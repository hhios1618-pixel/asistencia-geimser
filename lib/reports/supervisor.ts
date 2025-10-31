import { runQuery } from '../db/postgres';

export type SupervisorOverview = {
  sites: { id: string; name: string }[];
  activePeople: number;
  pendingAlerts: number;
  marksToday: number;
  latestMarks: { person: string; event_type: 'IN' | 'OUT'; event_ts: string; site: string | null }[];
};

export const getSupervisorOverview = async (supervisorId: string): Promise<SupervisorOverview> => {
  const { rows: assignedSiteRows } = await runQuery<{ site_id: string }>(
    'select site_id from public.people_sites where person_id = $1 and active = true',
    [supervisorId]
  );

  const siteIds = assignedSiteRows.map((row) => row.site_id);

  if (siteIds.length === 0) {
    return {
      sites: [],
      activePeople: 0,
      pendingAlerts: 0,
      marksToday: 0,
      latestMarks: [],
    };
  }

  const { rows: siteRows } = await runQuery<{ id: string; name: string }>(
    'select id, name from public.sites where id = any($1::uuid[]) order by name',
    [siteIds]
  );

  const { rows: peopleCount } = await runQuery<{ total: number }>(
    `select count(distinct ps.person_id) as total
     from public.people_sites ps
     join public.people p on p.id = ps.person_id
     where ps.site_id = any($1::uuid[]) and ps.active = true and p.is_active = true`,
    [siteIds]
  );

  let pendingAlerts = 0;
  try {
    const { rows } = await runQuery<{ total: number }>(
      `select count(*) as total
       from public.alerts
       where site_id = any($1::uuid[]) and resolved = false`,
      [siteIds]
    );
    pendingAlerts = Number(rows[0]?.total ?? 0);
  } catch {
    pendingAlerts = 0;
  }

  const { rows: marksToday } = await runQuery<{ total: number }>(
    `select count(*) as total
     from public.attendance_marks
     where site_id = any($1::uuid[])
       and event_ts::date = current_date`,
    [siteIds]
  );

  const { rows: latestMarks } = await runQuery<{
    person: string;
    event_type: 'IN' | 'OUT';
    event_ts: string;
    site: string | null;
  }>(
    `select p.name as person,
            m.event_type,
            m.event_ts,
            s.name as site
     from public.attendance_marks m
     join public.people p on p.id = m.person_id
     left join public.sites s on s.id = m.site_id
     where m.site_id = any($1::uuid[])
     order by m.event_ts desc
     limit 8`,
    [siteIds]
  );

  return {
    sites: siteRows,
    activePeople: Number(peopleCount[0]?.total ?? 0),
    pendingAlerts,
    marksToday: Number(marksToday[0]?.total ?? 0),
    latestMarks,
  };
};

export const getSupervisorTeam = async (supervisorId: string) => {
  const { rows: siteRows } = await runQuery<{ site_id: string }>(
    'select site_id from public.people_sites where person_id = $1 and active = true',
    [supervisorId]
  );
  if (siteRows.length === 0) {
    return [] as { person_id: string; name: string; email: string | null; role: string; sites: string[] }[];
  }
  const siteIds = siteRows.map((row) => row.site_id);
  const { rows } = await runQuery<{
    person_id: string;
    name: string;
    email: string | null;
    role: string;
    sites: string[];
  }>(
    `select p.id as person_id,
            p.name,
            p.email,
            p.role,
            array_agg(distinct s.name) as sites
     from public.people p
     join public.people_sites ps on ps.person_id = p.id and ps.active = true
     left join public.sites s on s.id = ps.site_id
     where ps.site_id = any($1::uuid[]) and p.is_active = true
     group by p.id, p.name, p.email, p.role
     order by p.name`,
    [siteIds]
  );
  return rows;
};

export const getSupervisorSiteDetails = async (supervisorId: string) => {
  const { rows: siteRows } = await runQuery<{ site_id: string }>(
    'select site_id from public.people_sites where person_id = $1 and active = true',
    [supervisorId]
  );
  if (siteRows.length === 0) {
    return [] as {
      id: string;
      name: string;
      total_people: number;
      marks_today: number;
    }[];
  }
  const siteIds = siteRows.map((row) => row.site_id);
  const { rows } = await runQuery<{
    id: string;
    name: string;
    total_people: number;
    marks_today: number;
  }>(
    `select s.id,
            s.name,
            coalesce(
              (
                select count(distinct ps2.person_id)
                from public.people_sites ps2
                where ps2.site_id = s.id and ps2.active = true
              ),
              0
            ) as total_people,
            coalesce(
              (
                select count(*)
                from public.attendance_marks m
                where m.site_id = s.id and m.event_ts::date = current_date
              ),
              0
            ) as marks_today
     from public.sites s
     where s.id = any($1::uuid[])
     order by s.name`,
    [siteIds]
  );
  return rows;
};

export const getSupervisorAlerts = async (supervisorId: string) => {
  const { rows: siteRows } = await runQuery<{ site_id: string }>(
    'select site_id from public.people_sites where person_id = $1 and active = true',
    [supervisorId]
  );
  if (siteRows.length === 0) {
    return [] as {
      id: string;
      kind: string;
      ts: string;
      resolved: boolean;
      metadata: Record<string, unknown> | null;
      site: string | null;
      person: string | null;
    }[];
  }
  const siteIds = siteRows.map((row) => row.site_id);
  const { rows } = await runQuery<{
    id: string;
    kind: string;
    ts: string;
    resolved: boolean;
    metadata: Record<string, unknown> | null;
    site: string | null;
    person: string | null;
  }>(
    `select a.id,
            a.kind,
            a.ts,
            a.resolved,
            a.metadata,
            s.name as site,
            p.name as person
     from public.alerts a
     left join public.sites s on s.id = a.site_id
     left join public.people p on p.id = a.person_id
     where a.site_id = any($1::uuid[])
     order by a.ts desc
     limit 100`,
    [siteIds]
  );
  return rows;
};
