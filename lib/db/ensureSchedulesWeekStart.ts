import 'server-only';

import { runQuery } from './postgres';

let ensured = false;

export async function ensureSchedulesWeekStart() {
  if (ensured) {
    return;
  }

  await runQuery(`alter table public.schedules add column if not exists week_start date`);

  await runQuery(
    `create index if not exists schedules_person_week_day_idx
     on public.schedules (person_id, week_start, day_of_week)`
  );

  try {
    await runQuery(
      `create unique index if not exists schedules_unique_template_day
       on public.schedules (person_id, day_of_week)
       where week_start is null`
    );
  } catch {
    // ignore if there are duplicate legacy rows
  }

  try {
    await runQuery(
      `create unique index if not exists schedules_unique_week_day
       on public.schedules (person_id, week_start, day_of_week)
       where week_start is not null`
    );
  } catch {
    // ignore if there are duplicate legacy rows
  }

  ensured = true;
}
