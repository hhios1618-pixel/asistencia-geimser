'use client';

import { useEffect, useState } from 'react';
import { useBrowserSupabase } from '../../../../lib/hooks/useBrowserSupabase';
import type { Tables } from '../../../../types/database';

export function AuditLogViewer() {
  const supabase = useBrowserSupabase();
  const [events, setEvents] = useState<Tables['audit_events']['Row'][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
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
        return;
      }
      setEvents(data ?? []);
    };
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">Auditoría</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="max-h-96 overflow-auto rounded border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">Fecha</th>
              <th className="border px-2 py-1 text-left">Acción</th>
              <th className="border px-2 py-1 text-left">Entidad</th>
              <th className="border px-2 py-1 text-left">Actor</th>
              <th className="border px-2 py-1 text-left">Hash</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="border px-2 py-1">{new Date(event.ts).toLocaleString()}</td>
                <td className="border px-2 py-1">{event.action}</td>
                <td className="border px-2 py-1">{event.entity}</td>
                <td className="border px-2 py-1">{event.actor_id ?? '—'}</td>
                <td className="border px-2 py-1">{event.hash_chain?.slice(0, 12) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AuditLogViewer;
