'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBrowserSupabase } from '../../../../lib/hooks/useBrowserSupabase';
import type { TableInsert, Tables } from '../../../../types/database';
import SectionHeader from '../../../../components/ui/SectionHeader';

interface Policy {
  id: string;
  title: string;
  version: string;
  url: string;
  [key: string]: string;
}

type PoliciesValue = {
  policies: Policy[];
};

const KEY = 'policies_register';
type SettingsRow = Tables['settings']['Row'];

export function PoliciesManager() {
  const supabase = useBrowserSupabase();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', KEY)
      .maybeSingle();
    if (fetchError && fetchError.code !== 'PGRST116') {
      setError(fetchError.message);
      return;
    }
    if (data) {
      const record = data as SettingsRow;
      const value = record.value as PoliciesValue | null;
      setPolicies(value?.policies ?? []);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const addPolicy = async () => {
    setError(null);
    setSuccess(false);
    if (!title || !version || !url) {
      setError('Completa todos los campos');
      return;
    }
    const nextPolicies = [...policies, { id: crypto.randomUUID(), title, version, url }];
    const upsertPayload = {
      key: KEY,
      value: { policies: nextPolicies },
    } as unknown as TableInsert<'settings'>;

    const { error: upsertError } = await supabase.from('settings').upsert(upsertPayload as never).select().single();
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setPolicies(nextPolicies);
    setTitle('');
    setVersion('');
    setUrl('');
    setSuccess(true);
  };

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Cumplimiento"
        title="Políticas y anexos"
        description="Mantén a tu equipo informado con los documentos oficiales vigentes."
      />
      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Versión</span>
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">URL / Documento</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600"
            onClick={addPolicy}
          >
            Registrar
          </button>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Guardado.</p>}
        </div>
      </div>
      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Documentos publicados</h3>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          {policies.map((policy) => (
            <li key={policy.id} className="rounded-3xl border border-white/70 bg-white/85 px-4 py-3 shadow-inner">
              <p className="text-base font-semibold text-slate-900">{policy.title}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Versión {policy.version}</p>
              <a
                href={policy.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 underline"
              >
                Ver documento
              </a>
            </li>
          ))}
          {policies.length === 0 && <p className="text-sm text-slate-400">Sin políticas registradas.</p>}
        </ul>
      </div>
    </section>
  );
}

export default PoliciesManager;
