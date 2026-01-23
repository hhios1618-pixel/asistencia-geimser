import { useState, useCallback } from 'react';
import { offlineQueue, type PendingMark } from '../../../lib/offline/queue';
import { insecureGeolocationMessage, isSecureForGeolocation } from '../../../lib/utils/geoSecurity';
import { GEO_CONSENT_VERSION } from '../../../lib/privacy/consent';

const DEVICE_KEY = 'asistencia_device_id';
const GEO_CONSENT_KEY = 'asistencia_geo_consent_version';

export type SuccessfulMark = {
    id: string;
    event_ts: string;
    receipt_url: string;
    hash: string;
    event_type: 'IN' | 'OUT';
    site_id: string;
};

type MarkPayload = {
    eventType: 'IN' | 'OUT';
    siteId: string;
    clientTs: string;
    deviceId: string;
    geo: { lat: number; lng: number; acc?: number };
    consent?: { geoAcceptedVersion: string };
};

type ApiError = { error?: string; details?: string; requiredVersion?: string };
type MarkResponse = SuccessfulMark;

const getDeviceId = () => {
    if (typeof window === 'undefined') return 'unknown-device';
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const generated = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, generated);
    return generated;
};

const getStoredGeoConsentVersion = () => {
    if (typeof window === 'undefined') return null;
    const version = window.localStorage.getItem(GEO_CONSENT_KEY);
    return version && version.trim().length > 0 ? version : null;
};

const storeGeoConsentVersion = (version: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GEO_CONSENT_KEY, version);
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

const markRequest = async (payload: MarkPayload) => {
    try {
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
    } catch (error) {
        return {
            ok: false as const,
            status: 0,
            body: { details: (error as Error).message } as ApiError,
            errorCode: 'NETWORK_ERROR',
        };
    }
};

const shouldEnqueue = (status: number, errorCode: string) =>
    status === 0 || status === 502 || status === 503 || status === 504 || errorCode === 'NETWORK_ERROR';

export const resolveMarkError = (errorCode: string, details?: string) => {
    switch (errorCode) {
        case 'SITE_NOT_ACCESSIBLE':
            return 'Sitio no accesible. Solícita asignación al administrador.';
        case 'SERVICE_NOT_CONFIGURED':
            return 'Servicio no configurado. Contacta al administrador.';
        case 'SITE_INACTIVE':
            return 'El sitio está inactivo.';
        case 'GEO_REQUIRED':
            return 'Ubicación requerida para validar geocerca.';
        case 'OUTSIDE_GEOFENCE':
            return 'Estás fuera del perímetro permitido.';
        case 'UNAUTHENTICATED':
            return 'Sesión expirada. Inicia sesión nuevamente.';
        default:
            return details ? `${errorCode}: ${details}` : errorCode;
    }
};

export const resolveGeoError = (geoError: unknown) => {
    const err = geoError as { code?: number; message?: string };
    if (typeof err?.code !== 'number') return (geoError as Error).message ?? 'Error de ubicación.';
    switch (err.code) {
        case 1:
            return 'Permiso de ubicación denegado.';
        case 2:
            return 'Ubicación no disponible. Revisa tu recepción GPS.';
        case 3:
            return 'Tiempo de espera agotado al buscar ubicación.';
        default:
            return err.message ?? 'Error de geolocalización.';
    }
};

export function useMarkAttendance() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [consentNeeded, setConsentNeeded] = useState<{ payload: MarkPayload; error: string } | null>(null);

    const executeMark = useCallback(async (
        eventType: 'IN' | 'OUT',
        siteId: string,
        onSuccess: (mark: SuccessfulMark) => void,
        onQueued: (mark: PendingMark) => void
    ) => {
        setLoading(true);
        setError(null);
        setConsentNeeded(null);

        try {
            const position = await requestPosition();
            const deviceId = getDeviceId();
            const storedConsent = getStoredGeoConsentVersion();

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
                ...(storedConsent ? { consent: { geoAcceptedVersion: storedConsent } } : {}),
            };

            if (!navigator.onLine) {
                const pending: PendingMark = { ...payload, id: crypto.randomUUID(), createdAt: Date.now() };
                await offlineQueue.add(pending);
                onQueued(pending);
                return;
            }

            const result = await markRequest(payload);

            if (!result.ok) {
                if (result.errorCode === 'CONSENT_GEO_MISSING') {
                    setConsentNeeded({ payload, error: 'Debes aceptar el uso de ubicación.' });
                    return;
                }
                if (shouldEnqueue(result.status, result.errorCode ?? 'MARK_FAILED')) {
                    const pending: PendingMark = { ...payload, id: crypto.randomUUID(), createdAt: Date.now() };
                    await offlineQueue.add(pending);
                    onQueued(pending);
                    setError('Sin conexión estable. Marca encolada.'); // Warning, not blocking error
                    return;
                }
                throw new Error(resolveMarkError(result.errorCode ?? 'MARK_FAILED', result.body.details));
            }

            onSuccess(result.data);
        } catch (err) {
            setError(resolveGeoError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    const confirmConsent = useCallback(async (
        onSuccess: (mark: SuccessfulMark) => void,
        onQueued: (mark: PendingMark) => void
    ) => {
        if (!consentNeeded) return;

        setLoading(true);
        try {
            const result = await markRequest({
                ...consentNeeded.payload,
                consent: { geoAcceptedVersion: GEO_CONSENT_VERSION },
            });

            if (!result.ok) {
                if (shouldEnqueue(result.status, result.errorCode ?? 'MARK_FAILED')) {
                    const pending: PendingMark = { ...consentNeeded.payload, id: crypto.randomUUID(), createdAt: Date.now() };
                    await offlineQueue.add(pending);
                    onQueued(pending);
                    setError('Sin conexión estable. Marca encolada.');
                    return;
                }
                throw new Error(resolveMarkError(result.errorCode ?? 'MARK_FAILED', result.body.details));
            }

            storeGeoConsentVersion(GEO_CONSENT_VERSION);
            onSuccess(result.data);
            setConsentNeeded(null);
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [consentNeeded]);

    const cancelConsent = useCallback(() => {
        setConsentNeeded(null);
        setError(null);
    }, []);

    return {
        executeMark,
        confirmConsent,
        cancelConsent,
        loading,
        error,
        consentNeeded,
    };
}
