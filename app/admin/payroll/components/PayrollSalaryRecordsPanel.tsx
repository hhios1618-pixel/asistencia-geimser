'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

type PersonHr = {
  id: string;
  name: string;
  business_name: string | null;
  position_name: string | null;
  salary_monthly: number | null;
  is_active: boolean;
};

const formatClp = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export default function PayrollSalaryRecordsPanel() {
  const [people, setPeople] = useState<PersonHr[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hr/people', { cache: 'no-store' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar registros salariales');
      }
      const body = (await response.json()) as { items: PersonHr[] };
      setPeople(body.items ?? []);
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
    if (!term) return people;
    return people.filter((p) => {
      const haystack = [p.name, p.business_name ?? '', p.position_name ?? ''].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [people, search]);

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Nómina"
        title="Registros salariales"
        description="Revisa el sueldo base por persona. La ficha se edita desde “Empleados”."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Listado</p>
            <p className="mt-1 text-xs text-slate-500">Fuente: ficha laboral (RR.HH.).</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, negocio, cargo…"
              className="w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-sm md:w-[320px]"
            />
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">Negocio</th>
                <th className="px-4 py-3 text-left">Cargo</th>
                <th className="px-4 py-3 text-left">Sueldo base</th>
                <th className="px-4 py-3 text-left">Estado</th>
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
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      <a href="/admin/rrhh?panel=employees" className="text-xs text-slate-400 underline underline-offset-4">
                        Abrir ficha
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.business_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.position_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{formatClp(p.salary_monthly)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.is_active ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-sm text-slate-400">
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

