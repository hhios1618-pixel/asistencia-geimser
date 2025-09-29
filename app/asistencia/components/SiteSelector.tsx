'use client';

interface Site {
  id: string;
  name: string;
}

interface Props {
  sites: Site[];
  selectedSiteId: string | null;
  onSelect: (siteId: string) => void;
}

export function SiteSelector({ sites, selectedSiteId, onSelect }: Props) {
  if (sites.length <= 1) {
    return (
      <div className="rounded border p-3">
        <p className="text-sm">Sitio asignado: {sites[0]?.name ?? 'No asignado'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="site" className="text-sm font-medium">
        Sitio de asistencia
      </label>
      <select
        id="site"
        value={selectedSiteId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className="rounded border p-2"
      >
        <option value="">Selecciona un sitio</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SiteSelector;

