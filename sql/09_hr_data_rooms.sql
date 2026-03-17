-- ============================================================
-- HR Data Rooms + CLIENT role + CRM Attendance Sync
-- Migración 09 — Plataforma RRHH Geimser
-- Ejecutar en Supabase SQL Editor (idempotente)
-- ============================================================

-- =============================================
-- 1. EXTENDER ROL EN people (agregar CLIENT)
-- =============================================

-- Eliminar constraint existente y recrear con CLIENT
alter table people
  drop constraint if exists people_role_check;

alter table people
  add constraint people_role_check
  check (role in ('WORKER','ADMIN','SUPERVISOR','DT_VIEWER','CLIENT'));

-- =============================================
-- 2. CAMPOS ADICIONALES EN people
-- =============================================

-- campaign_id: campaña principal del trabajador (viene del CRM)
alter table people add column if not exists campaign_id uuid;

-- phone: útil para el perfil de agente
alter table people add column if not exists phone text;

-- avatar_url: foto de perfil
alter table people add column if not exists avatar_url text;

-- =============================================
-- 3. TABLA: campaigns_local
-- Copia local de las campañas del CRM para FK y control
-- =============================================

create table if not exists campaigns_local (
    id uuid primary key default gen_random_uuid(),
    crm_campaign_id text unique not null,   -- id original del CRM
    name text not null,
    status text not null default 'active',
    channel text,
    client_name text,                        -- nombre del cliente (empresa)
    client_rut text,
    client_contact_name text,
    client_contact_email text,
    is_active boolean not null default true,
    synced_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_local_crm_id on campaigns_local(crm_campaign_id);
create index if not exists idx_campaigns_local_active on campaigns_local(is_active, name);

-- FK desde people hacia campaigns_local
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'people_campaign_id_fkey'
    ) then
        alter table people
        add constraint people_campaign_id_fkey
        foreign key (campaign_id) references campaigns_local(id) on delete set null;
    end if;
end $$;

create index if not exists idx_people_campaign_id on people(campaign_id);

-- =============================================
-- 4. TABLA: campaign_documents
-- Repositorio de documentos por campaña
-- =============================================

