import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeManager } from '../_shared';
import { ensureHrCollaboratorsSheetTable } from '../../../../../lib/db/ensureHrCollaboratorsSheetTable';
import { runQuery, withTransaction } from '../../../../../lib/db/postgres';
import { parseCollaboratorsTsv } from '../../../../../lib/hr/collaboratorsSheetParse';
import type { CollaboratorSheetRow } from '../../../../../lib/hr/collaboratorsSheetTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const importSchema = z.object({
  tsv: z.string().min(1),
});

const dayMs = 24 * 60 * 60 * 1000;

const computeKpis = (items: CollaboratorSheetRow[]) => {
  const total = items.length;
  const active = items.filter((r) => (r.estado ?? '').toLowerCase() === 'activo').length;
  const inactive = items.filter((r) => (r.estado ?? '').toLowerCase() === 'inactivo').length;
  const missingCorporateEmail = items.filter((r) => !(r.correo_corporativo ?? '').trim()).length;

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * dayMs);
  const ending30 = items.filter((r) => {
    if (!r.termino_contrato) return false;
    const d = new Date(r.termino_contrato);
    return d >= new Date(now.toDateString()) && d <= in30;
  }).length;

  const uniqueClients = new Set(items.map((r) => (r.cliente ?? '').trim()).filter(Boolean)).size;
  const uniqueAreas = new Set(items.map((r) => (r.area ?? '').trim()).filter(Boolean)).size;

  return {
    total,
    active,
    inactive,
    missingCorporateEmail,
    ending30,
    uniqueClients,
    uniqueAreas,
  };
};

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  await ensureHrCollaboratorsSheetTable();

  const { rows } = await runQuery<CollaboratorSheetRow>(
    `select
      rut_full,
      rut_base,
      rut_dv,
      ficha_numero,
      nombre_completo,
      empresa,
      area,
      estado,
      sub_estado,
      fecha_fin_licencia::text as fecha_fin_licencia,
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
      fecha_nacimiento::text as fecha_nacimiento,
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
      fecha_alta::text as fecha_alta,
      fecha_baja::text as fecha_baja,
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
      fecha_contrato::text as fecha_contrato,
      termino_contrato::text as termino_contrato,
      registro_contrato_dt::text as registro_contrato_dt,
      renovacion1_contrato::text as renovacion1_contrato,
      termino_renovacion1_contrato::text as termino_renovacion1_contrato,
      renovacion_indefinido,
      sueldo_bruto,
      gratificacion,
      movilizacion,
      colacion,
      anexo_confidencialidad::text as anexo_confidencialidad,
      anexo_horario::text as anexo_horario,
      anexo_cambio_renta::text as anexo_cambio_renta,
      pacto_hhee::text as pacto_hhee,
      sindicato,
      demanda,
      notebook,
      llaves_oficina_cerr_superior,
      llaves_oficina_cerr_inferior,
      correo_corporativo,
      correo_gmail_corporativo,
      correo_cliente,
      created_at::text as created_at,
      updated_at::text as updated_at
    from public.hr_collaborators_sheet
    order by coalesce(nombre_completo, rut_full) asc`
  );

  const kpis = computeKpis(rows);

  return NextResponse.json({ items: rows, kpis }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const items = parseCollaboratorsTsv(parsed.data.tsv);
  if (items.length === 0) {
    return NextResponse.json({ error: 'NO_ROWS' }, { status: 400 });
  }

  await ensureHrCollaboratorsSheetTable();

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

  return NextResponse.json({ ok: true, imported: items.length }, { status: 201 });
}

