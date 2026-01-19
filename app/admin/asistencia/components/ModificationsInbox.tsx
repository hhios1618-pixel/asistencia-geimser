'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

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
      if (response.status === 401) {
        setError('Inicia sesión como administrador para revisar solicitudes pendientes.');
      } else {
        setError('No fue posible cargar solicitudes');
      }
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

  const skeletonCards = useMemo(() => Array.from({ length: 3 }), []);

  const statusLabel: Record<Modification['status'], string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Inbox"
        title="Solicitudes de corrección"
        description="Aprueba o rechaza los ajustes enviados por los colaboradores."
      />
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        {loading && (
          <div className="space-y-3">
            {skeletonCards.map((_, index) => (
              <div key={index} className="h-24 rounded-3xl bg-slate-100/70 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && !error && (
          <p className="text-sm text-slate-400">Sin solicitudes pendientes.</p>
        )}
        {!loading && items.length > 0 && (
          <ul className="space-y-4">
            {items.map((mod) => (
              <li
                key={mod.id}
                className="glass-panel rounded-3xl border border-white/60 bg-white/95 p-5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.45)]"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600">
                        {statusLabel[mod.status]}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(mod.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">Solicitud de {mod.requester_id}</p>
                    <p className="text-sm text-slate-600">{mod.reason}</p>
                    <p className="text-xs text-slate-500">Delta solicitado: {mod.requested_delta}</p>
                    {mod.attendance_marks && (
                      <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-slate-500">
                        Marca {mod.attendance_marks.event_type === 'IN' ? 'Entrada' : 'Salida'} ·{' '}
                        {formatDate(mod.attendance_marks.event_ts)} · Sitio {mod.attendance_marks.site_id}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <button
                      type="button"
                      className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600"
                      onClick={() => decide(mod.id, 'APPROVED')}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(244,63,94,0.6)] transition hover:from-rose-600 hover:to-red-600"
                      onClick={() => decide(mod.id, 'REJECTED')}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default ModificationsInbox;
