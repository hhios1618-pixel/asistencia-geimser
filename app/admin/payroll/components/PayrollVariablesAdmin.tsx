'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

type Period = { id: string; label: string | null; start_date: string; end_date: string };
type Person = { id: string; name: string; is_active: boolean };

type VariableType = {
  id: string;
  code: string;
  label: string;
  line_type: 'EARNING' | 'DEDUCTION' | 'TAX' | 'OTHER';
  is_active: boolean;
};

type AssignmentRow = {
  id: string;
  person_id: string;
  person_name: string;
  variable_type_id: string;
  code: string;
  label: string;
  line_type: string;
  amount: number;
  notes: string | null;
};

const emptyType: VariableType = {
  id: '',
  code: '',
  label: '',
  line_type: 'EARNING',
  is_active: true,
};

const formatClp = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export default function PayrollVariablesAdmin() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [types, setTypes] = useState<VariableType[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [editingType, setEditingType] = useState<VariableType>(emptyType);
  const [assignPersonId, setAssignPersonId] = useState('');
  const [assignTypeId, setAssignTypeId] = useState('');
  const [assignAmount, setAssignAmount] = useState<number>(0);
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBase = async () => {
    setLoading(true);
    setError(null);
    try {
      const [periodsRes, peopleRes, typesRes] = await Promise.all([
        fetch('/api/admin/payroll/periods', { cache: 'no-store' }),
        fetch('/api/admin/hr/people', { cache: 'no-store' }),
        fetch('/api/admin/payroll/variables/types', { cache: 'no-store' }),
      ]);
      if (!periodsRes.ok) throw new Error('No fue posible cargar períodos');
      if (!peopleRes.ok) throw new Error('No fue posible cargar personas');
      if (!typesRes.ok) throw new Error('No fue posible cargar variables');

      const periodsBody = (await periodsRes.json()) as { items: Period[] };
      const peopleBody = (await peopleRes.json()) as { items: Array<{ id: string; name: string; is_active: boolean }> };
      const typesBody = (await typesRes.json()) as { items: VariableType[] };

      setPeriods(periodsBody.items ?? []);
      setPeople((peopleBody.items ?? []).filter((p) => p.is_active));
      setTypes(typesBody.items ?? []);

      if (!selectedPeriodId && (periodsBody.items?.length ?? 0) > 0) {
        setSelectedPeriodId(periodsBody.items[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async (periodId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/payroll/variables/assignments?period_id=${encodeURIComponent(periodId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar asignaciones');
      }
      const body = (await res.json()) as { items: AssignmentRow[] };
      setAssignments(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setAssignments([]);
    }
  };

  useEffect(() => {
    void loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      void loadAssignments(selectedPeriodId);
    }
  }, [selectedPeriodId]);

  const submitType = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const exists = types.some((t) => t.id === editingType.id);
      const method = exists ? 'PATCH' : 'POST';
      const response = await fetch('/api/admin/payroll/variables/types', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingType),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible guardar la variable');
      }
      await loadBase();
      setEditingType(emptyType);
      setSuccess('Variable guardada.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startNewType = () => {
    setEditingType({ ...emptyType, id: crypto.randomUUID() });
    setError(null);
    setSuccess(null);
  };

  const startEditType = (t: VariableType) => {
    setEditingType(t);
    setError(null);
    setSuccess(null);
  };

  const deleteType = async (t: VariableType) => {
    const confirmed = window.confirm(`¿Eliminar variable ${t.code}?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/payroll/variables/types?id=${encodeURIComponent(t.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No fue posible eliminar');
      await loadBase();
      setSuccess('Variable eliminada.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submitAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPeriodId || !assignPersonId || !assignTypeId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/payroll/variables/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          person_id: assignPersonId,
          period_id: selectedPeriodId,
          variable_type_id: assignTypeId,
          amount: assignAmount,
          notes: assignNotes || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible guardar asignación');
      }
      await loadAssignments(selectedPeriodId);
      setSuccess('Asignación guardada.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (row: AssignmentRow) => {
    const confirmed = window.confirm(`¿Eliminar asignación ${row.code} para ${row.person_name}?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/payroll/variables/assignments?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No fue posible eliminar asignación');
      await loadAssignments(selectedPeriodId);
      setSuccess('Asignación eliminada.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const activeTypes = useMemo(
    () => types.filter((t) => t.is_active).sort((a, b) => a.code.localeCompare(b.code, 'es')),
    [types]
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Nómina"
        title="Bonos y descuentos"
        description="Define variables (asignación/deducción) y asigna montos por persona y período. El cálculo las incluye automáticamente."
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">Tipos de variables</p>
            <button
              type="button"
              onClick={startNewType}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] px-4 py-2 text-xs font-semibold text-black shadow-[0_12px_30px_-18px_rgba(0,229,255,0.45)] transition hover:brightness-110"
            >
              Nueva variable
            </button>
          </div>

          <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Activo</th>
                  <th className="px-4 py-3 text-left">Acciones</th>
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
                  types.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100 hover:bg-white/60">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{t.code}</td>
                      <td className="px-4 py-3 text-slate-600">{t.label}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.line_type === 'EARNING'
                          ? 'Asignación'
                          : t.line_type === 'DEDUCTION'
                            ? 'Deducción'
                            : t.line_type === 'TAX'
                              ? 'Impuesto'
                              : 'Otro'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.is_active ? 'Sí' : 'No'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditType(t)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteType(t)}
                            disabled={saving}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!loading && types.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                      Aún no hay variables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={submitType} className="mt-5 rounded-3xl border border-slate-100 bg-white/80 p-5">
            <p className="text-sm font-semibold text-slate-800">{editingType.id ? 'Editar' : 'Crear'} variable</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Code
                <input
                  value={editingType.code}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, code: e.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Tipo
                <select
                  value={editingType.line_type}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, line_type: e.target.value as VariableType['line_type'] }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                >
                  <option value="EARNING">EARNING</option>
                  <option value="DEDUCTION">DEDUCTION</option>
                  <option value="TAX">TAX</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              <label className="md:col-span-2 flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Label
                <input
                  value={editingType.label}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, label: e.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  required
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm">
                <input
                  type="checkbox"
                  checked={editingType.is_active}
                  onChange={(e) => setEditingType((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Activo
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingType(emptyType)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !editingType.id}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>

        <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
          <p className="text-sm font-semibold text-slate-800">Asignaciones por período</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Período
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
              >
                <option value="">—</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.label ? `${p.label} · ` : '') + `${p.start_date} → ${p.end_date}`}
                  </option>
                ))}
              </select>
            </label>

            <form onSubmit={submitAssignment} className="md:col-span-2 grid gap-4 rounded-3xl border border-slate-100 bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-800">Crear / actualizar asignación</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Persona
                  <select
                    value={assignPersonId}
                    onChange={(e) => setAssignPersonId(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                    required
                  >
                    <option value="">—</option>
                    {people
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Variable
                  <select
                    value={assignTypeId}
                    onChange={(e) => setAssignTypeId(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                    required
                  >
                    <option value="">—</option>
                    {activeTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Monto (CLP)
                  <input
                    type="number"
                    min={0}
                    value={assignAmount}
                    onChange={(e) => setAssignAmount(Number(e.target.value))}
                    className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  />
                </label>

                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Nota (opcional)
                  <input
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !selectedPeriodId}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar asignación'}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-5 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Persona</th>
                  <th className="px-4 py-3 text-left">Variable</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Monto</th>
                  <th className="px-4 py-3 text-left">Acción</th>
                </tr>
              </thead>
              <tbody>
                {selectedPeriodId &&
                  assignments.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{row.person_name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.code} · {row.label}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.line_type}</td>
                      <td className="px-4 py-3 text-slate-600">{formatClp(row.amount)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => deleteAssignment(row)}
                          disabled={saving}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                {selectedPeriodId && assignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                      Sin asignaciones para este período.
                    </td>
                  </tr>
                )}
                {!selectedPeriodId && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                      Selecciona un período.
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
