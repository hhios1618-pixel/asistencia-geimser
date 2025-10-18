import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../lib/supabase/server';
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
    return { supabase, person: null } as const;
  }
  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle<Tables['people']['Row']>();
  if (!person || !isManager(person.role)) {
    return { supabase, person: null } as const;
  }
  return { supabase, person } as const;
};

export async function GET(request: NextRequest) {
  const { supabase, person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const personId = request.nextUrl.searchParams.get('personId');

  const query = supabase.from('schedules').select('*').order('day_of_week');
  if (personId) {
    query.eq('person_id', personId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof scheduleSchema>;
  try {
    payload = scheduleSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('schedules')
    .insert(payload as never)
    .select('*')
    .maybeSingle<Tables['schedules']['Row']>();

  if (error || !data) {
    return NextResponse.json({ error: 'CREATE_FAILED', details: error?.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { id, ...changes } = payload;

  const { data, error } = await supabase
    .from('schedules')
    .update(changes as Tables['schedules']['Update'] as never)
    .eq('id', id)
    .select('*')
    .maybeSingle<Tables['schedules']['Row']>();

  if (error || !data) {
    return NextResponse.json({ error: 'UPDATE_FAILED', details: error?.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(request: NextRequest) {
  const { supabase, person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  }

  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
