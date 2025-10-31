'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import StatusBadge from '../../../components/ui/StatusBadge';

interface AlertItem {
  id: string;
  person_id: string;
  kind: string;
  ts: string;
  resolved: boolean;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error('No fue posible cargar alertas');
  }
  return res.json();
});

export function AlertList() {
  const { data, error, isLoading, mutate } = useSWR<{ items: AlertItem[] }>(
    '/api/attendance/alerts?limit=100',
    fetcher,
    { refreshInterval: 60_000 }
  );

  const alerts = useMemo(() => data?.items ?? [], [data?.items]);

  const groupedByKind = useMemo(() => {
    const map = new Map<string, AlertItem[]>();
    alerts.forEach((alert) => {
      const key = alert.kind.toUpperCase();
      const list = map.get(key) ?? [];
      list.push(alert);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [alerts]);

  return (
    <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_80px_-58px_rgba(37,99,235,0.5)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alertas personales</p>
          <h2 className="text-lg font-semibold text-slate-900">Solicitudes y notificaciones pendientes</h2>
          <p className="text-xs text-slate-500">Se actualizan automáticamente cada minuto.</p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
            <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 16v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 11a6 6 0 0 1 10.39-2.97" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 9a6 6 0 0 1-10.39 2.97" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Actualizar
        </button>
      </header>

      {isLoading && <p className="text-sm text-slate-500">Cargando alertas…</p>}
      {error && <p className="text-sm text-rose-600">{(error as Error).message}</p>}

      {!isLoading && !error && alerts.length === 0 && (
        <p className="text-sm text-slate-500">¡Felicidades! No tienes alertas activas.</p>
      )}

      <div className="mt-4 space-y-6">
        {groupedByKind.map(([kind, items]) => (
          <section key={kind} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.45)]">
            <header className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">{kind}</span>
              <StatusBadge label={`${items.length} activas`} variant="warning" />
            </header>
            <ul className="space-y-3">
              {items.map((alert) => {
                const title = typeof alert.metadata?.title === 'string' ? alert.metadata.title : 'Notificación';
                const description =
                  typeof alert.metadata?.description === 'string' ? alert.metadata.description : undefined;
                const siteLabel = typeof alert.metadata?.site === 'string' ? alert.metadata.site : undefined;
                return (
                  <li
                    key={alert.id}
                    className="rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 text-sm text-slate-600"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{title}</span>
                      <span className="text-xs text-slate-400">
                        {new Intl.DateTimeFormat('es-CL', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(alert.ts))}
                      </span>
                    </div>
                    {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
                    {siteLabel && <p className="mt-1 text-xs text-slate-400">Sitio: {siteLabel}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default AlertList;
