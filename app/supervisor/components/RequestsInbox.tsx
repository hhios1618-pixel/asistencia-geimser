'use client';

import { useMemo, useState, useCallback } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import useSWR from 'swr';
import { useAttendanceRequestsRealtime } from '../../../lib/hooks/useAttendanceRequestsRealtime';

type RequestItem = {
  id: string;
  request_type: 'TIME_OFF' | 'SHIFT_CHANGE' | 'PERMISSION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requested_start: string | null;
  requested_end: string | null;
  reason: string;
  supervisor_note: string | null;
  decided_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
  requester?: { id: string; name: string; email: string | null; service: string | null } | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  service: string | null;
};

type RequestsResponse = {
  items: RequestItem[];
  teamMembers?: TeamMember[];
  actor?: { id: string; role: string };
};

type AttendanceRequestRecord = {
  id: string;
  requester_id: string;
  supervisor_id: string;
  status: string;
  request_type: string;
  created_at: string;
  decided_at: string | null;
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('No fue posible cargar las solicitudes del equipo');
  }
  return (await response.json()) as RequestsResponse;
};

const STATUS_LABELS: Record<RequestItem['status'], string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const STATUS_VARIANTS: Record<RequestItem['status'], string> = {
  PENDING: 'bg-amber-500/10 text-amber-600',
  APPROVED: 'bg-emerald-500/10 text-emerald-600',
  REJECTED: 'bg-rose-500/10 text-rose-600',
  CANCELLED: 'bg-slate-400/15 text-slate-500',
};

const REQUEST_TYPE_LABELS: Record<RequestItem['request_type'], string> = {
  TIME_OFF: 'Permiso / día libre',
  SHIFT_CHANGE: 'Cambio de turno',
  PERMISSION: 'Permiso puntual',
};

const STATUS_FILTERS: Array<RequestItem['status'] | 'ALL'> = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'];

