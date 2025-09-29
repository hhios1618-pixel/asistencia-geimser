'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
}

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });

export function SitesAdmin() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Site | null>(null);

  const defaultPosition: [number, number] = useMemo(() => [editing?.lat ?? -33.45, editing?.lng ?? -70.66], [editing]);

  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/admin/attendance/sites');
    if (!response.ok) {
      setError('No fue posible cargar sitios');
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { items: Site[] };
    setSites(body.items);
    setLoading(false);
  };

  useEffect(() => {
    void import('leaflet/dist/leaflet.css');
    void fetchSites();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) {
      return;
    }
    const isExisting = sites.some((site) => site.id === editing.id);
    const method = isExisting ? 'PATCH' : 'POST';
    const { id, ...payload } = editing;
    const response = await fetch('/api/admin/attendance/sites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isExisting ? editing : payload),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? 'No fue posible guardar el sitio');
      return;
    }
    setEditing(null);
    await fetchSites();
  };

  const startCreation = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      lat: -33.45,
      lng: -70.66,
      radius_m: 100,
      is_active: true,
    });
  };

  const startEdit = (site: Site) => {
    setEditing(site);
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sitios</h2>
        <button type="button" className="rounded bg-blue-600 px-3 py-1 text-white" onClick={startCreation}>
          Nuevo sitio
        </button>
      </header>
      {loading && <p>Cargando sitios…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {sites.map((site) => (
          <li key={site.id} className="rounded border p-3">
            <h3 className="font-medium">{site.name}</h3>
            <p className="text-sm text-gray-600">
              {site.lat.toFixed(5)}, {site.lng.toFixed(5)} · Radio {site.radius_m}m
            </p>
            <p className="text-xs">Activo: {site.is_active ? 'Sí' : 'No'}</p>
            <button type="button" className="text-sm text-blue-600 underline" onClick={() => startEdit(site)}>
              Editar
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <form onSubmit={submit} className="grid gap-2 rounded border p-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input
              required
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Radio (m)
            <input
              type="number"
              min={0}
              value={editing.radius_m}
              onChange={(event) => setEditing({ ...editing, radius_m: Number(event.target.value) })}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Latitud
            <input
              type="number"
              value={editing.lat}
              onChange={(event) => setEditing({ ...editing, lat: Number(event.target.value) })}
              className="rounded border p-2"
              step={0.000001}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Longitud
            <input
              type="number"
              value={editing.lng}
              onChange={(event) => setEditing({ ...editing, lng: Number(event.target.value) })}
              className="rounded border p-2"
              step={0.000001}
            />
          </label>
          <div className="md:col-span-2 h-64 overflow-hidden rounded">
            <MapContainer key={editing.id} center={defaultPosition} zoom={17} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={defaultPosition} />
              <Circle center={defaultPosition} radius={editing.radius_m} />
            </MapContainer>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })}
              />
              Activo
            </label>
            <button type="submit" className="rounded bg-green-600 px-3 py-1 text-white">
              Guardar
            </button>
            <button type="button" className="rounded border px-3 py-1" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default SitesAdmin;
