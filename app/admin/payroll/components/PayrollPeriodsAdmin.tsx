'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

type Period = {
  id: string;
  label: string | null;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSED' | 'PAID';
  created_at: string;
};

const emptyPeriod: Period = {
  id: '',
  label: null,
  start_date: '',
  end_date: '',
  status: 'OPEN',
  created_at: '',
};

export default function PayrollPeriodsAdmin() {
  const [items, setItems] = useState<Period[]>([]);
  const [editing, setEditing] = useState<Period>(emptyPeriod);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/payroll/periods', { cache: 'no-store' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar periodos');
      }
      const body = (await response.json()) as { items: Period[] };
      setItems(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startNew = () => {
    setEditing({ ...emptyPeriod, id: crypto.randomUUID(), status: 'OPEN' });
    setError(null);
    setSuccess(null);
  };

  const startEdit = (period: Period) => {
    setEditing(period);
    setError(null);
    setSuccess(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const exists = items.some((p) => p.id === editing.id);
      const method = exists ? 'PATCH' : 'POST';
      const response = await fetch('/api/admin/payroll/periods', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          label: editing.label,
          start_date: editing.start_date,
          end_date: editing.end_date,
          status: editing.status,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible guardar el periodo');
      }
      await load();
      setSuccess(exists ? 'Periodo actualizado.' : 'Periodo creado.');
      setEditing(emptyPeriod);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (period: Period) => {
    const confirmed = window.confirm(`¿Eliminar el periodo ${period.label ?? `${period.start_date} → ${period.end_date}`}?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/payroll/periods?id=${period.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible eliminar el periodo');
      }
      await load();
      setSuccess('Periodo eliminado.');
      if (editing.id === period.id) setEditing(emptyPeriod);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sorted = useMemo(() => items, [items]);

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader overline="Payroll" title="Periodos" description="Define el rango de fechas para calcular días trabajados." />

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">Listado</p>
          <button
            type="button"
            onClick={startNew}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.6)] transition hover:from-indigo-600 hover:to-blue-600"
          >
            Nuevo periodo
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600">{success}</p>}

        <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Inicio</th>
                <th className="px-4 py-3 text-left">Fin</th>
                <th className="px-4 py-3 text-left">Estado</th>
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
                sorted.map((period) => (
                  <tr key={period.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{period.label ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{period.start_date}</td>
                    <td className="px-4 py-3 text-slate-600">{period.end_date}</td>
                    <td className="px-4 py-3 text-slate-600">{period.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(period)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(period)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                    Aún no hay periodos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={submit} className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">{editing.id ? 'Editar periodo' : 'Crear periodo'}</p>
          {editing.id && (
            <button
              type="button"
              onClick={() => setEditing(emptyPeriod)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Label (opcional)
            <input
              value={editing.label ?? ''}
              onChange={(e) => setEditing((prev) => ({ ...prev, label: e.target.value || null }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Estado
            <select
              value={editing.status}
              onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value as Period['status'] }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
            >
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
              <option value="PAID">PAID</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Inicio
            <input
              type="date"
              value={editing.start_date}
              onChange={(e) => setEditing((prev) => ({ ...prev, start_date: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Fin
            <input
              type="date"
              value={editing.end_date}
              onChange={(e) => setEditing((prev) => ({ ...prev, end_date: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
              required
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  );
}

