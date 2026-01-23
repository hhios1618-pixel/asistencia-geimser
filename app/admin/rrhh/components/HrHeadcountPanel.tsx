'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import { IconChartPie, IconCurrencyDollar } from '@tabler/icons-react';

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

  const columns: Column<HeadcountRow>[] = [
    {
      header: 'Negocio',
      accessorKey: 'business_name',
      sortable: true,
      render: (item) => <span className="font-semibold text-slate-200">{item.business_name || 'Sin Negocio'}</span>,
    },
    {
      header: 'Cargo',
      accessorKey: 'position_name',
      sortable: true,
      render: (item) => <span className="text-slate-400">{item.position_name || 'Sin Cargo'}</span>,
    },
    {
      header: 'Activos',
      accessorKey: 'headcount_active',
      render: (item) => <span className="text-emerald-400 font-bold">{item.headcount_active}</span>,
    },
    {
      header: 'Total Histórico',
      accessorKey: 'headcount_total',
      render: (item) => <span className="text-slate-500">{item.headcount_total}</span>,
    },
    {
      header: 'Costo Mensual',
      accessorKey: 'payroll_monthly_active',
      render: (item) => <span className="text-slate-300 font-mono">{formatClp(item.payroll_monthly_active)}</span>,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Control"
        title="Headcount"
        description="Dotación activa por negocio y cargo (calculado automáticamente)."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
              <IconChartPie size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dotación Activa</p>
              <p className="text-2xl font-bold text-white">{totals.headcount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <IconCurrencyDollar size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Costo Mensual</p>
              <p className="text-2xl font-bold text-white">{formatClp(totals.payroll)}</p>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}

      <DataTable
        title="Detalle por Unidad"
        data={items}
        columns={columns}
        keyExtractor={(item, idx) => `${item.business_id}-${item.position_id}-${idx}`}
        loading={loading}
        searchPlaceholder="Buscar por negocio o cargo..."
      />
    </section>
  );
}

