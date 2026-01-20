'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import StatusBadge from '../../../../components/ui/StatusBadge';

type DailyRow = {
  person_id: string;
  name: string;
  service: string | null;
  business_name: string | null;
  position_name: string | null;
  work_date: string;
  first_in_ts: string | null;
  last_out_ts: string | null;
  worked_minutes: number | null;
  in_total: number | null;
  out_total: number | null;
  sites_touched: number | null;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

const formatDateLabel = (value: string) =>
  new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`)
  );

const minutesToHm = (minutes: number | null) => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

function getStatus(row: DailyRow) {
  const hasIn = Boolean(row.first_in_ts);
  const hasOut = Boolean(row.last_out_ts);
  if (!hasIn && !hasOut) return { label: 'Sin marcas', variant: 'default' as const };
  if (hasIn && hasOut) return { label: 'Completo', variant: 'success' as const };
  return { label: 'Incompleto', variant: 'warning' as const };
}

export default function DailyControlPanel() {
  const [date, setDate] = useState(todayIso);
  const [items, setItems] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/attendance/reports/daily?date=${encodeURIComponent(date)}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar el control diario');
      }
      const payload = (await response.json()) as { items: DailyRow[] };
      setItems(payload.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) => {
      const haystack = [
        row.name,
        row.service ?? '',
        row.business_name ?? '',
        row.position_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, search]);

  const totals = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let none = 0;
    filtered.forEach((row) => {
      const status = getStatus(row).label;
      if (status === 'Completo') complete += 1;
      else if (status === 'Incompleto') incomplete += 1;
      else none += 1;
    });
    return { complete, incomplete, none, total: filtered.length };
  }, [filtered]);

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Control"
        title="Asistencia diaria"
        description="Registro por persona para el día seleccionado. Esto alimenta el cálculo de días trabajados en nómina."
      />

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Día</label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-sm"
              />
              <span className="text-sm text-slate-500">{formatDateLabel(date)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, negocio, cargo…"
              className="w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-sm md:w-[320px]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Total: {totals.total}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Completos: {totals.complete}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Incompletos: {totals.incomplete}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Sin marcas: {totals.none}</span>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">Negocio</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">IN</th>
                <th className="px-4 py-3 text-left">OUT</th>
                <th className="px-4 py-3 text-left">Horas</th>
                <th className="px-4 py-3 text-left">Sitios</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="h-3 w-full rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                filtered.map((row) => {
                  const status = getStatus(row);
                  return (
                    <tr key={row.person_id} className="border-t border-slate-100 hover:bg-blue-50/40">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">{row.name}</span>
                          <span className="text-[11px] text-slate-400">{row.service ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.business_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.position_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTime(row.first_in_ts)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatTime(row.last_out_ts)}</td>
                      <td className="px-4 py-3 text-slate-600">{minutesToHm(row.worked_minutes)}</td>
                      <td className="px-4 py-3 text-slate-600">{row.sites_touched ?? 0}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={status.label} variant={status.variant} />
                      </td>
                    </tr>
                  );
                })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    Sin datos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
