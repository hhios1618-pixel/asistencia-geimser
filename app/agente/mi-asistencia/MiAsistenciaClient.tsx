'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { IconCalendar, IconClock, IconChevronDown } from '@tabler/icons-react';

type AttendanceRecord = {
  work_date: string;
  status: string;
  hours_worked: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; badge: string }> = {
  PRESENT:    { label: 'Presente',      color: 'text-emerald-400', dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  ABSENT:     { label: 'Ausente',       color: 'text-rose-400',    dot: 'bg-rose-400',    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300' },
  LATE:       { label: 'Tardanza',      color: 'text-amber-400',   dot: 'bg-amber-400',   badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  HALF_DAY:   { label: 'Media jornada', color: 'text-sky-400',     dot: 'bg-sky-400',     badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  SICK_LEAVE: { label: 'Licencia',      color: 'text-violet-400',  dot: 'bg-violet-400',  badge: 'border-violet-400/30 bg-violet-400/10 text-violet-300' },
  PERMISSION: { label: 'Permiso',       color: 'text-slate-400',   dot: 'bg-slate-500',   badge: 'border-slate-600 bg-white/5 text-slate-400' },
  HOLIDAY:    { label: 'Feriado',       color: 'text-slate-500',   dot: 'bg-slate-600',   badge: 'border-slate-700 bg-white/5 text-slate-500' },
};

function getWeek(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function MiAsistenciaClient({ records }: { records: AttendanceRecord[] }) {
  // Group by month
  const byMonth = useMemo(() => {
    const months: Record<string, AttendanceRecord[]> = {};
    for (const r of records) {
      const key = r.work_date.slice(0, 7); // YYYY-MM
      if (!months[key]) months[key] = [];
      months[key].push(r);
    }
    return months;
  }, [records]);

  // Overall stats
  const stats = useMemo(() => ({
    total: records.length,
    present: records.filter(r => r.status === 'PRESENT').length,
    absent: records.filter(r => r.status === 'ABSENT').length,
    late: records.filter(r => r.status === 'LATE').length,
    hours: records.reduce((a, r) => a + (Number(r.hours_worked) || 0), 0),
  }), [records]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-white/5 flex items-center justify-center mb-4">
          <IconCalendar size={28} className="text-slate-600" />
        </div>
        <p className="text-slate-400 font-medium">Sin registros de asistencia</p>
        <p className="text-slate-600 text-sm mt-1">Los datos se sincronizan automáticamente desde el CRM</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        {[
          { label: 'Días presentes', value: stats.present, color: 'text-emerald-400', border: 'border-emerald-400/20', bg: 'from-emerald-400/10 to-emerald-400/5' },
          { label: 'Ausencias',      value: stats.absent,  color: 'text-rose-400',    border: 'border-rose-400/20',    bg: 'from-rose-400/10 to-rose-400/5' },
          { label: 'Tardanzas',      value: stats.late,    color: 'text-amber-400',   border: 'border-amber-400/20',   bg: 'from-amber-400/10 to-amber-400/5' },
          { label: 'Horas totales',  value: `${Math.round(stats.hours)}h`, color: 'text-[var(--accent)]', border: 'border-[var(--accent)]/20', bg: 'from-[var(--accent)]/10 to-[var(--accent)]/5' },
        ].map(({ label, value, color, border, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07 }}
            className={`relative overflow-hidden rounded-3xl border ${border} bg-gradient-to-br ${bg} p-5`}
          >
            <p className={`text-3xl font-bold ${color} tracking-tight`}>{value}</p>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
            <p className="text-[10px] text-slate-700 mt-1">Últimos 3 meses</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Monthly breakdown */}
      {Object.entries(byMonth)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, recs], monthIdx) => {
          const monthStats = {
            present: recs.filter(r => r.status === 'PRESENT').length,
            absent: recs.filter(r => r.status === 'ABSENT').length,
            late: recs.filter(r => r.status === 'LATE').length,
            hours: recs.reduce((a, r) => a + (Number(r.hours_worked) || 0), 0),
          };

          return (
            <motion.section
              key={monthKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: monthIdx * 0.08 }}
              className="flex flex-col gap-3"
            >
              {/* Month header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white capitalize">{monthLabel(monthKey)}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="text-emerald-400 font-semibold">{monthStats.present}P</span>
                  <span className="text-rose-400 font-semibold">{monthStats.absent}A</span>
                  <span className="text-amber-400 font-semibold">{monthStats.late}T</span>
                  <span className="text-[var(--accent)] font-semibold">{Math.round(monthStats.hours)}h</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                {monthStats.present > 0 && (
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${(monthStats.present / recs.length) * 100}%` }}
                  />
                )}
                {monthStats.late > 0 && (
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${(monthStats.late / recs.length) * 100}%` }}
                  />
                )}
                {monthStats.absent > 0 && (
                  <div
                    className="h-full bg-rose-400"
                    style={{ width: `${(monthStats.absent / recs.length) * 100}%` }}
                  />
                )}
              </div>

              {/* Records */}
              <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)]">
                {recs.map((rec, i) => {
                  const s = STATUS_CONFIG[rec.status] ?? { label: rec.status, color: 'text-slate-400', dot: 'bg-slate-600', badge: 'border-slate-600 bg-white/5 text-slate-400' };
                  const dateObj = new Date(rec.work_date + 'T00:00:00');

                  return (
                    <div
                      key={rec.work_date}
                      className={`flex items-center justify-between px-4 py-3 ${
                        i < recs.length - 1 ? 'border-b border-[rgba(255,255,255,0.04)]' : ''
                      } hover:bg-white/[0.02] transition-colors`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center w-12 flex-shrink-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                            {dateObj.toLocaleDateString('es-CL', { weekday: 'short' })}
                          </p>
                          <p className="text-lg font-bold text-slate-300 leading-none mt-0.5">
                            {dateObj.getDate()}
                          </p>
                        </div>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-bold uppercase tracking-[0.15em] ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        {rec.check_in_time && (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <IconClock size={11} />
                            <span>{rec.check_in_time.slice(0, 5)}</span>
                            {rec.check_out_time && (
                              <><span className="text-slate-700">–</span><span>{rec.check_out_time.slice(0, 5)}</span></>
                            )}
                          </span>
                        )}
                        {rec.hours_worked && (
                          <span className="text-[var(--accent)] font-semibold">{rec.hours_worked}h</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          );
        })}
    </div>
  );
}
