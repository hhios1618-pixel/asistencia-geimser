import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import { writeAuditTrail } from '../../../../lib/audit/log';
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

export const runtime = 'nodejs';

const getActor = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { supabase, person: null } as const;
  }

  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle<Tables['people']['Row']>();

  return { supabase, person: person ?? null } as const;
};

export async function GET(request: NextRequest) {
  const { supabase, person } = await getActor();
  if (!person) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_PARAMS', details: (error as Error).message }, { status: 400 });
  }

  const query = supabase
    .from('attendance_modifications')
    .select('*, attendance_marks(*)')
    .order('created_at', { ascending: false })
    .limit(params.limit);

  if (!isManager(person.role)) {
    query.eq('requester_id', person.id);
  } else if (params.personId) {
    query.eq('requester_id', params.personId);
  }

  if (params.status) {
    query.eq('status', params.status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, person } = await getActor();
  if (!person) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let payload: z.infer<typeof modificationSchema>;
  try {
    payload = modificationSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { data: mark, error: markError } = await supabase
    .from('attendance_marks')
    .select('*')
    .eq('id', payload.markId)
    .maybeSingle<Tables['attendance_marks']['Row']>();

  if (markError || !mark) {
    return NextResponse.json({ error: 'MARK_NOT_FOUND' }, { status: 404 });
  }

  if (mark.person_id !== person.id && !isManager(person.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const modificationInsert: Tables['attendance_modifications']['Insert'] = {
    mark_id: payload.markId,
    requester_id: person.id,
    reason: payload.reason,
    requested_delta: payload.requestedDelta,
    status: 'PENDING',
  };

  const { data, error } = await supabase
    .from('attendance_modifications')
    .insert(modificationInsert as never)
    .select('*')
    .maybeSingle<Tables['attendance_modifications']['Row']>();

  if (error || !data) {
    return NextResponse.json({ error: 'CREATE_FAILED', details: error?.message }, { status: 500 });
  }

  const service = getServiceSupabase();
  await writeAuditTrail(service, {
    actorId: person.id,
    action: 'attendance.modification.requested',
    entity: 'attendance_modifications',
    entityId: data.id,
    after: data,
  }).catch(() => undefined);

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, person } = await getActor();
  if (!person) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  if (!isManager(person.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from('attendance_modifications')
    .select('*')
    .eq('id', payload.id)
    .maybeSingle<Tables['attendance_modifications']['Row']>();

  if (currentError || !current) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (current.status !== 'PENDING') {
    return NextResponse.json({ error: 'ALREADY_RESOLVED' }, { status: 409 });
  }

  const modificationUpdate: Tables['attendance_modifications']['Update'] = {
    status: payload.status,
    notes: payload.notes ?? null,
    resolver_id: person.id,
    resolved_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('attendance_modifications')
    .update(modificationUpdate as never)
    .eq('id', payload.id)
    .select('*')
    .maybeSingle<Tables['attendance_modifications']['Row']>();

  if (error || !data) {
    return NextResponse.json({ error: 'UPDATE_FAILED', details: error?.message }, { status: 500 });
  }

  const service = getServiceSupabase();
  await writeAuditTrail(service, {
    actorId: person.id,
    action: `attendance.modification.${payload.status.toLowerCase()}`,
    entity: 'attendance_modifications',
    entityId: payload.id,
    before: current,
    after: data,
  }).catch(() => undefined);

  return NextResponse.json({ item: data });
}
