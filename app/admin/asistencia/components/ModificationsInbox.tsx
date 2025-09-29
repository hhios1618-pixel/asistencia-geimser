'use client';

import { useEffect, useState } from 'react';

interface Modification {
  id: string;
  mark_id: string;
  requester_id: string;
  reason: string;
  requested_delta: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  attendance_marks?: {
    event_ts: string;
    event_type: 'IN' | 'OUT';
    site_id: string;
  } | null;
}

export function ModificationsInbox() {
  const [items, setItems] = useState<Modification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/attendance/modifications?status=PENDING');
    if (!response.ok) {
      setError('No fue posible cargar solicitudes');
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { items: Modification[] };
    setItems(body.items);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const response = await fetch('/api/attendance/modifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      setError('No fue posible actualizar la solicitud');
      return;
    }
    await load();
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Solicitudes de corrección</h2>
      {loading && <p>Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((mod) => (
          <li key={mod.id} className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">Solicitud de {mod.requester_id}</p>
                <p>{mod.reason}</p>
                <p className="text-xs text-gray-500">Delta: {mod.requested_delta}</p>
                {mod.attendance_marks && (
                  <p className="text-xs text-gray-500">
                    Marca {mod.attendance_marks.event_type} · {mod.attendance_marks.event_ts} · Sitio {mod.attendance_marks.site_id}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="rounded bg-green-600 px-3 py-1 text-white"
                  onClick={() => decide(mod.id, 'APPROVED')}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="rounded bg-red-600 px-3 py-1 text-white"
                  onClick={() => decide(mod.id, 'REJECTED')}
                >
                  Rechazar
                </button>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && !loading && <p className="text-sm text-gray-600">Sin solicitudes pendientes.</p>}
      </ul>
    </section>
  );
}

export default ModificationsInbox;

