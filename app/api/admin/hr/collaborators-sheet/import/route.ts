import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { authorizeManager } from '../../_shared';
import { ensureHrCollaboratorsSheetTable } from '../../../../../../lib/db/ensureHrCollaboratorsSheetTable';
import { parseCollaboratorsTsv } from '../../../../../../lib/hr/collaboratorsSheetParse';
import { runQuery, withTransaction } from '../../../../../../lib/db/postgres';
import { getServiceSupabase } from '../../../../../../lib/supabase/server';
import { normalizeRutComparable } from '../../../../../../lib/hr/rut';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ImportResult = {
  ok: boolean;
  imported: number;
  created_auth_users: number;
  updated_auth_users: number;
  synced_people: number;
  synced_businesses: number;
  synced_positions: number;
  synced_team_assignments: number;
  warnings: string[];
};

const randomPassword = () => {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return `${raw.slice(0, 10)}Aa1`;
};

const parseTextToTsv = (text: string) => {
  const normalized = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return '';
  if (normalized.includes('\t')) return normalized;
  // Try ; then , (CSV). Use a simple quoted-field parser to avoid breaking addresses with commas.
  const delimiter = normalized.includes(';') ? ';' : normalized.includes(',') ? ',' : null;
  if (!delimiter) return normalized;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i] ?? '';
    const next = normalized[i + 1] ?? '';

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.map((r) => r.map((cell) => String(cell ?? '').replace(/\u00a0/g, ' ').trim()).join('\t')).join('\n');
};

const readFileAsTsv = async (file: File) => {
  const name = (file.name ?? '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const firstName = wb.SheetNames[0];
    const sheet = firstName ? wb.Sheets[firstName] : null;
    if (!sheet) return '';

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as Array<Array<unknown>>;
    const lines = rows
      .filter((r) => r.some((cell) => String(cell ?? '').trim().length > 0))
      .map((r) => r.map((cell) => String(cell ?? '').replace(/\u00a0/g, ' ').trim()).join('\t'));

    // If first line looks like header, keep it; parser can handle both.
    return lines.join('\n');
  }

  const text = await file.text();
  return parseTextToTsv(text);
};

const ensureHrMasters = async (businesses: string[], positions: string[]) => {
  let syncedBusinesses = 0;
  let syncedPositions = 0;
  try {
    for (const name of businesses) {
      await runQuery(
        `insert into public.hr_businesses (name, is_active) values ($1, true)
         on conflict (name) do update set is_active = true`,
        [name]
      );
      syncedBusinesses += 1;
    }
  } catch (error) {
    return { syncedBusinesses: 0, syncedPositions: 0, warnings: ['No se pudo sincronizar hr_businesses.'] as string[] };
  }

  try {
    for (const name of positions) {
      await runQuery(
        `insert into public.hr_positions (name, is_active) values ($1, true)
         on conflict (name) do update set is_active = true`,
        [name]
      );
      syncedPositions += 1;
    }
  } catch (error) {
    return { syncedBusinesses, syncedPositions: 0, warnings: ['No se pudo sincronizar hr_positions.'] as string[] };
  }

  return { syncedBusinesses, syncedPositions, warnings: [] as string[] };
};

const listAuthUserIdByEmail = async (email: string) => {
  const service = getServiceSupabase();
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
};

const getOrCreateAuthUser = async (email: string, metadata: Record<string, unknown>, role: string) => {
  const service = getServiceSupabase();
  const password = randomPassword();
  const create = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { role },
  });
  if (!create.error && create.data?.user?.id) {
    return { id: create.data.user.id, created: true, password } as const;
  }

  // Already exists or other error
  const existingId = await listAuthUserIdByEmail(email);
  if (!existingId) {
    throw new Error(create.error?.message ?? 'AUTH_CREATE_FAILED');
  }

  const update = await service.auth.admin.updateUserById(existingId, {
    user_metadata: metadata,
    app_metadata: { role },
  });
  if (update.error) {
    throw new Error(update.error.message);
  }
  return { id: existingId, created: false, password: null } as const;
};

