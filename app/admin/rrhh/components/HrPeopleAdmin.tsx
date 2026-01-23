'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconEdit, IconX, IconDatabaseOff, IconBuildingStore, IconBriefcase } from '@tabler/icons-react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

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
  const [editing, setEditing] = useState<PersonHr | null>(null); // Null means no modal
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [peopleRes, businessesRes, positionsRes] = await Promise.all([
        fetch('/api/admin/hr/people', { cache: 'no-store' }),
        fetch('/api/admin/hr/businesses', { cache: 'no-store' }),
        fetch('/api/admin/hr/positions', { cache: 'no-store' }),
      ]);

      const peopleBody = await peopleRes.json();
      const businessesBody = await businessesRes.json();
      const positionsBody = await positionsRes.json();

      if (!peopleRes.ok) throw new Error(peopleBody.error);
      if (!businessesRes.ok) throw new Error(businessesBody.error);
      if (!positionsRes.ok) throw new Error(positionsBody.error);

      setPeople(peopleBody.items ?? []);
      setBusinesses(businessesBody.items ?? []);
      setPositions(positionsBody.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing?.id) return;
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
        const body = await response.json();
        throw new Error(body.error ?? 'Error al guardar');
      }
      await load();
      setSuccess('Ficha actualizada correctamente.');
      setEditing(null);
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

  const columns: Column<PersonHr>[] = [
    {
      header: 'Colaborador',
      accessorKey: 'name',
      sortable: true,
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-200">{p.name}</span>
          <span className="text-xs text-slate-500">{p.email ?? '—'}</span>
        </div>
      )
    },
    {
      header: 'Negocio',
      sortable: true,
      accessorKey: 'business_name',
      render: (p) => (
        <div className="flex items-center gap-2">
          <IconBuildingStore size={16} className="text-slate-500" />
          <span>{p.business_name ?? <span className="text-slate-600 italic">Sin asignar</span>}</span>
        </div>
      )
    },
    {
      header: 'Cargo',
      sortable: true,
      accessorKey: 'position_name',
      render: (p) => (
        <div className="flex items-center gap-2">
          <IconBriefcase size={16} className="text-slate-500" />
          <span>{p.position_name ?? <span className="text-slate-600 italic">Sin asignar</span>}</span>
        </div>
      )
    },
    {
      header: 'Sueldo',
      accessorKey: 'salary_monthly',
      render: (p) => <span className="font-mono text-emerald-400">{formatClp(p.salary_monthly)}</span>,
      className: 'text-right'
    }
  ];

  const actions = (p: PersonHr) => (
    <button
      onClick={() => setEditing(p)}
      className="rounded-lg p-2 text-blue-400 hover:bg-blue-500/10 transition"
      title="Editar Ficha"
    >
      <IconEdit size={18} />
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        overline="RRHH"
        title="Ficha Laboral"
        description="Gestión de contratos, datos personales y asignaciones comerciales."
      />

      <DataTable
        data={people}
        columns={columns}
        keyExtractor={p => p.id}
        searchPlaceholder="Buscar por nombre, cargo, negocio..."
        actions={actions}
        loading={loading}
      />

      {/* Editor Drawer */}
      <AnimatePresence>
        {editing && (
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
                  <h2 className="text-xl font-bold text-white">Editar Ficha</h2>
                  <p className="text-sm text-slate-400">{editing.name}</p>
                </div>
                <button onClick={() => setEditing(null)} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                  <IconX size={20} />
                </button>
              </div>

              <form onSubmit={submit} className="p-6 space-y-8">
                {/* Business & Position */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Asignación</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Negocio</span>
                      <select
                        value={editing.business_id ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, business_id: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">— Sin Asignar —</option>
                        {activeBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Cargo</span>
                      <select
                        value={editing.position_id ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, position_id: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">— Sin Asignar —</option>
                        {activePositions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                {/* Contract Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Contrato</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Sueldo Base (CLP)</span>
                      <input
                        type="number"
                        min={0}
                        value={editing.salary_monthly ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, salary_monthly: e.target.value === '' ? null : Number(e.target.value) }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Tipo Contrato</span>
                      <input
                        value={editing.employment_type ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, employment_type: e.target.value || null }) : null)}
                        placeholder="Ej. Indefinido"
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Fecha Ingreso</span>
                      <input
                        type="date"
                        value={editing.hire_date ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, hire_date: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Fecha Término</span>
                      <input
                        type="date"
                        value={editing.termination_date ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, termination_date: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>

                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400">Datos Personales</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Fecha Nacimiento</span>
                      <input
                        type="date"
                        value={editing.birth_date ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, birth_date: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Dirección</span>
                      <input
                        value={editing.address_line1 ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, address_line1: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Calle, número, depto..."
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Ciudad</span>
                      <input
                        value={editing.city ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, city: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Región</span>
                      <input
                        value={editing.region ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? ({ ...prev, region: e.target.value || null }) : null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>

                {/* Error/Success Messages within form */}
                {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="px-6 py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Success Notification */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] rounded-full border border-emerald-500/30 bg-[#0A0C10] px-6 py-3 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-sm font-medium text-white">{success}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
