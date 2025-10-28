'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBrowserSupabase } from '../../../../lib/hooks/useBrowserSupabase';
import type { Tables } from '../../../../types/database';

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
      if (!active) {
        return;
      }
      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      setEvents(data ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  const skeletonRows = useMemo(() => Array.from({ length: 5 }), []);

  return (
    <section className="flex flex-col gap-6">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Auditoría</p>
          <h2 className="text-xl font-semibold text-slate-900">Registro de eventos</h2>
          <p className="text-sm text-slate-500">Consulta los últimos movimientos realizados por los distintos actores.</p>
        </div>
      </header>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="glass-panel max-h-[420px] overflow-auto rounded-3xl border border-white/60 bg-white/90">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-white/85 text-xs uppercase tracking-[0.3em] text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Acción</th>
              <th className="px-4 py-3 text-left">Entidad</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              skeletonRows.map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-3 w-24 rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-32 rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-16 rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-28 rounded bg-slate-100" />
                  </td>
                </tr>
              ))}
            {!loading &&
              events.map((event) => (
                <tr key={event.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 text-slate-600">{formatDate(event.ts)}</td>
                  <td className="px-4 py-3 text-slate-700">{event.action}</td>
                  <td className="px-4 py-3 text-slate-500">{event.entity}</td>
                  <td className="px-4 py-3 text-slate-500">{event.actor_id ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{event.hash_chain?.slice(0, 16) ?? '—'}</td>
                </tr>
              ))}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  No hay registros recientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AuditLogViewer;
