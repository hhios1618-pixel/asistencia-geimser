import 'server-only';

import { runQuery } from '../db/postgres';
import type { Tables, Json } from '../../types/database';

type ScheduleRow = Pick<
  Tables['schedules']['Row'],
  'person_id' | 'week_start' | 'day_of_week' | 'start_time' | 'end_time' | 'break_minutes'
>;

type PersonRow = Pick<Tables['people']['Row'], 'id' | 'rut' | 'name'>;

type HrRow = {
  rut_full: string;
  jornada_laboral: number | null;
};

type ShiftInstance = {
  person_id: string;
  week_start: string | null;
  day_of_week: number;
  date_start: string;
  date_end: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  start_abs_min: number;
  end_abs_min: number;
  duration_min: number;
  work_min: number;
};

type ComplianceAlert = {
  person_id: string;
  kind: string;
  ts: string;
  metadata: Json;
};

const MIN_REST_HOURS = 10;
const MIN_REST_MINUTES = MIN_REST_HOURS * 60;

const KINDS = {
  WEEKLY_HOURS: 'SCHEDULE_WEEKLY_HOURS_EXCEEDED',
  MIN_REST: 'SCHEDULE_MIN_REST_10H',
  CONSECUTIVE_DAYS: 'SCHEDULE_7_CONSECUTIVE_DAYS',
  SUNDAYS_OFF: 'SCHEDULE_SUNDAYS_OFF_INSUFFICIENT',
} as const;

const normalizeTimeHHMM = (value: string) => {
  const trimmed = (value ?? '').trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.slice(0, 5);
  return null;
};

const timeToMinutes = (hhmm: string) => {
  const parts = hhmm.split(':');
  const h = Number(parts[0] ?? NaN);
  const m = Number(parts[1] ?? NaN);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const parseIsoDateToDayIndex = (isoDate: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const ms = Date.UTC(year, month - 1, day);
  return Math.floor(ms / 86_400_000);
};

const isoDateFromDayIndex = (dayIndex: number) => new Date(dayIndex * 86_400_000).toISOString().slice(0, 10);

const addDaysIso = (isoDate: string, days: number) => {
  const base = parseIsoDateToDayIndex(isoDate);
  if (base == null) return null;
  return isoDateFromDayIndex(base + days);
};

// DB stores day_of_week as JS convention: 0=Domingo, 1=Lunes, ... 6=Sábado.
// week_start is Monday of that week. Convert to offset from week_start (0..6).
const offsetFromWeekStart = (dayOfWeek: number) => (dayOfWeek + 6) % 7;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeRut = (value: string | null | undefined) =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^0-9k]/g, '');

const countSundaysInMonth = (year: number, month1to12: number) => {
  const firstDayMs = Date.UTC(year, month1to12 - 1, 1);
  const first = new Date(firstDayMs);
  const nextMonth = new Date(Date.UTC(year, month1to12, 1));
  const days = Math.floor((nextMonth.getTime() - first.getTime()) / 86_400_000);
  let total = 0;
  for (let d = 0; d < days; d += 1) {
    const date = new Date(firstDayMs + d * 86_400_000);
    if (date.getUTCDay() === 0) total += 1;
  }
  return total;
};

const monthKeyFromIsoDate = (isoDate: string) => isoDate.slice(0, 7);

const monthRangeFromMonthKey = (monthKey: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const start = `${match[1]}-${match[2]}-01`;
  const startDayIndex = parseIsoDateToDayIndex(start);
  if (startDayIndex == null) return null;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const days = Math.floor((nextMonth.getTime() - Date.UTC(year, month - 1, 1)) / 86_400_000);
  const end = isoDateFromDayIndex(startDayIndex + (days - 1));
  return { year, month, start, end };
};

const startOfWeekMonday = (isoDate: string) => {
  const dayIndex = parseIsoDateToDayIndex(isoDate);
  if (dayIndex == null) return null;
  const date = new Date(dayIndex * 86_400_000);
  const dow = date.getUTCDay(); // 0=Sunday..6=Saturday
  const offset = (dow + 6) % 7; // days since Monday
  return isoDateFromDayIndex(dayIndex - offset);
};

