'use client';

import { useState, useCallback, type SVGProps } from 'react';
import { offlineQueue, type PendingMark } from '../../../lib/offline/queue';
import type { Tables } from '../../../types/database';

interface Props {
  siteId: string | null;
  lastEventType: Tables['attendance_marks']['Row']['event_type'] | null;
  onSuccess?: (mark: { id: string; event_ts: string; receipt_url: string; hash: string; event_type: 'IN' | 'OUT' }) => void;
  onQueued?: (mark: PendingMark) => void;
  disabled?: boolean;
}

const DEVICE_KEY = 'asistencia_device_id';

const getDeviceId = () => {
  if (typeof window === 'undefined') {
    return 'unknown-device';
  }
  const stored = window.localStorage.getItem(DEVICE_KEY);
  if (stored) {
    return stored;
  }
  const generated = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY, generated);
  return generated;
};

const requestPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
  });

type MarkResponse = {
  id: string;
  event_ts: string;
  receipt_url: string;
  hash: string;
};

const ClockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <circle cx="12" cy="12" r="8.25" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 8.25v4.5l2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SunsetIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path d="M3 16.5h18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.25 19.5h13.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 13.5a4.5 4.5 0 0 1 9 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 3v4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.25 10.5 7.5 12" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m18.75 10.5-2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path d="M5 10h10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m11 6 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function CheckButtons({ siteId, lastEventType, onSuccess, onQueued, disabled }: Props) {
  const [loadingEvent, setLoadingEvent] = useState<'IN' | 'OUT' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMark = useCallback(
    async (eventType: 'IN' | 'OUT') => {
      if (!siteId) {
        setError('Selecciona un sitio antes de marcar.');
        return;
      }

      setLoadingEvent(eventType);
      setError(null);

      try {
        const position = await requestPosition();
        const deviceId = getDeviceId();
        const payload = {
          eventType,
          siteId,
          clientTs: new Date().toISOString(),
          deviceId,
          geo: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            acc: position.coords.accuracy,
          },
        };

        if (!navigator.onLine) {
          const pending: PendingMark = {
            id: crypto.randomUUID(),
            ...payload,
            createdAt: Date.now(),
          };
          await offlineQueue.add(pending);
          onQueued?.(pending);
          setError('Sin conexión. Marca encolada para sincronizar.');
          return;
        }

        const response = await fetch('/api/attendance/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          if (response.status >= 500) {
            const pending: PendingMark = {
              id: crypto.randomUUID(),
              ...payload,
              createdAt: Date.now(),
            };
            await offlineQueue.add(pending);
            onQueued?.(pending);
            setError('Servidor indisponible. Marca encolada.');
            return;
          }
          const body = await response.json();
          throw new Error(body.error ?? 'Error al registrar marca');
        }

        const data = (await response.json()) as MarkResponse;
        onSuccess?.({
          ...data,
          event_type: eventType,
        });
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingEvent(null);
      }
    },
    [siteId, onQueued, onSuccess]
  );

  const inDisabled = disabled || !siteId || loadingEvent !== null || lastEventType === 'IN';
  const outDisabled = disabled || !siteId || loadingEvent !== null || lastEventType === 'OUT';

  const lastMarkCopy =
    lastEventType === 'IN' ? 'Última marca registrada: Entrada' : lastEventType === 'OUT' ? 'Última marca registrada: Salida' : 'Aún no registras una marca hoy';

  return (
    <div className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.35)]">
      <div className="mb-4 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-slate-700">Registrar asistencia</p>
        <span className="inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 sm:w-auto">
          {lastMarkCopy}
        </span>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <button
          type="button"
          className="group relative flex w-full flex-1 items-center justify-between overflow-hidden rounded-[28px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 p-[2px] text-left text-white shadow-[0_24px_45px_-30px_rgba(16,185,129,0.9)] transition hover:from-emerald-500 hover:via-emerald-600 hover:to-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 disabled:opacity-60"
          disabled={inDisabled}
          onClick={() => handleMark('IN')}
        >
          <span className="flex w-full items-center justify-between rounded-[26px] bg-emerald-500/90 px-5 py-4 text-sm font-semibold backdrop-blur-sm md:px-6 md:py-5">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base">
                <ClockIcon className="h-5 w-5" />
              </span>
              <span>{loadingEvent === 'IN' ? 'Marcando entrada…' : 'Marcar entrada'}</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <ArrowIcon className="h-4 w-4" />
            </span>
          </span>
        </button>
        <button
          type="button"
          className="group relative flex w-full flex-1 items-center justify-between overflow-hidden rounded-[28px] bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 p-[2px] text-left text-white shadow-[0_24px_45px_-30px_rgba(244,63,94,0.85)] transition hover:from-rose-500 hover:via-rose-600 hover:to-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 disabled:opacity-60"
          disabled={outDisabled}
          onClick={() => handleMark('OUT')}
        >
          <span className="flex w-full items-center justify-between rounded-[26px] bg-rose-500/90 px-5 py-4 text-sm font-semibold backdrop-blur-sm md:px-6 md:py-5">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base">
                <SunsetIcon className="h-5 w-5" />
              </span>
              <span>{loadingEvent === 'OUT' ? 'Marcando salida…' : 'Marcar salida'}</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <ArrowIcon className="h-4 w-4" />
            </span>
          </span>
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

export default CheckButtons;
