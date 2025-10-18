import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../lib/supabase/server';
import type { Tables } from '../../../../../types/database';

const siteSchema = z.object({
  name: z.string().min(3),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(0),
  is_active: z.boolean().optional(),
});

const siteUpdateSchema = siteSchema.partial().extend({ id: z.string().uuid() });

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

export async function GET() {
  const { supabase, person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { data, error } = await supabase.from('sites').select('*').order('created_at', { ascending: true });
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

  let payload: z.infer<typeof siteSchema>;
  try {
    payload = siteSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const insertValues: Tables['sites']['Insert'] = { ...payload, is_active: payload.is_active ?? true };

  const { data, error } = await supabase
    .from('sites')
    .insert(insertValues as never)
    .select('*')
    .maybeSingle<Tables['sites']['Row']>();

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

  let payload: z.infer<typeof siteUpdateSchema>;
  try {
    payload = siteUpdateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { id, ...changes } = payload;

  const { data, error } = await supabase
    .from('sites')
    .update(changes as Tables['sites']['Update'] as never)
    .eq('id', id)
    .select('*')
    .maybeSingle<Tables['sites']['Row']>();

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

  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
