'use client';

import { useState, useCallback } from 'react';
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-green-600 px-4 py-2 text-white disabled:bg-gray-400"
          disabled={inDisabled}
          onClick={() => handleMark('IN')}
        >
          {loadingEvent === 'IN' ? 'Marcando…' : 'Marcar Entrada'}
        </button>
        <button
          type="button"
          className="rounded bg-red-600 px-4 py-2 text-white disabled:bg-gray-400"
          disabled={outDisabled}
          onClick={() => handleMark('OUT')}
        >
          {loadingEvent === 'OUT' ? 'Marcando…' : 'Marcar Salida'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default CheckButtons;
