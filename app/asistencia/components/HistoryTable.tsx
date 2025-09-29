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
    <div className="rounded border p-3">
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex flex-col text-sm">
          <label htmlFor="from">Desde</label>
          <input
            id="from"
            type="date"
            value={from ?? ''}
            onChange={(event) => setFrom(event.target.value || undefined)}
            className="rounded border p-1"
          />
        </div>
        <div className="flex flex-col text-sm">
          <label htmlFor="to">Hasta</label>
          <input
            id="to"
            type="date"
            value={to ?? ''}
            onChange={(event) => setTo(event.target.value || undefined)}
            className="rounded border p-1"
          />
        </div>
        <div className="flex flex-col text-sm">
          <label htmlFor="event">Evento</label>
          <select
            id="event"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value as 'ALL' | 'IN' | 'OUT')}
            className="rounded border p-1"
          >
            <option value="ALL">Todos</option>
            <option value="IN">Entradas</option>
            <option value="OUT">Salidas</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={reload}>
            Actualizar
          </button>
          <button type="button" className="rounded border px-3 py-1" onClick={exportLocal}>
            Exportar CSV
          </button>
        </div>
      </div>
      {isLoading && <p className="text-sm">Cargando historial…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      <div className="max-h-96 overflow-auto text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Fecha/Hora</th>
              <th className="border px-2 py-1 text-left">Evento</th>
              <th className="border px-2 py-1 text-left">Sitio</th>
              <th className="border px-2 py-1 text-left">Hash</th>
              <th className="border px-2 py-1 text-left">Recibo</th>
              <th className="border px-2 py-1 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="border px-2 py-1">{new Date(item.event_ts).toLocaleString()}</td>
                <td className="border px-2 py-1">{item.event_type === 'IN' ? 'Entrada' : 'Salida'}</td>
                <td className="border px-2 py-1">{item.site_id}</td>
                <td className="border px-2 py-1 text-xs">{item.hash_self.slice(0, 12)}…</td>
                <td className="border px-2 py-1">
                  <ProofReceiptButton receiptUrl={item.receipt_signed_url} />
                </td>
                <td className="border px-2 py-1">
                  <JustificationModal markId={item.id} onSubmitted={() => mutate()} />
                </td>
              </tr>
            ))}
            {items.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="border px-2 py-3 text-center text-sm text-gray-500">
                  No hay marcas registradas en el período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HistoryTable;