create table if not exists campaign_documents (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references campaigns_local(id) on delete cascade,
    person_id uuid references people(id) on delete set null,  -- null = doc de campaña general
    doc_type text not null check (doc_type in (
        'CONTRACT',         -- contrato trabajador
        'PAYSLIP',          -- liquidación de sueldo
        'COTIZACION',       -- cotización previsional
        'ANEXO',            -- anexo contrato
        'FINIQUITO',        -- finiquito
        'REPORT',           -- reporte supervisor/admin
        'INVOICE',          -- factura al cliente
        'OTHER'             -- otros
    )),
    period_label text,           -- ej: "2024-03", "2024-T1"
    file_name text not null,
    storage_path text not null,  -- path en Supabase Storage
    file_size_bytes bigint,
    mime_type text,
    visible_to_worker boolean not null default false,   -- agente puede ver
    visible_to_client boolean not null default false,   -- cliente puede ver
    uploaded_by uuid references people(id) on delete set null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_docs_campaign on campaign_documents(campaign_id, created_at desc);
create index if not exists idx_campaign_docs_person on campaign_documents(person_id, doc_type, created_at desc);
create index if not exists idx_campaign_docs_type on campaign_documents(doc_type, period_label);
create index if not exists idx_campaign_docs_worker_vis on campaign_documents(person_id, visible_to_worker) where visible_to_worker = true;
create index if not exists idx_campaign_docs_client_vis on campaign_documents(campaign_id, visible_to_client) where visible_to_client = true;

-- =============================================
-- 5. TABLA: campaign_client_access
-- Credenciales de acceso para clientes externos
-- =============================================

create table if not exists campaign_client_access (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references campaigns_local(id) on delete cascade,
    person_id uuid not null references people(id) on delete cascade,  -- la persona con rol CLIENT
    access_level text not null default 'READ' check (access_level in ('READ','DOWNLOAD')),
    expires_at timestamptz,             -- null = nunca expira
    is_active boolean not null default true,
    created_by uuid references people(id) on delete set null,
    last_accessed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint campaign_client_access_unique unique (campaign_id, person_id)
);

create index if not exists idx_client_access_campaign on campaign_client_access(campaign_id, is_active);
create index if not exists idx_client_access_person on campaign_client_access(person_id, is_active);

-- =============================================
-- 6. TABLA: crm_attendance_sync
-- Asistencia importada desde el CRM (sin geo-marca)
-- =============================================

create table if not exists crm_attendance_sync (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references people(id) on delete cascade,
    campaign_id uuid references campaigns_local(id) on delete set null,
    work_date date not null,
    hours_worked numeric(5,2),
    status text not null default 'PRESENT' check (status in (
        'PRESENT',    -- presente
        'ABSENT',     -- ausente
        'LATE',       -- tardanza
        'HALF_DAY',   -- media jornada
        'HOLIDAY',    -- feriado
        'SICK_LEAVE', -- licencia médica
        'PERMISSION'  -- permiso
    )),
    check_in_time time,
    check_out_time time,
    crm_record_id text,          -- id original en el CRM
    source text not null default 'crm',
    raw_data jsonb,              -- datos crudos del CRM por si se necesitan
    synced_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint crm_attendance_unique unique (person_id, work_date, source)
);

create index if not exists idx_crm_att_person_date on crm_attendance_sync(person_id, work_date desc);
create index if not exists idx_crm_att_campaign_date on crm_attendance_sync(campaign_id, work_date desc);
create index if not exists idx_crm_att_sync on crm_attendance_sync(synced_at desc);

-- =============================================
-- 7. TABLA: sync_logs
-- Log de sincronizaciones CRM
-- =============================================

create table if not exists sync_logs (
    id uuid primary key default gen_random_uuid(),
    sync_type text not null check (sync_type in ('ATTENDANCE','CAMPAIGNS','WORKERS')),
    status text not null check (status in ('SUCCESS','PARTIAL','FAILED')),
    records_synced integer not null default 0,
    records_failed integer not null default 0,
    error_detail text,
    duration_ms integer,
    triggered_by text not null default 'cron',  -- 'cron' | 'manual' | 'webhook'
    created_at timestamptz not null default now()
);

create index if not exists idx_sync_logs_type_ts on sync_logs(sync_type, created_at desc);

-- =============================================
-- 8. FUNCIONES RLS HELPER (actualizar para CLIENT)
-- =============================================

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from people p
        where p.id = auth.uid()
          and p.role in ('ADMIN')
          and p.is_active = true
    );
$$;

create or replace function public.is_admin_or_supervisor()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from people p
        where p.id = auth.uid()
          and p.role in ('ADMIN','SUPERVISOR')
          and p.is_active = true
    );
$$;

create or replace function public.is_worker()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from people p
        where p.id = auth.uid()
          and p.role = 'WORKER'
          and p.is_active = true
    );
$$;

create or replace function public.is_client()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from people p
        where p.id = auth.uid()
          and p.role = 'CLIENT'
          and p.is_active = true
    );
$$;

-- Obtener campaign_id del usuario actual
create or replace function public.my_campaign_id()
returns uuid
language sql
stable
as $$
    select campaign_id from people where id = auth.uid() limit 1;
$$;

-- =============================================
-- 9. RLS: campaigns_local
-- =============================================

alter table campaigns_local enable row level security;

drop policy if exists campaigns_local_admin_all on campaigns_local;
drop policy if exists campaigns_local_worker_select on campaigns_local;
drop policy if exists campaigns_local_client_select on campaigns_local;

create policy campaigns_local_admin_all on campaigns_local
    for all using (is_admin_or_supervisor()) with check (is_admin_or_supervisor());

-- Trabajador ve solo su campaña
create policy campaigns_local_worker_select on campaigns_local
    for select using (
        is_worker()
        and id = my_campaign_id()
    );

-- Cliente ve solo sus campañas autorizadas
create policy campaigns_local_client_select on campaigns_local
    for select using (
        is_client()
        and exists (
            select 1 from campaign_client_access cca
            where cca.campaign_id = campaigns_local.id
              and cca.person_id = auth.uid()
              and cca.is_active = true
              and (cca.expires_at is null or cca.expires_at > now())
        )
    );

-- =============================================
-- 10. RLS: campaign_documents
-- =============================================

alter table campaign_documents enable row level security;

