'use client';

import { useState } from 'react';
import { getGeofenceStatus, type GeofenceStatus } from '../../../lib/geo/geofence';

interface Props {
  site: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    radius_m: number;
  };
}

const statusPalette: Record<
  GeofenceStatus,
  { badge: string; chip: string; title: string; glow: string }
> = {
  ok: {
    badge: 'bg-emerald-500/15 text-emerald-600',
    chip: 'bg-emerald-500/10 text-emerald-700',
    title: 'text-emerald-800',
    glow: 'from-emerald-500/35 via-emerald-400/15 to-transparent',
  },
  warn: {
    badge: 'bg-amber-400/20 text-amber-700',
    chip: 'bg-amber-400/15 text-amber-700',
    title: 'text-amber-800',
    glow: 'from-amber-400/35 via-amber-300/15 to-transparent',
  },
  fail: {
    badge: 'bg-rose-500/15 text-rose-600',
    chip: 'bg-rose-500/10 text-rose-700',
    title: 'text-rose-700',
    glow: 'from-rose-500/40 via-rose-400/20 to-transparent',
  },
};

export function GeofenceBadge({ site }: Props) {
  const [status, setStatus] = useState<GeofenceStatus>('fail');
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocalización no disponible');
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 0,
        });
      });
      const result = getGeofenceStatus({
        site: { lat: site.lat, lng: site.lng },
        point: { lat: position.coords.latitude, lng: position.coords.longitude },
        radius: site.radius_m,
      });
      setStatus(result.status);
      setDistance(result.distance);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const palette = statusPalette[status];

  return (
    <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-[1px] shadow-[0_26px_70px_-48px_rgba(15,23,42,0.52)]">
      <div className={`relative rounded-[26px] bg-white/92 p-6`}>
        <div className={`pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-gradient-to-br ${palette.glow} blur-3xl`} />
        <header className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-slate-500">Geocerca activa</p>
            <h3 className={`text-lg font-semibold ${palette.title}`}>{site.name}</h3>
          </div>
          <span className={`rounded-full px-4 py-1 text-xs font-semibold ${palette.badge}`}>
            {status === 'ok' ? 'Dentro del perímetro' : status === 'warn' ? 'Cerca del límite' : 'Fuera del radio'}
          </span>
        </header>
        <p className="relative text-xs text-slate-500">
          El radio permitido es de {site.radius_m} metros alrededor del punto geo-referenciado.
        </p>
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${palette.chip}`}>
              Distancia {distance !== null ? `${distance.toFixed(1)} m` : 'sin medir'}
            </span>
            {error && <span className="text-xs text-rose-600">{error}</span>}
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_18px_50px_-32px_rgba(59,130,246,0.6)] transition hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-blue-300 disabled:opacity-60"
            disabled={loading}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M4 4v4h4M16 16v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 8A7 7 0 1 0 8 17" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {loading ? 'Calculando…' : 'Actualizar precisión'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GeofenceBadge;
