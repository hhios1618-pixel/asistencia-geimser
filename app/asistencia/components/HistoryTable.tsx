'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import ProofReceiptButton from './ProofReceiptButton';
import JustificationModal from './JustificationModal';

interface HistoryItem {
  id: string;
  site_id: string;
  event_type: 'IN' | 'OUT';
  event_ts: string;
  hash_self: string;
  receipt_url: string | null;
  receipt_signed_url: string | null;
}

interface Props {
  onReload?: () => void;
  refreshKey?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error('No fue posible cargar historial');
  }
  return res.json();
});

export function HistoryTable({ onReload, refreshKey }: Props) {
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [eventFilter, setEventFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (from) search.set('from', new Date(from).toISOString());
    if (to) search.set('to', new Date(to).toISOString());
    search.set('limit', '200');
    return search.toString();
  }, [from, to]);

  const { data, error, isLoading, mutate } = useSWR<{ items: HistoryItem[] }>(
    `/api/attendance/history?${params}`,
    fetcher
  );

  useEffect(() => {
    if (refreshKey !== undefined) {
      void mutate();
    }
  }, [refreshKey, mutate]);

  const items = useMemo(() => {
    const history = data?.items ?? [];
    if (eventFilter === 'ALL') {
      return history;
    }
    return history.filter((item) => item.event_type === eventFilter);
  }, [data?.items, eventFilter]);

  const exportLocal = () => {
    const rows = items.map((item) => [item.id, item.event_type, item.event_ts, item.site_id, item.hash_self]);
    const csv = ['id,event_type,event_ts,site_id,hash_self', ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historial-asistencia.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const reload = async () => {
    await mutate();
    onReload?.();
  };

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-[1px] shadow-[0_28px_70px_-50px_rgba(15,23,42,0.5)]">
        <div className="rounded-[26px] bg-white/95 p-5 sm:p-6">
          <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500">Historial personal</p>
              <h3 className="text-2xl font-semibold text-slate-900">Controla tus marcas</h3>
              <p className="mt-1 text-sm text-slate-500">
                Filtra por fechas y tipo de evento. Tu historial se sincroniza automáticamente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={exportLocal}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
                  <path d="M6 8h8M6 11h8M6 14h5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 4h4l2 2v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4h2Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exportar CSV
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_22px_60px_-35px_rgba(59,130,246,0.65)] transition hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-blue-300"
                onClick={reload}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
                  <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 16v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 11a6 6 0 0 1 10.39-2.97" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 9a6 6 0 0 1-10.39 2.97" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Actualizar
              </button>
            </div>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Desde</span>
              <input
                id="from"
                type="date"
                value={from ?? ''}
                onChange={(event) => setFrom(event.target.value || undefined)}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm shadow-inner transition focus:border-blue-300 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Hasta</span>
              <input
                id="to"
                type="date"
                value={to ?? ''}
                onChange={(event) => setTo(event.target.value || undefined)}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm shadow-inner transition focus:border-blue-300 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Evento</span>
              <div className="flex gap-2 rounded-2xl border border-slate-200/70 bg-white/80 p-2">
                {[
                  { value: 'ALL', label: 'Todos' },
                  { value: 'IN', label: 'Entradas' },
                  { value: 'OUT', label: 'Salidas' },
                ].map((option) => {
                  const active = eventFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex-1 rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 text-white shadow-[0_18px_40px_-28px_rgba(59,130,246,0.6)]'
                          : 'bg-white/60 text-slate-500 hover:bg-white'
                      }`}
                      onClick={() => setEventFilter(option.value as typeof eventFilter)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </label>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 text-sm text-slate-500 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.45)]">
          Cargando historial…
        </div>
      )}
      {error && (
        <div className="rounded-3xl border border-rose-200/60 bg-rose-50/80 p-6 text-sm text-rose-700 shadow-[0_24px_60px_-45px_rgba(244,63,94,0.35)]">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && items.length === 0 && !error && (
        <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-6 text-center text-sm text-slate-500 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
          No hay marcas registradas en el período seleccionado.
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="space-y-4 md:hidden">
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={`${item.id}-mobile`} className="rounded-3xl border border-white/60 bg-white/95 p-4 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">
                      {new Date(item.event_ts).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.event_type === 'IN'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {item.event_type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {new Date(item.event_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="mt-3 space-y-2 text-xs text-slate-500">
                    <p>
                      <span className="font-semibold text-slate-700">Sitio:</span> {item.site_id}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {item.hash_self.slice(0, 18)}…
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ProofReceiptButton receiptUrl={item.receipt_signed_url} />
                    <JustificationModal markId={item.id} onSubmitted={() => mutate()} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative hidden space-y-4 md:block">
          <span className="absolute left-[18px] top-0 h-full w-[2px] bg-gradient-to-b from-blue-500/70 via-indigo-500/50 to-transparent md:left-5" />
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="relative pl-12 md:pl-16">
                <span className="absolute left-5 top-4 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 shadow-[0_8px_20px_-10px_rgba(59,130,246,0.8)] md:left-8" />
                <article className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-45px_rgba(59,130,246,0.5)]">
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        {new Date(item.event_ts).toLocaleDateString(undefined, {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </p>
                      <h4 className="text-lg font-semibold text-slate-900">
                        {new Date(item.event_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </h4>
                    </div>
                    <span
                      className={`rounded-full px-4 py-1 text-sm font-semibold ${
                        item.event_type === 'IN'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {item.event_type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </header>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Sitio</span>
                      <span className="font-medium text-slate-900">{item.site_id}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Hash</span>
                      <span className="font-mono text-xs text-slate-500">{item.hash_self.slice(0, 18)}…</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ProofReceiptButton receiptUrl={item.receipt_signed_url} />
                      <JustificationModal markId={item.id} onSubmitted={() => mutate()} />
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
        </>
      )}
    </section>
  );
}

export default HistoryTable;
