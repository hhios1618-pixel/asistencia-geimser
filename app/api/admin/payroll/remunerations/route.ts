import { NextResponse } from 'next/server';
import { authorizeManager } from '../../hr/_shared';
import { ensureHrCollaboratorsSheetTable } from '../../../../../lib/db/ensureHrCollaboratorsSheetTable';
import { runQuery } from '../../../../../lib/db/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RemunerationCrmRow = {
  rut_full: string;
  nombre_completo: string | null;
  estado: string | null;
  sub_estado: string | null;
  empresa: string | null;
  area: string | null;
  cliente: string | null;
  servicio: string | null;
  campania: string | null;
  cargo: string | null;
  supervisor: string | null;
  coordinador: string | null;
  sub_gerente: string | null;
  tipo_remuneracion: string | null;
  centro_costo_id: string | null;
  centro_costo_descripcion: string | null;
  banco_transferencia: string | null;
  tipo_cuenta_transferencia: string | null;
  numero_cuenta: string | null;
  sueldo_bruto: number | null;
  gratificacion: number | null;
  movilizacion: number | null;
  colacion: number | null;
  fecha_contrato: string | null;
  termino_contrato: string | null;
  correo_corporativo: string | null;
  correo_cliente: string | null;
  correo_personal: string | null;
  telefono_celular: string | null;

  // system join (people)
  person_id: string | null;
  person_name: string | null;
  person_email: string | null;
  person_service: string | null;
  person_role: string | null;
  person_is_active: boolean | null;
  business_name: string | null;
  position_name: string | null;
  salary_monthly: number | null;
  employment_type: string | null;
  hire_date: string | null;
  termination_date: string | null;
};

type RemunerationsKpis = {
  total: number;
  planilla_activos: number;
  planilla_inactivos: number;
  system_activos: number;
  system_inactivos: number;
  sin_match_sistema: number;
  sin_banco: number;
  sin_centro_costo: number;
  sin_sueldo: number;
  vencen_30_dias: number;
};

const dayMs = 24 * 60 * 60 * 1000;

const computeKpis = (items: RemunerationCrmRow[]): RemunerationsKpis => {
  const total = items.length;
  const planilla_activos = items.filter((r) => (r.estado ?? '').toLowerCase() === 'activo').length;
  const planilla_inactivos = items.filter((r) => (r.estado ?? '').toLowerCase() === 'inactivo').length;
  const system_activos = items.filter((r) => r.person_is_active === true).length;
  const system_inactivos = items.filter((r) => r.person_is_active === false).length;
  const sin_match_sistema = items.filter((r) => !r.person_id).length;
  const sin_banco = items.filter((r) => !(r.banco_transferencia ?? '').trim() || !(r.numero_cuenta ?? '').trim()).length;
  const sin_centro_costo = items.filter((r) => !(r.centro_costo_descripcion ?? '').trim() && !(r.centro_costo_id ?? '').trim()).length;
  const sin_sueldo = items.filter((r) => (r.sueldo_bruto ?? 0) <= 0).length;

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * dayMs);
  const vencen_30_dias = items.filter((r) => {
    if (!r.termino_contrato) return false;
    const d = new Date(r.termino_contrato);
    return d >= new Date(now.toDateString()) && d <= in30;
  }).length;

  return {
    total,
    planilla_activos,
    planilla_inactivos,
    system_activos,
    system_inactivos,
    sin_match_sistema,
    sin_banco,
    sin_centro_costo,
    sin_sueldo,
    vencen_30_dias,
  };
};

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  await ensureHrCollaboratorsSheetTable();

  const { rows } = await runQuery<RemunerationCrmRow>(
    `
    with hs as (
      select
        *,
        regexp_replace(lower(rut_full), '[^0-9k]', '', 'g') as rut_norm
      from public.hr_collaborators_sheet
    ),
    p as (
      select
        p.*,
        regexp_replace(lower(p.rut), '[^0-9k]', '', 'g') as rut_norm
      from public.people p
      where p.rut is not null
    )
    select
      hs.rut_full,
      hs.nombre_completo,
      hs.estado,
      hs.sub_estado,
      hs.empresa,
      hs.area,
      hs.cliente,
      hs.servicio,
      hs.campania,
      hs.cargo,
      hs.supervisor,
      hs.coordinador,
      hs.sub_gerente,
      hs.tipo_remuneracion,
      hs.centro_costo_id,
      hs.centro_costo_descripcion,
      hs.banco_transferencia,
      hs.tipo_cuenta_transferencia,
      hs.numero_cuenta,
      hs.sueldo_bruto,
      hs.gratificacion,
      hs.movilizacion,
      hs.colacion,
      hs.fecha_contrato::text as fecha_contrato,
      hs.termino_contrato::text as termino_contrato,
      hs.correo_corporativo,
      hs.correo_cliente,
      hs.correo_personal,
      hs.telefono_celular,
      p.id as person_id,
      p.name as person_name,
      p.email as person_email,
      p.service as person_service,
      p.role as person_role,
      p.is_active as person_is_active,
      b.name as business_name,
      pos.name as position_name,
      p.salary_monthly,
      p.employment_type,
      p.hire_date::text as hire_date,
      p.termination_date::text as termination_date
    from hs
    left join p on p.rut_norm = hs.rut_norm
    left join public.hr_businesses b on b.id = p.business_id
    left join public.hr_positions pos on pos.id = p.position_id
    order by coalesce(hs.nombre_completo, hs.rut_full) asc
    `
  );

  const kpis = computeKpis(rows);
  return NextResponse.json({ items: rows, kpis }, { headers: { 'Cache-Control': 'no-store' } });
}
