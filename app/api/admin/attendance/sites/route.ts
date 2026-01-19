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
  z.string().min(3).max(500).or(z.null())
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

type TableTarget = { schema: 'public' | 'asistencia'; name: string; qualified: string };

type PgErrorLike = {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  constraint?: string;
};

const formatDbError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return 'unknown_db_error';
  }
  const err = error as PgErrorLike;
  const parts = [
    err.message?.trim(),
    err.code ? `code=${err.code}` : null,
    err.constraint ? `constraint=${err.constraint}` : null,
    err.detail ? `detail=${err.detail}` : null,
    err.hint ? `hint=${err.hint}` : null,
  ].filter((value): value is string => Boolean(value && value.length > 0));

  return parts.length > 0 ? parts.join(' | ') : 'unknown_db_error';
};

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

let sitesTarget: TableTarget | null = null;
const getSitesTarget = async () => {
  if (sitesTarget) {
    return sitesTarget;
  }
  sitesTarget = await resolveTableTarget('sites');
  return sitesTarget;
};

let peopleSitesTarget: TableTarget | null = null;
const getPeopleSitesTarget = async () => {
  if (peopleSitesTarget) {
    return peopleSitesTarget;
  }
  peopleSitesTarget = await resolveTableTarget('people_sites');
  return peopleSitesTarget;
};

let addressColumnEnsured = false;
let addressColumnAvailable: boolean | null = null;
const hasAddressColumn = async (target: TableTarget) => {
  const { rows } = await runQuery<{ exists: boolean }>(
    `select exists (
       select 1
       from information_schema.columns
       where table_schema = $1
         and table_name = $2
         and column_name = 'address'
     ) as exists`,
    [target.schema, target.name]
  );
  return Boolean(rows[0]?.exists);
};

const ensureAddressColumn = async () => {
  if (addressColumnEnsured) {
    return;
  }

  const sites = await getSitesTarget();
  try {
    if (await hasAddressColumn(sites)) {
      addressColumnAvailable = true;
      addressColumnEnsured = true;
      return;
    }
    await runQuery(`alter table if exists ${sites.qualified} add column if not exists address text`);
    addressColumnAvailable = await hasAddressColumn(sites);
    addressColumnEnsured = true;
  } catch (error) {
    console.warn('[sites] address column ensure failed', formatDbError(error));
    addressColumnAvailable = false;
    addressColumnEnsured = true;
  }
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
  const sites = await getSitesTarget();
  const { rows } = await runQuery<Tables['sites']['Row']>(`select * from ${sites.qualified} order by created_at`);
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
    const sites = await getSitesTarget();
    const address = payload.address ?? null;
    const addressEnabled = addressColumnAvailable ?? (await hasAddressColumn(sites));
    const { rows } = addressEnabled
      ? await runQuery<Tables['sites']['Row']>(
          `insert into ${sites.qualified} (name, address, lat, lng, radius_m, is_active)
           values ($1, $2, $3, $4, $5, $6)
           returning *`,
          [payload.name, address, payload.lat, payload.lng, payload.radius_m, payload.is_active ?? true]
        )
      : await runQuery<Tables['sites']['Row']>(
          `insert into ${sites.qualified} (name, lat, lng, radius_m, is_active)
           values ($1, $2, $3, $4, $5)
           returning *`,
          [payload.name, payload.lat, payload.lng, payload.radius_m, payload.is_active ?? true]
        );

    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'CREATE_FAILED', details: formatDbError(error) }, { status: 500 });
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
    const sites = await getSitesTarget();
    if (entries.length === 0) {
      const { rows } = await runQuery<Tables['sites']['Row']>(`select * from ${sites.qualified} where id = $1`, [id]);
      return NextResponse.json({ item: rows[0] ?? null });
    }

    const setters = entries.map(([column], index) => `${column} = $${index + 2}`).join(', ');
    const params = [id, ...entries.map(([, value]) => value)];

    const { rows } = await runQuery<Tables['sites']['Row']>(`update ${sites.qualified} set ${setters} where id = $1 returning *`, params);

    if (!rows[0]) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ item: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: 'UPDATE_FAILED', details: formatDbError(error) }, { status: 500 });
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
    const peopleSites = await getPeopleSitesTarget();
    const sites = await getSitesTarget();
    await runQuery(`delete from ${peopleSites.qualified} where site_id = $1`, [id]);
    await runQuery(`delete from ${sites.qualified} where id = $1`, [id]);
  } catch (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: formatDbError(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
