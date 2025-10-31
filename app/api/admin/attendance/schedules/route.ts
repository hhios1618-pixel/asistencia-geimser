import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../lib/supabase/server';
import { runQuery } from '../../../../../lib/db/postgres';
import type { Tables } from '../../../../../types/database';

const scheduleSchema = z.object({
  person_id: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  break_minutes: z.number().int().min(0).default(60),
});

const updateSchema = scheduleSchema.partial().extend({ id: z.string().uuid() });

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const runtime = 'nodejs';

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { userId: null as string | null, role: null as Tables['people']['Row']['role'] | null } as const;
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const fallbackRole =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;

  let role = fallbackRole;
  try {
    const { rows } = await runQuery<Pick<Tables['people']['Row'], 'role'>>(
      'select role from public.people where id = $1',
      [authData.user.id as string]
    );
    if (rows[0]?.role) {
      role = rows[0].role;
    }
  } catch (error) {
    console.warn('[schedules] role lookup failed', error);
  }

  if (!isManager(role)) {
    return { userId: authData.user.id as string, role: null } as const;
  }
  return { userId: authData.user.id as string, role } as const;
};

export async function GET(request: NextRequest) {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const personId = request.nextUrl.searchParams.get('personId');

  const filters: string[] = [];
  const params: unknown[] = [];
  if (personId) {
    filters.push('person_id = $1');
    params.push(personId);
  }
  const whereClause = filters.length > 0 ? ` where ${filters.join(' and ')}` : '';
  const { rows } = await runQuery<Tables['schedules']['Row']>(
    `select * from public.schedules${whereClause} order by day_of_week, start_time`,
    params
  );

  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof scheduleSchema>;
  try {
    payload = scheduleSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { rows } = await runQuery<Tables['schedules']['Row']>(
    `insert into public.schedules (person_id, group_id, day_of_week, start_time, end_time, break_minutes)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      payload.person_id ?? null,
      payload.group_id ?? null,
      payload.day_of_week,
      payload.start_time,
      payload.end_time,
      payload.break_minutes,
    ]
  );

  return NextResponse.json({ item: rows[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { id, ...changes } = payload;

  if (Object.keys(changes).length === 0) {
    const { rows } = await runQuery<Tables['schedules']['Row']>(
      'select * from public.schedules where id = $1',
      [id]
    );
    return NextResponse.json({ item: rows[0] ?? null });
  }

  const columns = Object.keys(changes);
  const setters = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
  const params = [id, ...columns.map((column) => (changes as Record<string, unknown>)[column])];

  const { rows } = await runQuery<Tables['schedules']['Row']>(
    `update public.schedules set ${setters} where id = $1 returning *`,
    params
  );

  if (!rows[0]) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ item: rows[0] });
}

export async function DELETE(request: NextRequest) {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  }

  try {
    await runQuery('delete from public.schedules where id = $1', [id]);
  } catch (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: (error as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
