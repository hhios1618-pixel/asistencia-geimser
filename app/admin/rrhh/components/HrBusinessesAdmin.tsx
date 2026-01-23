'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';
import DataTable, { type Column } from '../../../../components/ui/DataTable';
import { IconEdit, IconTrash, IconPlus, IconBuildingStore } from '@tabler/icons-react';

type Business = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  is_active: boolean;
};

const emptyBusiness: Business = {
  id: '',
  name: '',
  legal_name: null,
  tax_id: null,
  is_active: true,
};

export default function HrBusinessesAdmin() {
  const [items, setItems] = useState<Business[]>([]);
  const [editing, setEditing] = useState<Business>(emptyBusiness);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hr/businesses', { cache: 'no-store' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible cargar negocios');
      }
      const body = (await response.json()) as { items: Business[] };
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
    setEditing({ ...emptyBusiness, id: crypto.randomUUID() });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const startEdit = (business: Business) => {
    setEditing(business);
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
      const exists = items.some((b) => b.id === editing.id);
      const method = exists ? 'PATCH' : 'POST';
      const response = await fetch('/api/admin/hr/businesses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible guardar el negocio');
      }
      await load();
      setSuccess(exists ? 'Negocio actualizado.' : 'Negocio creado.');
      setEditing(emptyBusiness);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (business: Business) => {
    const confirmed = window.confirm(`¿Eliminar el negocio "${business.name}"?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/hr/businesses?id=${business.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'No fue posible eliminar el negocio');
      }
      await load();
      setSuccess('Negocio eliminado.');
      if (editing.id === business.id) {
        setEditing(emptyBusiness);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Business>[] = [
    {
      header: 'Nombre',
      accessorKey: 'name',
      sortable: true,
      render: (item) => <span className="font-semibold text-slate-200">{item.name}</span>,
    },
    {
      header: 'Razón Social',
      accessorKey: 'legal_name',
      sortable: true,
      render: (item) => <span className="text-slate-400">{item.legal_name || '—'}</span>,
    },
    {
      header: 'Tax ID',
      accessorKey: 'tax_id',
      render: (item) => <span className="text-slate-500 font-mono text-xs">{item.tax_id || '—'}</span>,
    },
    {
      header: 'Estado',
      accessorKey: 'is_active',
      render: (item) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${item.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
            }`}
        >
          {item.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Catálogo"
        title="Negocios"
        description="Agrupa personas por unidad de negocio (impacta headcount y nómina)."
      />

      <div className="flex flex-col gap-4">
        {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
        {success && <p className="text-sm font-semibold text-emerald-500">{success}</p>}

        <DataTable
          title="Listado de Negocios"
          subtitle="Gestiona las unidades de negocio."
          data={items}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          searchPlaceholder="Buscar negocios..."
          headerActions={
            <button
              onClick={startNew}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
            >
              <IconPlus size={18} />
              Nuevo Negocio
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
              <IconBuildingStore className="text-blue-500" />
              {items.some(b => b.id === editing.id) ? 'Editar Negocio' : 'Nuevo Negocio'}
            </h3>
            <button
              onClick={() => setEditing(emptyBusiness)}
              className="text-sm text-slate-500 hover:text-white transition"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={submit} className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</span>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                  placeholder="Ej. Ventas Norte"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Razón Social</span>
                <input
                  value={editing.legal_name ?? ''}
                  onChange={(e) => setEditing({ ...editing, legal_name: e.target.value || null })}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                  placeholder="Ej. Sociedad Ventas S.A."
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tax ID / RUT</span>
                <input
                  value={editing.tax_id ?? ''}
                  onChange={(e) => setEditing({ ...editing, tax_id: e.target.value || null })}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                  placeholder="Ej. 76.123.456-7"
                />
              </label>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 w-full cursor-pointer hover:bg-white/10 transition">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-600 bg-transparent text-blue-500 accent-blue-500"
                  />
                  <span className="text-sm font-medium text-white">Negocio Activo</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/10">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 transition"
              >
                {saving ? 'Guardando...' : 'Guardar Negocio'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

