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
      <div className="rounded-3xl border border-slate-200/50 bg-white/85 p-6 text-sm text-slate-600 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.4)]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-300/70 via-slate-200/70 to-white text-slate-700 shadow-[0_18px_45px_-30px_rgba(148,163,184,0.6)]">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path d="M5 4.5v-2M15 4.5v-2M3 8h14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Agenda</p>
            <p className="text-base font-semibold text-slate-900">No hay jornada programada para hoy</p>
            <p className="mt-1 text-xs text-slate-500">
              Tus marcas seguirán registrándose aunque no tengas turno asignado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dayLabel = format(currentDate, 'EEEE dd/MM');

  return (
    <div className="overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-blue-500/12 via-indigo-500/10 to-blue-600/15 p-[1px] shadow-[0_28px_70px_-45px_rgba(59,130,246,0.6)]">
      <div className="rounded-[26px] bg-white/92 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Jornada del día</p>
            <h3 className="text-2xl font-semibold text-slate-900">{dayLabel}</h3>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-700">
              Inicio {schedule.start_time}
            </span>
            <span className="rounded-full bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-700">
              Término {schedule.end_time}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M4 9h12M4 13h6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 4v2M13 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Colación</p>
              <p className="font-medium text-slate-900">{schedule.break_minutes} minutos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M10 5v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Recuerda</p>
              <p className="font-medium text-slate-900">Registra tus marcas a tiempo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShiftInfoCard;
