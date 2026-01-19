'use client';

import { useEffect, useState } from 'react';
import { offlineQueue, type PendingMark } from '../../../lib/offline/queue';
import type { SuccessfulMark } from './CheckButtons';
import { GEO_CONSENT_VERSION } from '../../../lib/privacy/consent';

interface Props {
  onSynced?: (result: SuccessfulMark) => void;
  refreshKey?: number;
}

export function OfflineSyncTray({ onSynced, refreshKey }: Props) {
  const [pending, setPending] = useState<PendingMark[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const getStoredGeoConsentVersion = () => {
    if (typeof window === 'undefined') {
      return null;
    }
    const version = window.localStorage.getItem('asistencia_geo_consent_version');
    return version && version.trim().length > 0 ? version : null;
  };

  const resolveMarkError = (api: { errorCode: string; details?: string }) => {
    switch (api.errorCode) {
      case 'CONSENT_GEO_MISSING':
        return 'Falta consentimiento GEO. Marca online y acepta el consentimiento para habilitar la sincronización.';
      case 'SITE_NOT_ACCESSIBLE':
        return 'Sitio no accesible (no estás asignado o está inactivo).';
      case 'SITE_INACTIVE':
        return 'Sitio inactivo.';
      case 'OUTSIDE_GEOFENCE':
        return 'Fuera de geocerca para esa marca.';
      case 'UNAUTHENTICATED':
        return 'Sesión expirada. Inicia sesión nuevamente y reintenta.';
      case 'SERVICE_NOT_CONFIGURED':
        return 'Servidor sin configuración completa. Contacta al administrador.';
      case 'NETWORK_ERROR':
        return api.details ? `Sin conexión: ${api.details}` : 'Sin conexión con el servidor.';
      default:
        return api.details ? `${api.errorCode}: ${api.details}` : api.errorCode;
    }
  };

  const shouldRetryLater = (status: number, errorCode: string) =>
    status === 0 || status === 502 || status === 503 || status === 504 || errorCode === 'NETWORK_ERROR';

  const loadQueue = async () => {
    try {
      const items = await offlineQueue.list();
      setPending(items.sort((a, b) => a.createdAt - b.createdAt));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [refreshKey]);

  const syncAll = async () => {
    if (pending.length === 0) {
      return;
    }
    setSyncing(true);
    setError(null);
    setItemErrors({});

    for (const item of pending) {
      try {
        const storedConsent = getStoredGeoConsentVersion();
        const basePayload = {
          eventType: item.eventType,
          siteId: item.siteId,
          clientTs: item.clientTs ?? new Date(item.createdAt).toISOString(),
          deviceId: item.deviceId,
          geo: item.geo,
          note: item.note,
          ...(storedConsent ? { consent: { geoAcceptedVersion: storedConsent } } : {}),
        };

        const response = await fetch('/api/attendance/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string; requiredVersion?: string };
          const errorCode = body.error ?? 'MARK_FAILED';

          if (errorCode === 'CONSENT_GEO_MISSING') {
            const retryResponse = await fetch('/api/attendance/mark', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...basePayload, consent: { geoAcceptedVersion: GEO_CONSENT_VERSION } }),
            });
            if (retryResponse.ok) {
              const data = (await retryResponse.json()) as SuccessfulMark;
              const normalized: SuccessfulMark = {
                ...data,
                site_id: data.site_id ?? item.siteId,
                event_type: data.event_type ?? item.eventType,
              };
              await offlineQueue.remove(item.id);
              onSynced?.(normalized);
              continue;
            }
            const retryBody = (await retryResponse.json().catch(() => ({}))) as { error?: string; details?: string };
            const retryCode = retryBody.error ?? 'MARK_FAILED';
            const message = resolveMarkError({ errorCode: retryCode, details: retryBody.details });
            setItemErrors((current) => ({ ...current, [item.id]: message }));
            if (shouldRetryLater(retryResponse.status, retryCode)) {
              setError(message);
              break;
            }
            continue;
          }

          const message = resolveMarkError({ errorCode, details: body.details });
          setItemErrors((current) => ({ ...current, [item.id]: message }));

          if (shouldRetryLater(response.status, errorCode)) {
            setError(message);
            break;
          }
          continue;
        }

        const data = (await response.json()) as SuccessfulMark;
        const normalized: SuccessfulMark = {
          ...data,
          site_id: data.site_id ?? item.siteId,
          event_type: data.event_type ?? item.eventType,
        };
        await offlineQueue.remove(item.id);
        onSynced?.(normalized);
      } catch (err) {
        setError((err as Error).message);
        break;
      }
    }

    await loadQueue();
    setSyncing(false);
  };

  if (pending.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/85 via-white/90 to-white/85 p-[1px] shadow-[0_26px_70px_-50px_rgba(251,191,36,0.4)]">
      <div className="rounded-[26px] bg-white/95 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="m6 13 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 17V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-amber-400">Modo offline</p>
              <h3 className="text-base font-semibold text-amber-700">
                {pending.length} marcas pendientes por sincronizar
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_50px_-32px_rgba(251,191,36,0.6)] transition hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-amber-300 disabled:opacity-60"
            onClick={syncAll}
            disabled={syncing}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="m6 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 5v10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {syncing ? 'Sincronizando…' : 'Reintentar'}
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <ul className="space-y-1 text-xs text-amber-700">
          {pending.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-amber-200/40 bg-amber-50/60 px-4 py-2 shadow-[0_12px_30px_-28px_rgba(251,191,36,0.45)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-medium">{item.eventType === 'IN' ? 'Entrada' : 'Salida'}</span>
                  {' · '}
                  {new Date(item.createdAt).toLocaleString()}
                  {' · '}
                  Sit {item.siteId.slice(0, 6)}
                </p>
                <button
                  type="button"
                  className="rounded-full border border-amber-200/60 bg-white/60 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-white"
                  onClick={async () => {
                    await offlineQueue.remove(item.id);
                    await loadQueue();
                  }}
                >
                  Quitar
                </button>
              </div>
              {itemErrors[item.id] && <p className="mt-1 text-[11px] text-rose-600">{itemErrors[item.id]}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default OfflineSyncTray;
