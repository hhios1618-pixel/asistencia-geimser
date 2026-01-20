-- HR + Payroll module (idempotent) for Asistencia G-Trace (Supabase/Postgres)
-- Run as a single script from Supabase SQL editor.

create extension if not exists pgcrypto;

-- === HR master data ===
create table if not exists hr_businesses (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    legal_name text,
    tax_id text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists hr_positions (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    level text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- === Extend core people with HR fields ===
alter table people add column if not exists business_id uuid;
alter table people add column if not exists position_id uuid;
alter table people add column if not exists address_line1 text;
alter table people add column if not exists address_line2 text;
alter table people add column if not exists city text;
alter table people add column if not exists region text;
alter table people add column if not exists country text;
alter table people add column if not exists birth_date date;
alter table people add column if not exists hire_date date;
alter table people add column if not exists salary_monthly numeric(12,2);
alter table people add column if not exists employment_type text;
alter table people add column if not exists termination_date date;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'people_business_id_fkey'
    ) then
        alter table people
        add constraint people_business_id_fkey
        foreign key (business_id) references hr_businesses(id) on delete set null;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'people_position_id_fkey'
    ) then
        alter table people
        add constraint people_position_id_fkey
        foreign key (position_id) references hr_positions(id) on delete set null;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'people_salary_monthly_nonneg'
    ) then
        alter table people
        add constraint people_salary_monthly_nonneg
        check (salary_monthly is null or salary_monthly >= 0);
    end if;
end $$;

create index if not exists idx_people_business_id on people(business_id);
create index if not exists idx_people_position_id on people(position_id);
create index if not exists idx_people_active_business_position on people(is_active, business_id, position_id);

-- === Payroll ===
create table if not exists payroll_periods (
    id uuid primary key default gen_random_uuid(),
    label text,
    start_date date not null,
    end_date date not null,
    status text not null default 'OPEN' check (status in ('OPEN','CLOSED','PAID')),
    created_at timestamptz not null default now(),
    constraint payroll_periods_dates_ok check (end_date >= start_date)
);

create table if not exists payroll_runs (
    id uuid primary key default gen_random_uuid(),
    period_id uuid not null references payroll_periods(id) on delete restrict,
    business_id uuid references hr_businesses(id) on delete set null,
    status text not null default 'DRAFT' check (status in ('DRAFT','CALCULATED','FINALIZED','PAID','CANCELLED')),
    created_by uuid references people(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_payroll_runs_period on payroll_runs(period_id, created_at desc);
create index if not exists idx_payroll_runs_business on payroll_runs(business_id, created_at desc);

create table if not exists payroll_payslips (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references payroll_runs(id) on delete cascade,
    person_id uuid not null references people(id) on delete restrict,
    -- snapshots (avoid breaking history if person changes)
    business_id uuid references hr_businesses(id) on delete set null,
    position_id uuid references hr_positions(id) on delete set null,
    salary_base numeric(12,2),
    gross numeric(12,2),
    deductions numeric(12,2),
    net numeric(12,2),
    currency text not null default 'CLP',
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    constraint payroll_payslips_unique_run_person unique (run_id, person_id),
    constraint payroll_payslips_amounts_nonneg check (
        (salary_base is null or salary_base >= 0)
        and (gross is null or gross >= 0)
        and (deductions is null or deductions >= 0)
        and (net is null or net >= 0)
    )
);

create index if not exists idx_payroll_payslips_person on payroll_payslips(person_id, created_at desc);

create table if not exists payroll_payslip_lines (
    id uuid primary key default gen_random_uuid(),
    payslip_id uuid not null references payroll_payslips(id) on delete cascade,
    line_type text not null check (line_type in ('EARNING','DEDUCTION','TAX','OTHER')),
    code text,
    label text not null,
    amount numeric(12,2) not null,
    created_at timestamptz not null default now(),
    constraint payroll_payslip_lines_amount_nonneg check (amount >= 0)
);

create index if not exists idx_payroll_payslip_lines_payslip on payroll_payslip_lines(payslip_id);

-- === Headcount (auto-updated from people) ===
create or replace view hr_headcount as
select
    b.id as business_id,
    b.name as business_name,
    pos.id as position_id,
    pos.name as position_name,
    count(*) filter (where p.is_active) as headcount_active,
    count(*) as headcount_total,
    coalesce(sum(p.salary_monthly) filter (where p.is_active), 0) as payroll_monthly_active
from people p
left join hr_businesses b on b.id = p.business_id
left join hr_positions pos on pos.id = p.position_id
group by b.id, b.name, pos.id, pos.name;

-- === RLS ===
alter table hr_businesses enable row level security;
drop policy if exists hr_businesses_admin_all on hr_businesses;
create policy hr_businesses_admin_all on hr_businesses
    for all using (is_admin()) with check (is_admin());

alter table hr_positions enable row level security;
drop policy if exists hr_positions_admin_all on hr_positions;
create policy hr_positions_admin_all on hr_positions
    for all using (is_admin()) with check (is_admin());

alter table payroll_periods enable row level security;
drop policy if exists payroll_periods_admin_all on payroll_periods;
create policy payroll_periods_admin_all on payroll_periods
    for all using (is_admin()) with check (is_admin());

alter table payroll_runs enable row level security;
drop policy if exists payroll_runs_admin_all on payroll_runs;
create policy payroll_runs_admin_all on payroll_runs
    for all using (is_admin()) with check (is_admin());

alter table payroll_payslips enable row level security;
drop policy if exists payroll_payslips_self_select on payroll_payslips;
drop policy if exists payroll_payslips_admin_crud on payroll_payslips;
create policy payroll_payslips_self_select on payroll_payslips
    for select using (person_id = auth.uid() or is_admin());
create policy payroll_payslips_admin_crud on payroll_payslips
    for all using (is_admin()) with check (is_admin());

alter table payroll_payslip_lines enable row level security;
drop policy if exists payroll_payslip_lines_self_select on payroll_payslip_lines;
drop policy if exists payroll_payslip_lines_admin_crud on payroll_payslip_lines;
create policy payroll_payslip_lines_self_select on payroll_payslip_lines
    for select using (
        is_admin()
        or exists (
            select 1
            from payroll_payslips ps
            where ps.id = payroll_payslip_lines.payslip_id
              and ps.person_id = auth.uid()
        )
    );
create policy payroll_payslip_lines_admin_crud on payroll_payslip_lines
    for all using (is_admin()) with check (is_admin());

