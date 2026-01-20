import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { createRouteSupabaseClient, getServiceSupabase } from '../../../../../lib/supabase/server';
import type { Tables } from '../../../../../types/database';
import { runQuery } from '../../../../../lib/db/postgres';
import { ensurePeopleServiceColumn } from '../../../../../lib/db/ensurePeopleServiceColumn';
import { resolveUserRole } from '../../../../../lib/auth/role';

const rutSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return undefined;
    }
    const cleaned = value.replace(/[^0-9kK]/g, '').toUpperCase();
    return cleaned.length > 0 ? cleaned : undefined;
  },
  z.string().min(7).optional()
);

const personSchema = z.object({
  name: z.string().min(3),
  rut: rutSchema,
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
  const role = await resolveUserRole(user, defaultRole);
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

const normalizeEmail = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRutValue = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/[^0-9kK]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
};

const ensureSupervisorsEligible = async (
  supervisorIds: string[]
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

const UNIQUE_CONSTRAINT_ERRORS: Record<string, { error: string; message: string }> = {
  people_email_key: {
    error: 'EMAIL_ALREADY_EXISTS',
    message: 'Ya existe una persona registrada con este correo.',
  },
  people_rut_key: {
    error: 'RUT_ALREADY_EXISTS',
    message: 'Ya existe una persona registrada con este RUT.',
  },
};

const mapUniqueViolation = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const pgError = error as { code?: string; constraint?: string };
  if (pgError.code !== '23505') {
    return null;
  }
  return (
    UNIQUE_CONSTRAINT_ERRORS[pgError.constraint ?? ''] ?? {
      error: 'DUPLICATE_VALUE',
      message: 'Ya existe un registro con los mismos datos.',
    }
  );
};

const detectDuplicatePerson = async ({
  email,
  rut,
  excludeId,
}: {
  email?: string | null;
  rut?: string | null;
  excludeId?: string;
}) => {
  if (email) {
    const { rows } = await runQuery<{ id: string }>(
      'select id from public.people where lower(email) = $1 limit 1',
      [email]
    );
    if (rows.length > 0 && (!excludeId || rows[0].id !== excludeId)) {
      return UNIQUE_CONSTRAINT_ERRORS.people_email_key;
    }
  }

  if (rut) {
    const { rows } = await runQuery<{ id: string }>(
      'select id from public.people where rut = $1 limit 1',
      [rut]
    );
    if (rows.length > 0 && (!excludeId || rows[0].id !== excludeId)) {
      return UNIQUE_CONSTRAINT_ERRORS.people_rut_key;
    }
  }

  return null;
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

  const normalizedEmail = normalizeEmail(payload.email ?? null);
  if (!normalizedEmail) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }
  const normalizedRut = normalizeRutValue(payload.rut ?? null);

  const supervisorIds = Array.from(new Set(payload.supervisorIds ?? []));
  const serviceValue = normalizeService(payload.service ?? null);

  try {
    await ensurePeopleServiceColumn();
  } catch (ensureError) {
    console.error('[admin_people] ensure service column failed', ensureError);
    return NextResponse.json(
      {
        error: 'SERVICE_COLUMN_MISSING',
        message: 'No fue posible preparar la columna "service" en la tabla de personas. Ejecuta la última migración e inténtalo nuevamente.',
        details: (ensureError as Error).message,
      },
      { status: 500 }
    );
  }

  const duplicateError = await detectDuplicatePerson({ email: normalizedEmail, rut: normalizedRut });
  if (duplicateError) {
    return NextResponse.json(duplicateError, { status: 409 });
  }

  try {
    await ensureSupervisorsEligible(supervisorIds);
  } catch (validationError) {
    return NextResponse.json(
      { error: 'SUPERVISOR_INVALID', message: mapSupervisorError((validationError as Error).message) },
      { status: 400 }
    );
  }

  const service = getServiceSupabase();
  const password = payload.password?.trim() || generateTemporaryPassword();

  const { data: createdAuth, error: authError } = await service.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: payload.name,
      rut: normalizedRut ?? null,
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
      [personId, payload.name, normalizedRut, serviceValue, normalizedEmail, payload.role, payload.is_active ?? true]
    );
  } catch (error) {
    try {
      await service.auth.admin.deleteUser(personId);
    } catch {
      // ignore auth deletion errors in rollback
    }
    const duplicate = mapUniqueViolation(error);
    if (duplicate) {
      return NextResponse.json(duplicate, { status: 409 });
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
        email: normalizedEmail,
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

  try {
    await ensurePeopleServiceColumn();
  } catch (ensureError) {
    console.error('[admin_people] ensure service column failed', ensureError);
    return NextResponse.json(
      {
        error: 'SERVICE_COLUMN_MISSING',
        message: 'No fue posible preparar la columna \"service\" en la tabla de personas. Ejecuta la última migración e inténtalo nuevamente.',
        details: (ensureError as Error).message,
      },
      { status: 500 }
    );
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
      supervisorValidationRows = await ensureSupervisorsEligible(supervisorIds);
    } catch (validationError) {
      return NextResponse.json(
        { error: 'SUPERVISOR_INVALID', message: mapSupervisorError((validationError as Error).message) },
        { status: 400 }
      );
    }
  }

  const updateValues = changes as Tables['people']['Update'];
  const emailDefined = Object.prototype.hasOwnProperty.call(changes, 'email');
  const rutDefined = Object.prototype.hasOwnProperty.call(changes, 'rut');
  let normalizedEmailUpdate: string | null = null;
  if (emailDefined) {
    normalizedEmailUpdate = normalizeEmail((changes as { email?: string | null }).email ?? null);
    if (!normalizedEmailUpdate) {
      return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
    }
    updateValues.email = normalizedEmailUpdate;
  }
  let normalizedRutUpdate: string | null = null;
  if (rutDefined) {
    normalizedRutUpdate = normalizeRutValue((changes as { rut?: string | null }).rut ?? null);
    updateValues.rut = normalizedRutUpdate;
  }

  if (emailDefined || rutDefined) {
    const duplicateUpdateError = await detectDuplicatePerson({
      email: emailDefined ? normalizedEmailUpdate : undefined,
      rut: rutDefined ? normalizedRutUpdate : undefined,
      excludeId: id,
    });
    if (duplicateUpdateError) {
      return NextResponse.json(duplicateUpdateError, { status: 409 });
    }
  }

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
      const duplicate = mapUniqueViolation(error);
      if (duplicate) {
        return NextResponse.json(duplicate, { status: 409 });
      }
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

  if (emailDefined && normalizedEmailUpdate) {
    authUpdates.email = normalizedEmailUpdate;
  }

  if (password && password.trim().length >= 8) {
    authUpdates.password = password;
  }

  const userMetadata: Record<string, unknown> = {};
  if (typeof changes.name === 'string') {
    userMetadata.name = changes.name;
  }
  if (rutDefined) {
    userMetadata.rut = normalizedRutUpdate;
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
