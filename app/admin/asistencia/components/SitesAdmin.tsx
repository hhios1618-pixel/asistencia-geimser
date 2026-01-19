'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SectionHeader from '../../../../components/ui/SectionHeader';

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Site | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<string | null>(null);
  const [addressLookupPerformed, setAddressLookupPerformed] = useState(false);
  const acceptedSuggestionRef = useRef<string | null>(null);
  const mapZoom = 16;

  const updateEditing = (updater: (current: Site) => Site) => {
    setEditing((current) => {
      if (!current) {
        return current;
      }
      const next = updater(current);
      if (next.lat !== current.lat || next.lng !== current.lng) {
        console.log('Update:', next.lat, next.lng);
      }
      return next;
    });
  };

  // posición reactiva forzada (garantiza rerender real del mapa)
  const currentLat = Number(editing?.lat ?? -33.45);
  const currentLng = Number(editing?.lng ?? -70.66);
  const defaultPosition: [number, number] = [currentLat, currentLng];

  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/admin/attendance/sites');
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'No fue posible cargar sitios');
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { items: Site[] };
    setSites(body.items);
    setLoading(false);
  };

  useEffect(() => {
    void fetchSites();
  }, []);

  useEffect(() => {
    if (editing) {
      const address = editing.address ?? '';
      setAddressQuery(address);
      setAddressSuggestions([]);
      setAcceptedSuggestion(address || null);
      setAddressLookupPerformed(false);
      setAddressError(null);
    } else {
      setAddressQuery('');
      setAddressSuggestions([]);
      setAcceptedSuggestion(null);
      setAddressLookupPerformed(false);
      setAddressError(null);
    }
  }, [editing]);

  useEffect(() => {
    acceptedSuggestionRef.current = acceptedSuggestion;
  }, [acceptedSuggestion]);

  useEffect(() => {
    if (!editing) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressLookupPerformed(false);
      setAddressError(null);
      return;
    }

    const query = addressQuery.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressLookupPerformed(false);
      setAddressError(null);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const lastAccepted = acceptedSuggestionRef.current;
      if (lastAccepted && lastAccepted.trim().toLowerCase() === query.toLowerCase()) {
        setAddressSuggestions([]);
        setAddressLoading(false);
        setAddressLookupPerformed(true);
        setAddressError(null);
        return;
      }
      setAddressLookupPerformed(false);
      setAddressLoading(true);
      setAddressError(null);
      try {
        const params = new URLSearchParams({ q: query, limit: '5' });
        const response = await fetch(`/api/admin/attendance/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          if (response.status === 403) {
            setAddressError('No autorizado para buscar direcciones (verifica tu sesión/rol).');
          } else {
            setAddressError(body.error ?? `No fue posible buscar direcciones (status ${response.status}).`);
          }
          setAddressSuggestions([]);
          setAddressLookupPerformed(true);
          return;
        }
        const data = (await response.json()) as { suggestions?: AddressSuggestion[] };
        setAddressSuggestions(data.suggestions ?? []);
        setAddressLookupPerformed(true);
      } catch (suggestError) {
        if (!(suggestError instanceof DOMException && suggestError.name === 'AbortError')) {
          setAddressError('No fue posible buscar direcciones. Revisa tu conexión.');
          setAddressSuggestions([]);
          setAddressLookupPerformed(true);
        }
      } finally {
        setAddressLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [addressQuery, editing]);

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const lat = Number(suggestion.lat);
    const lng = Number(suggestion.lng);
    const normalizedAddress = suggestion.displayName;

    updateEditing((current) => ({
      ...current,
      address: normalizedAddress,
      lat,
      lng,
    }));

    setAddressQuery(normalizedAddress);
    setAddressSuggestions([]);
    setAcceptedSuggestion(normalizedAddress);
    setAddressLoading(false);
    setAddressLookupPerformed(true);
    setAddressError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) {
      return;
    }
    setSuccess(null);
    setError(null);
    const normalizeForSubmit = (site: Site) => {
      const trimmedAddress = addressQuery.trim();
      return {
        ...site,
        address: trimmedAddress.length > 0 ? trimmedAddress : null,
      };
    };
    const normalized = normalizeForSubmit(editing);
    const isExisting = sites.some((site) => site.id === editing.id);
    const method = isExisting ? 'PATCH' : 'POST';
    const { id: siteId, ...createBase } = normalized;
    void siteId;
    const response = await fetch('/api/admin/attendance/sites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isExisting ? normalized : createBase),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      const messageBase = body.error ?? 'No fue posible guardar el sitio';
      setError(body.details ? `${messageBase}\n${body.details}` : messageBase);
      return;
    }
    setEditing(null);
    await fetchSites();
    setSuccess(`Sitio ${editing.name} ${isExisting ? 'actualizado' : 'creado'} correctamente.`);
  };

  const startCreation = () => {
    setError(null);
    setSuccess(null);
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      address: '',
      lat: -33.45,
      lng: -70.66,
      radius_m: 100,
      is_active: true,
    });
    setAddressQuery('');
    setAddressSuggestions([]);
    setAcceptedSuggestion(null);
    setAddressError(null);
  };

  const startEdit = (site: Site) => {
    setError(null);
    setSuccess(null);
    setEditing({ ...site, address: site.address ?? '' });
    setAddressQuery(site.address ?? '');
    setAddressSuggestions([]);
    setAcceptedSuggestion(site.address ?? null);
    setAddressError(null);
  };

  const deleteSite = async (site: Site) => {
    const confirmed = window.confirm(
      `¿Eliminar el sitio ${site.name}? Se quitarán asignaciones y no se podrán registrar marcas en él.`
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/admin/attendance/sites?id=${site.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'No fue posible eliminar el sitio');
      return;
    }
    if (editing?.id === site.id) {
      setEditing(null);
    }
    await fetchSites();
    setSuccess(`Sitio ${site.name} eliminado.`);
  };

  const filteredSites = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sites.filter((site) => {
      const matchesSearch =
        term.length === 0 ||
        site.name.toLowerCase().includes(term) ||
        (site.address ?? '').toLowerCase().includes(term) ||
        site.lat.toString().includes(term) ||
        site.lng.toString().includes(term);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && site.is_active) ||
        (statusFilter === 'INACTIVE' && !site.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [sites, searchTerm, statusFilter]);

  return (
    <section className="flex flex-col gap-6">
      <SectionHeader
        overline="Geocercas"
        title="Sitios"
        description="Define las ubicaciones, direcciones y radios de geocerca."
        actions={
          <button
            type="button"
            className="rounded-full bg-[linear-gradient(135deg,rgba(124,200,255,0.9),rgba(90,156,255,0.85))] px-5 py-2 text-sm font-semibold text-[#05060c] shadow-[0_18px_55px_-40px_rgba(124,200,255,0.65)] transition hover:shadow-[0_24px_70px_-44px_rgba(124,200,255,0.75)]"
            onClick={startCreation}
          >
            Nuevo sitio
          </button>
        }
      />
      {loading && <p className="text-sm text-slate-500">Cargando sitios…</p>}
      {error && <p className="whitespace-pre-wrap text-sm text-rose-200">{error}</p>}
      {success && (
        <p className="rounded-3xl border border-emerald-400/30 bg-[rgba(16,185,129,0.12)] p-3 text-sm text-emerald-100">
          {success}
        </p>
      )}
      <div className="glass-panel grid gap-3 rounded-3xl border border-white/60 bg-white/85 p-4 text-sm md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Búsqueda</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nombre, dirección o coordenadas"
            className="rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner placeholder:text-slate-400 focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Estado</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </label>
        <div className="flex items-end">
          <p className="text-xs text-slate-300">
            {filteredSites.length} de {sites.length} sitios visibles
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredSites.map((site) => (
          <li key={site.id} className="glass-panel rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.45)]">
            <h3 className="text-lg font-semibold text-slate-900">{site.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{site.address ?? 'Dirección no registrada'}</p>
            <p className="mt-2 text-xs text-slate-500">
              Lat {site.lat.toFixed(5)} · Lng {site.lng.toFixed(5)} · Radio {site.radius_m}m
            </p>
            <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {site.is_active ? 'Activo' : 'Inactivo'}
            </p>
            <div className="mt-3 flex gap-3 text-sm">
              <button
                type="button"
                className="rounded-full bg-sky-500/10 px-4 py-1 text-sky-200 transition hover:bg-sky-500/20"
                onClick={() => startEdit(site)}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-full bg-rose-500/10 px-4 py-1 text-rose-200 transition hover:bg-rose-500/20"
                onClick={() => deleteSite(site)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {filteredSites.length === 0 && !loading && (
          <li className="glass-panel rounded-3xl border border-white/60 bg-white/80 p-4 text-center text-sm text-slate-400">
            No hay sitios que cumplan con los filtros.
          </li>
        )}
      </ul>
      {editing && (
        <form onSubmit={submit} className="glass-panel grid gap-4 rounded-3xl border border-white/60 bg-white/90 p-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Nombre</span>
            <input
              required
              value={editing.name}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner placeholder:text-slate-400 focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Dirección</span>
            <div className="relative">
              <input
                required
                value={addressQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setAddressQuery(value);
                  setAcceptedSuggestion(null);
                  setAddressError(null);
                  updateEditing((current) => ({
                    ...current,
                    address: value,
                  }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && addressSuggestions.length > 0) {
                    event.preventDefault();
                    handleSelectSuggestion(addressSuggestions[0]);
                  }
                  if (event.key === 'Escape') {
                    setAddressSuggestions([]);
                  }
                }}
                placeholder="Escribe para buscar (mín. 3 letras)"
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner placeholder:text-slate-400 focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
              />
            </div>
            {addressQuery.trim().length >= 3 &&
              (addressLoading || addressSuggestions.length > 0 || addressLookupPerformed) && (
              <div className="mt-2 max-h-52 overflow-auto rounded-2xl border border-[rgba(255,255,255,0.16)] bg-[#070a12] shadow-xl [scrollbar-width:thin] [scrollbar-color:rgba(124,200,255,0.35)_transparent]">
                {addressLoading && <p className="px-4 py-2 text-xs text-slate-200">Buscando direcciones…</p>}
                {!addressLoading && addressError && <p className="px-4 py-2 text-xs text-rose-200">{addressError}</p>}
                {!addressLoading && !addressError && addressSuggestions.length === 0 && addressLookupPerformed && (
                  <p className="px-4 py-2 text-xs text-slate-200">No se encontraron coincidencias.</p>
                )}
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="flex w-full items-start gap-2 border-t border-[rgba(255,255,255,0.08)] px-4 py-2 text-left text-xs text-slate-100 hover:bg-[rgba(124,200,255,0.12)]"
                  >
                    <span className="flex-1 whitespace-normal leading-snug">{suggestion.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Latitud</span>
            <input
              type="number"
              value={editing.lat}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  lat: Number(event.target.value),
                }))
              }
              className="rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
              step={0.000001}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Longitud</span>
            <input
              type="number"
              value={editing.lng}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  lng: Number(event.target.value),
                }))
              }
              className="rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
              step={0.000001}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-300">Radio (m)</span>
            <input
              type="number"
              min={0}
              value={editing.radius_m}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  radius_m: Number(event.target.value),
                }))
              }
              className="rounded-2xl border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-3 text-sm text-slate-100 shadow-inner focus:border-[rgba(124,200,255,0.55)] focus:outline-none"
            />
          </label>
          <div className="md:col-span-2 h-64 overflow-hidden rounded-3xl border border-white/60">
            <SiteMap
              center={defaultPosition}
              zoom={mapZoom}
              radius={editing.radius_m}
              onDragEnd={(pos) =>
                updateEditing((current) => ({
                  ...current,
                  lat: pos.lat,
                  lng: pos.lng,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(event) =>
                  updateEditing((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
              />
              Activo
            </label>
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)] transition hover:from-emerald-600 hover:to-teal-600"
            >
              Guardar
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default SitesAdmin;
