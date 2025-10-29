'use client';

import { useEffect, useState } from 'react';
import type { Tables } from '../../../types/database';

export function AlertsBanner() {
  const [alerts, setAlerts] = useState<Tables['alerts']['Row'][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/attendance/alerts');
        if (!response.ok) {
          const body = (await response.json()) as { error?: string; details?: string };
          throw new Error(body.details ?? body.error ?? 'No fue posible cargar alertas');
        }
        const body = (await response.json()) as { items: Tables['alerts']['Row'][] };
        if (!active) {
          return;
        }
        setAlerts(body.items ?? []);
        setError(null);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError((fetchError as Error).message);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (alerts.length === 0 && !error) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-br from-rose-50/80 via-white/90 to-white/85 p-[1px] shadow-[0_26px_70px_-48px_rgba(244,63,94,0.35)]">
      <div className="rounded-[26px] bg-white/95 p-5 text-sm text-rose-700">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M10 3.75 2.75 16.25h14.5L10 3.75Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 8v3.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="13.5" r=".6" fill="currentColor" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-rose-400">Alertas</p>
              <h4 className="text-base font-semibold text-rose-700">
                {alerts.length > 0 ? `${alerts.length} eventos importantes` : 'Error al cargar alertas'}
              </h4>
            </div>
          </div>
          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600">
            Auditoría en tiempo real
          </span>
        </header>
        {error && <p className="mb-2 text-xs text-rose-600">Error al cargar alertas: {error}</p>}
        <ul className="space-y-2 text-sm text-rose-700">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-2xl border border-rose-200/40 bg-rose-50/60 px-4 py-2 text-sm shadow-[0_12px_30px_-28px_rgba(244,63,94,0.5)]"
            >
              <p className="font-medium text-rose-700">
                {new Date(alert.ts).toLocaleString()} · {alert.kind}
              </p>
              {alert.metadata && (
                <p className="mt-1 text-xs text-rose-500 truncate">{JSON.stringify(alert.metadata)}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AlertsBanner;
