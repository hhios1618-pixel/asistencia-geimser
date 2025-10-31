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
  supervisorIds: z.array(z.string().uuid()).optional(),
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

const normalizeService = (service?: string | null) => {
  if (!service) {
    return null;
  }
  const trimmed = service.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureSupervisorsEligible = async (
  supervisorIds: string[],
  service: string | null
): Promise<Array<Pick<Tables['people']['Row'], 'id' | 'name' | 'email' | 'service' | 'role' | 'is_active'>>> => {
  if (supervisorIds.length === 0) {
    return [];
  }

  let rows: Pick<Tables['people']['Row'], 'id' | 'name' | 'email' | 'role' | 'service' | 'is_active'>[] = [];
  try {
    const result = await runQuery<Pick<Tables['people']['Row'], 'id' | 'name' | 'email' | 'role' | 'service' | 'is_active'>>(
      `select id, name, email, role, service, is_active
       from public.people
       where id = any($1::uuid[])`,
      [supervisorIds]
    );
    rows = result.rows;
  } catch (error) {
    if (isMissingTeamAssignments(error)) {
      return [];
    }
    throw error;
  }

  if (rows.length !== supervisorIds.length) {
    throw new Error('SUPERVISOR_NOT_FOUND');
  }

  const invalidRole = rows.find((row) => row.role !== 'SUPERVISOR');
  if (invalidRole) {
    throw new Error('INVALID_SUPERVISOR_ROLE');
  }

  const inactive = rows.find((row) => !row.is_active);
  if (inactive) {
    throw new Error('INACTIVE_SUPERVISOR');
  }

  if (service === null) {
    const mismatch = rows.find((row) => normalizeService(row.service) !== null);
    if (mismatch) {
      throw new Error('SERVICE_REQUIRED_FOR_ASSIGNMENT');
    }
  } else {
    const mismatch = rows.find((row) => normalizeService(row.service) !== service);
    if (mismatch) {
      throw new Error('SERVICE_MISMATCH');
    }
  }

  return rows;
};

const syncTeamAssignments = async (memberId: string, supervisorIds: string[]) => {
  try {
    await runQuery('delete from public.team_assignments where member_id = $1', [memberId]);
  } catch (error) {
    if (isMissingTeamAssignments(error)) {
      return;
    }
    throw error;
  }

  if (supervisorIds.length === 0) {
    return;
  }

  try {
    await runQuery(
      `insert into public.team_assignments (supervisor_id, member_id, active, assigned_at)
       select value, $1, true, now()
       from unnest($2::uuid[]) as value`,
      [memberId, supervisorIds]
    );
  } catch (error) {
    if (isMissingTeamAssignments(error)) {
      return;
    }
    throw error;
  }
};

const mapSupervisorError = (code: string) => {
  switch (code) {
    case 'SUPERVISOR_NOT_FOUND':
      return 'Alguno de los supervisores indicados no existe.';
    case 'INVALID_SUPERVISOR_ROLE':
      return 'Solo puedes asignar usuarios con rol de supervisor.';
    case 'INACTIVE_SUPERVISOR':
      return 'Alguno de los supervisores está inactivo.';
    case 'SERVICE_REQUIRED_FOR_ASSIGNMENT':
      return 'Debes asignar un servicio a la persona antes de asociar supervisores.';
    case 'SERVICE_MISMATCH':
      return 'Los supervisores deben pertenecer al mismo servicio que la persona.';
    default:
      return 'No fue posible validar los supervisores seleccionados.';
  }
};

const isMissingTeamAssignments = (error: unknown): error is { code: string } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42P01';

const PEOPLE_WITH_SUPERVISORS_SELECT = `
select p.*,
        coalesce(
          (
            select json_agg(json_build_object('site_id', ps.site_id))
            from public.people_sites ps
            where ps.person_id = p.id
          ),
          '[]'::json
        ) as people_sites,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'supervisor_id', ta.supervisor_id,
                'name', sup.name,
                'email', sup.email
              )
            )
            from public.team_assignments ta
            join public.people sup on sup.id = ta.supervisor_id
            where ta.member_id = p.id
              and ta.active = true
          ),
          '[]'::json
        ) as supervisors
 from public.people p
`;

const PEOPLE_LEGACY_SELECT = `
select p.*,
        coalesce(
          (
            select json_agg(json_build_object('site_id', ps.site_id))
            from public.people_sites ps
            where ps.person_id = p.id
          ),
          '[]'::json
        ) as people_sites
 from public.people p
`;

const selectPeopleRows = async (suffix: string, params: unknown[]): Promise<DbPersonRow[]> => {
  try {
    const { rows } = await runQuery<DbPersonRow>(PEOPLE_WITH_SUPERVISORS_SELECT + suffix, params);
    return rows.map((row) => ({
      ...row,
      people_sites: row.people_sites ?? [],
      supervisors: row.supervisors ?? [],
    }));
  } catch (error) {
    if (!isMissingTeamAssignments(error)) {
      throw error;
    }
    const { rows } = await runQuery<DbPersonRowLegacy>(PEOPLE_LEGACY_SELECT + suffix, params);
    return rows.map((row) => ({
      ...row,
      people_sites: row.people_sites ?? [],
      supervisors: [],
    }));
  }
};

export async function GET() {
  const { user } = await authorize();
  if (!user) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  try {
    const rows = await selectPeopleRows(' order by p.created_at', []);
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('[admin_people] fetch failed', error);
    return NextResponse.json({ error: 'PEOPLE_FETCH_FAILED' }, { status: 500 });
  }
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

  const supervisorIds = Array.from(new Set(payload.supervisorIds ?? []));
  const serviceValue = normalizeService(payload.service ?? null);

  try {
    await ensureSupervisorsEligible(supervisorIds, serviceValue);
  } catch (validationError) {
    return NextResponse.json(
      { error: 'SUPERVISOR_INVALID', message: mapSupervisorError((validationError as Error).message) },
      { status: 400 }
    );
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
      service: serviceValue,
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
        serviceValue,
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

  try {
    await syncTeamAssignments(personId, supervisorIds);
  } catch (error) {
    await service.from('people').delete().eq('id', personId);
    try {
      await service.auth.admin.deleteUser(personId);
    } catch {
      // ignore rollback failure
    }
    return NextResponse.json({ error: 'SUPERVISOR_ASSIGN_FAILED', details: (error as Error).message }, { status: 500 });
  }

  const rows = await selectPeopleRows(' where p.id = $1', [personId]);
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

  const { id, siteIds, password, supervisorIds: rawSupervisorIds, ...changes } = payload;
  const service = getServiceSupabase();

  const existingRows = await selectPeopleRows(' where p.id = $1', [id]);
  const existingPerson = existingRows[0];

  if (!existingPerson) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const hasServiceChange = Object.prototype.hasOwnProperty.call(changes, 'service');
  const targetService = normalizeService(
    hasServiceChange ? ((changes as { service?: string | null }).service ?? null) : existingPerson.service
  );
  if (hasServiceChange) {
    (changes as Tables['people']['Update']).service = targetService;
  }

  const supervisorIdsDefined = Object.prototype.hasOwnProperty.call(payload, 'supervisorIds');
  const supervisorIds = supervisorIdsDefined ? Array.from(new Set(rawSupervisorIds ?? [])) : [];
  let supervisorValidationRows: Awaited<ReturnType<typeof ensureSupervisorsEligible>> = [];
  if (supervisorIdsDefined) {
    try {
      supervisorValidationRows = await ensureSupervisorsEligible(supervisorIds, targetService);
    } catch (validationError) {
      return NextResponse.json(
        { error: 'SUPERVISOR_INVALID', message: mapSupervisorError((validationError as Error).message) },
        { status: 400 }
      );
    }
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

  if (supervisorIdsDefined) {
    try {
      await syncTeamAssignments(id, supervisorIds);
      updatedPerson = {
        ...updatedPerson,
        supervisors: supervisorValidationRows.map((row) => ({
          supervisor_id: row.id,
          name: row.name ?? null,
          email: row.email ?? null,
        })),
      } as DbPersonRow;
    } catch (error) {
      return NextResponse.json(
        { error: 'SUPERVISOR_ASSIGN_FAILED', details: (error as Error).message },
        { status: 500 }
      );
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
  if (hasServiceChange) {
    userMetadata.service = targetService;
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

  const refreshedRows = await selectPeopleRows(' where p.id = $1', [id]);
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
type DbPersonRow = Tables['people']['Row'] & {
  people_sites: { site_id: string }[] | null;
  supervisors: { supervisor_id: string; name: string | null; email: string | null }[] | null;
};
type DbPersonRowLegacy = Tables['people']['Row'] & { people_sites: { site_id: string }[] | null };