export async function POST(request: NextRequest) {
  try {
    const { role } = await authorizeManager();
    if (!role) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    let form: FormData | null = null;
    try {
      form = await request.formData();
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.toLowerCase().includes('body') && msg.toLowerCase().includes('too')) {
        return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
      }
      return NextResponse.json({ error: 'INVALID_FORM', message: msg }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
    }

    const doSyncUsers = String(form.get('sync_users') ?? 'true') !== 'false';
    const doSyncTeams = String(form.get('sync_teams') ?? 'true') !== 'false';
    const doSyncHrMasters = String(form.get('sync_hr_masters') ?? 'true') !== 'false';

    const warnings: string[] = [];

    const tsv = await readFileAsTsv(file);
    const items = parseCollaboratorsTsv(tsv);
    if (items.length === 0) {
      return NextResponse.json({ error: 'NO_ROWS' }, { status: 400 });
    }

    await ensureHrCollaboratorsSheetTable();

    // Upsert sheet rows
    await withTransaction(async (client) => {
      for (const row of items) {
        await client.query(
          `insert into public.hr_collaborators_sheet (
          rut_full,
          rut_base,
          rut_dv,
          ficha_numero,
          nombre_completo,
          empresa,
          area,
          estado,
          sub_estado,
          fecha_fin_licencia,
          tipo_contrato,
          jornada_laboral,
          cliente,
          servicio,
          campania,
          cargo,
          supervisor,
          coordinador,
          sub_gerente,
          genero,
          fecha_nacimiento,
          estado_civil,
          nacionalidad,
          correo_personal,
          telefono_celular,
          telefono_fijo,
          direccion,
          comuna,
          ciudad,
          nivel_educacional,
          especialidad,
          contacto_emergencia,
          parentesco_emergencia,
          telefono_emergencia,
          alergias,
          fecha_alta,
          fecha_baja,
          antiguedad_dias,
          motivo_baja,
          tipo_remuneracion,
          centro_costo_id,
          centro_costo_descripcion,
          rol,
          banco_transferencia,
          tipo_cuenta_transferencia,
          numero_cuenta,
          cargas_familiares,
          salud,
          afp,
          fecha_contrato,
          termino_contrato,
          registro_contrato_dt,
          renovacion1_contrato,
          termino_renovacion1_contrato,
          renovacion_indefinido,
          sueldo_bruto,
          gratificacion,
          movilizacion,
          colacion,
          anexo_confidencialidad,
          anexo_horario,
          anexo_cambio_renta,
          pacto_hhee,
          sindicato,
          demanda,
          notebook,
          llaves_oficina_cerr_superior,
          llaves_oficina_cerr_inferior,
          correo_corporativo,
          correo_gmail_corporativo,
          correo_cliente,
          updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
          $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
          $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
          $51,$52,$53,$54,$55,$56,$57,$58,$59,$60,
          $61,$62,$63,$64,$65,$66,$67,$68,$69,$70,
          $71,$72,$73, now()
        )
        on conflict (rut_full) do update set
          rut_base = excluded.rut_base,
          rut_dv = excluded.rut_dv,
          ficha_numero = excluded.ficha_numero,
          nombre_completo = excluded.nombre_completo,
          empresa = excluded.empresa,
          area = excluded.area,
          estado = excluded.estado,
          sub_estado = excluded.sub_estado,
          fecha_fin_licencia = excluded.fecha_fin_licencia,
          tipo_contrato = excluded.tipo_contrato,
          jornada_laboral = excluded.jornada_laboral,
          cliente = excluded.cliente,
          servicio = excluded.servicio,
          campania = excluded.campania,
          cargo = excluded.cargo,
          supervisor = excluded.supervisor,
          coordinador = excluded.coordinador,
          sub_gerente = excluded.sub_gerente,
          genero = excluded.genero,
          fecha_nacimiento = excluded.fecha_nacimiento,
          estado_civil = excluded.estado_civil,
          nacionalidad = excluded.nacionalidad,
          correo_personal = excluded.correo_personal,
          telefono_celular = excluded.telefono_celular,
          telefono_fijo = excluded.telefono_fijo,
          direccion = excluded.direccion,
          comuna = excluded.comuna,
          ciudad = excluded.ciudad,
          nivel_educacional = excluded.nivel_educacional,
          especialidad = excluded.especialidad,
          contacto_emergencia = excluded.contacto_emergencia,
          parentesco_emergencia = excluded.parentesco_emergencia,
          telefono_emergencia = excluded.telefono_emergencia,
          alergias = excluded.alergias,
          fecha_alta = excluded.fecha_alta,
          fecha_baja = excluded.fecha_baja,
          antiguedad_dias = excluded.antiguedad_dias,
          motivo_baja = excluded.motivo_baja,
          tipo_remuneracion = excluded.tipo_remuneracion,
          centro_costo_id = excluded.centro_costo_id,
          centro_costo_descripcion = excluded.centro_costo_descripcion,
          rol = excluded.rol,
          banco_transferencia = excluded.banco_transferencia,
          tipo_cuenta_transferencia = excluded.tipo_cuenta_transferencia,
          numero_cuenta = excluded.numero_cuenta,
          cargas_familiares = excluded.cargas_familiares,
          salud = excluded.salud,
          afp = excluded.afp,
          fecha_contrato = excluded.fecha_contrato,
          termino_contrato = excluded.termino_contrato,
          registro_contrato_dt = excluded.registro_contrato_dt,
          renovacion1_contrato = excluded.renovacion1_contrato,
          termino_renovacion1_contrato = excluded.termino_renovacion1_contrato,
          renovacion_indefinido = excluded.renovacion_indefinido,
          sueldo_bruto = excluded.sueldo_bruto,
          gratificacion = excluded.gratificacion,
          movilizacion = excluded.movilizacion,
          colacion = excluded.colacion,
          anexo_confidencialidad = excluded.anexo_confidencialidad,
          anexo_horario = excluded.anexo_horario,
          anexo_cambio_renta = excluded.anexo_cambio_renta,
          pacto_hhee = excluded.pacto_hhee,
          sindicato = excluded.sindicato,
          demanda = excluded.demanda,
          notebook = excluded.notebook,
          llaves_oficina_cerr_superior = excluded.llaves_oficina_cerr_superior,
          llaves_oficina_cerr_inferior = excluded.llaves_oficina_cerr_inferior,
          correo_corporativo = excluded.correo_corporativo,
          correo_gmail_corporativo = excluded.correo_gmail_corporativo,
          correo_cliente = excluded.correo_cliente,
          updated_at = now()`,
          [
            row.rut_full,
            row.rut_base,
            row.rut_dv,
            row.ficha_numero,
            row.nombre_completo,
            row.empresa,
            row.area,
            row.estado,
            row.sub_estado,
            row.fecha_fin_licencia,
            row.tipo_contrato,
            row.jornada_laboral,
            row.cliente,
            row.servicio,
            row.campania,
            row.cargo,
            row.supervisor,
            row.coordinador,
            row.sub_gerente,
            row.genero,
            row.fecha_nacimiento,
            row.estado_civil,
            row.nacionalidad,
            row.correo_personal,
            row.telefono_celular,
            row.telefono_fijo,
            row.direccion,
            row.comuna,
            row.ciudad,
            row.nivel_educacional,
            row.especialidad,
            row.contacto_emergencia,
            row.parentesco_emergencia,
            row.telefono_emergencia,
            row.alergias,
            row.fecha_alta,
            row.fecha_baja,
            row.antiguedad_dias,
            row.motivo_baja,
            row.tipo_remuneracion,
            row.centro_costo_id,
            row.centro_costo_descripcion,
            row.rol,
            row.banco_transferencia,
            row.tipo_cuenta_transferencia,
            row.numero_cuenta,
            row.cargas_familiares,
            row.salud,
            row.afp,
            row.fecha_contrato,
            row.termino_contrato,
            row.registro_contrato_dt,
            row.renovacion1_contrato,
            row.termino_renovacion1_contrato,
            row.renovacion_indefinido,
            row.sueldo_bruto,
            row.gratificacion,
            row.movilizacion,
            row.colacion,
            row.anexo_confidencialidad,
            row.anexo_horario,
            row.anexo_cambio_renta,
            row.pacto_hhee,
            row.sindicato,
            row.demanda,
            row.notebook,
            row.llaves_oficina_cerr_superior,
            row.llaves_oficina_cerr_inferior,
            row.correo_corporativo,
            row.correo_gmail_corporativo,
            row.correo_cliente,
          ]
        );
      }
    });

    // Optional: sync HR master tables (business/position)
    let syncedBusinesses = 0;
    let syncedPositions = 0;
    if (doSyncHrMasters) {
      const businesses = Array.from(new Set(items.map((r) => (r.empresa ?? '').trim()).filter(Boolean)));
      const positions = Array.from(new Set(items.map((r) => (r.cargo ?? '').trim()).filter(Boolean)));
      const master = await ensureHrMasters(businesses, positions);
      syncedBusinesses = master.syncedBusinesses;
      syncedPositions = master.syncedPositions;
      warnings.push(...master.warnings);
    }

    // Optional: sync users into auth + people + HR columns
    const adminNames = new Set(
      ['LAURA ANDREA PINCHEIRA HERRERA', 'HUGO FELIPE KAROL HORMAZABAL CAVIEDES', 'PAULA ANDREA MELELLI MABE'].map((n) =>
        n.toLowerCase()
      )
    );
    const supervisorNames = new Set(items.map((r) => (r.supervisor ?? '').trim().toLowerCase()).filter(Boolean));

    let createdAuthUsers = 0;
    let updatedAuthUsers = 0;
    let syncedPeople = 0;
    const nameToPersonId = new Map<string, string>();
    const rutNormToPersonId = new Map<string, string>();

    if (doSyncUsers) {
      try {
        // Build HR master mappings if available
        const businessNameToId = new Map<string, string>();
        const positionNameToId = new Map<string, string>();

        try {
          const { rows: businessRows } = await runQuery<{ id: string; name: string }>('select id, name from public.hr_businesses', []);
          businessRows.forEach((b) => businessNameToId.set(b.name.toLowerCase(), b.id));
        } catch {
          // ignore if missing
        }
        try {
          const { rows: positionRows } = await runQuery<{ id: string; name: string }>('select id, name from public.hr_positions', []);
          positionRows.forEach((p) => positionNameToId.set(p.name.toLowerCase(), p.id));
        } catch {
          // ignore if missing
        }

        for (const row of items) {
          const email =
            (row.correo_corporativo ?? '').trim().toLowerCase() ||
            (row.correo_gmail_corporativo ?? '').trim().toLowerCase() ||
            (row.correo_personal ?? '').trim().toLowerCase() ||
            '';
          if (!email) continue;

          const fullName = (row.nombre_completo ?? '').trim();
          const roleForAuth = adminNames.has(fullName.toLowerCase())
            ? 'ADMIN'
            : supervisorNames.has(fullName.toLowerCase())
              ? 'SUPERVISOR'
              : 'WORKER';

          const isActive = (row.estado ?? '').toLowerCase() === 'activo';
          const metadata = {
            name: fullName || undefined,
            full_name: fullName || undefined,
            rut: row.rut_full,
            service: row.servicio ?? undefined,
            role: roleForAuth,
          };

          let authUser;
          try {
            authUser = await getOrCreateAuthUser(email, metadata, roleForAuth);
          } catch (authError) {
            warnings.push(`No se pudo crear/actualizar Auth para ${email}: ${(authError as Error).message}`);
            continue;
          }

          if (authUser.created) createdAuthUsers += 1;
          else updatedAuthUsers += 1;

          const businessId = row.empresa ? businessNameToId.get(row.empresa.toLowerCase()) ?? null : null;
          const positionId = row.cargo ? positionNameToId.get(row.cargo.toLowerCase()) ?? null : null;

          try {
            await runQuery(
              `insert into public.people (id, rut, name, service, role, is_active, email, business_id, position_id, salary_monthly, employment_type, hire_date, termination_date)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             on conflict (id) do update set
               rut = excluded.rut,
               name = excluded.name,
               service = excluded.service,
               role = excluded.role,
               is_active = excluded.is_active,
               email = excluded.email,
               business_id = excluded.business_id,
               position_id = excluded.position_id,
               salary_monthly = excluded.salary_monthly,
               employment_type = excluded.employment_type,
               hire_date = excluded.hire_date,
               termination_date = excluded.termination_date`,
              [
                authUser.id,
                row.rut_full,
                fullName || row.rut_full,
                row.servicio ?? null,
                roleForAuth,
                isActive,
                email,
                businessId,
                positionId,
                row.sueldo_bruto ?? null,
                row.tipo_contrato ?? null,
                row.fecha_alta ?? row.fecha_contrato ?? null,
                row.fecha_baja ?? row.termino_contrato ?? null,
              ]
            );
            syncedPeople += 1;
            nameToPersonId.set(fullName.toLowerCase(), authUser.id);
            const rutNorm = normalizeRutComparable(row.rut_full);
            if (rutNorm) rutNormToPersonId.set(rutNorm, authUser.id);
          } catch (dbError) {
            warnings.push(`No se pudo sincronizar people para ${email}: ${(dbError as Error).message}`);
          }
        }
      } catch (err) {
        const msg = (err as Error).message ?? '';
        warnings.push(`Sincronización de usuarios falló: ${msg || 'revisa SUPABASE_SERVICE_ROLE_KEY y esquema HR.'}`);
      }
    }

    // Optional: sync supervisor assignments (team_assignments) by names from sheet
    let syncedTeam = 0;
    if (doSyncTeams) {
      try {
        for (const row of items) {
          const memberRutNorm = normalizeRutComparable(row.rut_full);
          const memberId = memberRutNorm ? rutNormToPersonId.get(memberRutNorm) ?? null : null;
          if (!memberId) continue;
          const supervisorName = (row.supervisor ?? '').trim();
          if (!supervisorName) continue;

          let supervisorId = nameToPersonId.get(supervisorName.toLowerCase()) ?? null;
          if (!supervisorId) {
            const { rows: supRows } = await runQuery<{ id: string }>(
              'select id from public.people where lower(name) = lower($1) limit 1',
              [supervisorName]
            );
            supervisorId = supRows[0]?.id ?? null;
          }
          if (!supervisorId) continue;

          await runQuery(
            `insert into public.team_assignments (supervisor_id, member_id, active, assigned_at)
           values ($1,$2,true,now())
           on conflict (supervisor_id, member_id) do update set active = true, assigned_at = now()`,
            [supervisorId, memberId]
          );
          syncedTeam += 1;
        }
      } catch (err) {
        const msg = (err as Error).message ?? '';
        warnings.push(
          `No se pudieron sincronizar asignaciones de supervisor (team_assignments): ${msg || 'revisa RLS/permisos.'}`
        );
      }
    }

    const result: ImportResult = {
      ok: true,
      imported: items.length,
      created_auth_users: createdAuthUsers,
      updated_auth_users: updatedAuthUsers,
      synced_people: syncedPeople,
      synced_businesses: syncedBusinesses,
      synced_positions: syncedPositions,
      synced_team_assignments: syncedTeam,
      warnings,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = (err as Error).message ?? 'IMPORT_FAILED';
    console.error('[hr_collaborators_sheet_import] failed', err);
    return NextResponse.json({ error: 'IMPORT_FAILED', message }, { status: 500 });
  }
}
