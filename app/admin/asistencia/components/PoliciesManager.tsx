'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBrowserSupabase } from '../../../../lib/hooks/useBrowserSupabase';
import type { TableInsert, Tables } from '../../../../types/database';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import { IconExternalLink, IconPlus } from '@tabler/icons-react';

interface Policy {
  id: string;
  title: string;
  version: string;
  url: string;
  [key: string]: string;
}

type PoliciesValue = { policies: Policy[]; };
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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from('settings').select('*').eq('key', KEY).maybeSingle();
    if (fetchError && fetchError.code !== 'PGRST116') {
      setError(fetchError.message);
    } else if (data) {
      const record = data as SettingsRow;
      const value = record.value as PoliciesValue | null;
      setPolicies(value?.policies ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const addPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!title || !version || !url) {
      setError('Completa todos los campos');
      return;
    }
    const nextPolicies = [...policies, { id: crypto.randomUUID(), title, version, url }];
    const upsertPayload = { key: KEY, value: { policies: nextPolicies } } as unknown as TableInsert<'settings'>;

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

  const columns: Column<Policy>[] = [
    { header: 'Título', accessorKey: 'title', render: (p) => <span className="font-semibold text-white">{p.title}</span> },
    { header: 'Versión', accessorKey: 'version', render: (p) => <span className="text-slate-400">{p.version}</span> },
    {
      header: 'Documento',
      accessorKey: 'url',
      render: (p) => (
        <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <IconExternalLink size={14} /> Abrir
        </a>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Simple Input Form */}
      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6 shadow-inner">
        <h3 className="text-sm font-semibold text-white mb-4">Nueva Política</h3>
        <form onSubmit={addPolicy} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-slate-400">Título</span>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              placeholder="Ej. Reglamento Interno"
            />
          </label>
          <label className="flex flex-col gap-1.5 w-32">
            <span className="text-xs font-medium text-slate-400">Versión</span>
            <input
              value={version} onChange={e => setVersion(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              placeholder="v1.0"
            />
          </label>
          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-slate-400">URL del Documento</span>
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              placeholder="https://..."
            />
          </label>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 transition h-[38px]"
          >
            <IconPlus size={16} /> Agregar
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-400">Política agregada correctamente.</p>}
      </div>

      <DataTable
        data={policies}
        columns={columns}
        title="Políticas Vigentes"
        subtitle="Documentación oficial disponible para los colaboradores."
        keyExtractor={p => p.id}
        loading={loading}
        emptyMessage="No hay políticas publicadas."
      />
    </div>
  );
}

export default PoliciesManager;
