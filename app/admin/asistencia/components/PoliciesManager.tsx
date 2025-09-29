'use client';

import { useEffect, useState } from 'react';
import { useBrowserSupabase } from '../../../../lib/hooks/useBrowserSupabase';
import type { TableInsert, Tables } from '../../../../types/database';

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

  const load = async () => {
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
  };

  useEffect(() => {
    void load();
  }, []);

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
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">Políticas y anexos</h2>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Versión
          <input value={version} onChange={(event) => setVersion(event.target.value)} className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-1">
          URL / Documento
          <input value={url} onChange={(event) => setUrl(event.target.value)} className="rounded border p-2" />
        </label>
      </div>
      <button type="button" className="rounded bg-green-600 px-3 py-1 text-white" onClick={addPolicy}>
        Registrar
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Guardado.</p>}
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {policies.map((policy) => (
          <li key={policy.id} className="rounded border p-2">
            <p className="font-medium">{policy.title}</p>
            <p className="text-xs text-gray-600">Versión {policy.version}</p>
            <a href={policy.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
              Ver documento
            </a>
          </li>
        ))}
        {policies.length === 0 && <p className="text-sm text-gray-600">Sin políticas registradas.</p>}
      </ul>
    </section>
  );
}

export default PoliciesManager;
