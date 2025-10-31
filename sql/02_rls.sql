-- Enable row level security and define policies

-- Helper functions for role checks
create or replace function public.is_admin()
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

alter table people enable row level security;
drop policy if exists people_self_select on people;
drop policy if exists people_admin_crud on people;
create policy people_self_select on people
    for select using (id = auth.uid() or is_admin());
create policy people_admin_crud on people
    for all using (is_admin()) with check (is_admin());

alter table sites enable row level security;
drop policy if exists sites_member_select on sites;
drop policy if exists sites_admin_crud on sites;
create policy sites_member_select on sites
    for select using (
        is_admin() or exists (
            select 1 from people_sites ps
            where ps.site_id = sites.id and ps.person_id = auth.uid() and ps.active
        )
    );
create policy sites_admin_crud on sites
    for all using (is_admin()) with check (is_admin());

alter table people_sites enable row level security;
drop policy if exists people_sites_self_select on people_sites;
drop policy if exists people_sites_admin_crud on people_sites;
create policy people_sites_self_select on people_sites
    for select using (person_id = auth.uid() or is_admin());
create policy people_sites_admin_crud on people_sites
    for all using (is_admin()) with check (is_admin());

alter table attendance_marks enable row level security;
drop policy if exists attendance_marks_self_select on attendance_marks;
drop policy if exists attendance_marks_self_insert on attendance_marks;
create policy attendance_marks_self_select on attendance_marks
    for select using (person_id = auth.uid() or is_admin());
create policy attendance_marks_self_insert on attendance_marks
    for insert with check (person_id = auth.uid() or is_admin());

alter table attendance_modifications enable row level security;
drop policy if exists attendance_modifications_visible on attendance_modifications;
drop policy if exists attendance_modifications_self_insert on attendance_modifications;
drop policy if exists attendance_modifications_admin_update on attendance_modifications;
create policy attendance_modifications_visible on attendance_modifications
    for select using (
        requester_id = auth.uid()
        or is_admin()
        or exists (
            select 1 from attendance_marks am
            where am.id = attendance_modifications.mark_id
              and am.person_id = auth.uid()
        )
    );
create policy attendance_modifications_self_insert on attendance_modifications
    for insert with check (requester_id = auth.uid());
create policy attendance_modifications_admin_update on attendance_modifications
    for update using (is_admin()) with check (status in ('APPROVED','REJECTED'));

alter table audit_events enable row level security;
drop policy if exists audit_events_admin_only on audit_events;
create policy audit_events_admin_only on audit_events
    for select using (is_admin());

alter table dt_access_tokens enable row level security;
drop policy if exists dt_access_tokens_admin_only on dt_access_tokens;
create policy dt_access_tokens_admin_only on dt_access_tokens
    for all using (is_admin()) with check (is_admin());

alter table alerts enable row level security;
drop policy if exists alerts_self_select on alerts;
drop policy if exists alerts_admin_manage on alerts;
drop policy if exists alerts_admin_insert on alerts;
create policy alerts_self_select on alerts
    for select using (person_id = auth.uid() or is_admin());
create policy alerts_admin_manage on alerts
    for update using (is_admin()) with check (true);
create policy alerts_admin_insert on alerts
    for insert with check (is_admin());

alter table settings enable row level security;
drop policy if exists settings_admin_all on settings;
create policy settings_admin_all on settings
    for all using (is_admin()) with check (is_admin());

alter table consent_logs enable row level security;
drop policy if exists consent_logs_self_select on consent_logs;
drop policy if exists consent_logs_self_insert on consent_logs;
create policy consent_logs_self_select on consent_logs
    for select using (person_id = auth.uid() or is_admin());
create policy consent_logs_self_insert on consent_logs
    for insert with check (person_id = auth.uid() or is_admin());

-- attendance_mark_hash_log primarily for verification (admin/service only)
alter table attendance_mark_hash_log enable row level security;
drop policy if exists attendance_mark_hash_admin on attendance_mark_hash_log;
create policy attendance_mark_hash_admin on attendance_mark_hash_log
    for all using (is_admin()) with check (is_admin());

alter table team_assignments enable row level security;
drop policy if exists team_assignments_view on team_assignments;
drop policy if exists team_assignments_admin on team_assignments;
create policy team_assignments_view on team_assignments
    for select using (
        supervisor_id = auth.uid()
        or member_id = auth.uid()
        or is_admin()
    );
create policy team_assignments_admin on team_assignments
    for all using (is_admin()) with check (is_admin());

alter table attendance_requests enable row level security;
drop policy if exists attendance_requests_access on attendance_requests;
drop policy if exists attendance_requests_insert on attendance_requests;
drop policy if exists attendance_requests_supervisor_update on attendance_requests;
drop policy if exists attendance_requests_requester_update on attendance_requests;
create policy attendance_requests_access on attendance_requests
    for select using (
        requester_id = auth.uid()
        or supervisor_id = auth.uid()
        or is_admin()
    );
create policy attendance_requests_insert on attendance_requests
    for insert with check (requester_id = auth.uid());
create policy attendance_requests_supervisor_update on attendance_requests
    for update using (supervisor_id = auth.uid() or is_admin())
    with check (true);
create policy attendance_requests_requester_update on attendance_requests
    for update using (requester_id = auth.uid())
    with check (requester_id = auth.uid());
