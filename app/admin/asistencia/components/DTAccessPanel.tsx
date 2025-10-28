'use client';

import { useMemo, useState } from 'react';

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
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setError(null);
    setGeneratedUrl(null);
    if (!scope.from || !scope.to) {
      setError('Especifica rango de fechas');
      return;
    }
    setGenerating(true);
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
    setGenerating(false);
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
    setValidating(true);
    const response = await fetch(`/api/admin/attendance/dt/access?token=${token}&expires=${expires}`);
    setValidating(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'Token inválido');
      return;
    }
    const data = await response.json();
    setDataset(data.data ?? []);
  };

  const formattedDataset = useMemo(() => JSON.stringify(dataset, null, 2), [dataset]);

  return (
    <section className="flex flex-col gap-6">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Integraciones</p>
          <h2 className="text-xl font-semibold text-slate-900">Acceso DT</h2>
          <p className="text-sm text-slate-500">Emite enlaces temporales o valida tokens para entrega documental.</p>
        </div>
      </header>
      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Generar enlace</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Desde</span>
            <input
              type="date"
              value={scope.from}
              onChange={(event) => setScope({ ...scope, from: event.target.value })}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Hasta</span>
            <input
              type="date"
              value={scope.to}
              onChange={(event) => setScope({ ...scope, to: event.target.value })}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Person IDs (coma)</span>
            <input
              value={scope.personIds?.join(',') ?? ''}
              onChange={(event) =>
                setScope({ ...scope, personIds: event.target.value ? event.target.value.split(',') : undefined })
              }
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Sites (coma)</span>
            <input
              value={scope.siteIds?.join(',') ?? ''}
              onChange={(event) =>
                setScope({ ...scope, siteIds: event.target.value ? event.target.value.split(',') : undefined })
              }
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Expira en minutos
            <input
              type="number"
              min={5}
              value={expiresInMinutes}
              onChange={(event) => setExpires(Number(event.target.value))}
              className="w-24 rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <button
            type="button"
            className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)] transition hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50"
            onClick={generate}
            disabled={generating}
          >
            {generating ? 'Generando…' : 'Generar enlace'}
          </button>
        </div>
        {generatedUrl && (
          <p className="mt-3 text-sm text-slate-600">
            Enlace generado:{' '}
            <a href={generatedUrl} className="font-semibold text-blue-600 underline" target="_blank" rel="noreferrer">
              {generatedUrl}
            </a>
          </p>
        )}
      </div>

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Validar token</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            placeholder="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="flex-1 rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          />
          <input
            placeholder="expires (epoch)"
            value={expires}
            onChange={(event) => setExpiresParam(event.target.value)}
            className="flex-1 rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          />
          <button
            type="button"
            className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
            onClick={validate}
            disabled={validating}
          >
            {validating ? 'Validando…' : 'Validar'}
          </button>
        </div>
        <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-slate-900/90 p-3 text-xs text-emerald-200">
          {formattedDataset}
        </pre>
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </section>
  );
}

export default DTAccessPanel;
