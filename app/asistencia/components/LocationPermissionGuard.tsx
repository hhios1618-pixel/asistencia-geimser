'use client';

import { useEffect, useState } from 'react';

type PermissionStatus = 'unknown' | 'granted' | 'prompt' | 'denied';

interface Props {
  children: React.ReactNode;
}

const checkPermission = async (): Promise<PermissionStatus> => {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state as PermissionStatus;
  } catch {
    return 'unknown';
  }
};

export function LocationPermissionGuard({ children }: Props) {
  const [status, setStatus] = useState<PermissionStatus>('unknown');
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void checkPermission().then((value) => {
      if (mounted) {
        setStatus(value);
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const requestPermission = async () => {
    setChecking(true);
    setError(null);
    try {
      await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalización no disponible'));
          return;
        }
        navigator.geolocation.getCurrentPosition(() => resolve(null), reject);
      });
      setStatus('granted');
    } catch (err) {
      setError((err as Error).message);
      setStatus('denied');
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return <div className="rounded border p-4">Verificando permisos…</div>;
  }

  if (status === 'granted' || status === 'unknown') {
    return <>{children}</>;
  }

  return (
    <div className="rounded border border-orange-400 bg-orange-50 p-4 text-orange-800">
      <p className="mb-2 text-sm">Autoriza el uso de geolocalización para registrar asistencia.</p>
      <button
        type="button"
        className="rounded bg-orange-600 px-3 py-1 text-white"
        onClick={requestPermission}
        disabled={checking}
      >
        {checking ? 'Solicitando…' : 'Permitir geolocalización'}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export default LocationPermissionGuard;
