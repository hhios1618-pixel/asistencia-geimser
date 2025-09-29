'use client';

import { useState } from 'react';

interface DtScope {
  from: string;
  to: string;
  personIds?: string[];
  siteIds?: string[];
}

export function DTAccessPanel() {
  const [scope, setScope] = useState<DtScope>({ from: '', to: '' });
  const [expiresInMinutes, setExpires] = useState(120);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [expires, setExpiresParam] = useState('');
  const [dataset, setDataset] = useState<unknown[]>([]);

  const generate = async () => {
    setError(null);
    setGeneratedUrl(null);
    if (!scope.from || !scope.to) {
      setError('Especifica rango de fechas');
      return;
    }
    const response = await fetch('/api/admin/attendance/dt/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: {
          from: new Date(scope.from).toISOString(),
          to: new Date(scope.to).toISOString(),
          personIds: scope.personIds?.filter(Boolean),
          siteIds: scope.siteIds?.filter(Boolean),
        },
        expiresInMinutes,
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'No fue posible emitir enlace');
      return;
    }
    const data = await response.json();
    setGeneratedUrl(data.url);
  };

  const validate = async () => {
    if (!token || !expires) {
      setError('Completa token y expiración');
      return;
    }
    const response = await fetch(`/api/admin/attendance/dt/access?token=${token}&expires=${expires}`);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'Token inválido');
      return;
    }
    const data = await response.json();
    setDataset(data.data ?? []);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Acceso DT</h2>
      <div className="grid gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Desde
          <input type="date" value={scope.from} onChange={(event) => setScope({ ...scope, from: event.target.value })} className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hasta
          <input type="date" value={scope.to} onChange={(event) => setScope({ ...scope, to: event.target.value })} className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Person IDs (coma)
          <input
            value={scope.personIds?.join(',') ?? ''}
            onChange={(event) =>
              setScope({ ...scope, personIds: event.target.value ? event.target.value.split(',') : undefined })
            }
            className="rounded border p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sites (coma)
          <input
            value={scope.siteIds?.join(',') ?? ''}
            onChange={(event) =>
              setScope({ ...scope, siteIds: event.target.value ? event.target.value.split(',') : undefined })
            }
            className="rounded border p-2"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        Expira en minutos
        <input
          type="number"
          min={5}
          value={expiresInMinutes}
          onChange={(event) => setExpires(Number(event.target.value))}
          className="w-24 rounded border p-2"
        />
      </label>
      <button type="button" className="w-fit rounded bg-blue-600 px-3 py-1 text-white" onClick={generate}>
        Generar enlace
      </button>
      {generatedUrl && (
        <p className="text-sm">
          Enlace generado:{' '}
          <a href={generatedUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
            {generatedUrl}
          </a>
        </p>
      )}
      <div className="rounded border p-3 text-sm">
        <h3 className="mb-2 font-semibold">Validar token</h3>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="flex-1 rounded border p-2"
          />
          <input
            placeholder="expires (epoch)"
            value={expires}
            onChange={(event) => setExpiresParam(event.target.value)}
            className="flex-1 rounded border p-2"
          />
          <button type="button" className="rounded bg-green-600 px-3 py-1 text-white" onClick={validate}>
            Validar
          </button>
        </div>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-900 p-2 text-xs text-green-300">
          {JSON.stringify(dataset, null, 2)}
        </pre>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default DTAccessPanel;

