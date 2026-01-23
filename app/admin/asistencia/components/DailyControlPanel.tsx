'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

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
const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const minutesToHm = (minutes: number | null) => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

function getStatus(row: DailyRow) {
  const hasIn = Boolean(row.first_in_ts);
  const hasOut = Boolean(row.last_out_ts);
  if (!hasIn && !hasOut) return { label: 'Sin marcas', color: 'text-slate-500 bg-slate-500/10' };
  if (hasIn && hasOut) return { label: 'Completo', color: 'text-emerald-400 bg-emerald-500/10' };
  return { label: 'Incompleto', color: 'text-amber-400 bg-amber-500/10' };
}

export default function DailyControlPanel() {
  const [date, setDate] = useState(todayIso);
  const [items, setItems] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/attendance/reports/daily?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('No fue posible cargar el control diario');
      const payload = await response.json();
      setItems(payload.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const columns: Column<DailyRow>[] = [
    {
      header: 'Persona',
      accessorKey: 'name',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-200">{row.name}</span>
          <span className="text-xs text-slate-500">{row.service ?? 'Sin servicio'}</span>
        </div>
      )
    },
    { header: 'Cargo', accessorKey: 'position_name', render: (row) => <span className="text-slate-400 text-xs">{row.position_name ?? '—'}</span> },
    { header: 'Entrada', accessorKey: 'first_in_ts', render: (row) => <span className="text-slate-300 font-mono">{formatTime(row.first_in_ts)}</span> },
    { header: 'Salida', accessorKey: 'last_out_ts', render: (row) => <span className="text-slate-300 font-mono">{formatTime(row.last_out_ts)}</span> },
    { header: 'Horas', accessorKey: 'worked_minutes', render: (row) => <span className="text-slate-400 font-semibold">{minutesToHm(row.worked_minutes)}</span> },
    { header: 'Sitios', accessorKey: 'sites_touched', render: (row) => <span className="text-slate-500">{row.sites_touched ?? 0}</span> },
    {
      header: 'Estado',
      render: (row) => {
        const status = getStatus(row);
        return <span className={`px-2 py-1 rounded text-xs font-semibold ${status.color}`}>{status.label}</span>
      }
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 bg-[#0A0C10] p-4 rounded-xl border border-white/10 w-fit">
        <span className="text-sm font-medium text-slate-400">Fecha de Corte:</span>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-rose-500 text-sm font-semibold">{error}</p>}

      <DataTable
        title="Asistencia Diaria"
        subtitle="Detalle de marcas y cumplimiento diario por colaborador."
        data={items}
        columns={columns}
        keyExtractor={row => row.person_id}
        searchPlaceholder="Buscar por nombre, cargo o servicio..."
        loading={loading}
        emptyMessage="No se encontraron registros para esta fecha."
      />
    </div>
  );
}