drop policy if exists campaign_docs_admin_all on campaign_documents;
drop policy if exists campaign_docs_worker_own on campaign_documents;
drop policy if exists campaign_docs_client_vis on campaign_documents;
drop policy if exists campaign_docs_supervisor_campaign on campaign_documents;

-- Admin: todo
create policy campaign_docs_admin_all on campaign_documents
    for all using (is_admin()) with check (is_admin());

-- Supervisor: ve y sube docs de sus campañas (via team_assignments)
create policy campaign_docs_supervisor_campaign on campaign_documents
    for all using (
        exists (
            select 1 from people p
            where p.id = auth.uid()
              and p.role = 'SUPERVISOR'
              and p.is_active = true
              and (
                  p.campaign_id = campaign_documents.campaign_id
                  or exists (
                      select 1 from team_assignments ta
                      join people w on w.id = ta.member_id
                      where ta.supervisor_id = auth.uid()
                        and ta.active = true
                        and w.campaign_id = campaign_documents.campaign_id
                  )
              )
        )
    )
    with check (
        exists (
            select 1 from people p
            where p.id = auth.uid()
              and p.role = 'SUPERVISOR'
              and p.is_active = true
        )
    );

-- Trabajador: solo sus propios docs marcados como visibles
create policy campaign_docs_worker_own on campaign_documents
    for select using (
        is_worker()
        and person_id = auth.uid()
        and visible_to_worker = true
    );

-- Cliente: ve docs de su campaña marcados como visibles
create policy campaign_docs_client_vis on campaign_documents
    for select using (
        is_client()
        and visible_to_client = true
        and exists (
            select 1 from campaign_client_access cca
            where cca.campaign_id = campaign_documents.campaign_id
              and cca.person_id = auth.uid()
              and cca.is_active = true
              and (cca.expires_at is null or cca.expires_at > now())
        )
    );

-- =============================================
-- 11. RLS: campaign_client_access
-- =============================================

alter table campaign_client_access enable row level security;

drop policy if exists client_access_admin_all on campaign_client_access;
drop policy if exists client_access_self_select on campaign_client_access;

create policy client_access_admin_all on campaign_client_access
    for all using (is_admin()) with check (is_admin());

create policy client_access_self_select on campaign_client_access
    for select using (person_id = auth.uid());

-- =============================================
-- 12. RLS: crm_attendance_sync
-- =============================================

alter table crm_attendance_sync enable row level security;

drop policy if exists crm_att_admin_all on crm_attendance_sync;
drop policy if exists crm_att_worker_own on crm_attendance_sync;
drop policy if exists crm_att_supervisor_team on crm_attendance_sync;
drop policy if exists crm_att_client_campaign on crm_attendance_sync;

create policy crm_att_admin_all on crm_attendance_sync
    for all using (is_admin()) with check (is_admin());

create policy crm_att_worker_own on crm_attendance_sync
    for select using (
        is_worker()
        and person_id = auth.uid()
    );

create policy crm_att_supervisor_team on crm_attendance_sync
    for select using (
        exists (
            select 1 from people p
            where p.id = auth.uid()
              and p.role = 'SUPERVISOR'
              and p.is_active = true
              and (
                  p.campaign_id = crm_attendance_sync.campaign_id
                  or exists (
                      select 1 from team_assignments ta
                      where ta.supervisor_id = auth.uid()
                        and ta.member_id = crm_attendance_sync.person_id
                        and ta.active = true
                  )
              )
        )
    );

-- Cliente ve asistencia de su campaña (días trabajados)
create policy crm_att_client_campaign on crm_attendance_sync
    for select using (
        is_client()
        and exists (
            select 1 from campaign_client_access cca
            where cca.campaign_id = crm_attendance_sync.campaign_id
              and cca.person_id = auth.uid()
              and cca.is_active = true
              and (cca.expires_at is null or cca.expires_at > now())
        )
    );

-- =============================================
-- 13. RLS: sync_logs (solo admin)
-- =============================================

alter table sync_logs enable row level security;

drop policy if exists sync_logs_admin_all on sync_logs;
create policy sync_logs_admin_all on sync_logs
    for all using (is_admin()) with check (is_admin());

-- =============================================
-- 14. STORAGE: crear bucket hr-documents
-- (Ejecutar también desde Supabase Dashboard si falla)
-- =============================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'hr-documents',
    'hr-documents',
    false,
    52428800,  -- 50MB por archivo
    array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies
