import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../../lib/supabase/server';
import type { Tables } from '../../../../../types/database';

const personSchema = z.object({
  name: z.string().min(3),
  rut: z.string().min(7).optional(),
  email: z.string().email().optional(),
  role: z.enum(['WORKER', 'ADMIN', 'SUPERVISOR', 'DT_VIEWER']).default('WORKER'),
  is_active: z.boolean().optional(),
  siteIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = personSchema.partial().extend({ id: z.string().uuid() });

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
  const { data, error } = await supabase.from('people').select('*, people_sites(site_id)').order('created_at');
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

  let payload: z.infer<typeof personSchema>;
  try {
    payload = personSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const insertValues: Tables['people']['Insert'] = {
    name: payload.name,
    rut: payload.rut ?? null,
    email: payload.email ?? null,
    role: payload.role,
    is_active: payload.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('people')
    .insert(insertValues as never)
    .select('*')
    .maybeSingle<Tables['people']['Row']>();

  if (error || !data) {
    return NextResponse.json({ error: 'CREATE_FAILED', details: error?.message }, { status: 500 });
  }

  if (payload.siteIds && payload.siteIds.length > 0) {
    const service = getServiceSupabase();
    const assignments = payload.siteIds.map((siteId) => ({ person_id: data.id, site_id: siteId, active: true }));
    const { error: siteLinkError } = await service.from('people_sites').insert(assignments as never);
    if (siteLinkError) {
      return NextResponse.json({ error: 'SITE_ASSIGNMENT_FAILED', details: siteLinkError.message }, { status: 500 });
    }
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

  const { id, siteIds, ...changes } = payload;

  const updateValues = changes as Tables['people']['Update'];

  const { data, error } = await supabase
    .from('people')
    .update(updateValues as never)
    .eq('id', id)
    .select('*')
    .maybeSingle<Tables['people']['Row']>();

  if (error || !data) {
    return NextResponse.json({ error: 'UPDATE_FAILED', details: error?.message }, { status: 500 });
  }

  if (siteIds) {
    const service = getServiceSupabase();
    await service.from('people_sites').delete().eq('person_id', id);
    if (siteIds.length > 0) {
      const assignments = siteIds.map((siteId) => ({ person_id: id, site_id: siteId, active: true }));
      const { error: assignError } = await service.from('people_sites').insert(assignments as never);
      if (assignError) {
        return NextResponse.json({ error: 'SITE_ASSIGNMENT_FAILED', details: assignError.message }, { status: 500 });
      }
    }
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
  const { error } = await supabase.from('people').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
