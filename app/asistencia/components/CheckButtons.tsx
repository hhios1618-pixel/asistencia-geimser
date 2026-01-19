'use client';

import { useState, useCallback, type SVGProps } from 'react';
import { offlineQueue, type PendingMark } from '../../../lib/offline/queue';
import type { Tables } from '../../../types/database';
import { insecureGeolocationMessage, isSecureForGeolocation } from '../../../lib/utils/geoSecurity';
import { GEO_CONSENT_VERSION } from '../../../lib/privacy/consent';

interface Props {
  siteId: string | null;
  lastEventType: Tables['attendance_marks']['Row']['event_type'] | null;
  onSuccess?: (mark: SuccessfulMark) => void;
  onQueued?: (mark: PendingMark) => void;
  disabled?: boolean;
}

export type SuccessfulMark = {
  id: string;
  event_ts: string;
  receipt_url: string;
  hash: string;
  event_type: 'IN' | 'OUT';
  site_id: string;
};

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
    if (!isSecureForGeolocation()) {
      reject(new Error(insecureGeolocationMessage));
      return;
    }
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

type MarkResponse = SuccessfulMark;
type MarkPayload = {
  eventType: 'IN' | 'OUT';
  siteId: string;
  clientTs: string;
  deviceId: string;
  geo: { lat: number; lng: number; acc?: number };
};

type ApiError = { error?: string; details?: string; requiredVersion?: string };

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
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<MarkPayload | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const markRequest = async (payload: MarkPayload) => {
    const response = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiError;
      const errorCode = body.error ?? 'MARK_FAILED';
      return { ok: false as const, status: response.status, body, errorCode };
    }

    const data = (await response.json()) as MarkResponse;
    return { ok: true as const, status: response.status, data };
  };

  const acceptGeoConsent = async () => {
    setError(null);
    const response = await fetch('/api/privacy/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentType: 'GEO', version: GEO_CONSENT_VERSION }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiError;
      throw new Error(body.details ?? body.error ?? 'No fue posible registrar el consentimiento.');
    }
  };

  const resolveGeoError = (geoError: unknown) => {
    const err = geoError as { code?: number; message?: string };
    if (typeof err?.code !== 'number') {
      return (geoError as Error).message ?? 'No fue posible obtener tu ubicación.';
    }
    switch (err.code) {
      case 1:
        return 'Permiso de ubicación denegado. Actívalo en tu navegador/celular y vuelve a intentar.';
      case 2:
        return 'No fue posible determinar tu ubicación. Revisa tu conexión/GPS y vuelve a intentar.';
      case 3:
        return 'Tiempo de espera al obtener ubicación. Toca “Actualizar precisión” e intenta nuevamente.';
      default:
        return err.message ?? 'Error de geolocalización.';
    }
  };

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
        const payload: MarkPayload = {
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

        const result = await markRequest(payload);
        if (!result.ok) {
          if (result.errorCode === 'CONSENT_GEO_MISSING') {
            setPendingPayload(payload);
            setConsentOpen(true);
            setConsentError(null);
            setError('Debes aceptar el consentimiento de geolocalización para marcar tu asistencia.');
            return;
          }
          if (result.status >= 500) {
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
          throw new Error(result.body.details ?? result.errorCode ?? 'Error al registrar marca');
        }

        onSuccess?.(result.data);
        setError(null);
      } catch (err) {
        setError(resolveGeoError(err));
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
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
      {consentOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Consentimiento de geolocalización"
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[rgba(8,10,18,0.96)] p-5 shadow-2xl">
            <p className="text-sm font-semibold text-slate-100">Permiso requerido</p>
            <p className="mt-2 text-sm text-slate-200">
              Para confirmar tu asistencia necesitamos registrar tu ubicación y validar la geocerca del sitio. Esto solo se usa
              para el marcaje y auditoría.
            </p>
            {consentError && <p className="mt-3 text-sm text-rose-200">{consentError}</p>}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                disabled={consentBusy}
                onClick={() => {
                  setConsentOpen(false);
                  setPendingPayload(null);
                  setConsentError(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
                disabled={consentBusy}
                onClick={async () => {
                  try {
                    setConsentBusy(true);
                    setConsentError(null);
                    setLoadingEvent(pendingPayload?.eventType ?? 'IN');
                    await acceptGeoConsent();
                    if (pendingPayload) {
                      const result = await markRequest(pendingPayload);
                      if (!result.ok) {
                        throw new Error(result.body.details ?? result.errorCode ?? 'Error al registrar marca');
                      }
                      onSuccess?.(result.data);
                    }
                    setConsentOpen(false);
                    setPendingPayload(null);
                    setError(null);
                  } catch (consentErr) {
                    setConsentError((consentErr as Error).message);
                  } finally {
                    setConsentBusy(false);
                    setLoadingEvent(null);
                  }
                }}
              >
                {consentBusy ? 'Aceptando…' : 'Aceptar y continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckButtons;
