'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import StatusBadge from '../../../../components/ui/StatusBadge';

type HeadcountRow = {
  business_id: string | null;
  business_name: string | null;
  position_id: string | null;
  position_name: string | null;
  headcount_active: number;
  headcount_total: number;
  payroll_monthly_active: number;
};

const formatClp = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export default function HrHeadcountPanel() {
  const [items, setItems] = useState<HeadcountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hr/headcount', { cache: 'no-store' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar headcount');
      }
      const body = (await response.json()) as { items: HeadcountRow[] };
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

  const totals = useMemo(() => {
    const headcount = items.reduce((acc, row) => acc + (row.headcount_active ?? 0), 0);
    const payroll = items.reduce((acc, row) => acc + (row.payroll_monthly_active ?? 0), 0);
    return { headcount, payroll };
  }, [items]);

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Control"
        title="Headcount"
        description="Dotación activa por negocio y cargo (calculado automáticamente desde personas)."
      />

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={`Activos: ${totals.headcount}`} variant="info" />
            <StatusBadge label={`Costo mensual: ${formatClp(totals.payroll)}`} variant="default" />
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Negocio</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">Activos</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Costo mensual</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((row, index) => (
                  <tr key={`${row.business_id ?? 'none'}-${row.position_id ?? 'none'}-${index}`} className="border-t border-slate-100 hover:bg-blue-50/40">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{row.business_name ?? 'Sin negocio'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.position_name ?? 'Sin cargo'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.headcount_active}</td>
                    <td className="px-4 py-3 text-slate-600">{row.headcount_total}</td>
                    <td className="px-4 py-3 text-slate-600">{formatClp(row.payroll_monthly_active)}</td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                    Sin datos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

