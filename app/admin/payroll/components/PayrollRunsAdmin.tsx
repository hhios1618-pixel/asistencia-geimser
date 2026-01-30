'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import { IconCalculator, IconEye, IconTrash, IconMoneybag } from '@tabler/icons-react';

type Period = { id: string; label: string | null; start_date: string; end_date: string; status: string };
type Business = { id: string; name: string; is_active: boolean };

type Run = {
  id: string;
  period_id: string;
  period_label: string | null;
  start_date: string;
  end_date: string;
  business_id: string | null;
  business_name: string | null;
  status: string;
  created_at: string;
};

type Payslip = {
  id: string;
  person_id: string;
  person_name: string;
  business_name: string | null;
  position_name: string | null;
  days_worked: number;
  salary_base: number | null;
  gross: number | null;
  deductions: number | null;
  net: number | null;
};

const formatClp = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export default function PayrollRunsAdmin() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [periodsRes, businessesRes, runsRes] = await Promise.all([
        fetch('/api/admin/payroll/periods', { cache: 'no-store' }),
        fetch('/api/admin/hr/businesses', { cache: 'no-store' }),
        fetch('/api/admin/payroll/runs', { cache: 'no-store' }),
      ]);

      if (!periodsRes.ok) throw new Error('No fue posible cargar períodos');
      if (!businessesRes.ok) throw new Error('No fue posible cargar negocios');
      if (!runsRes.ok) throw new Error('No fue posible cargar procesos');

      const periodsBody = (await periodsRes.json()) as { items: Period[] };
      const businessesBody = (await businessesRes.json()) as { items: Business[] };
      const runsBody = (await runsRes.json()) as { items: Run[] };
      setPeriods(periodsBody.items ?? []);
      setBusinesses(businessesBody.items ?? []);
      setRuns(runsBody.items ?? []);

      if (!selectedPeriodId && (periodsBody.items?.length ?? 0) > 0) {
        const preferred = (periodsBody.items ?? []).find((p) => p.status === 'OPEN') ?? periodsBody.items[0]!;
        setSelectedPeriodId(preferred.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadPayslips = async (runId: string) => {
    setLoadingPayslips(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payroll/payslips?run_id=${encodeURIComponent(runId)}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar liquidaciones');
      }
      const body = (await response.json()) as { items: Payslip[] };
      setPayslips(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setPayslips([]);
    } finally {
      setLoadingPayslips(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      void loadPayslips(selectedRunId);
    }
  }, [selectedRunId]);

  const createRun = async () => {
    if (!selectedPeriodId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          period_id: selectedPeriodId,
          business_id: selectedBusinessId || null,
          status: 'DRAFT',
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible crear el proceso');
      }
      await load();
      setSuccess('Proceso creado.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const calculateRun = async (runId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/payroll/runs/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible calcular la nómina');
      }
      const body = (await response.json()) as { result: unknown };
      await load();
      await loadPayslips(runId);
      setSuccess(`Cálculo completado.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRun = async (runId: string) => {
    const confirmed = window.confirm('¿Eliminar este proceso? Se borrarán sus liquidaciones asociadas.');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/payroll/runs?id=${encodeURIComponent(runId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible eliminar el proceso');
      }
      if (selectedRunId === runId) {
        setSelectedRunId('');
        setPayslips([]);
      }
      await load();
      setSuccess('Proceso eliminado.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const activeBusinesses = useMemo(
    () => businesses.filter((b) => b.is_active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [businesses]
  );

  const totals = useMemo(() => {
    const net = payslips.reduce((acc, ps) => acc + (ps.net ?? 0), 0);
    const people = payslips.length;
    return { net, people };
  }, [payslips]);

  const runColumns: Column<Run>[] = [
    {
      header: 'Período',
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-200">
            {(item.period_label ? `${item.period_label} · ` : '') + `${item.start_date} → ${item.end_date}`}
          </span>
          <span className="text-[11px] text-slate-500">{new Date(item.created_at).toLocaleString('es-CL')}</span>
        </div>
      ),
    },
    {
      header: 'Negocio',
      accessorKey: 'business_name',
      render: (item) => <span className="text-slate-400 text-xs">{item.business_name ?? 'Todos'}</span>,
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      render: (item) => {
        const isCalculated = item.status === 'CALCULATED';
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${isCalculated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {item.status}
          </span>
        );
      },
    },
  ];

  const psColumns: Column<Payslip>[] = [
    { header: 'Persona', accessorKey: 'person_name', sortable: true, render: (i) => <span className="text-slate-200 font-semibold">{i.person_name}</span> },
    { header: 'Cargo', accessorKey: 'position_name', sortable: true, render: (i) => <span className="text-slate-400 text-xs">{i.position_name ?? '-'}</span> },
    { header: 'Días', accessorKey: 'days_worked', render: (i) => <span className="text-slate-300">{i.days_worked}</span> },
    { header: 'Bruto', accessorKey: 'gross', render: (i) => <span className="text-slate-400 font-mono text-xs">{formatClp(i.gross)}</span> },
    { header: 'Deducciones', accessorKey: 'deductions', render: (i) => <span className="text-slate-400 font-mono text-xs">{formatClp(i.deductions)}</span> },
    { header: 'Neto', accessorKey: 'net', render: (i) => <span className="text-emerald-400 font-mono font-bold text-xs">{formatClp(i.net)}</span> },
  ];

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Nómina"
        title="Procesos de Cálculo"
        description="Genera y calcula las liquidaciones por período."
      />

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-500">{success}</p>}

      {/* Control Panel */}
      <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
        <div className="grid gap-4 md:grid-cols-3 items-end">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período</span>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition [&>option]:text-black"
              disabled={loading}
            >
              <option value="">— Seleccionar —</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.label ? `${p.label} · ` : '') + `${p.start_date} → ${p.end_date}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocio (Opcional)</span>
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition [&>option]:text-black"
              disabled={loading}
            >
              <option value="">Todos</option>
              {activeBusinesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={createRun}
            disabled={saving || !selectedPeriodId}
            className="rounded-full bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            <IconMoneybag size={20} />
            Crear Proceso
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="flex flex-col gap-4">
          <DataTable
            title="Historial de Procesos"
            data={runs}
            columns={runColumns}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder="Buscar..."
            actions={(run) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedRunId(run.id)}
                  className={`p-2 rounded-lg transition ${selectedRunId === run.id ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  title="Ver Liquidaciones"
                >
                  <IconEye size={18} />
                </button>
                <button
                  onClick={() => calculateRun(run.id)}
                  className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                  title="Calcular"
                >
                  <IconCalculator size={18} />
                </button>
                <button
                  onClick={() => deleteRun(run.id)}
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Eliminar"
                >
                  <IconTrash size={18} />
                </button>
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-4">
          {selectedRunId ? (
            <DataTable
              title="Liquidaciones Generadas"
              subtitle={`Personas: ${totals.people} · Total Neto: ${formatClp(totals.net)}`}
              data={payslips}
              columns={psColumns}
              keyExtractor={(p) => p.id}
              loading={loadingPayslips}
              searchPlaceholder="Buscar persona..."
              headerActions={
                <button
                  onClick={() => loadPayslips(selectedRunId)}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Actualizar
                </button>
              }
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-white/10 bg-[#0A0C10] text-slate-500">
              <IconCalculator size={48} className="opacity-20 mb-4" />
              <p>Selecciona un proceso para ver sus liquidaciones.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
