import { runQuery } from '../db/postgres';
import type { Tables } from '../../types/database';

export type AdminOverviewData = {
  totals: {
    active_people: number;
    inactive_people: number;
    total_sites: number;
    marks_last_30: number;
  };
  marksByDay: { day: string; total: number; in_total: number; out_total: number }[];
  eventDistribution: { event_type: 'IN' | 'OUT'; total: number }[];
  topSites: { site: string; total: number }[];
  recentPeople: { name: string; role: Tables['people']['Row']['role']; created_at: string }[];
  latestMarks: { person: string; event_type: 'IN' | 'OUT'; event_ts: string; site: string | null }[];
  heatmap: { day: string; hours: number[] }[];
};

export const getAdminOverview = async (): Promise<AdminOverviewData> => {
  const totalsResult = await runQuery<{
    active_people: number;
    inactive_people: number;
    total_sites: number;
    marks_last_30: number;
  }>(
    `select
       (select count(*) from public.people where is_active = true) as active_people,
       (select count(*) from public.people where is_active = false) as inactive_people,
       (select count(*) from public.sites) as total_sites,
       (select count(*) from public.attendance_marks where event_ts >= now() - interval '30 days') as marks_last_30`
  );

  const marksResult = await runQuery<{ day: string; total: number; in_total: number; out_total: number }>(
    `with days as (
       select generate_series(current_date - interval '6 days', current_date, interval '1 day')::date as day
     ),
     marks as (
       select event_ts::date as day,
              count(*) as total,
              count(*) filter (where event_type = 'IN') as in_total,
              count(*) filter (where event_type = 'OUT') as out_total
       from public.attendance_marks
       where event_ts >= current_date - interval '6 days'
       group by event_ts::date
     )
     select to_char(days.day, 'YYYY-MM-DD') as day,
            coalesce(marks.total, 0) as total,
            coalesce(marks.in_total, 0) as in_total,
            coalesce(marks.out_total, 0) as out_total
     from days
     left join marks on marks.day = days.day
     order by days.day`
  );

  const distributionResult = await runQuery<{ event_type: 'IN' | 'OUT'; total: number }>(
    `select event_type, count(*) as total
     from public.attendance_marks
     group by event_type`
  );

  const topSitesResult = await runQuery<{ site: string; total: number }>(
    `select coalesce(s.name, 'Sin sitio') as site, count(*) as total
     from public.attendance_marks m
     left join public.sites s on s.id = m.site_id
     group by s.name
     order by total desc
     limit 5`
  );

  const recentPeopleResult = await runQuery<{ name: string; role: Tables['people']['Row']['role']; created_at: string }>(
    `select name, role, created_at
     from public.people
     order by created_at desc
     limit 5`
  );

  const latestMarksResult = await runQuery<{ person: string; event_type: 'IN' | 'OUT'; event_ts: string; site: string | null }>(
    `select
       coalesce(p.name, 'Colaborador') as person,
       m.event_type,
       m.event_ts::text as event_ts,
       s.name as site
     from public.attendance_marks m
     left join public.people p on p.id = m.person_id
     left join public.sites s on s.id = m.site_id
     order by m.event_ts desc
     limit 12`
  );

  const heatmapRows = await runQuery<{ day: string; hour: number; in_total: number }>(
    `with hours as (
       select generate_series(0, 23) as hour
     ),
     days as (
       select generate_series(current_date - interval '6 days', current_date, interval '1 day')::date as day
     ),
     marks as (
       select
         event_ts::date as day,
         extract(hour from event_ts)::int as hour,
         count(*) filter (where event_type = 'IN') as in_total
       from public.attendance_marks
       where event_ts >= current_date - interval '6 days'
       group by 1, 2
     )
     select
       to_char(d.day, 'YYYY-MM-DD') as day,
       h.hour,
       coalesce(m.in_total, 0) as in_total
     from days d
     cross join hours h
     left join marks m on m.day = d.day and m.hour = h.hour
     order by d.day, h.hour`
  );

  const heatmapByDay = new Map<string, number[]>();
  heatmapRows.rows.forEach((row) => {
    const hours = heatmapByDay.get(row.day) ?? Array.from({ length: 24 }, () => 0);
    hours[row.hour] = row.in_total;
    heatmapByDay.set(row.day, hours);
  });

  return {
    totals:
      totalsResult.rows[0] ?? 
      {
        active_people: 0,
        inactive_people: 0,
        total_sites: 0,
        marks_last_30: 0,
      },
    marksByDay: marksResult.rows,
    eventDistribution: distributionResult.rows,
    topSites: topSitesResult.rows,
    recentPeople: recentPeopleResult.rows,
    latestMarks: latestMarksResult.rows,
    heatmap: Array.from(heatmapByDay.entries()).map(([day, hours]) => ({ day, hours })),
  };
};
