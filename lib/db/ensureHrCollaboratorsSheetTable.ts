import { runQuery } from './postgres';

let ensured = false;

export const ensureHrCollaboratorsSheetTable = async () => {
  if (ensured) return;

  await runQuery(`
    create table if not exists public.hr_collaborators_sheet (
      rut_full text primary key,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await runQuery(`
    alter table public.hr_collaborators_sheet
      add column if not exists rut_base text,
      add column if not exists rut_dv text,
      add column if not exists ficha_numero text,
      add column if not exists nombre_completo text,
      add column if not exists empresa text,
      add column if not exists area text,
      add column if not exists estado text,
      add column if not exists sub_estado text,
      add column if not exists fecha_fin_licencia date,
      add column if not exists tipo_contrato text,
      add column if not exists jornada_laboral integer,
      add column if not exists cliente text,
      add column if not exists servicio text,
      add column if not exists campania text,
      add column if not exists cargo text,
      add column if not exists supervisor text,
      add column if not exists coordinador text,
      add column if not exists sub_gerente text,
      add column if not exists genero text,
      add column if not exists fecha_nacimiento date,
      add column if not exists estado_civil text,
      add column if not exists nacionalidad text,
      add column if not exists correo_personal text,
      add column if not exists telefono_celular text,
      add column if not exists telefono_fijo text,
      add column if not exists direccion text,
      add column if not exists comuna text,
      add column if not exists ciudad text,
      add column if not exists nivel_educacional text,
      add column if not exists especialidad text,
      add column if not exists contacto_emergencia text,
      add column if not exists parentesco_emergencia text,
      add column if not exists telefono_emergencia text,
      add column if not exists alergias text,
      add column if not exists fecha_alta date,
      add column if not exists fecha_baja date,
      add column if not exists antiguedad_dias integer,
      add column if not exists motivo_baja text,
      add column if not exists tipo_remuneracion text,
      add column if not exists centro_costo_id text,
      add column if not exists centro_costo_descripcion text,
      add column if not exists rol text,
      add column if not exists banco_transferencia text,
      add column if not exists tipo_cuenta_transferencia text,
      add column if not exists numero_cuenta text,
      add column if not exists cargas_familiares integer,
      add column if not exists salud text,
      add column if not exists afp text,
      add column if not exists fecha_contrato date,
      add column if not exists termino_contrato date,
      add column if not exists registro_contrato_dt date,
      add column if not exists renovacion1_contrato date,
      add column if not exists termino_renovacion1_contrato date,
      add column if not exists renovacion_indefinido text,
      add column if not exists sueldo_bruto numeric(12,2),
      add column if not exists gratificacion numeric(8,2),
      add column if not exists movilizacion numeric(12,2),
      add column if not exists colacion numeric(12,2),
      add column if not exists anexo_confidencialidad date,
      add column if not exists anexo_horario date,
      add column if not exists anexo_cambio_renta date,
      add column if not exists pacto_hhee date,
      add column if not exists sindicato text,
      add column if not exists demanda text,
      add column if not exists notebook text,
      add column if not exists llaves_oficina_cerr_superior text,
      add column if not exists llaves_oficina_cerr_inferior text,
      add column if not exists correo_corporativo text,
      add column if not exists correo_gmail_corporativo text,
      add column if not exists correo_cliente text;
  `);

  await runQuery('create index if not exists idx_hr_collaborators_sheet_estado on public.hr_collaborators_sheet(estado);');
  await runQuery('create index if not exists idx_hr_collaborators_sheet_area on public.hr_collaborators_sheet(area);');
  await runQuery('create index if not exists idx_hr_collaborators_sheet_cliente on public.hr_collaborators_sheet(cliente);');
  await runQuery(
    'create index if not exists idx_hr_collaborators_sheet_termino_contrato on public.hr_collaborators_sheet(termino_contrato);'
  );

  ensured = true;
};

