'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

type BlacklistItem = {
  id: string;
  rut_display: string;
  rut_normalized: string;
  full_name: string | null;
  reason: string | null;
  source: string | null;
  notes: string | null;
  active: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type CheckResult = {
  rut_normalized: string;
  found: boolean;
  status: 'NO_CONTRATAR' | 'EVALUABLE';
  item?: BlacklistItem | null;
};

const fmtDate = (value: string) =>
  new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export default function HrBlacklistPanel() {
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [checkRut, setCheckRut] = useState('');
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const [manualRut, setManualRut] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualSource, setManualSource] = useState('RRHH');
  const [manualNotes, setManualNotes] = useState('');

  const [replaceAll, setReplaceAll] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hr/blacklist', { cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as { error?: string; items?: BlacklistItem[] };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo cargar blacklist');
      }
      setItems(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.active).length;
    const withReason = items.filter((item) => (item.reason ?? '').trim().length > 0).length;
    return { total, active, withReason };
  }, [items]);

  const runCheck = async () => {
    setError(null);
    setSuccess(null);
    setCheckResult(null);
    if (!checkRut.trim()) {
      setError('Ingresa un RUT para validar.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/hr/blacklist?rut=${encodeURIComponent(checkRut.trim())}`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        found?: boolean;
        status?: 'NO_CONTRATAR' | 'EVALUABLE';
        rut_normalized?: string;
        item?: BlacklistItem | null;
      };

      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo validar RUT');
      }

      setCheckResult({
        rut_normalized: body.rut_normalized ?? checkRut,
        found: Boolean(body.found),
        status: body.status ?? 'EVALUABLE',
        item: body.item ?? null,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveManual = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/hr/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut: manualRut,
          full_name: manualName || null,
          reason: manualReason || null,
          source: manualSource || null,
          notes: manualNotes || null,
          active: true,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo guardar registro');
      }

      setManualRut('');
      setManualName('');
      setManualReason('');
      setManualSource('RRHH');
      setManualNotes('');
      setSuccess('Registro blacklist guardado.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runImport = async () => {
    if (!importFile) {
      setError('Selecciona un archivo antes de importar.');
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const form = new FormData();
      form.append('file', importFile);
      form.append('replace_all', String(replaceAll));

      const response = await fetch('/api/admin/hr/blacklist/import', {
        method: 'POST',
        body: form,
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        imported?: number;
        skipped?: number;
      };

      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo importar blacklist');
      }

      setSuccess(`Importación completa. Filas importadas: ${body.imported ?? 0}. Omitidas: ${body.skipped ?? 0}.`);
      setImportFile(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm('¿Eliminar este registro de blacklist?')) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/hr/blacklist?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo eliminar registro');
      }
      setSuccess('Registro eliminado.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const columns: Column<BlacklistItem>[] = [
    {
      header: 'RUT',
      accessorKey: 'rut_display',
      sortable: true,
      render: (item) => <span className="font-mono text-slate-100">{item.rut_display}</span>,
    },
    {
      header: 'Nombre',
      accessorKey: 'full_name',
      sortable: true,
      render: (item) => <span>{item.full_name || '—'}</span>,
    },
    {
      header: 'Motivo',
      accessorKey: 'reason',
      render: (item) => <span className="text-slate-300">{item.reason || '—'}</span>,
    },
    {
      header: 'Fuente',
      accessorKey: 'source',
      render: (item) => <span className="text-slate-400">{item.source || '—'}</span>,
    },
    {
      header: 'Actualizado',
      accessorKey: 'updated_at',
      render: (item) => <span className="text-xs text-slate-500">{fmtDate(item.updated_at)}</span>,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="RRHH · CONFIDENCIAL"
        title="Blist — No contratables"
        description="Registro confidencial de RUTs no contratables. Solo visible para perfil Administrador."
      />

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-500">{success}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-4">
          <p className="text-xs text-slate-500">Registros</p>
          <p className="mt-1 text-2xl font-bold text-white">{kpis.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-4">
          <p className="text-xs text-slate-500">Activos</p>
          <p className="mt-1 text-2xl font-bold text-rose-300">{kpis.active}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-4">
          <p className="text-xs text-slate-500">Con motivo</p>
          <p className="mt-1 text-2xl font-bold text-white">{kpis.withReason}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-4">
          <h3 className="text-sm font-semibold text-white">Buscador por RUT</h3>
          <div className="mt-3 space-y-3">
            <input
              value={checkRut}
              onChange={(event) => setCheckRut(event.target.value)}
              placeholder="Ej: 12.345.678-9"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <button
              onClick={runCheck}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Consultar en Blist
            </button>
          </div>

          {checkResult && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                checkResult.found
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              <p className="font-semibold">
                {checkResult.found ? '⛔ NO ES POSIBLE CONTRATAR' : '✓ Candidato EVALUABLE'}
              </p>
              <p className="mt-1 text-xs">
                RUT: <span className="font-mono">{checkResult.rut_normalized}</span>
              </p>
              {checkResult.item?.full_name && (
                <p className="mt-1 text-xs font-medium">Nombre: {checkResult.item.full_name}</p>
              )}
              {checkResult.item?.source && (
                <p className="mt-1 text-xs">Empresa origen: <span className="font-semibold">{checkResult.item.source}</span></p>
              )}
              {checkResult.item?.reason && <p className="mt-1 text-xs">Motivo: {checkResult.item.reason}</p>}
              {checkResult.item?.notes && <p className="mt-1 text-xs text-slate-400">{checkResult.item.notes}</p>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-4">
          <h3 className="text-sm font-semibold text-white">Agregar manualmente</h3>
          <div className="mt-3 space-y-2">
            <input
              value={manualRut}
              onChange={(event) => setManualRut(event.target.value)}
              placeholder="RUT"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Nombre (opcional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <input
              value={manualReason}
              onChange={(event) => setManualReason(event.target.value)}
              placeholder="Motivo"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <input
              value={manualSource}
              onChange={(event) => setManualSource(event.target.value)}
              placeholder="Fuente"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Notas"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <button
              onClick={saveManual}
              disabled={saving || !manualRut.trim()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar en blacklist'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-4">
          <h3 className="text-sm font-semibold text-white">Importar Excel / CSV</h3>
          <div className="mt-3 space-y-3">
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,text/csv,text/tab-separated-values"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={replaceAll}
                onChange={(event) => setReplaceAll(event.target.checked)}
                className="rounded border-white/20 bg-transparent"
              />
              Reemplazar blacklist completa
            </label>
            <button
              onClick={runImport}
              disabled={importing || !importFile}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {importing ? 'Importando...' : 'Importar blacklist'}
            </button>
          </div>
        </div>
      </div>

      <DataTable
        title="Registros Blist"
        subtitle="Registros confidenciales. Fuente: empresa reportante."
        data={items}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        searchPlaceholder="Buscar por RUT, nombre o motivo..."
        actions={(item) => (
          <button
            onClick={() => removeItem(item.id)}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
          >
            Eliminar
          </button>
        )}
      />
    </section>
  );
}
