import { differenceInMinutes, parseISO } from 'date-fns';
import type { Tables, TableInsert, Json } from '../../types/database';

type MarkRow = Tables['attendance_marks']['Row'];
type ScheduleRow = Tables['schedules']['Row'];

export type AlertKind = 'MISSING_OUT' | 'MISSING_IN' | 'NO_BREAK' | 'OVERTIME';

export interface AlertEvaluationContext {
  mark: MarkRow;
  previousMark: MarkRow | null;
  sameDayMarks: MarkRow[];
  activeSchedule: ScheduleRow | null;
}

const minutesBetween = (a: string, b: string): number => Math.abs(differenceInMinutes(parseISO(a), parseISO(b)));

const detectMissingPair = ({ mark, previousMark }: AlertEvaluationContext): AlertKind[] => {
  if (!previousMark) {
    return [];
  }

  if (mark.event_type === 'IN' && previousMark.event_type === 'IN') {
    return ['MISSING_OUT'];
  }
  if (mark.event_type === 'OUT' && previousMark.event_type === 'OUT') {
    return ['MISSING_IN'];
  }

  return [];
};

const detectOvertime = ({ mark, sameDayMarks, activeSchedule }: AlertEvaluationContext): AlertKind[] => {
  if (mark.event_type !== 'OUT') {
    return [];
  }

  const firstIn = sameDayMarks.find((m) => m.event_type === 'IN');
  if (!firstIn) {
    return [];
  }

  const workedMinutes = minutesBetween(firstIn.event_ts, mark.event_ts);
  const scheduledMinutes = activeSchedule
    ? minutesBetween(`${firstIn.event_ts.substring(0, 10)}T${activeSchedule.start_time}`, `${firstIn.event_ts.substring(0, 10)}T${activeSchedule.end_time}`)
    : 8 * 60;

  if (workedMinutes - scheduledMinutes > 60) {
    return ['OVERTIME'];
  }

  return [];
};

const detectMissingBreak = ({ mark, sameDayMarks, activeSchedule }: AlertEvaluationContext): AlertKind[] => {
  if (mark.event_type !== 'OUT' || !activeSchedule) {
    return [];
  }

  const firstIn = sameDayMarks.find((m) => m.event_type === 'IN');
  if (!firstIn) {
    return [];
  }

  const workedMinutes = minutesBetween(firstIn.event_ts, mark.event_ts);
  if (workedMinutes >= activeSchedule.break_minutes + 5 * 60 && activeSchedule.break_minutes > 0) {
    const breakTaken = sameDayMarks.some((m) => m.note?.toLowerCase().includes('break'));
    if (!breakTaken) {
      return ['NO_BREAK'];
    }
  }

  return [];
};

export const evaluateAlerts = (context: AlertEvaluationContext): AlertKind[] => {
  const kinds = new Set<AlertKind>();
  [...detectMissingPair(context), ...detectOvertime(context), ...detectMissingBreak(context)].forEach((kind) =>
    kinds.add(kind)
  );
  return [...kinds];
};

export const buildAlertRecords = (
  personId: string,
  kinds: AlertKind[],
  metadata?: Json
): TableInsert<'alerts'>[] =>
  kinds.map((kind) => ({
    person_id: personId,
    kind,
    metadata: metadata ?? null,
  }));
