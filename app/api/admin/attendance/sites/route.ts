import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../lib/supabase/server';
import { runQuery } from '../../../../../lib/db/postgres';
import type { Tables } from '../../../../../types/database';

const addressSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value ?? null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().min(3).max(255).or(z.null())
);

const siteSchema = z.object({
  name: z.string().trim().min(3),
  address: addressSchema.optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(0),
  is_active: z.boolean().optional(),
});

const siteUpdateSchema = siteSchema.partial().extend({ id: z.string().uuid() });

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const runtime = 'nodejs';

const ensureAddressColumn = async () => {
  await runQuery("alter table if exists public.sites add column if not exists address text");
};

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { person: null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isManager(role)) {
    return { person: null } as const;
  }
  return { person: { id: authData.user.id as string, role } } as const;
};

export async function GET() {
  const { person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  await ensureAddressColumn();
  const { rows } = await runQuery<Tables['sites']['Row']>('select * from public.sites order by created_at');
  const parsed = rows.map((row) => ({
    ...row,
    lat: typeof row.lat === 'number' ? row.lat : parseFloat(String(row.lat)),
    lng: typeof row.lng === 'number' ? row.lng : parseFloat(String(row.lng)),
  }));
  return NextResponse.json({ items: parsed });
}

export async function POST(request: NextRequest) {
  const { person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof siteSchema>;
  try {
    payload = siteSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  try {
    await ensureAddressColumn();
    const address = payload.address ?? null;
    const { rows } = await runQuery<Tables['sites']['Row']>(
      `insert into public.sites (name, address, lat, lng, radius_m, is_active)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        payload.name,
        address,
        payload.lat,
        payload.lng,
        payload.radius_m,
        payload.is_active ?? true,
      ]
    );

    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'CREATE_FAILED', details: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { person } = await authorize();
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
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined);

  try {
    await ensureAddressColumn();
    if (entries.length === 0) {
      const { rows } = await runQuery<Tables['sites']['Row']>('select * from public.sites where id = $1', [id]);
      return NextResponse.json({ item: rows[0] ?? null });
    }

    const setters = entries.map(([column], index) => `${column} = $${index + 2}`).join(', ');
    const params = [id, ...entries.map(([, value]) => value)];

    const { rows } = await runQuery<Tables['sites']['Row']>(
      `update public.sites set ${setters} where id = $1 returning *`,
      params
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: 'UPDATE_FAILED', details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { person } = await authorize();
  if (!person) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  }

  try {
    await runQuery('delete from public.people_sites where site_id = $1', [id]);
    await runQuery('delete from public.sites where id = $1', [id]);
  } catch (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: (error as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