export function RequestsInbox() {
  const { data, error, isLoading, mutate } = useSWR('/api/attendance/requests?scope=team', fetcher);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('PENDING');
  const [typeFilter, setTypeFilter] = useState<RequestItem['request_type'] | 'ALL'>('ALL');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string }>>([]);

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const availableServices = useMemo(() => {
    const services = new Set<string>();
    (data?.teamMembers ?? []).forEach((member) => {
      if (member.service) {
        services.add(member.service);
      }
    });
    return Array.from(services).sort((a, b) => a.localeCompare(b, 'es'));
  }, [data?.teamMembers]);

  const filterBySearchAndType = useCallback(
    (item: RequestItem) => {
      const matchesType = typeFilter === 'ALL' || item.request_type === typeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.reason.toLowerCase().includes(normalizedSearch) ||
        (item.requester?.name ?? '').toLowerCase().includes(normalizedSearch);
      const matchesService =
        serviceFilter === 'ALL' ||
        (item.requester?.service ?? '').toLowerCase() === serviceFilter.toLowerCase();
      return matchesType && matchesSearch && matchesService;
    },
    [typeFilter, normalizedSearch, serviceFilter]
  );

  const filteredItems = useMemo(() => {
    if (statusFilter === 'ALL') {
      return items.filter(filterBySearchAndType);
    }
    const scoped = items.filter((item) => item.status === statusFilter);
    return scoped.filter(filterBySearchAndType);
  }, [items, statusFilter, filterBySearchAndType]);

  const formatDateTime = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
      : 'No especificado';

  const handleDecision = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setActingId(id);
    setActionError(null);
    try {
      const response = await fetch('/api/attendance/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note: decisionNotes[id] ?? '' }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(payload.message ?? payload.error ?? 'No fue posible actualizar la solicitud');
      }
      setDecisionNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await mutate();
    } catch (decisionError) {
      setActionError((decisionError as Error).message);
    } finally {
      setActingId(null);
    }
  };

  const teamMembers = data?.teamMembers ?? [];
  const supervisorId = data?.actor?.id ?? null;

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((note) => note.id !== id));
  }, []);

  const handleRealtime = useCallback(
    (payload: RealtimePostgresChangesPayload<AttendanceRequestRecord>) => {
      const newRecord = payload.new as AttendanceRequestRecord | null;
      if (!newRecord) {
        return;
      }
      if (supervisorId && newRecord.supervisor_id !== supervisorId) {
        return;
      }

      const status = (newRecord.status as RequestItem['status']) ?? 'PENDING';
      const eventType = payload.eventType;

      setNotifications((current) => {
        const message =
          eventType === 'INSERT'
            ? 'Nueva solicitud pendiente de revisión.'
            : status === 'APPROVED'
            ? 'Una solicitud fue aprobada.'
            : status === 'REJECTED'
            ? 'Una solicitud fue rechazada.'
            : 'Una solicitud fue actualizada.';
        return [{ id: `${newRecord.id}-${Date.now()}`, message }, ...current].slice(0, 3);
      });

      // Refresca la bandeja para mantener la vista sincronizada
      void mutate();
    },
    [mutate, supervisorId]
  );

  useAttendanceRequestsRealtime({
    enabled: Boolean(supervisorId),
    onEvent: handleRealtime,
  });

  return (
    <div className="flex flex-col gap-8">
      {notifications.length > 0 && (
        <aside
          aria-live="polite"
          className="glass-panel rounded-[26px] border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-[0_18px_50px_-32px_rgba(16,185,129,0.45)]"
        >
          <ul className="space-y-2">
            {notifications.map((note) => (
              <li key={note.id} className="flex items-start justify-between gap-3">
                <span className="font-medium">{note.message}</span>
                <button
                  type="button"
                  onClick={() => dismissNotification(note.id)}
                  className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  aria-label="Descartar notificación"
                >
                  Cerrar
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_80px_-58px_rgba(37,99,235,0.5)]" aria-labelledby="requests-team-summary">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Equipo</p>
            <h2 id="requests-team-summary" className="text-lg font-semibold text-slate-900">
              {teamMembers.length} colaboradores asignados
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Gestiona permisos y cambios de turno enviados por tu equipo directo.
            </p>
          </div>
        </header>
        {teamMembers.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {teamMembers.map((member) => (
              <span
                key={member.id}
                className="rounded-full border border-slate-200/70 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow-[0_10px_22px_-20px_rgba(15,23,42,0.35)]"
              >
                {member.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Aún no tienes colaboradores asignados en tu equipo.</p>
        )}
      </section>

      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(37,99,235,0.45)]">
        <header className="flex flex-wrap items-center justify-between gap-3" aria-label="Filtros de solicitudes">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Solicitudes</p>
            <h3 className="text-lg font-semibold text-slate-900">Bandeja del equipo</h3>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
            {STATUS_FILTERS.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                    active
                      ? 'bg-indigo-500/90 text-white shadow-[0_18px_40px_-28px_rgba(79,70,229,0.55)]'
                      : 'border border-slate-200/70 bg-white/90 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
                >
                  {status === 'ALL' ? 'Todas' : STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </header>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]" role="region" aria-label="Filtros adicionales">
          <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor="requests-search">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Buscar</span>
            <input
              id="requests-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nombre o motivo"
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm text-slate-600" role="group" aria-label="Filtrar por tipo">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tipo</span>
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'TIME_OFF', 'SHIFT_CHANGE', 'PERMISSION'] as const).map((type) => {
                const active = typeFilter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type === 'ALL' ? 'ALL' : type)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                      active
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'border border-slate-200/70 bg-white/90 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    {type === 'ALL' ? 'Todos' : REQUEST_TYPE_LABELS[type as RequestItem['request_type']]}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor="requests-service-filter">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Servicio</span>
            <select
              id="requests-service-filter"
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value as typeof serviceFilter)}
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
            >
              <option value="ALL">Todos</option>
              {availableServices.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isLoading && <p className="mt-4 text-sm text-slate-500">Cargando solicitudes…</p>}
        {error && <p className="mt-4 text-sm text-rose-600">{(error as Error).message}</p>}
        {!isLoading && !error && filteredItems.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">Sin solicitudes en esta categoría.</p>
        )}
        {actionError && <p className="mt-4 text-sm text-rose-600">{actionError}</p>}
        <div className="mt-5 space-y-4">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-white/60 bg-white/95 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-45px_rgba(59,130,246,0.4)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-semibold text-slate-900">
                    {item.requester?.name ?? 'Colaborador sin registro'}
                  </h4>
                  <p className="text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_VARIANTS[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tipo</span>
                  <span className="font-medium text-slate-900">{REQUEST_TYPE_LABELS[item.request_type]}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Periodo</span>
                  <span>
                    {formatDateTime(item.requested_start)}
                    {' – '}
                    {formatDateTime(item.requested_end)}
                  </span>
                </div>
                <div className="md:col-span-2 flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Motivo</span>
                  <span className="text-slate-700">{item.reason}</span>
                </div>
                {item.payload && Object.keys(item.payload).length > 0 && (
                  <div className="md:col-span-2 flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
                    <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Detalles adjuntos</span>
                    <pre className="mt-1 whitespace-pre-wrap text-[11px]">{JSON.stringify(item.payload, null, 2)}</pre>
                  </div>
                )}
                {item.supervisor_note && item.status !== 'PENDING' && (
                  <div className="md:col-span-2 flex flex-col gap-1 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
                    <span className="text-xs uppercase tracking-[0.3em] text-emerald-500">Nota registrada</span>
                    <span>{item.supervisor_note}</span>
                  </div>
                )}
                {item.status === 'PENDING' && (
                  <div className="md:col-span-2 flex flex-col gap-3">
                    <textarea
                      value={decisionNotes[item.id] ?? ''}
                      onChange={(event) =>
                        setDecisionNotes((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Agrega una nota para tu decisión (opcional)"
                      className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-inner transition focus:border-indigo-300 focus:outline-none"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(item.id, 'REJECT')}
                        disabled={actingId === item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(item.id, 'APPROVE')}
                        disabled={actingId === item.id}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_18px_40px_-28px_rgba(16,185,129,0.55)] transition hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 disabled:opacity-60"
                      >
                        {actingId === item.id ? 'Aplicando…' : 'Aprobar'}
                      </button>
                    </div>
                  </div>
                )}
                {item.decided_at && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Decisión registrada</span>
                    <span>{formatDateTime(item.decided_at)}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default RequestsInbox;
