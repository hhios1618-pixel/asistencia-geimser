'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

type RemunerationRow = {
  rut_full: string;
  nombre_completo: string | null;
  estado: string | null;
  empresa: string | null;
  cliente: string | null;
  servicio: string | null;
  cargo: string | null;
  tipo_remuneracion: string | null;
  centro_costo_descripcion: string | null;
  sueldo_bruto: number | null;
  gratificacion: number | null;
  movilizacion: number | null;
  colacion: number | null;
  banco_transferencia: string | null;
  tipo_cuenta_transferencia: string | null;
  numero_cuenta: string | null;
  fecha_contrato: string | null;
  termino_contrato: string | null;
  correo_corporativo: string | null;
};

const formatClp = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number | null) =>
  value == null ? '—' : `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value)}%`;

const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(iso)) : '—';

export default function PayrollSalaryRecordsPanel() {
  const [rows, setRows] = useState<RemunerationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hr/collaborators-sheet', { cache: 'no-store' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar remuneraciones');
      }
      const body = (await response.json()) as { items: RemunerationRow[] };
      setRows(body.items ?? []);
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
    if (!term) return rows;
    return rows.filter((p) => {
      const haystack = [
        p.rut_full,
        p.nombre_completo ?? '',
        p.empresa ?? '',
        p.cliente ?? '',
        p.servicio ?? '',
        p.cargo ?? '',
        p.centro_costo_descripcion ?? '',
        p.banco_transferencia ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Nómina"
        title="Remuneraciones"
        description="Fuente: Planilla RR.HH. (Sueldo, centro de costo y datos bancarios)."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Listado</p>
            <p className="mt-1 text-xs text-slate-500">
              Fuente: planilla base (RR.HH.). Importa datos en{' '}
              <a className="underline underline-offset-4" href="/admin/colaboradores">
                Planilla RR.HH.
              </a>
              .
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, RUT, cliente, cargo, centro de costo…"
              className="w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-sm md:w-[320px]"
            />
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Colaborador</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Centro costo</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Sueldo bruto</th>
                <th className="px-4 py-3 text-left">Grat.</th>
                <th className="px-4 py-3 text-left">Mov.</th>
                <th className="px-4 py-3 text-left">Col.</th>
                <th className="px-4 py-3 text-left">Banco/Cuenta</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-sm text-slate-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((p) => (
                  <tr key={p.rut_full} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">{p.nombre_completo ?? '—'}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{p.rut_full}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.cliente ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.centro_costo_descripcion ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.tipo_remuneracion ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{formatClp(p.sueldo_bruto)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatPercent(p.gratificacion)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatClp(p.movilizacion)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatClp(p.colacion)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p>{p.banco_transferencia ?? '—'}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.tipo_cuenta_transferencia ?? '—'} • {p.numero_cuenta ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.estado ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(p.fecha_contrato)} → {formatDate(p.termino_contrato)}
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-sm text-slate-400">
                    Sin resultados.
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
