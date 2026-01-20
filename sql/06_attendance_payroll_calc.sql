-- Attendance daily summary + Payroll calculation helpers (idempotent)
-- Run this script in Supabase SQL editor after core schema + HR/Payroll tables.

create extension if not exists pgcrypto;

-- === Daily attendance summary (for dashboards + payroll) ===
create or replace view attendance_daily as
select
  am.person_id,
  am.event_ts::date as work_date,
  min(am.event_ts) filter (where am.event_type = 'IN') as first_in_ts,
  max(am.event_ts) filter (where am.event_type = 'OUT') as last_out_ts,
  count(*) filter (where am.event_type = 'IN') as in_total,
  count(*) filter (where am.event_type = 'OUT') as out_total,
  (
    min(am.event_ts) filter (where am.event_type = 'IN') is not null
  ) as has_in,
  (
    max(am.event_ts) filter (where am.event_type = 'OUT') is not null
  ) as has_out,
  greatest(
    0,
    extract(
      epoch
      from (
        (max(am.event_ts) filter (where am.event_type = 'OUT'))
        - (min(am.event_ts) filter (where am.event_type = 'IN'))
      )
    ) / 60
  )::int as worked_minutes,
  count(distinct am.site_id) as sites_touched
from attendance_marks am
group by am.person_id, am.event_ts::date;

-- === Payroll variables (optional additions/deductions per period) ===
create table if not exists payroll_variable_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  line_type text not null check (line_type in ('EARNING','DEDUCTION','TAX','OTHER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists payroll_person_variables (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  period_id uuid not null references payroll_periods(id) on delete cascade,
  variable_type_id uuid not null references payroll_variable_types(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint payroll_person_variables_unique unique (person_id, period_id, variable_type_id)
);

create index if not exists idx_payroll_person_variables_period on payroll_person_variables(period_id, person_id);

alter table payroll_variable_types enable row level security;
drop policy if exists payroll_variable_types_admin_all on payroll_variable_types;
create policy payroll_variable_types_admin_all on payroll_variable_types
  for all using (is_admin()) with check (is_admin());

alter table payroll_person_variables enable row level security;
drop policy if exists payroll_person_variables_admin_all on payroll_person_variables;
create policy payroll_person_variables_admin_all on payroll_person_variables
  for all using (is_admin()) with check (is_admin());

-- === Payroll calculation ===
-- Rule: day worked = day with at least one IN mark.
-- Base earning = (salary_monthly / days_in_period) * days_worked.
create or replace function fn_payroll_calculate_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period payroll_periods%rowtype;
  v_run payroll_runs%rowtype;
  v_days_in_period int;
  v_people int := 0;
  v_payslips int := 0;
begin
  select * into v_run from payroll_runs where id = p_run_id;
  if not found then
    raise exception 'RUN_NOT_FOUND';
  end if;

  select * into v_period from payroll_periods where id = v_run.period_id;
  if not found then
    raise exception 'PERIOD_NOT_FOUND';
  end if;

  v_days_in_period := (v_period.end_date - v_period.start_date) + 1;
  if v_days_in_period <= 0 then
    raise exception 'INVALID_PERIOD_DATES';
  end if;

  -- Ensure payslips exist for selected people (active workers by default)
  with eligible as (
    select
      p.id as person_id,
      p.business_id,
      p.position_id,
      p.salary_monthly,
      coalesce((
        select count(*)
        from attendance_daily ad
        where ad.person_id = p.id
          and ad.work_date between v_period.start_date and v_period.end_date
          and ad.has_in = true
      ), 0) as days_worked
    from people p
    where p.is_active = true
      and (v_run.business_id is null or p.business_id = v_run.business_id)
  ),
  vars as (
    select
      pv.person_id,
      sum(pv.amount) filter (where vt.line_type in ('EARNING','OTHER')) as var_earnings,
      sum(pv.amount) filter (where vt.line_type in ('DEDUCTION','TAX')) as var_deductions
    from payroll_person_variables pv
    join payroll_variable_types vt on vt.id = pv.variable_type_id
    where pv.period_id = v_period.id
      and vt.is_active = true
    group by pv.person_id
  ),
  upserted as (
    insert into payroll_payslips(
      run_id,
      person_id,
      business_id,
      position_id,
      salary_base,
      gross,
      deductions,
      net
    )
    select
      p_run_id,
      e.person_id,
      e.business_id,
      e.position_id,
      e.salary_monthly,
      round(coalesce(e.salary_monthly, 0) / v_days_in_period * e.days_worked, 2)
        + coalesce(v.var_earnings, 0),
      coalesce(v.var_deductions, 0),
      round(
        (round(coalesce(e.salary_monthly, 0) / v_days_in_period * e.days_worked, 2) + coalesce(v.var_earnings, 0))
        - coalesce(v.var_deductions, 0),
        2
      )
    from eligible e
    left join vars v on v.person_id = e.person_id
    on conflict (run_id, person_id) do update set
      business_id = excluded.business_id,
      position_id = excluded.position_id,
      salary_base = excluded.salary_base,
      gross = excluded.gross,
      deductions = excluded.deductions,
      net = excluded.net
    returning id, person_id
  )
  select count(*) into v_payslips from upserted;

  select count(*) into v_people
  from people p
  where p.is_active = true
    and (v_run.business_id is null or p.business_id = v_run.business_id);

  -- Refresh lines: base + variables (idempotent)
  delete from payroll_payslip_lines
  where payslip_id in (select id from payroll_payslips where run_id = p_run_id);

  insert into payroll_payslip_lines(payslip_id, line_type, code, label, amount)
  select
    ps.id,
    'EARNING',
    'BASE_DAYS',
    'Sueldo base prorrateado (días trabajados)',
    round(coalesce(ps.salary_base, 0) / v_days_in_period * coalesce(e.days_worked, 0), 2)
  from payroll_payslips ps
  left join (
    select person_id, count(*) as days_worked
    from attendance_daily
    where work_date between v_period.start_date and v_period.end_date
      and has_in = true
    group by person_id
  ) e on e.person_id = ps.person_id
  where ps.run_id = p_run_id;

  insert into payroll_payslip_lines(payslip_id, line_type, code, label, amount)
  select
    ps.id,
    vt.line_type,
    vt.code,
    vt.label,
    pv.amount
  from payroll_payslips ps
  join payroll_runs r on r.id = ps.run_id
  join payroll_periods pp on pp.id = r.period_id
  join payroll_person_variables pv on pv.person_id = ps.person_id and pv.period_id = pp.id
  join payroll_variable_types vt on vt.id = pv.variable_type_id
  where ps.run_id = p_run_id
    and vt.is_active = true;

  update payroll_runs set status = 'CALCULATED' where id = p_run_id;

  return jsonb_build_object(
    'run_id', p_run_id,
    'period_id', v_period.id,
    'days_in_period', v_days_in_period,
    'eligible_people', v_people,
    'payslips_upserted', v_payslips
  );
end;
$$;