const splitMinutesByDayIndex = (startAbsMin: number, endAbsMin: number) => {
  const map = new Map<number, number>();
  let cursor = startAbsMin;
  while (cursor < endAbsMin) {
    const dayIndex = Math.floor(cursor / 1440);
    const nextBoundary = Math.min(endAbsMin, (dayIndex + 1) * 1440);
    map.set(dayIndex, (map.get(dayIndex) ?? 0) + (nextBoundary - cursor));
    cursor = nextBoundary;
  }
  return map;
};

const buildShiftInstance = (row: ScheduleRow, weekStartFallback: string) => {
  const week_start = row.week_start ?? weekStartFallback;
  const person_id = row.person_id;
  if (!person_id) return null;

  const weekDayIndex = parseIsoDateToDayIndex(week_start);
  if (weekDayIndex == null) return null;

  const startHHMM = normalizeTimeHHMM(row.start_time);
  const endHHMM = normalizeTimeHHMM(row.end_time);
  if (!startHHMM || !endHHMM) return null;

  const startMinutes = timeToMinutes(startHHMM);
  const endMinutes = timeToMinutes(endHHMM);
  if (startMinutes == null || endMinutes == null) return null;

  const dayOffset = offsetFromWeekStart(row.day_of_week);
  const startDayIndex = weekDayIndex + dayOffset;

  const overnight = endMinutes <= startMinutes;
  const endDayIndex = startDayIndex + (overnight ? 1 : 0);

  const start_abs_min = startDayIndex * 1440 + startMinutes;
  const end_abs_min = endDayIndex * 1440 + endMinutes;
  const duration_min = Math.max(0, end_abs_min - start_abs_min);
  const break_minutes = clamp(Number(row.break_minutes ?? 0), 0, 24 * 60);
  const work_min = Math.max(0, duration_min - break_minutes);

  return {
    person_id,
    week_start: row.week_start ?? null,
    day_of_week: row.day_of_week,
    date_start: isoDateFromDayIndex(startDayIndex),
    date_end: isoDateFromDayIndex(endDayIndex),
    start_time: startHHMM,
    end_time: endHHMM,
    break_minutes,
    start_abs_min,
    end_abs_min,
    duration_min,
    work_min,
  } satisfies ShiftInstance;
};

const overlapMinutes = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const computeWeeklyWorkMinutes = (weekStartISO: string, shifts: ShiftInstance[]) => {
  const weekDayIndex = parseIsoDateToDayIndex(weekStartISO);
  if (weekDayIndex == null) return null;
  const weekStartAbs = weekDayIndex * 1440;
  const weekEndAbs = (weekDayIndex + 7) * 1440;

  let total = 0;
  shifts.forEach((shift) => {
    const overlap = overlapMinutes(shift.start_abs_min, shift.end_abs_min, weekStartAbs, weekEndAbs);
    if (overlap <= 0 || shift.duration_min <= 0 || shift.work_min <= 0) return;
    total += (shift.work_min * overlap) / shift.duration_min;
  });

  return Math.round(total);
};

const computeWorkedDayIndexSet = (shifts: ShiftInstance[]) => {
  const worked = new Set<number>();
  shifts.forEach((shift) => {
    if (shift.duration_min <= 0) return;
    const byDay = splitMinutesByDayIndex(shift.start_abs_min, shift.end_abs_min);
    byDay.forEach((minutes, dayIndex) => {
      if (minutes > 0) worked.add(dayIndex);
    });
  });
  return worked;
};

const findConsecutiveStreaks = (workedDayIndices: number[]) => {
  if (workedDayIndices.length === 0) return [];
  const sorted = [...new Set(workedDayIndices)].sort((a, b) => a - b);
  const streaks: Array<{ start: number; end: number; length: number }> = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i < sorted.length; i += 1) {
    const day = sorted[i]!;
    if (day === prev + 1) {
      prev = day;
      continue;
    }
    streaks.push({ start, end: prev, length: prev - start + 1 });
    start = day;
    prev = day;
  }
  streaks.push({ start, end: prev, length: prev - start + 1 });
  return streaks;
};

const isoTsAtNoonZ = (isoDate: string) => `${isoDate}T12:00:00Z`;

