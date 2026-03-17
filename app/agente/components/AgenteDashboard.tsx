'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  IconFileText, IconCalendar, IconUser, IconBriefcase,
  IconDownload, IconClock, IconChevronRight, IconFolder,
  IconCircleCheck, IconAlertTriangle,
} from '@tabler/icons-react';

type Profile = {
  name: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  position_name: string | null;
  campaign_name: string | null;
  hire_date: string | null;
  employment_type: string | null;
};

type AttendanceRecord = {
  work_date: string;
  status: string;
  hours_worked: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
};

type AttendanceSummary = {
  present_days: number;
  absent_days: number;
  late_days: number;
  hours_total: number;
};

type Document = {
  id: string;
  doc_type: string;
  period_label: string | null;
  file_name: string;
  created_at: string;
  campaign_name: string | null;
};

type Props = {
  profile: Profile;
  summary: AttendanceSummary;
  recentAttendance: AttendanceRecord[];
  recentDocs: Document[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PRESENT:    { label: 'Presente',      color: 'text-emerald-400', dot: 'bg-emerald-400' },
  ABSENT:     { label: 'Ausente',       color: 'text-rose-400',    dot: 'bg-rose-400' },
  LATE:       { label: 'Tardanza',      color: 'text-amber-400',   dot: 'bg-amber-400' },
  HALF_DAY:   { label: 'Media jornada', color: 'text-sky-400',     dot: 'bg-sky-400' },
  SICK_LEAVE: { label: 'Licencia',      color: 'text-violet-400',  dot: 'bg-violet-400' },
  PERMISSION: { label: 'Permiso',       color: 'text-slate-400',   dot: 'bg-slate-500' },
  HOLIDAY:    { label: 'Feriado',       color: 'text-slate-500',   dot: 'bg-slate-600' },
};

const DOC_LABELS: Record<string, string> = {
  CONTRACT:   'Contrato',
  PAYSLIP:    'Liquidación',
  COTIZACION: 'Cotización',
  ANEXO:      'Anexo',
  FINIQUITO:  'Finiquito',
  REPORT:     'Reporte',
  OTHER:      'Otro',
};

const WORKER_NAV = [
  { label: 'Mis documentos',   href: '/agente/mis-documentos',  icon: IconFolder },
  { label: 'Mi asistencia',    href: '/agente/mi-asistencia',   icon: IconCalendar },
  { label: 'Mi liquidación',   href: '/agente/mis-documentos?tipo=PAYSLIP', icon: IconFileText },
  { label: 'Mi contrato',      href: '/agente/mis-documentos?tipo=CONTRACT', icon: IconCircleCheck },
];

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export default function AgenteDashboard({ profile, summary, recentAttendance, recentDocs }: Props) {
  const thisMonth = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const firstName = profile.name.split(' ')[0];

  const statCards = [
    { label: 'Días presentes', value: summary.present_days, color: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400', border: 'border-emerald-400/20' },
    { label: 'Ausencias',      value: summary.absent_days,  color: 'from-rose-500/20 to-rose-500/5',    text: 'text-rose-400',    border: 'border-rose-400/20' },
    { label: 'Tardanzas',      value: summary.late_days,    color: 'from-amber-500/20 to-amber-500/5',  text: 'text-amber-400',   border: 'border-amber-400/20' },
    { label: 'Horas trabajadas', value: `${Math.round(summary.hours_total)}h`, color: 'from-[var(--accent)]/20 to-[var(--accent)]/5', text: 'text-[var(--accent)]', border: 'border-[var(--accent)]/20' },
  ];

  return (
    <div className="flex flex-col gap-8">

      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(150deg,rgba(17,23,34,0.97),rgba(10,12,18,0.95))] p-8"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[var(--accent)] opacity-[0.04] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-[var(--accent-2)] opacity-[0.04] blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent-2)]/20 border border-[var(--accent)]/20 flex items-center justify-center text-2xl font-bold text-white shadow-[0_0_24px_rgba(0,229,255,0.15)]">
              {firstName.charAt(0)}
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-black shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]">{firstName}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {profile.campaign_name && (
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <IconBriefcase size={14} className="text-slate-600" />
                  {profile.campaign_name}
                </span>
              )}
              {profile.position_name && (
                <span className="text-slate-600">·</span>
              )}
              {profile.position_name && (
                <span className="text-sm text-slate-500">{profile.position_name}</span>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {WORKER_NAV.slice(0, 2).map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.1)] bg-white/5 text-sm text-slate-300 hover:text-white hover:border-[var(--accent)]/30 hover:bg-[rgba(0,229,255,0.05)] transition-all"
              >
                <Icon size={14} className="text-slate-500" />
                {label}
                <IconChevronRight size={12} className="ml-auto text-slate-600" />
              </Link>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map(({ label, value, color, text, border }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className={`relative overflow-hidden rounded-3xl border ${border} bg-gradient-to-br ${color} p-5`}
          >
            <p className={`text-3xl font-bold ${text} tracking-tight`}>{value}</p>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
            <p className="text-[10px] text-slate-700 mt-1">{thisMonth}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Attendance recent */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                  <IconCalendar size={15} className="text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Mi asistencia</p>
                  <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em]">{thisMonth}</p>
                </div>
              </div>
              <Link
                href="/agente/mi-asistencia"
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                Ver todo <IconChevronRight size={12} />
              </Link>
            </div>

            {recentAttendance.length === 0 ? (
              <div className="text-center py-10 text-slate-600">
                <IconCalendar size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin registros de asistencia aún</p>
                <p className="text-xs mt-1">Los datos se sincronizan desde el CRM</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {recentAttendance.map((rec, i) => {
                  const s = STATUS_CONFIG[rec.status] ?? { label: rec.status, color: 'text-slate-400', dot: 'bg-slate-600' };
                  return (
                    <motion.div
                      key={rec.work_date}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.04 }}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                        <span className="text-sm text-slate-400 w-36">
                          {formatDate(rec.work_date)}
                        </span>
                        <span className={`text-sm font-medium ${s.color}`}>{s.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        {rec.check_in_time && (
                          <span className="flex items-center gap-1">
                            <IconClock size={11} />
                            {rec.check_in_time.slice(0, 5)}
                            {rec.check_out_time && ` – ${rec.check_out_time.slice(0, 5)}`}
                          </span>
                        )}
                        {rec.hours_worked && (
                          <span className="text-slate-500">{rec.hours_worked}h</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Profile card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <IconUser size={15} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-white">Mi perfil</p>
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: 'RUT',         value: profile.rut },
                { label: 'Email',       value: profile.email },
                { label: 'Teléfono',    value: profile.phone },
                { label: 'Ingreso',     value: profile.hire_date ? new Date(profile.hire_date + 'T00:00:00').toLocaleDateString('es-CL') : null },
                { label: 'Contrato',    value: profile.employment_type },
              ].filter(i => i.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between items-baseline">
                  <dt className="text-xs text-slate-600 uppercase tracking-[0.15em]">{label}</dt>
                  <dd className="text-slate-300 font-medium text-right text-xs ml-2 truncate max-w-[140px]">{value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* Recent docs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(150deg,rgba(17,23,34,0.95),rgba(10,12,18,0.9))] p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                  <IconFolder size={15} className="text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-white">Mis documentos</p>
              </div>
              <Link href="/agente/mis-documentos" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                Ver todos <IconChevronRight size={12} />
              </Link>
            </div>

            {recentDocs.length === 0 ? (
              <div className="text-center py-6 text-slate-600">
                <IconFolder size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sin documentos disponibles</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-600">
                          {DOC_LABELS[doc.doc_type] ?? doc.doc_type}
                        </span>
                        {doc.period_label && (
                          <><span className="text-slate-700">·</span><span className="text-[10px] text-slate-700">{doc.period_label}</span></>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`/api/me/documents/${doc.id}/download`)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg border border-[rgba(255,255,255,0.1)] bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                    >
                      <IconDownload size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
