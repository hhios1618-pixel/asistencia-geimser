'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

type Business = { id: string; name: string; is_active: boolean };
type Position = { id: string; name: string; is_active: boolean };

type PersonHr = {
  id: string;
  name: string;
  email: string | null;
  service: string | null;
  is_active: boolean;
  business_id: string | null;
  business_name: string | null;
  position_id: string | null;
  position_name: string | null;
  salary_monthly: number | null;
  employment_type: string | null;
  birth_date: string | null;
  hire_date: string | null;
  termination_date: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

const emptyPerson: PersonHr = {
  id: '',
  name: '',
  email: null,
  service: null,
  is_active: true,
  business_id: null,
  business_name: null,
  position_id: null,
  position_name: null,
  salary_monthly: null,
  employment_type: null,
  birth_date: null,
  hire_date: null,
  termination_date: null,
  address_line1: null,
  address_line2: null,
  city: null,
  region: null,
  country: null,
};

const formatClp = (value: number | null) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export default function HrPeopleAdmin() {
  const [people, setPeople] = useState<PersonHr[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editing, setEditing] = useState<PersonHr>(emptyPerson);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [peopleRes, businessesRes, positionsRes] = await Promise.all([
        fetch('/api/admin/hr/people', { cache: 'no-store' }),
        fetch('/api/admin/hr/businesses', { cache: 'no-store' }),
        fetch('/api/admin/hr/positions', { cache: 'no-store' }),
      ]);

      if (!peopleRes.ok) {
        const body = (await peopleRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar personas');
      }
      if (!businessesRes.ok) {
        const body = (await businessesRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar negocios');
      }
      if (!positionsRes.ok) {
        const body = (await positionsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar cargos');
      }

      const peopleBody = (await peopleRes.json()) as { items: PersonHr[] };
      const businessesBody = (await businessesRes.json()) as { items: Business[] };
      const positionsBody = (await positionsRes.json()) as { items: Position[] };

      setPeople(peopleBody.items ?? []);
      setBusinesses(businessesBody.items ?? []);
      setPositions(positionsBody.items ?? []);
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
      const haystack = [p.name, p.email ?? '', p.service ?? '', p.business_name ?? '', p.position_name ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [people, search]);

  const startEdit = (person: PersonHr) => {
    setEditing(person);
    setError(null);
    setSuccess(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/hr/people', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          business_id: editing.business_id,
          position_id: editing.position_id,
          salary_monthly: editing.salary_monthly,
          employment_type: editing.employment_type,
          birth_date: editing.birth_date,
          hire_date: editing.hire_date,
          termination_date: editing.termination_date,
          address_line1: editing.address_line1,
          address_line2: editing.address_line2,
          city: editing.city,
          region: editing.region,
          country: editing.country,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible guardar la ficha');
      }
      await load();
      setSuccess('Ficha actualizada.');
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

  const activePositions = useMemo(
    () => positions.filter((p) => p.is_active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [positions]
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Ficha"
        title="Personas"
        description="Edita negocio, cargo, sueldo base y datos de contacto. Esto impacta headcount y cálculo de payroll."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Listado</p>
              <p className="mt-1 text-xs text-slate-500">Selecciona una persona para editar su ficha.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buscar</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, correo, negocio, cargo…"
                className="w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-sm md:w-[320px]"
              />
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Negocio</th>
                  <th className="px-4 py-3 text-left">Cargo</th>
                  <th className="px-4 py-3 text-left">Sueldo base</th>
                  <th className="px-4 py-3 text-left">Acción</th>
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
                  filtered.map((person) => (
                    <tr key={person.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">{person.name}</span>
                          <span className="text-[11px] text-slate-400">{person.email ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{person.business_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{person.position_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatClp(person.salary_monthly)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => startEdit(person)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={submit} className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Ficha laboral</p>
              <p className="mt-1 text-xs text-slate-500">{editing.id ? editing.name : 'Selecciona una persona.'}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(emptyPerson)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Negocio
              <select
                value={editing.business_id ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, business_id: e.target.value || null }))}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                disabled={!editing.id}
              >
                <option value="">—</option>
                {activeBusinesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Cargo
              <select
                value={editing.position_id ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, position_id: e.target.value || null }))}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                disabled={!editing.id}
              >
                <option value="">—</option>
                {activePositions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Sueldo base mensual (CLP)
              <input
                type="number"
                min={0}
                value={editing.salary_monthly ?? ''}
                onChange={(e) =>
                  setEditing((prev) => ({
                    ...prev,
                    salary_monthly: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                disabled={!editing.id}
              />
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Tipo de contrato
              <input
                value={editing.employment_type ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, employment_type: e.target.value || null }))}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                placeholder="Plazo fijo, indefinido…"
                disabled={!editing.id}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Fecha nacimiento
                <input
                  type="date"
                  value={editing.birth_date ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, birth_date: e.target.value || null }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  disabled={!editing.id}
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Fecha ingreso
                <input
                  type="date"
                  value={editing.hire_date ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, hire_date: e.target.value || null }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  disabled={!editing.id}
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Dirección (línea 1)
              <input
                value={editing.address_line1 ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, address_line1: e.target.value || null }))}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                disabled={!editing.id}
              />
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Ciudad / Comuna
              <input
                value={editing.city ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, city: e.target.value || null }))}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                disabled={!editing.id}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Región
                <input
                  value={editing.region ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, region: e.target.value || null }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  disabled={!editing.id}
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                País
                <input
                  value={editing.country ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, country: e.target.value || null }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  disabled={!editing.id}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={!editing.id || saving}
              className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar ficha'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

