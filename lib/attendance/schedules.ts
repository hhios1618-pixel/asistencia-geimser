import 'server-only';

import { startOfWeek, format } from 'date-fns';
import { runQuery } from '../db/postgres';
import type { Tables } from '../../types/database';
import { ensureSchedulesWeekStart } from '../db/ensureSchedulesWeekStart';

export const toWeekStartISO = (date: Date) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  return format(weekStart, 'yyyy-MM-dd');
};

export async function getEffectiveScheduleForDate(personId: string, date: Date) {
  await ensureSchedulesWeekStart();
  const weekStart = toWeekStartISO(date);
  const dayOfWeek = date.getDay();

  const { rows } = await runQuery<Tables['schedules']['Row'] & { week_start?: string | null }>(
    `select *
     from public.schedules
     where person_id = $1
       and day_of_week = $2
       and (week_start = $3::date or week_start is null)
     order by (week_start is null) asc, created_at desc
     limit 1`,
    [personId, dayOfWeek, weekStart]
  );

  return rows[0] ?? null;
}

export async function getEffectiveWeeklySchedules(personId: string, weekStartISO: string) {
  await ensureSchedulesWeekStart();

  const { rows } = await runQuery<Tables['schedules']['Row'] & { week_start?: string | null }>(
    `select distinct on (day_of_week) *
     from public.schedules
     where person_id = $1
       and (week_start = $2::date or week_start is null)
     order by day_of_week, (week_start is null) asc, created_at desc, start_time asc`,
    [personId, weekStartISO]
  );

  return rows;
}
