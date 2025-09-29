'use client';

import { useEffect, useState } from 'react';
import { offlineQueue, type PendingMark } from '../../../lib/offline/queue';

interface SyncResult {
  id: string;
  event_ts: string;
  receipt_url: string;
  hash: string;
  event_type: 'IN' | 'OUT';
}

interface Props {
  onSynced?: (result: SyncResult) => void;
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
        const data = (await response.json()) as SyncResult;
        await offlineQueue.remove(item.id);
        onSynced?.(data);
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
    <div className="rounded border border-yellow-400 bg-yellow-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-yellow-800">{pending.length} marcas pendientes por sincronizar.</p>
        <button
          type="button"
          className="rounded bg-yellow-600 px-3 py-1 text-sm text-white disabled:bg-gray-400"
          onClick={syncAll}
          disabled={syncing}
        >
          {syncing ? 'Sincronizando…' : 'Reintentar' }
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <ul className="text-xs text-yellow-900">
        {pending.map((item) => (
          <li key={item.id}>
            {new Date(item.createdAt).toLocaleString()} · {item.eventType} · sit {item.siteId.slice(0, 6)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default OfflineSyncTray;

