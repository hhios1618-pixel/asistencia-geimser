'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../../components/ui/SectionHeader';

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
  };

  const startEdit = (business: Business) => {
    setEditing(business);
    setError(null);
    setSuccess(null);
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

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [items]
  );

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Catálogo"
        title="Negocios"
        description="Agrupa personas por unidad de negocio (impacta headcount y nómina)."
      />

      <div className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">Listado</p>
          <button
            type="button"
            onClick={startNew}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.6)] transition hover:from-indigo-600 hover:to-blue-600"
          >
            Nuevo negocio
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600">{success}</p>}

        <div className="mt-4 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Razón social</th>
                <th className="px-4 py-3 text-left">Tax ID</th>
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
                sorted.map((business) => (
                  <tr key={business.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{business.name}</td>
                    <td className="px-4 py-3 text-slate-600">{business.legal_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{business.tax_id ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{business.is_active ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(business)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(business)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                    Aún no hay negocios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={submit} className="glass-panel rounded-3xl border border-white/60 bg-white/90 p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">{editing.id ? 'Editar negocio' : 'Crear negocio'}</p>
          {editing.id && (
            <button
              type="button"
              onClick={() => setEditing(emptyBusiness)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Nombre
            <input
              value={editing.name}
              onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Razón social
            <input
              value={editing.legal_name ?? ''}
              onChange={(e) => setEditing((prev) => ({ ...prev, legal_name: e.target.value || null }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Tax ID / RUT empresa
            <input
              value={editing.tax_id ?? ''}
              onChange={(e) => setEditing((prev) => ({ ...prev, tax_id: e.target.value || null }))}
              className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-normal text-slate-700 shadow-sm"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm">
            <input
              type="checkbox"
              checked={editing.is_active}
              onChange={(e) => setEditing((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            Activo
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

