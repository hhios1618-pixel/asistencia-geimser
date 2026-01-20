'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import StatusBadge from '../../../../components/ui/StatusBadge';

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

      if (!periodsRes.ok) throw new Error('No fue posible cargar periodos');
      if (!businessesRes.ok) throw new Error('No fue posible cargar negocios');
      if (!runsRes.ok) throw new Error('No fue posible cargar corridas');

      const periodsBody = (await periodsRes.json()) as { items: Period[] };
      const businessesBody = (await businessesRes.json()) as { items: Business[] };
      const runsBody = (await runsRes.json()) as { items: Run[] };
      setPeriods(periodsBody.items ?? []);
      setBusinesses(businessesBody.items ?? []);
      setRuns(runsBody.items ?? []);

      if (!selectedPeriodId && (periodsBody.items?.length ?? 0) > 0) {
        setSelectedPeriodId(periodsBody.items[0].id);
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
        throw new Error(body.error ?? 'No fue posible crear la corrida');
      }
      await load();
      setSuccess('Corrida creada.');
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
      setSuccess(`Cálculo completado. (${JSON.stringify(body.result)})`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRun = async (runId: string) => {
    const confirmed = window.confirm('¿Eliminar esta corrida? Se borrarán sus liquidaciones asociadas.');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/payroll/runs?id=${encodeURIComponent(runId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible eliminar la corrida');
      }
      if (selectedRunId === runId) {
        setSelectedRunId('');
        setPayslips([]);
      }
      await load();
      setSuccess('Corrida eliminada.');
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

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Cálculo"
        title="Corridas de payroll"
        description="Crea una corrida por periodo (y opcionalmente por negocio) y calcula netos según días trabajados."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Periodo
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
              disabled={loading}
            >
              <option value="">—</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.label ? `${p.label} · ` : '') + `${p.start_date} → ${p.end_date}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Negocio (opcional)
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={createRun}
              disabled={saving || !selectedPeriodId}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.6)] transition hover:from-indigo-600 hover:to-blue-600 disabled:opacity-60"
            >
              Crear corrida
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
          <p className="text-sm font-semibold text-slate-800">Corridas</p>
          <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Periodo</th>
                  <th className="px-4 py-3 text-left">Negocio</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading &&
                  runs.map((run) => (
                    <tr
                      key={run.id}
                      className={`border-t border-slate-100 hover:bg-blue-50/40 ${selectedRunId === run.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">
                            {(run.period_label ? `${run.period_label} · ` : '') + `${run.start_date} → ${run.end_date}`}
                          </span>
                          <span className="text-[11px] text-slate-400">{new Date(run.created_at).toLocaleString('es-CL')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{run.business_name ?? 'Todos'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={run.status} variant={run.status === 'CALCULATED' ? 'success' : 'default'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRunId(run.id)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => calculateRun(run.id)}
                            disabled={saving}
                            className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
                          >
                            Calcular
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRun(run.id)}
                            disabled={saving}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!loading && runs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                      Aún no hay corridas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Liquidaciones</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedRunId ? `Run ${selectedRunId.slice(0, 8)}… · Personas: ${totals.people} · Neto: ${formatClp(totals.net)}` : 'Selecciona una corrida.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (selectedRunId ? loadPayslips(selectedRunId) : null)}
              disabled={!selectedRunId || loadingPayslips}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingPayslips ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Persona</th>
                  <th className="px-4 py-3 text-left">Negocio</th>
                  <th className="px-4 py-3 text-left">Cargo</th>
                  <th className="px-4 py-3 text-left">Días</th>
                  <th className="px-4 py-3 text-left">Bruto</th>
                  <th className="px-4 py-3 text-left">Desc.</th>
                  <th className="px-4 py-3 text-left">Neto</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayslips && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-sm text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loadingPayslips &&
                  payslips.map((ps) => (
                    <tr key={ps.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{ps.person_name}</td>
                      <td className="px-4 py-3 text-slate-600">{ps.business_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{ps.position_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{ps.days_worked}</td>
                      <td className="px-4 py-3 text-slate-600">{formatClp(ps.gross)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatClp(ps.deductions)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatClp(ps.net)}</td>
                    </tr>
                  ))}
                {!loadingPayslips && payslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                      {selectedRunId ? 'Aún no hay liquidaciones. Presiona “Calcular”.' : 'Selecciona una corrida.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

