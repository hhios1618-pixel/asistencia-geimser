'use client';

import { useEffect, useState } from 'react';
import { useBrowserSupabase } from '../../../../lib/hooks/useBrowserSupabase';
import type { Tables } from '../../../../types/database';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

export function AuditLogViewer() {
  const supabase = useBrowserSupabase();
  const [events, setEvents] = useState<Tables['audit_events']['Row'][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('audit_events')
        .select('*')
        .order('ts', { ascending: false })
        .limit(50);
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setEvents(data ?? []);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [supabase]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  const columns: Column<Tables['audit_events']['Row']>[] = [
    {
      header: 'Fecha',
      accessorKey: 'ts',
      render: (e) => <span className="text-xs text-slate-400 font-mono">{formatDate(e.ts)}</span>
    },
    {
      header: 'Acción',
      accessorKey: 'action',
      render: (e) => <span className="text-sm font-semibold text-white">{e.action}</span>
    },
    {
      header: 'Entidad',
      accessorKey: 'entity',
      render: (e) => <span className="text-xs text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">{e.entity}</span>
    },
    {
      header: 'Actor',
      accessorKey: 'actor_id',
      render: (e) => <span className="text-xs text-slate-500">{e.actor_id ?? '—'}</span>
    },
    {
      header: 'Hash',
      accessorKey: 'hash_chain',
      render: (e) => <span className="text-[10px] text-slate-600 font-mono truncate max-w-[100px]" title={e.hash_chain ?? ''}>{e.hash_chain?.slice(0, 12)}...</span>
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-rose-500 text-sm">{error}</p>}
      <DataTable
        title="Registro de Auditoría"
        subtitle="Eventos recientes de seguridad y cambios en el sistema."
        data={events}
        columns={columns}
        keyExtractor={e => e.id}
        loading={loading}
        emptyMessage="No hay registros de auditoría recientes."
      />
    </div>
  );
}

export default AuditLogViewer;
