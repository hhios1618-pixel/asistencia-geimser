'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconAlertTriangle, IconCheck, IconFileText, IconX } from '@tabler/icons-react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import KpiCard from '../../../../components/ui/KpiCard';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

type RemunerationRow = {
  rut_full: string;
  nombre_completo: string | null;
  estado: string | null;
  sub_estado: string | null;
  empresa: string | null;
  area: string | null;
  cliente: string | null;
  servicio: string | null;
  campania: string | null;
  cargo: string | null;
  supervisor: string | null;
  coordinador: string | null;
  sub_gerente: string | null;

  tipo_remuneracion: string | null;
  centro_costo_descripcion: string | null;
  banco_transferencia: string | null;
  tipo_cuenta_transferencia: string | null;
  numero_cuenta: string | null;

  sueldo_bruto: number | null;
  gratificacion: number | null;
  movilizacion: number | null;
  colacion: number | null;

  fecha_contrato: string | null;
  termino_contrato: string | null;

  // system join
  person_id: string | null;
  person_role: string | null;
  person_is_active: boolean | null;
  business_name: string | null;
  position_name: string | null;
  salary_monthly: number | null;
} & Record<string, unknown>;

type Kpis = {
  total: number;
  planilla_activos: number;
  planilla_inactivos: number;
  system_activos: number;
  system_inactivos: number;
  sin_match_sistema: number;
  sin_banco: number;
  sin_centro_costo: number;
  sin_sueldo: number;
  vencen_30_dias: number;
};

const formatClp = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number | null) =>
  value == null ? '—' : `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value)}%`;

const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(iso)) : '—';

const isActive = (estado: string | null) => (estado ?? '').toLowerCase() === 'activo';

