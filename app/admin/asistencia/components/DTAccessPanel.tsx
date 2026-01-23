'use client';

import { useMemo, useState } from 'react';
import { IconLink, IconShieldLock } from '@tabler/icons-react';
import SectionHeader from '../../../../components/ui/SectionHeader';

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
    if (!scope.from || !scope.to) { setError('Especifica rango de fechas'); return; }
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
    if (!token || !expires) { setError('Completa token y expiración'); return; }
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
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Generator Panel */}
      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <IconLink size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Generar Enlace</h3>
            <p className="text-sm text-slate-400">Crear acceso temporal para fiscalización.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">Desde</span>
              <input type="date" value={scope.from} onChange={e => setScope({ ...scope, from: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">Hasta</span>
              <input type="date" value={scope.to} onChange={e => setScope({ ...scope, to: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-400">Person IDs (opcional, separadas por coma)</span>
            <input value={scope.personIds?.join(',') ?? ''} onChange={e => setScope({ ...scope, personIds: e.target.value ? e.target.value.split(',') : undefined })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" placeholder="id1, id2..." />
          </label>

          <div className="flex items-end gap-3 pt-2">
            <label className="flex flex-col gap-1.5 w-32">
              <span className="text-xs font-medium text-slate-400">Expira (min)</span>
              <input type="number" min={5} value={expiresInMinutes} onChange={e => setExpires(Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </label>
            <button onClick={generate} disabled={generating}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 transition disabled:opacity-50">
              {generating ? 'Generando...' : 'Generar Enlace'}
            </button>
          </div>

          {generatedUrl && (
            <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-sm">
              <p className="text-slate-300 mb-1">Enlace activo:</p>
              <a href={generatedUrl} target="_blank" rel="noreferrer" className="text-blue-400 underline break-all font-mono text-xs">{generatedUrl}</a>
            </div>
          )}
        </div>
      </div>

      {/* Validator Panel */}
      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <IconShieldLock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Validar Token</h3>
            <p className="text-sm text-slate-400">Verificar integridad de datos entregados.</p>
          </div>
        </div>

        <div className="space-y-4">
          <input placeholder="Pegar Token..." value={token} onChange={e => setToken(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
          <input placeholder="Expires (epoch timestamp)..." value={expires} onChange={e => setExpiresParam(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />

          <button onClick={validate} disabled={validating}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50">
            {validating ? 'Verificando...' : 'Validar Datos'}
          </button>

          {dataset.length > 0 && (
            <div className="mt-4 rounded-lg bg-slate-900 border border-white/10 p-3">
              <pre className="text-[10px] text-emerald-400 font-mono overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-white/20">
                {formattedDataset}
              </pre>
            </div>
          )}
        </div>
      </div>

      {error && <div className="lg:col-span-2 text-center text-rose-500 font-medium py-2">{error}</div>}
    </div>
  );
}

export default DTAccessPanel;
