import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import { writeAuditTrail } from '../../../../lib/audit/log';
import { runQuery } from '../../../../lib/db/postgres';
import type { Tables } from '../../../../types/database';

const modificationSchema = z.object({
  markId: z.string().uuid(),
  reason: z.string().min(5).max(500),
  requestedDelta: z.string().regex(/^[-+]?P.*$/, { message: 'Intervalo debe ser ISO8601' }),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(500).optional(),
});

const querySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  personId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
});

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

type ModificationWithMark = Tables['attendance_modifications']['Row'] & {
  attendance_marks: Tables['attendance_marks']['Row'] | null;
};

export const runtime = 'nodejs';

const selectModificationWithMarkById = async (id: string) => {
  const { rows } = await runQuery<ModificationWithMark>(
    `select m.*, row_to_json(am) as attendance_marks
     from asistencia.attendance_modifications m
     left join asistencia.attendance_marks am on am.id = m.mark_id
     where m.id = $1`,
    [id]
  );
  return rows[0] ?? null;
};

const getActor = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return {
      userId: null as string | null,
      person: null as Tables['people']['Row'] | null,
      role: null as Tables['people']['Row']['role'] | null,
    } as const;
  }

  const userId = authData.user.id as string;
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'WORKER';
  const fallbackRole =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;

  let person: Tables['people']['Row'] | null = null;
  try {
    const { rows } = await runQuery<Tables['people']['Row']>(
      'select * from asistencia.people where id = $1',
      [userId]
    );
    person = rows[0] ?? null;
  } catch (error) {
    console.warn('[attendance_modifications] person lookup failed', error);
  }

  return {
    userId,
    person,
    role: person?.role ?? fallbackRole,
  } as const;
};

export async function GET(request: NextRequest) {
  const { userId, role } = await getActor();
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_PARAMS', details: (error as Error).message }, { status: 400 });
  }

  const filters: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (!isManager(role ?? 'WORKER')) {
    filters.push(`m.requester_id = $${index++}`);
    values.push(userId);
  } else if (params.personId) {
    filters.push(`m.requester_id = $${index++}`);
    values.push(params.personId);
  }

  if (params.status) {
    filters.push(`m.status = $${index++}`);
    values.push(params.status);
  }

  const whereClause = filters.length > 0 ? `where ${filters.join(' and ')}` : '';
  const limitIndex = index;
  values.push(params.limit);

  const { rows } = await runQuery<ModificationWithMark>(
    `select m.*, row_to_json(am) as attendance_marks
     from asistencia.attendance_modifications m
     left join asistencia.attendance_marks am on am.id = m.mark_id
     ${whereClause}
     order by m.created_at desc
     limit $${limitIndex}`,
    values
  );

  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { userId, role } = await getActor();
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let payload: z.infer<typeof modificationSchema>;
  try {
    payload = modificationSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { rows: markRows } = await runQuery<Tables['attendance_marks']['Row']>(
    'select * from asistencia.attendance_marks where id = $1',
    [payload.markId]
  );
  const mark = markRows[0] ?? null;

  if (!mark) {
    return NextResponse.json({ error: 'MARK_NOT_FOUND' }, { status: 404 });
  }

  if (mark.person_id !== userId && !isManager(role ?? 'WORKER')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { rows: insertRows } = await runQuery<Tables['attendance_modifications']['Row']>(
    `insert into asistencia.attendance_modifications (mark_id, requester_id, reason, requested_delta, status)
     values ($1, $2, $3, $4, 'PENDING')
     returning *`,
    [payload.markId, userId, payload.reason, payload.requestedDelta]
  );

  const inserted = insertRows[0];
  if (!inserted) {
    return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }

  const detailed = (await selectModificationWithMarkById(inserted.id)) ?? {
    ...inserted,
    attendance_marks: mark,
  };

  const service = getServiceSupabase();
  await writeAuditTrail(service, {
    actorId: userId,
    action: 'attendance.modification.requested',
    entity: 'attendance_modifications',
    entityId: inserted.id,
    after: detailed,
  }).catch(() => undefined);

  return NextResponse.json({ item: detailed }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { userId, role } = await getActor();
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  if (!isManager(role ?? 'WORKER')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const current = await selectModificationWithMarkById(payload.id);
  if (!current) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (current.status !== 'PENDING') {
    return NextResponse.json({ error: 'ALREADY_RESOLVED' }, { status: 409 });
  }

  const resolvedAt = new Date().toISOString();

  const { rows: updateRows } = await runQuery<Tables['attendance_modifications']['Row']>(
    `update asistencia.attendance_modifications
     set status = $2, notes = $3, resolver_id = $4, resolved_at = $5
     where id = $1
     returning *`,
    [payload.id, payload.status, payload.notes ?? null, userId, resolvedAt]
  );

  if (!updateRows[0]) {
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }

  const updated = (await selectModificationWithMarkById(payload.id)) ?? {
    ...updateRows[0],
    attendance_marks: current.attendance_marks,
  };

  const service = getServiceSupabase();
  await writeAuditTrail(service, {
    actorId: userId,
    action: `attendance.modification.${payload.status.toLowerCase()}`,
    entity: 'attendance_modifications',
    entityId: payload.id,
    before: current,
    after: updated,
  }).catch(() => undefined);

  return NextResponse.json({ item: updated });
}

