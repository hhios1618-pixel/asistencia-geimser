-- Asistencia Geimser core schema
-- Ensure required extensions
create extension if not exists pgcrypto;

-- Primary entities
create table if not exists people (
    id uuid primary key default gen_random_uuid(),
    rut text unique,
    name text not null,
    service text,
    role text not null check (role in ('WORKER','ADMIN','SUPERVISOR','DT_VIEWER')),
    is_active boolean not null default true,
    email text unique,
    created_at timestamptz not null default now()
);

create table if not exists sites (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    lat double precision not null,
    lng double precision not null,
    radius_m integer not null check (radius_m >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists people_sites (
    person_id uuid not null references people(id) on delete cascade,
    site_id uuid not null references sites(id) on delete cascade,
    active boolean not null default true,
    assigned_at timestamptz not null default now(),
    primary key (person_id, site_id)
);

create table if not exists schedules (
    id uuid primary key default gen_random_uuid(),
    person_id uuid references people(id) on delete cascade,
    group_id uuid,
    day_of_week integer not null check (day_of_week between 0 and 6),
    start_time time not null,
    end_time time not null,
    break_minutes integer not null default 60 check (break_minutes >= 0),
    created_at timestamptz not null default now()
);

create table if not exists attendance_marks (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references people(id) on delete restrict,
    site_id uuid not null references sites(id) on delete restrict,
    event_type text not null check (event_type in ('IN','OUT')),
    event_ts timestamptz not null default now(),
    geo_lat double precision,
    geo_lng double precision,
    geo_acc double precision,
    device_id text,
    client_ts timestamptz,
    note text,
    hash_prev text,
    hash_self text not null,
    receipt_url text,
    created_at timestamptz not null default now()
);

create index if not exists idx_attendance_marks_person_ts on attendance_marks(person_id, event_ts desc);
create index if not exists idx_attendance_marks_site_ts on attendance_marks(site_id, event_ts desc);

create table if not exists attendance_modifications (
    id uuid primary key default gen_random_uuid(),
    mark_id uuid not null references attendance_marks(id) on delete restrict,
    requester_id uuid not null references people(id) on delete restrict,
    reason text not null,
    requested_delta interval not null,
    status text not null check (status in ('PENDING','APPROVED','REJECTED')) default 'PENDING',
    resolver_id uuid references people(id) on delete set null,
    resolved_at timestamptz,
    notes text,
    created_at timestamptz not null default now()
);

create unique index if not exists idx_attendance_modifications_mark_pending
    on attendance_modifications(mark_id)
    where status = 'PENDING';

create table if not exists audit_events (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references people(id) on delete set null,
    action text not null,
    entity text not null,
    entity_id uuid,
    ts timestamptz not null default now(),
    before jsonb,
    after jsonb,
    ip text,
    user_agent text,
    hash_chain text
);

create index if not exists idx_audit_events_entity_ts on audit_events(entity, ts desc);

create table if not exists consent_logs (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references people(id) on delete cascade,
    consent_type text not null check (consent_type in ('GEO','PRIVACY')),
    version text not null,
    accepted_at timestamptz not null default now(),
    ip text,
    user_agent text,
    constraint consent_unique_per_version unique (person_id, consent_type, version)
);

create table if not exists dt_access_tokens (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    scope jsonb not null,
    expires_at timestamptz not null,
    issued_by uuid not null references people(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_dt_access_tokens_expires on dt_access_tokens(expires_at);

create table if not exists alerts (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references people(id) on delete cascade,
    kind text not null,
    ts timestamptz not null default now(),
    resolved boolean not null default false,
    resolved_at timestamptz,
    metadata jsonb,
    constraint alerts_kind_ts unique (person_id, kind, ts)
);

create table if not exists settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

-- Helper table for mark hash verification trail
drop table if exists attendance_mark_hash_log;
create table attendance_mark_hash_log (
    mark_id uuid primary key references attendance_marks(id) on delete cascade,
    computed_at timestamptz not null default now(),
    hash_self text not null,
    hash_prev text
);
