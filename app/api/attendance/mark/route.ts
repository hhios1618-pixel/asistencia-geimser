import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase';
import { ensureConsentVersion, GEO_CONSENT_VERSION } from '../../../../lib/privacy/consent';
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

export async function POST(request: NextRequest) {
  const supabase = createRouteSupabaseClient();
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
    .eq('id', authData.user.id)
    .single();

  if (personError || !person) {
    return respond(403, { error: 'PERSON_NOT_FOUND' });
  }

  if (!person.is_active) {
    return respond(403, { error: 'PERSON_INACTIVE' });
  }

  try {
    await ensureConsentVersion(supabase, person.id, 'GEO', GEO_CONSENT_VERSION);
  } catch (consentError) {
    return respond(409, { error: (consentError as Error).message });
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', body.siteId)
    .single();

  if (siteError || !site) {
    return respond(404, { error: 'SITE_NOT_ACCESSIBLE' });
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
    .maybeSingle();

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
    .insert(markInsert)
    .select('*')
    .single();

  if (insertError || !insertedMark) {
    return respond(500, { error: 'MARK_INSERT_FAILED', details: insertError?.message });
  }

  const serviceSupabase = getServiceSupabase();

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
    receipt_url: receiptUrl,
    hash: hashSelf,
  });
}
