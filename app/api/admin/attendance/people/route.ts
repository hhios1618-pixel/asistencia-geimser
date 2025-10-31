import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../../lib/supabase/server';
import type { Tables } from '../../../../../types/database';
import { runQuery } from '../../../../../lib/db/postgres';

const personSchema = z.object({
  name: z.string().min(3),
  rut: z.string().min(7).optional(),
  email: z.string().email().optional(),
  service: z.string().min(2).optional(),
  role: z.enum(['WORKER', 'ADMIN', 'SUPERVISOR', 'DT_VIEWER']).default('WORKER'),
  is_active: z.boolean().optional(),
  siteIds: z.array(z.string().uuid()).optional(),
  password: z.string().min(8).max(72).optional(),
});

const updateSchema = personSchema.partial().extend({ id: z.string().uuid() });

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

export const runtime = 'nodejs';

const generateTemporaryPassword = (): string => {
  let raw = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  while (raw.length < 10) {
    raw += randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }
  return `${raw.slice(0, 10)}Aa1`;
};

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user ?? null;
  if (!user) {
    return { supabase, user: null, role: null as Tables['people']['Row']['role'] | null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role =
    (user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isManager(role)) {
    return { supabase, user: null, role: null as Tables['people']['Row']['role'] | null } as const;
  }
  return { supabase, user, role } as const;
};

export async function GET() {
  const { user } = await authorize();
  if (!user) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { rows } = await runQuery<DbPersonRow>(
    `select p.*,
            coalesce(
              (
                select json_agg(json_build_object('site_id', ps.site_id))
                from public.people_sites ps
                where ps.person_id = p.id
              ),
              '[]'::json
            ) as people_sites
     from public.people p
     order by p.created_at`
  );
  return NextResponse.json({
    items: rows.map((row) => ({ ...row, people_sites: row.people_sites ?? [] })),
  });
}

export async function POST(request: NextRequest) {
  const { user } = await authorize();
  if (!user) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof personSchema>;
  try {
    payload = personSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  if (!payload.email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }

  const service = getServiceSupabase();
  const password = payload.password?.trim() || generateTemporaryPassword();

  const { data: createdAuth, error: authError } = await service.auth.admin.createUser({
    email: payload.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: payload.name,
      rut: payload.rut ?? null,
      service: payload.service ?? null,
    },
    app_metadata: {
      role: payload.role,
    },
  });

  if (authError || !createdAuth?.user) {
    return NextResponse.json({ error: 'AUTH_CREATE_FAILED', details: authError?.message }, { status: 500 });
  }

  const personId = createdAuth.user.id;

  try {
    await runQuery(
      `insert into public.people (id, name, rut, service, email, role, is_active)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        personId,
        payload.name,
        payload.rut ?? null,
        payload.service ?? null,
        payload.email ?? null,
        payload.role,
        payload.is_active ?? true,
      ]
    );
  } catch (error) {
    try {
      await service.auth.admin.deleteUser(personId);
    } catch {
      // ignore auth deletion errors in rollback
    }
    return NextResponse.json({ error: 'CREATE_FAILED', details: (error as Error).message }, { status: 500 });
  }

  if (payload.siteIds && payload.siteIds.length > 0) {
    try {
      await runQuery(
        `insert into public.people_sites (person_id, site_id, active)
         select $1, value, true from unnest($2::uuid[]) as value`,
        [personId, payload.siteIds]
      );
    } catch (error) {
      await service.from('people').delete().eq('id', personId);
      try {
        await service.auth.admin.deleteUser(personId);
      } catch {
        // ignore rollback failure
      }
      return NextResponse.json({ error: 'SITE_ASSIGNMENT_FAILED', details: (error as Error).message }, { status: 500 });
    }
  }

  const { rows } = await runQuery<DbPersonRow>(
    `select p.*,
            coalesce(
              (
                select json_agg(json_build_object('site_id', ps.site_id))
                from public.people_sites ps
                where ps.person_id = p.id
              ),
              '[]'::json
            ) as people_sites
     from public.people p
     where p.id = $1`,
    [personId]
  );
  const inserted = rows[0];

  return NextResponse.json(
    {
      item: {
        ...inserted,
        people_sites: inserted?.people_sites ?? [],
      },
      credentials: {
        email: payload.email,
        password,
      },
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const { user } = await authorize();
  if (!user) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_BODY', details: (error as Error).message }, { status: 400 });
  }

  const { id, siteIds, password, ...changes } = payload;
  const service = getServiceSupabase();

  const { rows: existingRows } = await runQuery<DbPersonRow>(
    `select p.*,
            coalesce(
              (
                select json_agg(json_build_object('site_id', ps.site_id))
                from public.people_sites ps
                where ps.person_id = p.id
              ),
              '[]'::json
            ) as people_sites
     from public.people p
     where p.id = $1`,
    [id]
  );
  const existingPerson = existingRows[0];

  if (!existingPerson) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const updateValues = changes as Tables['people']['Update'];

  let updatedPerson = existingPerson;

  if (Object.keys(updateValues).length > 0) {
    try {
      const columns = Object.keys(updateValues);
      const setters = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
      await runQuery(
        `update public.people set ${setters} where id = $1`,
        [id, ...columns.map((column) => (updateValues as Record<string, unknown>)[column])]
      );
      updatedPerson = { ...updatedPerson, ...updateValues } as DbPersonRow;
    } catch (error) {
      return NextResponse.json({ error: 'UPDATE_FAILED', details: (error as Error).message }, { status: 500 });
    }
  }

  if (siteIds) {
    try {
      await runQuery('delete from public.people_sites where person_id = $1', [id]);
      if (siteIds.length > 0) {
        await runQuery(
          `insert into public.people_sites (person_id, site_id, active)
           select $1, value, true from unnest($2::uuid[]) as value`,
          [id, siteIds]
        );
      }
      updatedPerson = {
        ...updatedPerson,
        people_sites: siteIds.map((siteId) => ({ site_id: siteId })),
      } as DbPersonRow;
    } catch (error) {
      return NextResponse.json({ error: 'SITE_ASSIGNMENT_FAILED', details: (error as Error).message }, { status: 500 });
    }
  }

  const authUpdates: Record<string, unknown> = {};

  if (typeof changes.email === 'string') {
    authUpdates.email = changes.email;
  }

  if (password && password.trim().length >= 8) {
    authUpdates.password = password;
  }

  const userMetadata: Record<string, unknown> = {};
  if (typeof changes.name === 'string') {
    userMetadata.name = changes.name;
  }
  if (typeof changes.rut === 'string') {
    userMetadata.rut = changes.rut;
  }
  if (typeof changes.service === 'string') {
    userMetadata.service = changes.service;
  }

  if (Object.keys(userMetadata).length > 0) {
    authUpdates.user_metadata = userMetadata;
  }

  if (typeof changes.role === 'string') {
    authUpdates.app_metadata = { role: changes.role };
  }

  if (Object.keys(authUpdates).length > 0) {
    const { error: authUpdateError } = await service.auth.admin.updateUserById(id, authUpdates);
    if (authUpdateError) {
      if (Object.keys(updateValues).length > 0) {
        await runQuery(
          `update public.people
           set name = $2, rut = $3, service = $4, email = $5, role = $6, is_active = $7
           where id = $1`,
          [
            id,
            existingPerson.name,
            existingPerson.rut,
            existingPerson.service,
            existingPerson.email,
            existingPerson.role,
            existingPerson.is_active,
          ]
        );
      }
      return NextResponse.json({ error: 'AUTH_UPDATE_FAILED', details: authUpdateError.message }, { status: 500 });
    }
  }

  const { rows: refreshedRows } = await runQuery<DbPersonRow>(
    `select p.*,
            coalesce(
              (
                select json_agg(json_build_object('site_id', ps.site_id))
                from public.people_sites ps
                where ps.person_id = p.id
              ),
              '[]'::json
            ) as people_sites
     from public.people p
     where p.id = $1`,
    [id]
  );
  const refreshed = refreshedRows[0];

  return NextResponse.json({ item: refreshed ?? updatedPerson, passwordReset: Boolean(password) });
}

export async function DELETE(request: NextRequest) {
  const { user } = await authorize();
  if (!user) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  }

  const service = getServiceSupabase();

  const authDeleteResult = await service.auth.admin.deleteUser(id);
  if (authDeleteResult.error && authDeleteResult.error.status !== 404) {
    return NextResponse.json(
      { error: 'AUTH_DELETE_FAILED', details: authDeleteResult.error.message },
      { status: 500 }
    );
  }

  await runQuery('delete from public.people_sites where person_id = $1', [id]);

  try {
    await runQuery('delete from public.people where id = $1', [id]);
  } catch (error) {
    return NextResponse.json({ error: 'DELETE_FAILED', details: (error as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
type DbPersonRow = Tables['people']['Row'] & { people_sites: { site_id: string }[] | null };
