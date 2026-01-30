import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../lib/supabase/server';
import type { Tables, TableInsert, TableUpdate } from '../../../../types/database';
import type { PostgrestError } from '@supabase/supabase-js';
import { ensurePeopleServiceColumn } from '../../../../lib/db/ensurePeopleServiceColumn';
import { getUserDisplayName } from '../../../../lib/auth/displayName';

const REQUEST_TYPES = ['TIME_OFF', 'SHIFT_CHANGE', 'PERMISSION'] as const;
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

type RequestStatus = (typeof STATUSES)[number];

const respond = (status: number, payload: unknown) =>
  new NextResponse(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isSupervisorRole = (role: Tables['people']['Row']['role']) => role === 'SUPERVISOR' || role === 'ADMIN';
const isElevatedRole = (role: Tables['people']['Row']['role']) => role === 'ADMIN';

const ensurePersonProfile = async (userId: string, email?: string | null) => {
  const service = getServiceSupabase();
  const { data: personRow, error: personError } = await service
    .from('people')
    .select('*')
    .eq('id', userId)
    .maybeSingle<Tables['people']['Row']>();

  if (personError) {
    throw personError;
  }

  if (personRow) {
    return personRow;
  }

  const fallbackName = getUserDisplayName({ email });
  const defaultRole =
    (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'WORKER';

  const provisionPayload: Tables['people']['Insert'] = {
    id: userId,
    name: fallbackName.trim(),
    email: email ?? null,
    role: defaultRole,
    is_active: true,
  };

  const { data: provisioned, error: provisionError } = await service
    .from('people')
    .upsert<Tables['people']['Insert']>(provisionPayload, { onConflict: 'id' })
    .select('*')
    .maybeSingle<Tables['people']['Row']>();

  if (provisionError || !provisioned) {
    throw provisionError ?? new Error('Provision failed');
  }

  return provisioned;
};

const supervisorOptionsForMember = async (memberId: string) => {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('team_assignments')
    .select('supervisor_id')
    .eq('member_id', memberId)
    .eq('active', true);

  if (error) {
    if ((error as PostgrestError | null)?.code === 'PGRST106') {
      return [];
    }
    throw error;
  }

  const supervisorIds = Array.from(new Set((data ?? []).map((row) => row.supervisor_id))).filter(Boolean);
  if (supervisorIds.length === 0) {
    return [] as { id: string; name: string; email: string | null }[];
  }

  const { data: supervisors, error: peopleError } = await service
    .from('people')
    .select('id, name, email')
    .in('id', supervisorIds);

  if (peopleError) {
    throw peopleError;
  }

  return (supervisors ?? []) as { id: string; name: string; email: string | null }[];
};

const teamMembersForSupervisor = async (supervisorId: string) => {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('team_assignments')
    .select('member_id')
    .eq('supervisor_id', supervisorId)
    .eq('active', true);

  if (error) {
    if ((error as PostgrestError | null)?.code === 'PGRST106') {
      return [];
    }
    throw error;
  }

  const memberIds = Array.from(new Set((data ?? []).map((row) => row.member_id))).filter(Boolean);
  if (memberIds.length === 0) {
    return [] as {
      id: string;
      name: string;
      email: string | null;
      role: Tables['people']['Row']['role'];
    }[];
  }

  const { data: members, error: memberError } = await service
    .from('people')
    .select('id, name, email, role, service')
    .in('id', memberIds);

  if (memberError) {
    throw memberError;
  }

  return (members ?? []) as {
    id: string;
    name: string;
    email: string | null;
    role: Tables['people']['Row']['role'];
    service: string | null;
  }[];
};

const selectClause =
  'id, requester_id, supervisor_id, request_type, status, requested_start, requested_end, payload, reason, supervisor_note, decided_at, created_at, requester:people!attendance_requests_requester_id_fkey(id,name,email,role,service), supervisor:people!attendance_requests_supervisor_id_fkey(id,name,email,role,service)';

const querySchema = z.object({
  scope: z.enum(['mine', 'team']).optional(),
  status: z.enum(STATUSES).optional(),
  limit: z.coerce.number().min(1).max(200).default(100),
});

export async function GET(request: NextRequest) {
  try {
    try {
      await ensurePeopleServiceColumn();
    } catch (ensureError) {
      console.error('[attendance_requests] ensure service column failed', ensureError);
      return respond(500, {
        error: 'SERVICE_COLUMN_MISSING',
        message: 'No fue posible preparar la columna "service" en la tabla de personas. Ejecuta la última migración e inténtalo nuevamente.',
      });
    }

    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return respond(401, { error: 'UNAUTHENTICATED' });
    }

    let params: z.infer<typeof querySchema>;
    try {
      params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    } catch (parseError) {
      return respond(400, { error: 'INVALID_PARAMS', details: (parseError as Error).message });
    }

    const person = await ensurePersonProfile(user.id, user.email);
    const scope =
      params.scope === 'team' && isSupervisorRole(person.role) ? ('team' as const) : ('mine' as const);
    const filterColumn = scope === 'team' ? 'supervisor_id' : 'requester_id';

    const service = getServiceSupabase();
    let query = service
      .from('attendance_requests')
      .select(selectClause)
      .eq(filterColumn, person.id)
      .order('created_at', { ascending: false })
      .limit(params.limit);

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[attendance_requests] fetch failed', error);
      return respond(500, { error: 'REQUESTS_FETCH_FAILED' });
    }

    const payload: Record<string, unknown> = {
      items: data ?? [],
      scope,
      actor: {
        id: person.id,
        role: person.role,
      },
    };

    if (scope === 'mine') {
      try {
        payload.supervisors = await supervisorOptionsForMember(person.id);
      } catch (supervisorError) {
        console.warn('[attendance_requests] supervisor lookup failed', supervisorError);
        payload.supervisors = [];
      }
    } else {
      try {
        payload.teamMembers = await teamMembersForSupervisor(person.id);
      } catch (teamError) {
        console.warn('[attendance_requests] team lookup failed', teamError);
        payload.teamMembers = [];
      }
    }

    return NextResponse.json(payload);
  } catch (unexpected) {
    console.error('[attendance_requests] unexpected error', unexpected);
    return respond(500, { error: 'UNEXPECTED' });
  }
}

const createSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  reason: z.string().min(3).max(2000),
  requestedStart: z.string().datetime({ offset: true }).nullable().optional(),
  requestedEnd: z.string().datetime({ offset: true }).nullable().optional(),
  supervisorId: z.string().uuid().optional(),
  payload: z
    .record(z.string(), z.any())
    .optional()
    .transform((value) => value ?? {}),
});

export async function POST(request: NextRequest) {
  try {
    try {
      await ensurePeopleServiceColumn();
    } catch (ensureError) {
      console.error('[attendance_requests] ensure service column failed', ensureError);
      return respond(500, {
        error: 'SERVICE_COLUMN_MISSING',
        message: 'No fue posible preparar la columna "service" en la tabla de personas. Ejecuta la última migración e inténtalo nuevamente.',
      });
    }

    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return respond(401, { error: 'UNAUTHENTICATED' });
    }

    let body: z.infer<typeof createSchema>;
    try {
      body = createSchema.parse(await request.json());
    } catch (parseError) {
      return respond(400, { error: 'INVALID_BODY', details: (parseError as Error).message });
    }

    const person = await ensurePersonProfile(user.id, user.email);

    const supervisorOptions = await supervisorOptionsForMember(person.id);

    if (supervisorOptions.length === 0 && !body.supervisorId) {
      return respond(409, { error: 'SUPERVISOR_REQUIRED', message: 'No hay supervisor asignado. Contacta a tu administrador.' });
    }

    let supervisorId = body.supervisorId ?? null;

    if (supervisorId) {
      const isValid = supervisorOptions.some((option) => option.id === supervisorId);
      if (!isValid) {
        return respond(403, { error: 'SUPERVISOR_INVALID' });
      }
    } else if (supervisorOptions.length === 1) {
      supervisorId = supervisorOptions[0]!.id;
    } else {
      return respond(409, { error: 'SUPERVISOR_REQUIRED', message: 'Selecciona un supervisor para tu solicitud.' });
    }

    if (body.requestedStart && body.requestedEnd) {
      if (new Date(body.requestedStart).getTime() > new Date(body.requestedEnd).getTime()) {
        return respond(400, { error: 'INVALID_RANGE', message: 'El término debe ser posterior al inicio.' });
      }
    }

    const service = getServiceSupabase();
    const insertPayload: TableInsert<'attendance_requests'> = {
      requester_id: person.id,
      supervisor_id: supervisorId!,
      request_type: body.requestType,
      reason: body.reason,
      requested_start: body.requestedStart ?? null,
      requested_end: body.requestedEnd ?? null,
      payload: body.payload as Tables['attendance_requests']['Row']['payload'],
      status: 'PENDING',
    };

    const { data, error } = await service
      .from('attendance_requests')
      .insert(insertPayload as never)
      .select(selectClause)
      .maybeSingle();

    if (error || !data) {
      console.error('[attendance_requests] insert failed', error);
      return respond(500, { error: 'REQUEST_CREATE_FAILED' });
    }

    return respond(201, data);
  } catch (unexpected) {
    console.error('[attendance_requests] unexpected error', unexpected);
    return respond(500, { error: 'UNEXPECTED' });
  }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT', 'CANCEL']),
  note: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    try {
      await ensurePeopleServiceColumn();
    } catch (ensureError) {
      console.error('[attendance_requests] ensure service column failed', ensureError);
      return respond(500, {
        error: 'SERVICE_COLUMN_MISSING',
        message: 'No fue posible preparar la columna "service" en la tabla de personas. Ejecuta la última migración e inténtalo nuevamente.',
      });
    }

    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return respond(401, { error: 'UNAUTHENTICATED' });
    }

    let body: z.infer<typeof updateSchema>;
    try {
      body = updateSchema.parse(await request.json());
    } catch (parseError) {
      return respond(400, { error: 'INVALID_BODY', details: (parseError as Error).message });
    }

    const person = await ensurePersonProfile(user.id, user.email);
    const service = getServiceSupabase();

    const { data: existing, error: existingError } = await service
      .from('attendance_requests')
      .select('*')
      .eq('id', body.id)
      .maybeSingle<Tables['attendance_requests']['Row']>();

    if (existingError) {
      console.error('[attendance_requests] lookup failed', existingError);
      return respond(500, { error: 'REQUEST_LOOKUP_FAILED' });
    }

    if (!existing) {
      return respond(404, { error: 'NOT_FOUND' });
    }

    if (existing.status !== 'PENDING' && body.action !== 'CANCEL') {
      return respond(409, { error: 'ALREADY_DECIDED' });
    }

    if (body.action === 'CANCEL') {
      if (existing.requester_id !== person.id && !isElevatedRole(person.role)) {
        return respond(403, { error: 'FORBIDDEN' });
      }
    } else if (existing.supervisor_id !== person.id && !isElevatedRole(person.role)) {
      return respond(403, { error: 'FORBIDDEN' });
    }

    let nextStatus: RequestStatus;
    if (body.action === 'APPROVE') {
      nextStatus = 'APPROVED';
    } else if (body.action === 'REJECT') {
      nextStatus = 'REJECTED';
    } else {
      nextStatus = 'CANCELLED';
    }

    const updatePayload: TableUpdate<'attendance_requests'> = {
      status: nextStatus,
      decided_at: new Date().toISOString(),
    };

    if (body.action !== 'CANCEL') {
      updatePayload.supervisor_note = body.note ?? null;
    }

    const { data, error } = await service
      .from('attendance_requests')
      .update(updatePayload as never)
      .eq('id', body.id)
      .select(selectClause)
      .maybeSingle();

    if (error || !data) {
      console.error('[attendance_requests] update failed', error);
      return respond(500, { error: 'REQUEST_UPDATE_FAILED' });
    }

    return NextResponse.json(data);
  } catch (unexpected) {
    console.error('[attendance_requests] unexpected error', unexpected);
    return respond(500, { error: 'UNEXPECTED' });
  }
}
