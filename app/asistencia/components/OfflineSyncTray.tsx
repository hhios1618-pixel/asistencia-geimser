'use client';

import { useEffect, useState } from 'react';
import { offlineQueue, type PendingMark } from '../../../lib/offline/queue';
import type { SuccessfulMark } from './CheckButtons';

interface Props {
  onSynced?: (result: SuccessfulMark) => void;
  refreshKey?: number;
}

export function OfflineSyncTray({ onSynced, refreshKey }: Props) {
  const [pending, setPending] = useState<PendingMark[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = async () => {
    try {
      const items = await offlineQueue.list();
      setPending(items.sort((a, b) => a.createdAt - b.createdAt));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [refreshKey]);

  const syncAll = async () => {
    if (pending.length === 0) {
      return;
    }
    setSyncing(true);
    setError(null);

    for (const item of pending) {
      try {
        const response = await fetch('/api/attendance/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: item.eventType,
            siteId: item.siteId,
            clientTs: item.clientTs ?? new Date(item.createdAt).toISOString(),
            deviceId: item.deviceId,
            geo: item.geo,
            note: item.note,
          }),
        });
        if (!response.ok) {
          throw new Error('Error al sincronizar marca');
        }
        const data = (await response.json()) as SuccessfulMark;
        const normalized: SuccessfulMark = {
          ...data,
          site_id: data.site_id ?? item.siteId,
          event_type: data.event_type ?? item.eventType,
        };
        await offlineQueue.remove(item.id);
        onSynced?.(normalized);
      } catch (err) {
        setError((err as Error).message);
        break;
      }
    }

    await loadQueue();
    setSyncing(false);
  };

  if (pending.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/85 via-white/90 to-white/85 p-[1px] shadow-[0_26px_70px_-50px_rgba(251,191,36,0.4)]">
      <div className="rounded-[26px] bg-white/95 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="m6 13 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 17V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-400">Modo offline</p>
              <h3 className="text-base font-semibold text-amber-700">
                {pending.length} marcas pendientes por sincronizar
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_50px_-32px_rgba(251,191,36,0.6)] transition hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-amber-300 disabled:opacity-60"
            onClick={syncAll}
            disabled={syncing}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="m6 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 5v10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {syncing ? 'Sincronizando…' : 'Reintentar'}
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <ul className="space-y-1 text-xs text-amber-700">
          {pending.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-amber-200/40 bg-amber-50/60 px-4 py-2 shadow-[0_12px_30px_-28px_rgba(251,191,36,0.45)]"
            >
              <span className="font-medium">{item.eventType === 'IN' ? 'Entrada' : 'Salida'}</span>
              {' · '}
              {new Date(item.createdAt).toLocaleString()}
              {' · '}
              Sit {item.siteId.slice(0, 6)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default OfflineSyncTray;
