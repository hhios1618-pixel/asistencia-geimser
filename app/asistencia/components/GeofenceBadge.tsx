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

const statusToClasses: Record<GeofenceStatus, string> = {
  ok: 'bg-green-100 text-green-700 border-green-400',
  warn: 'bg-yellow-100 text-yellow-700 border-yellow-400',
  fail: 'bg-red-100 text-red-700 border-red-400',
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

  return (
    <div className={`flex flex-col gap-2 rounded border p-3 ${statusToClasses[status]}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Geocerca {site.name}</span>
        <button
          type="button"
          onClick={refresh}
          className="rounded bg-white px-2 py-1 text-xs"
          disabled={loading}
        >
          {loading ? 'Calculando…' : 'Calcular'}
        </button>
      </div>
      {distance !== null && <p className="text-xs">Distancia: {distance.toFixed(1)} m</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <p className="text-xs">Estado: {status === 'ok' ? 'Dentro' : status === 'warn' ? 'Cercano' : 'Fuera de radio'}</p>
    </div>
  );
}

export default GeofenceBadge;