async function fetchHrWeeklyHoursByRut(people: PersonRow[]) {
  const rutList = people.map((p) => normalizeRut(p.rut)).filter((r) => r.length > 0);
  const normalizedUnique = Array.from(new Set(rutList));
  if (normalizedUnique.length === 0) {
    return new Map<string, number | null>();
  }

  try {
    const { rows } = await runQuery<HrRow>(
      `select rut_full, jornada_laboral
       from public.hr_collaborators_sheet
       where lower(regexp_replace(rut_full, '[^0-9kK]', '', 'g')) = any($1::text[])`,
      [normalizedUnique]
    );

    const map = new Map<string, number | null>();
    rows.forEach((row) => {
      map.set(normalizeRut(row.rut_full), row.jornada_laboral ?? null);
    });
    return map;
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError?.code === '42P01') {
      // hr_collaborators_sheet table not present in this environment.
      return new Map<string, number | null>();
    }
    console.warn('[scheduleCompliance] HR lookup failed', pgError?.message ?? error);
    return new Map<string, number | null>();
  }
}

async function upsertComplianceAlerts(alerts: ComplianceAlert[]) {
  if (alerts.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < alerts.length; i += chunkSize) {
    const chunk = alerts.slice(i, i + chunkSize);
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    for (const alert of chunk) {
      values.push(`($${paramIndex++}::uuid, $${paramIndex++}::text, $${paramIndex++}::timestamptz, $${paramIndex++}::jsonb)`);
      params.push(alert.person_id, alert.kind, alert.ts, alert.metadata);
    }

    await runQuery(
      `insert into public.alerts (person_id, kind, ts, metadata)
       values ${values.join(', ')}
       on conflict (person_id, kind, ts)
       do update set metadata = excluded.metadata, resolved = false, resolved_at = null`,
      params
    );
  }
}

async function resolveComplianceAlertsInRange(personId: string, kinds: string[], startTs: string, endTs: string) {
  await runQuery(
    `update public.alerts
     set resolved = true, resolved_at = now()
     where person_id = $1::uuid
       and resolved = false
       and kind = any($2::text[])
       and ts >= $3::timestamptz
       and ts < $4::timestamptz`,
    [personId, kinds, startTs, endTs]
  );
}

export type ScheduleComplianceRecalcInput = {
  personIds: string[];
  weekStarts: Array<string | null>;
};

