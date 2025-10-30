'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { DragEndEvent, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });

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
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<string | null>(null);
  const [addressLookupPerformed, setAddressLookupPerformed] = useState(false);
  const acceptedSuggestionRef = useRef<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
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
  const mapKey = editing ? `map-${editing.id}-${currentLat.toFixed(6)}-${currentLng.toFixed(6)}` : 'map-default';
  const markerKey = editing ? `marker-${editing.id}-${currentLat.toFixed(6)}-${currentLng.toFixed(6)}` : 'marker-default';

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
    let mounted = true;
    const setupLeaflet = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default ?? leafletModule;
      if (!mounted) {
        return;
      }
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    };
    void setupLeaflet();
    void fetchSites();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (editing) {
      const address = editing.address ?? '';
      setAddressQuery(address);
      setAddressSuggestions([]);
      setAcceptedSuggestion(address || null);
      setAddressLookupPerformed(false);
    } else {
      setAddressQuery('');
      setAddressSuggestions([]);
      setAcceptedSuggestion(null);
      setAddressLookupPerformed(false);
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
      return;
    }

    const query = addressQuery.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressLookupPerformed(false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const lastAccepted = acceptedSuggestionRef.current;
      if (lastAccepted && lastAccepted.trim().toLowerCase() === query.toLowerCase()) {
        setAddressSuggestions([]);
        setAddressLoading(false);
        setAddressLookupPerformed(true);
        return;
      }
      setAddressLookupPerformed(false);
      setAddressLoading(true);
      try {
        console.log('[SitesAdmin] fetching suggestions', { query });
        const params = new URLSearchParams({ q: query, limit: '5' });
        const response = await fetch(`/api/admin/attendance/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`status_${response.status}`);
        }
        const data = (await response.json()) as { suggestions?: AddressSuggestion[] };
        setAddressSuggestions(data.suggestions ?? []);
        setAddressLookupPerformed(true);
      } catch (suggestError) {
        if (!(suggestError instanceof DOMException && suggestError.name === 'AbortError')) {
          console.warn('address lookup failed', suggestError);
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

  const handleMapRef = useCallback(
    (instance: LeafletMap | null) => {
      mapRef.current = instance;
      if (instance) {
        console.log('[SitesAdmin] map ready', instance.getCenter());
      }
    },
    []
  );

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const lat = Number(suggestion.lat);
    const lng = Number(suggestion.lng);
    const normalizedAddress = suggestion.displayName;

    console.log('[SitesAdmin] suggestion selected', {
      displayName: normalizedAddress,
      lat,
      lng,
    });

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

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], mapZoom, { animate: true });
    } else {
      console.warn('[SitesAdmin] mapRef not ready to set view', { lat, lng });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) {
      return;
    }
    setSuccess(null);
    const normalizeForSubmit = (site: Site) => {
      const trimmedAddress = (site.address ?? '').trim();
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
      const body = await response.json();
      setError(body.error ?? 'No fue posible guardar el sitio');
      return;
    }
    setEditing(null);
    await fetchSites();
    setSuccess(`Sitio ${editing.name} ${isExisting ? 'actualizado' : 'creado'} correctamente.`);
  };

  const startCreation = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      address: '',
      lat: -33.45,
      lng: -70.66,
      radius_m: 100,
      is_active: true,
    });
    console.log('Update:', -33.45, -70.66);
    setAddressQuery('');
    setAddressSuggestions([]);
    setAcceptedSuggestion(null);
  };

  const startEdit = (site: Site) => {
    setEditing({ ...site, address: site.address ?? '' });
    console.log('Update:', site.lat, site.lng);
    setAddressQuery(site.address ?? '');
    setAddressSuggestions([]);
    setAcceptedSuggestion(site.address ?? null);
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
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Sitios</h2>
          <p className="text-sm text-slate-500">Define las ubicaciones, direcciones y radios de geocerca.</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)] transition hover:from-blue-600 hover:to-indigo-600"
          onClick={startCreation}
        >
          Nuevo sitio
        </button>
      </header>
      {loading && <p className="text-sm text-slate-500">Cargando sitios…</p>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {success && <p className="glass-panel border border-emerald-200/70 bg-emerald-50/70 p-3 text-sm text-emerald-700">{success}</p>}
      <div className="glass-panel grid gap-3 rounded-3xl border border-white/60 bg-white/85 p-4 text-sm md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Búsqueda</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nombre, dirección o coordenadas"
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Estado</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </label>
        <div className="flex items-end">
          <p className="text-xs text-slate-500">
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
                className="rounded-full bg-blue-500/10 px-4 py-1 text-blue-600 transition hover:bg-blue-500/20"
                onClick={() => startEdit(site)}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-full bg-rose-500/10 px-4 py-1 text-rose-600 transition hover:bg-rose-500/20"
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
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Nombre</span>
            <input
              required
              value={editing.name}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Dirección</span>
            <div className="relative">
              <input
                required
                value={addressQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setAddressQuery(value);
                  setAcceptedSuggestion(null);
                }}
                className="w-full rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              />
              {addressQuery.trim().length >= 3 &&
                (addressLoading || addressSuggestions.length > 0 || addressLookupPerformed) && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-xl">
                  {addressLoading && (
                    <p className="px-4 py-2 text-xs text-slate-400">Buscando direcciones…</p>
                  )}
                  {!addressLoading && addressSuggestions.length === 0 && addressLookupPerformed && (
                    <p className="px-4 py-2 text-xs text-slate-400">No se encontraron coincidencias.</p>
                  )}
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="flex w-full items-start gap-2 px-4 py-2 text-left text-xs text-slate-600 hover:bg-blue-50/70"
                    >
                      <span className="flex-1 leading-snug">{suggestion.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Latitud</span>
            <input
              type="number"
              value={editing.lat}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  lat: Number(event.target.value),
                }))
              }
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              step={0.000001}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Longitud</span>
            <input
              type="number"
              value={editing.lng}
              onChange={(event) =>
                updateEditing((current) => ({
                  ...current,
                  lng: Number(event.target.value),
                }))
              }
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
              step={0.000001}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Radio (m)</span>
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
              className="rounded-2xl border border-white/80 bg-white/70 p-3 text-sm shadow-inner focus:border-blue-300 focus:outline-none"
            />
          </label>
          <div className="md:col-span-2 h-64 overflow-hidden rounded-3xl border border-white/60">
            <MapContainer
              key={mapKey}
              center={defaultPosition}
              zoom={mapZoom}
              className="h-full w-full"
              ref={handleMapRef}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                key={markerKey}
                position={defaultPosition}
                draggable={true}
                eventHandlers={{
                  dragend: (event: DragEndEvent) => {
                    const pos = event.target.getLatLng();
                    updateEditing((current) => ({
                      ...current,
                      lat: pos.lat,
                      lng: pos.lng,
                    }));
                    console.log('[SitesAdmin] marker dragged', pos);
                  },
                }}
              />
              <Circle key={`circle-${markerKey}`} center={defaultPosition} radius={editing.radius_m} />
            </MapContainer>
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
