import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../../../../lib/supabase/server';
import { runQuery } from '../../../../../../lib/db/postgres';
import type { Tables } from '../../../../../../types/database';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { role: null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isManager(role)) {
    return { role: null } as const;
  }
  return { role } as const;
};

export async function GET() {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

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

  return NextResponse.json({
    totals: totalsResult.rows[0] ?? {
      active_people: 0,
      inactive_people: 0,
      total_sites: 0,
      marks_last_30: 0,
    },
    marksByDay: marksResult.rows,
    eventDistribution: distributionResult.rows,
    topSites: topSitesResult.rows,
    recentPeople: recentPeopleResult.rows,
  });
}
