'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { IconMapPin, IconX, IconEdit, IconTrash, IconPlus, IconCheck } from '@tabler/icons-react';
import DataTable, { type Column } from '../../../../components/ui/DataTable';

interface Site {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
}

interface AddressSuggestion {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
}

const SiteMap = dynamic(() => import('./SiteMap'), { ssr: false });

export function SitesAdmin() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const acceptedSuggestionRef = useRef<string | null>(null);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/attendance/sites', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      setSites(body.items ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchSites(); }, []);

  // Update address query when editing changes
  useEffect(() => {
    if (editing) {
      setAddressQuery(editing.address ?? '');
      setAddressSuggestions([]);
      acceptedSuggestionRef.current = editing.address ?? null;
      setAddressError(null);
    }
  }, [editing]);

  // Geocoding Logic
  useEffect(() => {
    if (!editing || addressQuery.trim().length < 3) return;

    // Si lo que escribió es igual a lo que ya aceptó, no buscar
    if (acceptedSuggestionRef.current && acceptedSuggestionRef.current.toLowerCase() === addressQuery.trim().toLowerCase()) return;

    const timeout = setTimeout(async () => {
      setAddressLoading(true);
      setAddressError(null);
      try {
        const res = await fetch(`/api/admin/attendance/geocode?q=${encodeURIComponent(addressQuery)}&limit=5`);
        if (!res.ok) throw new Error('Error buscando dirección');
        const data = await res.json();
        setAddressSuggestions(data.suggestions ?? []);
      } catch (err) {
        setAddressError('No se pudieron cargar sugerencias.');
      } finally {
        setAddressLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [addressQuery, editing]);

  const handleSelectSuggestion = (s: AddressSuggestion) => {
    setEditing(prev => prev ? ({ ...prev, lat: Number(s.lat), lng: Number(s.lng), address: s.displayName }) : null);
    setAddressQuery(s.displayName);
    acceptedSuggestionRef.current = s.displayName;
    setAddressSuggestions([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const isNew = !sites.some(s => s.id === editing.id);
      const method = isNew ? 'POST' : 'PATCH';
      const payload = { ...editing, address: addressQuery.trim() || null };

      const res = await fetch('/api/admin/attendance/sites', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Error al guardar sitio');
      }

      await fetchSites();
      setSuccess(`Sitio "${editing.name}" guardado.`);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (site: Site) => {
    const next = !site.is_active;
    const verb = next ? 'activar' : 'desactivar';
    if (!confirm(`¿Quieres ${verb} el sitio "${site.name}"?`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/attendance/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: site.id, is_active: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? body.details ?? 'No fue posible actualizar el sitio');
      await fetchSites();
      setSuccess(`Sitio "${site.name}" ${next ? 'activado' : 'desactivado'}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (site: Site) => {
    if (
      !confirm(
        `¿Eliminar el sitio "${site.name}"?\n\nSi tiene historial asociado, se desactivará automáticamente.`
      )
    )
      return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/attendance/sites?id=${site.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? body.details ?? 'No fue posible eliminar el sitio');
      await fetchSites();
      if (body?.soft_deleted) {
        setSuccess(`Sitio "${site.name}" desactivado (tiene historial asociado).`);
      } else {
        setSuccess(`Sitio "${site.name}" eliminado.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Site>[] = [
    {
      header: 'Nombre',
      accessorKey: 'name',
      sortable: true,
      render: (s) => <span className="font-semibold text-slate-200">{s.name}</span>
    },
    {
      header: 'Dirección',
      accessorKey: 'address',
      render: (s) => (
        <div className="flex items-center gap-2 text-slate-400">
          <IconMapPin size={16} />
          <span className="truncate max-w-[200px]" title={s.address ?? ''}>{s.address ?? '—'}</span>
        </div>
      )
    },
    {
      header: 'Coordenadas',
      render: (s) => (
        <span className="font-mono text-xs text-slate-500">
          {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
        </span>
      )
    },
    {
      header: 'Radio',
      accessorKey: 'radius_m',
      render: (s) => <span className="text-slate-400">{s.radius_m}m</span>
    },
    {
      header: 'Estado',
      accessorKey: 'is_active',
      render: (s) => (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
          {s.is_active ? 'Activo' : 'Inactivo'}
        </span>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        title="Gestión de Sitios"
        subtitle="Configura las ubicaciones geográficas y perímetros permitidos."
        data={sites}
        columns={columns}
        keyExtractor={s => s.id}
        searchPlaceholder="Buscar sitio..."
        loading={loading}
        headerActions={
          <button
            onClick={() => {
              setEditing({
                id: crypto.randomUUID(),
                name: '',
                address: '',
                lat: -33.45, // Santiago Default
                lng: -70.66,
                radius_m: 100,
                is_active: true
              });
            }}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
          >
            <IconPlus size={18} />
            Nuevo Sitio
          </button>
        }
        actions={(site) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(site)}
              className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
              title="Editar"
            >
              <IconEdit size={18} />
            </button>
            <button
              onClick={() => handleToggleActive(site)}
              className={`p-2 rounded-lg transition ${
                site.is_active ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title={site.is_active ? 'Desactivar' : 'Activar'}
              disabled={saving}
            >
              {site.is_active ? <IconX size={18} /> : <IconCheck size={18} />}
            </button>
            <button
              onClick={() => handleDelete(site)}
              className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              title="Eliminar"
              disabled={saving}
            >
              <IconTrash size={18} />
            </button>
          </div>
        )}
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
              className="h-full w-full max-w-xl overflow-y-auto bg-[#0A0C10] border-l border-white/10 shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0A0C10]/95 px-6 py-4 backdrop-blur">
                <h2 className="text-xl font-bold text-white">
                  {sites.some(s => s.id === editing.id) ? 'Editar Sitio' : 'Nuevo Sitio'}
                </h2>
                <button onClick={() => setEditing(null)} className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                  <IconX size={20} />
                </button>
              </div>

              <form onSubmit={submit} className="p-6 space-y-6">
                <div className="space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-400">Nombre del Sitio</span>
                    <input
                      required
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Ej. Oficina Central"
                    />
                  </label>

                  <label className="flex flex-col gap-2 relative">
                    <span className="text-xs font-semibold text-slate-400">Dirección</span>
                    <input
                      value={addressQuery}
                      onChange={(e) => {
                        setAddressQuery(e.target.value);
                        setEditing({ ...editing, address: e.target.value });
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Buscar dirección..."
                    />
                    {addressSuggestions.length > 0 && (
                      <div className="absolute top-full mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1A1D24] shadow-2xl z-20">
                        {addressSuggestions.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectSuggestion(s)}
                            className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5"
                          >
                            {s.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Latitud</span>
                      <input
                        type="number"
                        step="any"
                        value={editing.lat}
                        onChange={(e) => setEditing({ ...editing, lat: Number(e.target.value) })}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400">Longitud</span>
                      <input
                        type="number"
                        step="any"
                        value={editing.lng}
                        onChange={(e) => setEditing({ ...editing, lng: Number(e.target.value) })}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-400">Radio Geocerca (metros)</span>
                    <input
                      type="number"
                      min={50}
                      value={editing.radius_m}
                      onChange={(e) => setEditing({ ...editing, radius_m: Number(e.target.value) })}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  </label>

                  {/* Map Placeholder - In a real scenario, this would be an interactive map */}
                  <div className="h-48 w-full rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
                    <SiteMap
                      center={[editing.lat, editing.lng]}
                      zoom={15}
                      radius={editing.radius_m}
                      onDragEnd={(pos) => setEditing({ ...editing, lat: pos.lat, lng: pos.lng })}
                    />
                  </div>

                  <label className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
                    <input
                      type="checkbox"
                      checked={editing.is_active}
                      onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                      className="h-5 w-5 rounded border-slate-600 bg-transparent text-blue-500 accent-blue-500"
                    />
                    <span className="text-sm font-medium text-white">Sitio Activo</span>
                  </label>
                </div>

                {error && <p className="text-sm font-bold text-rose-500">{error}</p>}

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="px-6 py-2.5 text-sm font-semibold text-slate-400 hover:text-white transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    {saving ? 'Guardando...' : 'Guardar Sitio'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
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
