-- Seed data for Asistencia Geimser MVP

insert into people (id, rut, name, service, role, is_active, email)
values
    ('00000000-0000-0000-0000-000000000001', '12.345.678-9', 'Admin Geimser', 'Administración', 'ADMIN', true, 'admin@geimser.cl'),
    ('00000000-0000-0000-0000-000000000002', '98.765.432-1', 'Trabajador Demo', 'Operaciones', 'WORKER', true, 'worker@geimser.cl')
on conflict (id) do nothing;

insert into sites (id, name, lat, lng, radius_m, is_active)
values
    ('00000000-0000-0000-0000-0000000000aa', 'Planta Principal', -33.4489, -70.6693, 150, true)
on conflict (id) do nothing;

insert into people_sites (person_id, site_id, active)
values
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', true)
on conflict (person_id, site_id) do nothing;

insert into schedules (id, person_id, day_of_week, start_time, end_time, break_minutes)
values
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 1, time '08:00', time '17:00', 60)
on conflict (id) do nothing;

insert into settings(key, value)
values
    ('official_attendance_system', jsonb_build_object('enabled', true, 'updated_by', 'sysseed')),
    ('dt_portal', jsonb_build_object('base_url', 'https://asistencia-geimser.vercel.app/admin/dt'))
on conflict (key) do update set value = excluded.value, updated_at = now();