drop policy if exists "hr-docs-admin-all" on storage.objects;
drop policy if exists "hr-docs-worker-own" on storage.objects;
drop policy if exists "hr-docs-client" on storage.objects;
drop policy if exists "hr-docs-supervisor" on storage.objects;

create policy "hr-docs-admin-all" on storage.objects
    for all
    using (bucket_id = 'hr-documents' and is_admin())
    with check (bucket_id = 'hr-documents' and is_admin());

-- Supervisor: acceso a carpetas de su campaña
create policy "hr-docs-supervisor" on storage.objects
    for all
    using (
        bucket_id = 'hr-documents'
        and exists (
            select 1 from people p
            where p.id = auth.uid()
              and p.role = 'SUPERVISOR'
              and p.is_active = true
              and (
                  storage.objects.name like (p.campaign_id::text || '/%')
                  or p.campaign_id is null
              )
        )
    )
    with check (bucket_id = 'hr-documents');

-- Trabajador: solo su propia carpeta
create policy "hr-docs-worker-own" on storage.objects
    for select
    using (
        bucket_id = 'hr-documents'
        and is_worker()
        and storage.objects.name like ('%/' || auth.uid()::text || '/%')
    );

-- Cliente: carpetas de su campaña
create policy "hr-docs-client" on storage.objects
    for select
    using (
        bucket_id = 'hr-documents'
        and is_client()
        and exists (
            select 1 from campaign_client_access cca
            where cca.person_id = auth.uid()
              and cca.is_active = true
              and (cca.expires_at is null or cca.expires_at > now())
              and storage.objects.name like (cca.campaign_id::text || '/%')
        )
    );

-- =============================================
-- 15. VIEWS útiles
-- =============================================

-- Vista de agente: sus días trabajados
create or replace view v_worker_attendance as
select
    cas.id,
    cas.person_id,
    p.name as worker_name,
    p.rut,
    cl.name as campaign_name,
    cas.work_date,
    cas.status,
    cas.hours_worked,
    cas.check_in_time,
    cas.check_out_time,
    cas.source
from crm_attendance_sync cas
join people p on p.id = cas.person_id
left join campaigns_local cl on cl.id = cas.campaign_id;

-- Vista de campaña: resumen de equipo
create or replace view v_campaign_team as
select
    cl.id as campaign_id,
    cl.name as campaign_name,
    cl.client_name,
    p.id as person_id,
    p.name as worker_name,
    p.rut,
    p.role,
    p.email,
    p.is_active,
    p.hire_date,
    pos.name as position_name
from campaigns_local cl
join people p on p.campaign_id = cl.id
left join hr_positions pos on pos.id = p.position_id
where cl.is_active = true;

-- Vista de documentos por trabajador
create or replace view v_worker_documents as
select
    cd.id,
    cd.campaign_id,
    cl.name as campaign_name,
    cd.person_id,
    p.name as worker_name,
    cd.doc_type,
    cd.period_label,
    cd.file_name,
    cd.storage_path,
    cd.file_size_bytes,
    cd.visible_to_worker,
    cd.visible_to_client,
    cd.created_at
from campaign_documents cd
join campaigns_local cl on cl.id = cd.campaign_id
left join people p on p.id = cd.person_id;

-- =============================================
-- 16. FUNCIÓN: sync_campaign_from_crm()
-- Para llamar desde el job de sync
-- =============================================

create or replace function public.upsert_campaign_from_crm(
    p_crm_id text,
    p_name text,
    p_status text default 'active',
    p_channel text default null,
    p_client_name text default null
)
returns uuid
language plpgsql
as $$
declare
    v_id uuid;
begin
    insert into campaigns_local (crm_campaign_id, name, status, channel, client_name, synced_at, updated_at)
    values (p_crm_id, p_name, coalesce(p_status, 'active'), p_channel, p_client_name, now(), now())
    on conflict (crm_campaign_id) do update set
        name = excluded.name,
        status = excluded.status,
        channel = excluded.channel,
        client_name = coalesce(excluded.client_name, campaigns_local.client_name),
        synced_at = now(),
        updated_at = now()
    returning id into v_id;
    return v_id;
end;
$$;

-- =============================================
-- FIN MIGRACIÓN 09
-- =============================================
