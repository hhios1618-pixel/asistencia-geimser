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
