'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

interface OverviewResponse {
  totals: {
    active_people: number;
    inactive_people: number;
    total_sites: number;
    marks_last_30: number;
  };
  marksByDay: { day: string; total: number; in_total: number; out_total: number }[];
  eventDistribution: { event_type: 'IN' | 'OUT'; total: number }[];
  topSites: { site: string; total: number }[];
  recentPeople: { name: string; role: string; created_at: string }[];
}

const EVENT_COLORS = {
  IN: '#2563eb',
  OUT: '#f97316',
};

const CARD_GRADIENTS = [
  'from-blue-500 via-indigo-500 to-purple-500',
  'from-emerald-400 via-teal-400 to-cyan-400',
  'from-pink-500 via-rose-500 to-orange-400',
  'from-gray-700 via-slate-700 to-slate-900',
];

const formatDay = (day: string) =>
  new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric' })
    .format(new Date(day))
    .replace('.', '')
    .toUpperCase();

export function ReportsExporter() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingOverview(true);
      setOverviewError(null);
      try {
        const response = await fetch('/api/admin/attendance/reports/overview');
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'No fue posible cargar el resumen');
        }
        const body = (await response.json()) as OverviewResponse;
        setOverview(body);
      } catch (error) {
        setOverviewError((error as Error).message);
      } finally {
        setLoadingOverview(false);
      }
    };
    void load();
  }, []);

  const exportReport = async () => {
    if (!from || !to) {
      setExportError('Selecciona rango de fechas');
      return;
    }
    setExportError(null);
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      format,
    });
    const response = await fetch(`/api/admin/attendance/export?${params.toString()}`);
    if (!response.ok) {
      setExportError('No fue posible generar el reporte');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'csv' ? 'reporte.csv' : 'reporte.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  const eventDistributionData = useMemo(
    () =>
      (overview?.eventDistribution ?? []).map((item) => ({
        name: item.event_type === 'IN' ? 'Entradas' : 'Salidas',
        value: item.total,
        event: item.event_type,
      })),
    [overview?.eventDistribution]
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Analítica de asistencia</h2>
          <p className="text-sm text-slate-500">Visualiza tendencias y exporta reportes detallados.</p>
        </div>
      </header>

      {loadingOverview && (
        <div className="glass-panel grid gap-4 rounded-3xl border border-white/60 bg-white/80 p-6 text-sm text-slate-400">
          <div className="h-6 w-1/3 rounded-full bg-slate-100 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 rounded-3xl bg-slate-100/70 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-3xl bg-slate-100/70 animate-pulse" />
        </div>
      )}

      {overviewError && (
        <div className="glass-panel rounded-3xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-600">
          {overviewError}
        </div>
      )}

      {overview && !loadingOverview && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              {
                label: 'Colaboradores activos',
                value: overview.totals.active_people,
              },
              {
                label: 'Colaboradores inactivos',
                value: overview.totals.inactive_people,
              },
              {
                label: 'Sitios configurados',
                value: overview.totals.total_sites,
              },
              {
                label: 'Marcas últimos 30 días',
                value: overview.totals.marks_last_30,
              },
            ].map((card, index) => (
              <div
                key={card.label}
                className={`glass-panel overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br ${CARD_GRADIENTS[index % CARD_GRADIENTS.length]} p-[1px]`}
              >
                <div className="h-full rounded-3xl bg-white/90 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value.toLocaleString('es-CL')}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Actividad semanal</p>
                <h3 className="text-lg font-semibold text-slate-900">Marcas por día</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview.marksByDay} margin={{ left: -20 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(value: number) => value.toLocaleString('es-CL')} labelFormatter={(value) => formatDay(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="total" name="Total" stroke="#1d4ed8" fill="url(#colorTotal)" strokeWidth={2} />
                    <Area type="monotone" dataKey="in_total" name="Entradas" stroke="#2563eb" fill="url(#colorIn)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="out_total" name="Salidas" stroke="#f97316" fill="url(#colorOut)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/90 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Distribución</p>
                <h3 className="text-lg font-semibold text-slate-900">Entradas vs salidas</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={eventDistributionData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                      {eventDistributionData.map((entry, index) => (
                        <Cell key={entry.event} fill={EVENT_COLORS[entry.event]} opacity={0.85 - index * 0.2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString('es-CL')} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {eventDistributionData.map((item) => (
                  <li key={item.event} className="flex items-center justify-between text-slate-600">
                    <span>{item.name}</span>
                    <span className="font-semibold text-slate-900">{item.value.toLocaleString('es-CL')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sitios con más marcas</p>
                  <h3 className="text-lg font-semibold text-slate-900">Top 5 sitios</h3>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.topSites} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="site" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(value: number) => value.toLocaleString('es-CL')} />
                    <Bar dataKey="total" fill="#6366f1" radius={[18, 18, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Nuevos ingresos</p>
                <h3 className="text-lg font-semibold text-slate-900">Últimos colaboradores</h3>
              </div>
              <ul className="space-y-3 text-sm text-slate-600">
                {overview.recentPeople.map((person) => (
                  <li key={`${person.name}-${person.created_at}`} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-inner">
                    <p className="font-semibold text-slate-900">{person.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.2em]">{person.role}</p>
                    <p className="text-xs text-slate-400">
                      {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(person.created_at)
                      )}
                    </p>
                  </li>
                ))}
                {overview.recentPeople.length === 0 && <li className="text-xs text-slate-400">Sin movimientos recientes.</li>}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <h3 className="text-lg font-semibold text-slate-900">Exportar reporte</h3>
        <p className="text-sm text-slate-500">Descarga la información auditada en formato CSV o PDF para análisis externo.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Formato</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as 'csv' | 'pdf')}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <button
            type="button"
            className="self-end rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)] transition hover:from-blue-600 hover:to-indigo-600"
            onClick={exportReport}
          >
            Descargar
          </button>
        </div>
        {exportError && <p className="mt-2 text-sm text-rose-500">{exportError}</p>}
      </div>
    </section>
  );
}

export default ReportsExporter;
