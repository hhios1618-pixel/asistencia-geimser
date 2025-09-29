'use client';

import { format } from 'date-fns';

interface Props {
  schedule: {
    start_time: string;
    end_time: string;
    break_minutes: number;
  } | null;
  currentDate: Date;
}

export function ShiftInfoCard({ schedule, currentDate }: Props) {
  if (!schedule) {
    return (
      <div className="rounded border p-3">
        <p className="text-sm">No hay jornada programada para hoy.</p>
      </div>
    );
  }

  const dayLabel = format(currentDate, 'EEEE dd/MM');

  return (
    <div className="rounded border p-3">
      <h3 className="mb-2 text-sm font-semibold">Jornada {dayLabel}</h3>
      <ul className="text-sm text-gray-700">
        <li>Inicio: {schedule.start_time}</li>
        <li>Término: {schedule.end_time}</li>
        <li>Colación: {schedule.break_minutes} minutos</li>
      </ul>
    </div>
  );
}

export default ShiftInfoCard;