export async function recalculateScheduleComplianceAlerts(input: ScheduleComplianceRecalcInput) {
  const personIds = Array.from(new Set(input.personIds)).filter(Boolean);
  if (personIds.length === 0) return;

  const weekStartsRaw = Array.from(new Set(input.weekStarts));
  const realWeekStarts = weekStartsRaw.filter((w): w is string => typeof w === 'string' && w.length > 0);
  const includeTemplate = weekStartsRaw.some((w) => w == null);

  // Expand by ±1 week to catch: (a) Sunday->Monday overnight boundary, (b) rest gaps across week boundaries,
  // (c) 7-day streaks that start/end near a modified week.
  const expandedWeekStarts = new Set<string>();
  for (const w of realWeekStarts) {
    expandedWeekStarts.add(w);
    const prev = addDaysIso(w, -7);
    const next = addDaysIso(w, 7);
    if (prev) expandedWeekStarts.add(prev);
    if (next) expandedWeekStarts.add(next);
  }
  const expanded = Array.from(expandedWeekStarts).sort();

  // Determine month keys affected by the changed weeks (for the "2 Sundays off/month" rule).
  const affectedMonths = new Set<string>();
  for (const w of realWeekStarts) {
    for (let d = 0; d < 7; d += 1) {
      const day = addDaysIso(w, d);
      if (day) affectedMonths.add(monthKeyFromIsoDate(day));
    }
  }

  const { rows: people } = await runQuery<PersonRow>(
    'select id, rut, name from public.people where id = any($1::uuid[])',
    [personIds]
  );
  const personById = new Map(people.map((p) => [p.id, p]));

  const weeklyHoursByRut = await fetchHrWeeklyHoursByRut(people);

  // Figure out the schedule fetch range. If we need monthly validation, expand range to cover whole months.
  let minWeekStart: string | null = expanded[0] ?? null;
  let maxWeekStart: string | null = expanded.at(-1) ?? null;

  if (affectedMonths.size > 0) {
    const monthStarts: string[] = [];
    const monthEnds: string[] = [];
    affectedMonths.forEach((monthKey) => {
      const range = monthRangeFromMonthKey(monthKey);
      if (!range) return;
      const monthWeekStart = startOfWeekMonday(range.start);
      const monthWeekEnd = startOfWeekMonday(range.end);
      if (monthWeekStart) monthStarts.push(monthWeekStart);
      if (monthWeekEnd) monthEnds.push(monthWeekEnd);
    });
    monthStarts.sort();
    monthEnds.sort();
    if (monthStarts[0]) minWeekStart = minWeekStart ? (monthStarts[0] < minWeekStart ? monthStarts[0] : minWeekStart) : monthStarts[0];
    if (monthEnds.at(-1)) maxWeekStart = maxWeekStart ? (monthEnds.at(-1)! > maxWeekStart ? monthEnds.at(-1)! : maxWeekStart) : monthEnds.at(-1)!;
  }

  const scheduleRows: ScheduleRow[] = [];
  if (minWeekStart && maxWeekStart) {
    const { rows } = await runQuery<ScheduleRow>(
      `select person_id, week_start, day_of_week, start_time, end_time, break_minutes
       from public.schedules
       where person_id = any($1::uuid[])
         and week_start is not null
         and week_start between $2::date and $3::date`,
      [personIds, minWeekStart, maxWeekStart]
    );
    scheduleRows.push(...rows);
  }

  const templateRows: ScheduleRow[] = [];
  if (includeTemplate) {
    const { rows } = await runQuery<ScheduleRow>(
      `select person_id, week_start, day_of_week, start_time, end_time, break_minutes
       from public.schedules
       where person_id = any($1::uuid[])
         and week_start is null`,
      [personIds]
    );
    templateRows.push(...rows);
  }

  const allRows = [...scheduleRows, ...templateRows];
  const rowsByPerson = new Map<string, ScheduleRow[]>();
  allRows.forEach((row) => {
    if (!row.person_id) return;
    const list = rowsByPerson.get(row.person_id) ?? [];
    list.push(row);
    rowsByPerson.set(row.person_id, list);
  });

  const allAlerts: ComplianceAlert[] = [];

  for (const personId of personIds) {
    const person = personById.get(personId) ?? null;
    const rutKey = normalizeRut(person?.rut ?? null);
    const allowedWeeklyHours = rutKey ? weeklyHoursByRut.get(rutKey) ?? null : null;

    const rows = rowsByPerson.get(personId) ?? [];
    const shifts: ShiftInstance[] = [];

    // Use a fixed virtual Monday when validating template schedules.
    const TEMPLATE_WEEK_START = '2000-01-03';
    rows.forEach((row) => {
      const instance = buildShiftInstance(row, TEMPLATE_WEEK_START);
      if (instance) shifts.push(instance);
    });
    shifts.sort((a, b) => a.start_abs_min - b.start_abs_min);

    // Resolve old compliance alerts in relevant ranges so violations disappearing get cleaned up.
    if (minWeekStart && maxWeekStart) {
      const startTs = isoTsAtNoonZ(minWeekStart);
      const endPlusOneWeek = addDaysIso(maxWeekStart, 14) ?? maxWeekStart;
      const endTs = isoTsAtNoonZ(endPlusOneWeek);
      await resolveComplianceAlertsInRange(personId, Object.values(KINDS), startTs, endTs);
    }
    if (includeTemplate) {
      await resolveComplianceAlertsInRange(
        personId,
        Object.values(KINDS),
        isoTsAtNoonZ(TEMPLATE_WEEK_START),
        isoTsAtNoonZ(addDaysIso(TEMPLATE_WEEK_START, 14) ?? TEMPLATE_WEEK_START)
      );
    }

    // 1) Weekly hours vs "Ficha" (jornada_laboral).
    const weeksToCheck = includeTemplate ? [...expanded, TEMPLATE_WEEK_START] : [...expanded];
    for (const weekStart of weeksToCheck) {
      const totalWork = computeWeeklyWorkMinutes(weekStart, shifts);
      if (totalWork == null || allowedWeeklyHours == null) continue;
      const allowedMinutes = allowedWeeklyHours * 60;
      if (totalWork <= allowedMinutes) continue;

      const exceededMinutes = totalWork - allowedMinutes;
      const totalHours = (totalWork / 60).toFixed(2);
      const exceededHours = (exceededMinutes / 60).toFixed(2);

      allAlerts.push({
        person_id: personId,
        kind: KINDS.WEEKLY_HOURS,
        ts: isoTsAtNoonZ(weekStart),
        metadata: {
          title: 'Exceso de horas programadas',
          description: `Se programaron ${totalHours}h en la semana (jornada ficha: ${allowedWeeklyHours}h). Exceso: ${exceededHours}h (alerta desde la hora ${allowedWeeklyHours + 1}).`,
          week_start: weekStart === TEMPLATE_WEEK_START ? null : weekStart,
          template: weekStart === TEMPLATE_WEEK_START,
          jornada_ficha_horas: allowedWeeklyHours,
          total_programado_min: totalWork,
          exceso_min: exceededMinutes,
          person: person?.name ?? null,
        } satisfies Json,
      });
    }

    // 4) Min rest between consecutive shifts (10 hours).
    for (let i = 0; i < shifts.length - 1; i += 1) {
      const prev = shifts[i]!;
      const next = shifts[i + 1]!;
      const restMin = next.start_abs_min - prev.end_abs_min;
      if (restMin >= MIN_REST_MINUTES) continue;

      const restHours = Math.max(0, restMin) / 60;
      allAlerts.push({
        person_id: personId,
        kind: KINDS.MIN_REST,
        ts: isoTsAtNoonZ(next.date_start),
        metadata: {
          title: 'Descanso insuficiente entre turnos',
          description: `Descanso entre ${prev.date_end} ${prev.end_time} y ${next.date_start} ${next.start_time}: ${restHours.toFixed(2)}h (mínimo ${MIN_REST_HOURS}h).`,
          week_start: next.week_start,
          prev_shift: {
            week_start: prev.week_start,
            date_start: prev.date_start,
            date_end: prev.date_end,
            start_time: prev.start_time,
            end_time: prev.end_time,
          },
          next_shift: {
            week_start: next.week_start,
            date_start: next.date_start,
            date_end: next.date_end,
            start_time: next.start_time,
            end_time: next.end_time,
          },
          descanso_min: restMin,
          descanso_minimo_horas: MIN_REST_HOURS,
          person: person?.name ?? null,
        } satisfies Json,
      });
    }

    // 2) Overnight / week-boundary handling is addressed by: (a) absolute-minute modeling, and (b) weekly overlap in computeWeeklyWorkMinutes.
    // 3a) Prevent 7 days in a row.
    const workedSet = computeWorkedDayIndexSet(shifts);
    const workedDays = Array.from(workedSet);
    const streaks = findConsecutiveStreaks(workedDays);
    streaks
      .filter((streak) => streak.length >= 7)
      .forEach((streak) => {
        const startDate = isoDateFromDayIndex(streak.start);
        const endDate = isoDateFromDayIndex(streak.end);
        allAlerts.push({
          person_id: personId,
          kind: KINDS.CONSECUTIVE_DAYS,
          ts: isoTsAtNoonZ(endDate),
          metadata: {
            title: '7+ días consecutivos programados',
            description: `Se detectan ${streak.length} días consecutivos con turno entre ${startDate} y ${endDate}.`,
            streak_start: startDate,
            streak_end: endDate,
            consecutive_days: streak.length,
            person: person?.name ?? null,
          } satisfies Json,
        });
      });

    // 3b) At least 2 Sundays off per calendar month.
    affectedMonths.forEach((monthKey) => {
      const range = monthRangeFromMonthKey(monthKey);
      if (!range) return;

      const monthStartDayIndex = parseIsoDateToDayIndex(range.start);
      const monthEndDayIndex = parseIsoDateToDayIndex(range.end);
      if (monthStartDayIndex == null || monthEndDayIndex == null) return;

      let workedSundays = 0;
      for (let dayIndex = monthStartDayIndex; dayIndex <= monthEndDayIndex; dayIndex += 1) {
        const date = new Date(dayIndex * 86_400_000);
        if (date.getUTCDay() !== 0) continue;
        if (workedSet.has(dayIndex)) workedSundays += 1;
      }

      const totalSundays = countSundaysInMonth(range.year, range.month);
      const offSundays = totalSundays - workedSundays;
      if (offSundays >= 2) return;

      allAlerts.push({
        person_id: personId,
        kind: KINDS.SUNDAYS_OFF,
        ts: isoTsAtNoonZ(range.start),
        metadata: {
          title: 'Domingos de descanso insuficientes',
          description: `En ${monthKey} hay ${workedSundays} domingos trabajados (${totalSundays} domingos en el mes). Se requieren al menos 2 domingos libres.`,
          month: monthKey,
          total_sundays: totalSundays,
          worked_sundays: workedSundays,
          off_sundays: offSundays,
          required_off_sundays: 2,
          person: person?.name ?? null,
        } satisfies Json,
      });
    });
  }

  await upsertComplianceAlerts(allAlerts);
}

