import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import { ensureConsentVersion, GEO_CONSENT_VERSION } from '../../../../lib/privacy/consent';
import { runQuery } from '../../../../lib/db/postgres';
import { getGeofenceStatus } from '../../../../lib/geo/geofence';
import { computeHash } from '../../../../lib/dt/hashchain';
import { generateAndStoreReceipt } from '../../../../lib/dt/receipts';
import { evaluateAlerts, buildAlertRecords } from '../../../../lib/alerts/rules';
import { writeAuditTrail } from '../../../../lib/audit/log';
import type { Tables, TableInsert } from '../../../../types/database';

export const runtime = 'nodejs';

const bodySchema = z.object({
  eventType: z.enum(['IN', 'OUT']),
  siteId: z.string().uuid(),
  clientTs: z.string().datetime({ offset: true }).optional(),
  consent: z
    .object({
      geoAcceptedVersion: z.string().trim().min(1).max(50).optional(),
    })
    .optional(),
  geo: z
    .object({
      lat: z.number(),
      lng: z.number(),
      acc: z.number().optional(),
    })
    .optional(),
  deviceId: z.string().min(3).max(255),
  note: z.string().max(500).optional(),
});

const respond = (status: number, payload: unknown) =>
  new NextResponse(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type TableTarget = { schema: 'public' | 'asistencia'; name: string; qualified: string };

const resolveTableTarget = async (name: string): Promise<TableTarget> => {
  const { rows } = await runQuery<{ table_schema: 'public' | 'asistencia'; table_type: string }>(
    `select table_schema, table_type
     from information_schema.tables
     where table_name = $1
       and table_schema in ('public', 'asistencia')
     order by case when table_schema = 'public' then 0 else 1 end`,
    [name]
  );

  const base = rows.find((row) => row.table_type === 'BASE TABLE');
  const first = rows[0];
  const schema = (base?.table_schema ?? first?.table_schema ?? 'public') as TableTarget['schema'];
  return { schema, name, qualified: `${schema}.${name}` };
};

let consentTarget: TableTarget | null = null;
const getConsentTarget = async () => {
  if (consentTarget) {
    return consentTarget;
  }
  consentTarget = await resolveTableTarget('consent_logs');
  return consentTarget;
};

const recordGeoConsent = async (params: {
  personId: string;
  version: string;
  ip: string | null;
  userAgent: string | null;
}) => {
  const target = await getConsentTarget();
  await runQuery(
    `insert into ${target.qualified} (person_id, consent_type, version, ip, user_agent)
     values ($1, 'GEO', $2, $3, $4)
     on conflict (person_id, consent_type, version) do nothing`,
    [params.personId, params.version, params.ip, params.userAgent]
  );
};

export async function POST(request: NextRequest) {
  const supabase = await createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return respond(401, { error: 'UNAUTHENTICATED' });
  }


  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (parseError) {
    return respond(400, { error: 'INVALID_BODY', details: (parseError as Error).message });
  }

  const { data: person, error: personError } = await supabase
    .from('people')
    .select('*')
    .eq('id', authData.user.id as string)
    .maybeSingle<Tables['people']['Row']>();

  if (personError || !person) {
    return respond(403, { error: 'PERSON_NOT_FOUND' });
  }

  if (!person.is_active) {
    return respond(403, { error: 'PERSON_INACTIVE' });
  }

  const isManager = person.role === 'ADMIN' || person.role === 'SUPERVISOR';

  try {
    await ensureConsentVersion(supabase, person.id, 'GEO', GEO_CONSENT_VERSION);
  } catch (consentError) {
    const message = (consentError as Error).message;
    if (message !== 'CONSENT_GEO_MISSING') {
      return respond(409, { error: message });
    }

    const acceptedVersion = body.consent?.geoAcceptedVersion;
    if (acceptedVersion !== GEO_CONSENT_VERSION) {
      return respond(409, { error: message, requiredVersion: GEO_CONSENT_VERSION });
    }

    try {
      await recordGeoConsent({
        personId: person.id,
        version: GEO_CONSENT_VERSION,
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      });
    } catch (recordError) {
      return respond(500, { error: 'CONSENT_RECORD_FAILED', details: (recordError as Error).message });
    }
  }

  const serviceSupabase = getServiceSupabase();

  const { data: site, error: siteError } = await serviceSupabase
    .from('sites')
    .select('*')
    .eq('id', body.siteId)
    .maybeSingle<Tables['sites']['Row']>();

  if (siteError || !site) {
    return respond(404, { error: 'SITE_NOT_ACCESSIBLE' });
  }

  if (!isManager) {
    const { data: assignment, error: assignmentError } = await serviceSupabase
      .from('people_sites')
      .select('active')
      .eq('person_id', person.id)
      .eq('site_id', body.siteId)
      .maybeSingle<{ active: boolean }>();

    if (assignmentError && assignmentError.code !== 'PGRST116') {
      return respond(500, { error: 'ASSIGNMENT_LOOKUP_FAILED', details: assignmentError.message });
    }

    if (!assignment?.active) {
      return respond(404, { error: 'SITE_NOT_ACCESSIBLE' });
    }
  }

  if (site.is_active === false) {
    return respond(403, { error: 'SITE_INACTIVE' });
  }

  if (site.radius_m > 0) {
    if (!body.geo) {
      return respond(422, { error: 'GEO_REQUIRED' });
    }
    const geofence = getGeofenceStatus({
      site: { lat: site.lat, lng: site.lng },
      point: { lat: body.geo.lat, lng: body.geo.lng },
      radius: site.radius_m,
    });

    if (geofence.status === 'fail') {
      return respond(422, { error: 'OUTSIDE_GEOFENCE', details: geofence });
    }
  }

  const { data: prevMark } = await supabase
    .from('attendance_marks')
    .select('*')
    .eq('person_id', person.id)
    .order('event_ts', { ascending: false })
    .limit(1)
    .maybeSingle<Tables['attendance_marks']['Row']>();

  const prevHash = prevMark?.hash_self ?? null;
  const markId = randomUUID();
  const eventTs = new Date().toISOString();

  const payload = {
    personId: person.id,
    siteId: site.id,
    eventType: body.eventType,
    eventTs,
    clientTs: body.clientTs,
    geo: body.geo
      ? {
          lat: body.geo.lat,
          lng: body.geo.lng,
          acc: body.geo.acc,
        }
      : undefined,
    deviceId: body.deviceId,
    note: body.note,
  } as const;

  const hashSelf = computeHash(payload, prevHash);
  const storagePath = `marks/${person.id}/${markId}.pdf`;

  const markInsert: TableInsert<'attendance_marks'> = {
    id: markId,
    person_id: person.id,
    site_id: site.id,
    event_type: body.eventType,
    event_ts: eventTs,
    geo_lat: body.geo?.lat ?? null,
    geo_lng: body.geo?.lng ?? null,
    geo_acc: body.geo?.acc ?? null,
    device_id: body.deviceId,
    client_ts: body.clientTs ?? null,
    note: body.note ?? null,
    hash_prev: prevHash,
    hash_self: hashSelf,
    receipt_url: storagePath,
  };

  const { error: insertError, data: insertedMark } = await supabase
    .from('attendance_marks')
    .insert(markInsert as never)
    .select('*')
    .maybeSingle<Tables['attendance_marks']['Row']>();

  if (insertError || !insertedMark) {
    return respond(500, { error: 'MARK_INSERT_FAILED', details: insertError?.message });
  }

  const receiptUrl = await generateAndStoreReceipt(
    {
      mark: insertedMark as Tables['attendance_marks']['Row'],
      person: person as Tables['people']['Row'],
      site: site as Tables['sites']['Row'],
      hashChain: {
        prev: prevHash,
        self: hashSelf,
      },
    },
    { storagePath }
  );

  const markDate = eventTs.substring(0, 10);
  const { data: sameDayMarks, error: sameDayError } = await serviceSupabase
    .from('attendance_marks')
    .select('*')
    .eq('person_id', person.id)
    .gte('event_ts', `${markDate}T00:00:00Z`)
    .lte('event_ts', `${markDate}T23:59:59Z`)
    .order('event_ts', { ascending: true });

  if (sameDayError) {
    await writeAuditTrail(serviceSupabase, {
      actorId: person.id,
      action: 'attendance.alerts.failed_fetch',
      entity: 'attendance_marks',
      entityId: markId,
      before: null,
      after: { error: sameDayError.message },
    }).catch(() => undefined);
  }

  const { data: schedule, error: scheduleError } = await serviceSupabase
    .from('schedules')
    .select('*')
    .eq('person_id', person.id)
    .eq('day_of_week', new Date(eventTs).getDay())
    .maybeSingle();

  if (scheduleError && scheduleError.code !== 'PGRST116') {
    await writeAuditTrail(serviceSupabase, {
      actorId: person.id,
      action: 'attendance.alerts.schedule_lookup_failed',
      entity: 'schedules',
      entityId: person.id,
      before: null,
      after: { error: scheduleError.message },
    }).catch(() => undefined);
  }

  const alerts = evaluateAlerts({
    mark: insertedMark as Tables['attendance_marks']['Row'],
    previousMark: prevMark ? (prevMark as Tables['attendance_marks']['Row']) : null,
    sameDayMarks: sameDayMarks ?? [],
    activeSchedule: schedule ?? null,
  });

  if (alerts.length > 0) {
    await serviceSupabase
      .from('alerts')
      .insert(buildAlertRecords(person.id, alerts) as never);
  }

  await writeAuditTrail(serviceSupabase, {
    actorId: person.id,
    action: 'attendance.mark',
    entity: 'attendance_marks',
    entityId: markId,
    after: {
      id: markId,
      event_type: body.eventType,
      event_ts: eventTs,
      site_id: site.id,
      person_id: person.id,
      hash_self: hashSelf,
    },
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return respond(201, {
    id: markId,
    event_ts: eventTs,
    event_type: body.eventType,
    site_id: site.id,
    receipt_url: receiptUrl,
    hash: hashSelf,
  });
}