export default function PayrollSalaryRecordsPanel() {
  const [rows, setRows] = useState<RemunerationRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'active' | 'expiring' | 'issues'>('all');
  const [selected, setSelected] = useState<RemunerationRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/payroll/remunerations', { cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as { items?: RemunerationRow[]; kpis?: Kpis; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'No fue posible cargar remuneraciones');
      setRows(body.items ?? []);
      setKpis(body.kpis ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const withSearch = !term
      ? rows
      : rows.filter((p) => {
          const haystack = [
            p.rut_full,
            p.nombre_completo ?? '',
            p.empresa ?? '',
            p.area ?? '',
            p.cliente ?? '',
            p.servicio ?? '',
            p.campania ?? '',
            p.cargo ?? '',
            p.supervisor ?? '',
            p.coordinador ?? '',
            p.centro_costo_descripcion ?? '',
            p.banco_transferencia ?? '',
            p.business_name ?? '',
            p.position_name ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(term);
        });

    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiring30 = (p: RemunerationRow) => {
      if (!p.termino_contrato) return false;
      const d = new Date(p.termino_contrato);
      return d >= new Date(today.toDateString()) && d <= in30;
    };
    const issues = (p: RemunerationRow) =>
      !p.person_id ||
      !(p.banco_transferencia ?? '').trim() ||
      !(p.numero_cuenta ?? '').trim() ||
      !(p.centro_costo_descripcion ?? '').trim() ||
      (p.sueldo_bruto ?? 0) <= 0;

    switch (tab) {
      case 'active':
        return withSearch.filter((p) => isActive(p.estado));
      case 'expiring':
        return withSearch.filter(expiring30);
      case 'issues':
        return withSearch.filter(issues);
      default:
        return withSearch;
    }
  }, [rows, search, tab]);

  const columns = useMemo<Column<RemunerationRow>[]>(() => {
    const issueCount = (p: RemunerationRow) => {
      let n = 0;
      if (!p.person_id) n += 1;
      if (!(p.banco_transferencia ?? '').trim() || !(p.numero_cuenta ?? '').trim()) n += 1;
      if (!(p.centro_costo_descripcion ?? '').trim()) n += 1;
      if ((p.sueldo_bruto ?? 0) <= 0) n += 1;
      return n;
    };

    return [
      {
        header: 'Colaborador',
        accessorKey: 'nombre_completo',
        sortable: true,
        render: (p) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-200">{p.nombre_completo ?? '—'}</span>
            <span className="text-[11px] text-slate-500 font-mono">{p.rut_full}</span>
            <span className="text-[10px] text-slate-600">{p.business_name ?? '—'} • {p.position_name ?? '—'}</span>
          </div>
        ),
      },
      { header: 'Cliente', accessorKey: 'cliente', sortable: true, render: (p) => p.cliente ?? '—' },
      { header: 'Área', accessorKey: 'area', sortable: true, render: (p) => p.area ?? '—' },
      { header: 'Cargo', accessorKey: 'cargo', sortable: true, render: (p) => p.cargo ?? '—' },
      {
        header: 'Paquete',
        accessorKey: 'sueldo_bruto',
        sortable: true,
        className: 'text-right',
        render: (p) => (
          <div className="flex flex-col items-end">
            <span className="font-mono text-sm text-emerald-300">{formatClp(p.sueldo_bruto)}</span>
            <span className="text-[10px] text-slate-500">
              Grat {formatPercent(p.gratificacion)} • Mov {formatClp(p.movilizacion)} • Col {formatClp(p.colacion)}
            </span>
          </div>
        ),
      },
      {
        header: 'Banco',
        accessorKey: 'banco_transferencia',
        sortable: true,
        render: (p) => (
          <div className="flex flex-col">
            <span className="text-slate-300">{p.banco_transferencia ?? '—'}</span>
            <span className="text-[10px] text-slate-500 truncate">
              {(p.tipo_cuenta_transferencia ?? '—') + ' • ' + (p.numero_cuenta ?? '—')}
            </span>
          </div>
        ),
      },
      {
        header: 'Centro costo',
        accessorKey: 'centro_costo_descripcion',
        sortable: true,
        render: (p) => p.centro_costo_descripcion ?? '—',
      },
      {
        header: 'Estado',
        accessorKey: 'estado',
        sortable: true,
        render: (p) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              isActive(p.estado) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
            }`}
          >
            {p.estado ?? '—'}
          </span>
        ),
      },
      {
        header: 'Sistema',
        accessorKey: 'person_is_active',
        render: (p) => {
          if (!p.person_id) {
            return <span className="text-xs font-semibold text-amber-200">Sin match</span>;
          }
          return (
            <span className={`text-xs font-semibold ${p.person_is_active ? 'text-emerald-300' : 'text-rose-300'}`}>
              {p.person_is_active ? 'Activo' : 'Inactivo'}
            </span>
          );
        },
      },
      {
        header: 'Contrato',
        accessorKey: 'termino_contrato',
        sortable: true,
        render: (p) => (
          <div className="flex flex-col">
            <span className="text-slate-300">{formatDate(p.fecha_contrato)}</span>
            <span className="text-[10px] text-slate-500">{formatDate(p.termino_contrato)}</span>
          </div>
        ),
      },
      {
        header: 'Alertas',
        render: (p) => {
          const n = issueCount(p);
          if (n === 0) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                <IconCheck size={14} />
                OK
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200">
              <IconAlertTriangle size={14} />
              {n}
            </span>
          );
        },
      },
    ];
  }, []);

  const tabs = (
    <div className="flex flex-wrap gap-2">
      {([
        { id: 'all', label: 'Todos' },
        { id: 'active', label: 'Activos' },
        { id: 'expiring', label: 'Vencen 30 días' },
        { id: 'issues', label: 'Con alertas' },
      ] as const).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
            tab === t.id
              ? 'border-[rgba(124,200,255,0.45)] bg-[rgba(124,200,255,0.14)] text-white'
              : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Nómina"
        title="Remuneraciones"
        description="Panel CRM por colaborador (cruce planilla RR.HH. + sistema)."
        actions={
          <a
            href="/admin/colaboradores"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-[rgba(0,229,255,0.35)] hover:bg-white/15"
          >
            <IconFileText size={16} />
            Abrir planilla RR.HH.
          </a>
        }
      />

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Colaboradores" value={kpis?.total ?? 0} hint="Planilla" />
        <KpiCard title="Activos (planilla)" value={kpis?.planilla_activos ?? 0} />
        <KpiCard title="Sin match sistema" value={kpis?.sin_match_sistema ?? 0} />
        <KpiCard title="Sin banco/cuenta" value={kpis?.sin_banco ?? 0} />
        <KpiCard title="Vencen 30 días" value={kpis?.vencen_30_dias ?? 0} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {tabs}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, RUT, cliente, cargo, banco…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500 shadow-sm md:w-[360px] focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <DataTable
          title="Panel"
          subtitle="Unificado por RUT. Usa “Ver” para la ficha completa."
          data={filtered}
          columns={columns}
          keyExtractor={(row) => String(row.rut_full)}
          loading={loading}
          searchable={false}
          actions={(row) => (
            <button
              onClick={() => setSelected(row)}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
            >
              Ver
            </button>
          )}
          emptyMessage="Sin resultados con los filtros actuales."
        />
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full w-full max-w-2xl overflow-y-auto bg-[#0A0C10] border-l border-white/10 shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0A0C10]/95 px-6 py-4 backdrop-blur">
                <div>
                  <h2 className="text-xl font-bold text-white">Ficha de remuneración</h2>
                  <p className="text-sm text-slate-400">{selected.nombre_completo ?? selected.rut_full}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <IconX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">RUT</p>
                    <p className="mt-2 font-mono text-white">{selected.rut_full}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">Cruce sistema</p>
                    <p className="mt-2 text-white">
                      {selected.person_id ? (
                        <span className="inline-flex items-center gap-2 text-emerald-300">
                          <IconCheck size={16} /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-amber-200">
                          <IconAlertTriangle size={16} /> Sin match
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <KpiCard title="Sueldo bruto" value={formatClp(selected.sueldo_bruto)} />
                  <KpiCard title="Gratificación" value={formatPercent(selected.gratificacion)} />
                  <KpiCard title="Centro costo" value={selected.centro_costo_descripcion ?? '—'} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(selected).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">{key}</p>
                      <p className="mt-2 text-sm text-white break-words">{String(value ?? '—')}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/admin/colaboradores?rut=${encodeURIComponent(selected.rut_full)}`}
                    className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/15"
                  >
                    Ver en planilla RR.HH.
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

