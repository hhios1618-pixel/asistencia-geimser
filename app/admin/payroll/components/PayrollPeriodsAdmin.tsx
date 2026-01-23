'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import { IconEdit, IconTrash, IconPlus, IconCalendarTime } from '@tabler/icons-react';

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
        throw new Error(body.error ?? 'No fue posible cargar períodos');
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
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const startEdit = (period: Period) => {
    setEditing(period);
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
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
      setSuccess(exists ? 'Período actualizado.' : 'Período creado.');
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
      setSuccess('Período eliminado.');
      if (editing.id === period.id) setEditing(emptyPeriod);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Period>[] = [
    {
      header: 'Etiqueta',
      accessorKey: 'label',
      sortable: true,
      render: (item) => <span className="font-semibold text-slate-200">{item.label || '—'}</span>,
    },
    {
      header: 'Inicio',
      accessorKey: 'start_date',
      sortable: true,
      render: (item) => <span className="text-slate-400 font-mono text-xs">{item.start_date}</span>,
    },
    {
      header: 'Fin',
      accessorKey: 'end_date',
      sortable: true,
      render: (item) => <span className="text-slate-400 font-mono text-xs">{item.end_date}</span>,
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      render: (item) => {
        const colors = {
          OPEN: 'bg-emerald-500/10 text-emerald-400',
          CLOSED: 'bg-slate-500/10 text-slate-400',
          PAID: 'bg-blue-500/10 text-blue-400',
        };
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[item.status]}`}>
            {item.status}
          </span>
        );
      },
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader overline="Nómina" title="Períodos" description="Define el rango de fechas para calcular días trabajados." />

      <div className="flex flex-col gap-4">
        {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
        {success && <p className="text-sm font-semibold text-emerald-500">{success}</p>}

        <DataTable
          title="Ciclos de Nómina"
          subtitle="Gestiona los períodos de pago."
          data={items}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          searchPlaceholder="Buscar por etiqueta..."
          headerActions={
            <button
              onClick={startNew}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
            >
              <IconPlus size={18} />
              Nuevo Período
            </button>
          }
          actions={(item) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => startEdit(item)}
                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                title="Editar"
              >
                <IconEdit size={18} />
              </button>
              <button
                onClick={() => handleDelete(item)}
                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                title="Eliminar"
              >
                <IconTrash size={18} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Editor Form - Flat Design */}
      {editing.id && (
        <div className="rounded-2xl border border-white/10 bg-[#0A0C10] p-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <IconCalendarTime className="text-blue-500" />
              {items.some(p => p.id === editing.id) ? 'Editar Período' : 'Nuevo Período'}
            </h3>
            <button
              onClick={() => setEditing(emptyPeriod)}
              className="text-sm text-slate-500 hover:text-white transition"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={submit} className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Etiqueta (Opcional)</span>
                <input
                  value={editing.label ?? ''}
                  onChange={(e) => setEditing((prev) => ({ ...prev, label: e.target.value || null }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                  placeholder="Ej. Enero 2026"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</span>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value as Period['status'] }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition [&>option]:text-black"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="PAID">PAID</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha Inicio</span>
                <input
                  type="date"
                  required
                  value={editing.start_date}
                  onChange={(e) => setEditing((prev) => ({ ...prev, start_date: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition [color-scheme:dark]"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha Fin</span>
                <input
                  type="date"
                  required
                  value={editing.end_date}
                  onChange={(e) => setEditing((prev) => ({ ...prev, end_date: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition [color-scheme:dark]"
                />
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/10">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 transition"
              >
                {saving ? 'Guardando...' : 'Guardar Período'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
