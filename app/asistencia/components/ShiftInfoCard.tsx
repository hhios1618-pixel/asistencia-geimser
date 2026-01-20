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
      <div className="glass-panel rounded-3xl border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 text-sm text-slate-200 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-black shadow-[0_18px_45px_-30px_rgba(0,229,255,0.35)]">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
              <path d="M5 4.5v-2M15 4.5v-2M3 8h14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Agenda</p>
            <p className="text-base font-semibold text-white">No hay jornada programada para hoy</p>
            <p className="mt-1 text-xs text-slate-300">
              Tus marcas seguirán registrándose aunque no tengas turno asignado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dayLabel = format(currentDate, 'EEEE dd/MM');

  return (
    <div className="glass-panel overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 shadow-[0_28px_70px_-45px_rgba(0,229,255,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Jornada del día</p>
            <h3 className="text-2xl font-semibold text-white">{dayLabel}</h3>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full border border-[rgba(0,229,255,0.18)] bg-[rgba(0,229,255,0.10)] px-4 py-2 text-sm font-medium text-slate-100">
              Inicio {schedule.start_time}
            </span>
            <span className="rounded-full border border-[rgba(255,43,214,0.18)] bg-[rgba(255,43,214,0.10)] px-4 py-2 text-sm font-medium text-slate-100">
              Término {schedule.end_time}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(0,229,255,0.18)] bg-[rgba(0,229,255,0.10)] text-slate-100">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M4 9h12M4 13h6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 4v2M13 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Colación</p>
              <p className="font-medium text-white">{schedule.break_minutes} minutos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-white/5 text-slate-100">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M10 5v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Recuerda</p>
              <p className="font-medium text-white">Registra tus marcas a tiempo</p>
            </div>
          </div>
        </div>
    </div>
  );
}

export default ShiftInfoCard;
