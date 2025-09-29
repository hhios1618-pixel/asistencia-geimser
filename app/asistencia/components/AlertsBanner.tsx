'use client';

import { useEffect, useState } from 'react';
import { useBrowserSupabase } from '../../../lib/hooks/useBrowserSupabase';
import type { Tables } from '../../../types/database';

export function AlertsBanner() {
  const supabase = useBrowserSupabase();
  const [alerts, setAlerts] = useState<Tables['alerts']['Row'][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('alerts')
        .select('*')
        .eq('resolved', false)
        .order('ts', { ascending: false });
      if (!active) {
        return;
      }
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setAlerts(data ?? []);
    };
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (alerts.length === 0 && !error) {
    return null;
  }

  return (
    <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800">
      <h4 className="mb-1 font-semibold">Alertas</h4>
      {error && <p>Error al cargar alertas: {error}</p>}
      <ul className="list-disc pl-4">
        {alerts.map((alert) => (
          <li key={alert.id}>
            {new Date(alert.ts).toLocaleString()} · {alert.kind}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AlertsBanner;

