'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import useSWR from 'swr';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useAttendanceRequestsRealtime } from '../../../lib/hooks/useAttendanceRequestsRealtime';

type SupervisorOption = {
  id: string;
  name: string;
  email: string | null;
};

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
  supervisor?: { id: string; name: string; email: string | null; service: string | null } | null;
};

type RequestsResponse = {
  items: RequestItem[];
  supervisors?: SupervisorOption[];
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

const REQUEST_TYPES: RequestItem['request_type'][] = ['TIME_OFF', 'SHIFT_CHANGE', 'PERMISSION'];

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('No fue posible cargar tus solicitudes');
  }
  return (await response.json()) as RequestsResponse;
};

const REQUEST_TYPE_LABELS: Record<RequestItem['request_type'], string> = {
  TIME_OFF: 'Permiso / día libre',
  SHIFT_CHANGE: 'Cambio de turno',
  PERMISSION: 'Permiso puntual',
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

const STATUS_FILTERS: Array<RequestItem['status'] | 'ALL'> = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export function RequestsClient() {
  const { data, error, isLoading, mutate } = useSWR('/api/attendance/requests?scope=mine', fetcher);
  const supervisors = useMemo(() => data?.supervisors ?? [], [data?.supervisors]);

  const [requestType, setRequestType] = useState<RequestItem['request_type']>('TIME_OFF');
  const [reason, setReason] = useState('');
  const [requestedStart, setRequestedStart] = useState<string>('');
  const [requestedEnd, setRequestedEnd] = useState<string>('');
  const [supervisorId, setSupervisorId] = useState<string>(() => supervisors[0]?.id ?? '');
  const [extraDetails, setExtraDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestItem['status'] | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<RequestItem['request_type'] | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string }>>([]);

  useEffect(() => {
    if (supervisors.length === 1) {
      setSupervisorId(supervisors[0]!.id);
    } else if (supervisors.length === 0) {
      setSupervisorId('');
    }
  }, [supervisors]);

  const actorId = data?.actor?.id ?? null;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filterList = useCallback(
    (item: RequestItem) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || item.request_type === typeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.reason.toLowerCase().includes(normalizedSearch) ||
        (item.supervisor?.name ?? '').toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesType && matchesSearch;
    },
    [statusFilter, typeFilter, normalizedSearch]
  );

  const formattedItems = useMemo(() => (data?.items ?? []).filter(filterList), [data?.items, filterList]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (supervisors.length === 0) {
      setFormError('No tienes supervisor asignado. Contacta a tu administrador.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const body = {
        requestType,
        reason,
        requestedStart: requestedStart ? new Date(requestedStart).toISOString() : null,
        requestedEnd: requestedEnd ? new Date(requestedEnd).toISOString() : null,
        supervisorId: supervisors.length === 1 ? supervisors[0]!.id : supervisorId || undefined,
        payload: extraDetails ? { details: extraDetails } : {},
      };

      const response = await fetch('/api/attendance/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(payload.message ?? payload.error ?? 'No fue posible registrar la solicitud');
      }

      setReason('');
      setRequestedStart('');
      setRequestedEnd('');
      setExtraDetails('');
      if (supervisors.length > 1) {
        setSupervisorId('');
      }
      await mutate();
    } catch (submissionError) {
      setFormError((submissionError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      const response = await fetch('/api/attendance/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'CANCEL' as const }),
      });
      if (!response.ok) {
        throw new Error('No fue posible cancelar la solicitud');
      }
      await mutate();
    } catch (cancelError) {
      setFormError((cancelError as Error).message);
    }
  };

  const supervisorsDisabled = supervisors.length === 0;

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((note) => note.id !== id));
  }, []);

  const handleRealtimeEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<AttendanceRequestRecord>) => {
      const newRecord = payload.new as AttendanceRequestRecord | null;
      if (!newRecord) {
        return;
      }
      if (actorId && newRecord.requester_id !== actorId) {
        return;
      }

      const status = (newRecord.status as RequestItem['status']) ?? 'PENDING';
      const message =
        payload.eventType === 'INSERT'
          ? 'Tu solicitud fue registrada correctamente.'
          : status === 'APPROVED'
          ? 'Tu solicitud fue aprobada.'
          : status === 'REJECTED'
          ? 'Tu solicitud fue rechazada.'
          : 'Tu solicitud cambió de estado.';

      setNotifications((current) => [{ id: `${newRecord.id}-${Date.now()}`, message }, ...current].slice(0, 3));
      void mutate();
    },
    [actorId, mutate]
  );

  useAttendanceRequestsRealtime({
    enabled: Boolean(actorId),
    onEvent: handleRealtimeEvent,
  });

  const formatDateTime = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('es-CL', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : 'No especificado';

  return (
    <div className="flex flex-col gap-8">
      {notifications.length > 0 && (
        <aside
          aria-live="polite"
          className="glass-panel rounded-[26px] border border-indigo-200/70 bg-indigo-50/80 p-4 text-sm text-indigo-900 shadow-[0_18px_50px_-32px_rgba(79,70,229,0.35)]"
        >
          <ul className="space-y-2">
            {notifications.map((note) => (
              <li key={note.id} className="flex items-start justify-between gap-3">
                <span className="font-medium">{note.message}</span>
                <button
                  type="button"
                  onClick={() => dismissNotification(note.id)}
                  className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  aria-label="Descartar notificación"
                >
                  Cerrar
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(37,99,235,0.45)]" aria-labelledby="new-request-form">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Solicitudes</p>
            <h2 id="new-request-form" className="text-xl font-semibold text-slate-900">Crear nueva solicitud</h2>
            <p className="mt-1 text-sm text-slate-500">
              Envía permisos, cambios de turno o solicitudes especiales a tu supervisor directo.
            </p>
          </div>
        </header>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tipo de solicitud</span>
            <select
              value={requestType}
              onChange={(event) => setRequestType(event.target.value as RequestItem['request_type'])}
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
            >
              {REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REQUEST_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Supervisor</span>
            {supervisorsDisabled ? (
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
                No tienes supervisor asignado. Contacta a tu administrador.
              </div>
            ) : supervisors.length === 1 ? (
              <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm text-slate-700">
                {supervisors[0]?.name ?? 'Supervisor asignado'}
              </div>
            ) : (
              <select
                value={supervisorId}
                onChange={(event) => setSupervisorId(event.target.value)}
                className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
              >
                <option value="">Selecciona un supervisor…</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Inicio solicitado</span>
            <input
              type="datetime-local"
              value={requestedStart}
              onChange={(event) => setRequestedStart(event.target.value)}
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Fin solicitado</span>
            <input
              type="datetime-local"
              value={requestedEnd}
              onChange={(event) => setRequestedEnd(event.target.value)}
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Motivo</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              required
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
              placeholder="Describe brevemente el motivo de la solicitud"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Detalles adicionales (opcional)</span>
            <textarea
              value={extraDetails}
              onChange={(event) => setExtraDetails(event.target.value)}
              rows={2}
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
              placeholder="Información extra, adjunta enlaces o referencias relevantes"
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <button
              type="submit"
              disabled={submitting || supervisorsDisabled}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(37,99,235,0.55)] transition hover:from-indigo-600 hover:via-blue-600 hover:to-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-blue-300 disabled:opacity-60"
            >
              {submitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>

      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(37,99,235,0.35)]">
        <header className="flex flex-wrap items-start justify-between gap-3" aria-label="Filtros de historial">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Historial</p>
            <h3 className="text-lg font-semibold text-slate-900">Tus solicitudes recientes</h3>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
            {STATUS_FILTERS.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(status)}
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
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" role="region" aria-label="Filtros adicionales">
          <label className="flex flex-col gap-2 text-sm text-slate-600" htmlFor="history-search">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Buscar</span>
            <input
              id="history-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Supervisor o motivo"
              className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-2 text-sm shadow-inner transition focus:border-indigo-300 focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm text-slate-600" role="group" aria-label="Filtrar por tipo">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tipo</span>
            <div className="flex flex-wrap gap-2">
              {(['ALL', ...REQUEST_TYPES] as const).map((type) => {
                const active = typeFilter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTypeFilter(type === 'ALL' ? 'ALL' : type)}
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
        </div>
        {isLoading && <p className="text-sm text-slate-500">Cargando solicitudes…</p>}
        {error && <p className="text-sm text-rose-600">{(error as Error).message}</p>}
        {!isLoading && !error && formattedItems.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no envías solicitudes.</p>
        )}
        <div className="mt-4 space-y-4">
          {formattedItems.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-white/60 bg-white/95 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-45px_rgba(37,99,235,0.4)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-semibold text-slate-900">{REQUEST_TYPE_LABELS[item.request_type]}</h4>
                  <p className="text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_VARIANTS[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Supervisor</span>
                  <span className="font-medium text-slate-900">
                    {item.supervisor?.name ?? 'No disponible'}
                  </span>
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
                {item.supervisor_note && (
                  <div className="md:col-span-2 flex flex-col gap-1 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
                    <span className="text-xs uppercase tracking-[0.3em] text-emerald-500">Respuesta supervisor</span>
                    <span>{item.supervisor_note}</span>
                  </div>
                )}
                {item.decided_at && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Decisión</span>
                    <span>{formatDateTime(item.decided_at)}</span>
                  </div>
                )}
                {item.status === 'PENDING' && (
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => cancelRequest(item.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
                    >
                      Cancelar solicitud
                    </button>
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

export default RequestsClient;
