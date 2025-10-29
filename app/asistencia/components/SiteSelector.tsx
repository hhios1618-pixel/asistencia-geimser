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
      <div className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.4)]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-white shadow-[0_12px_30px_-18px_rgba(79,70,229,0.6)]">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" className="h-5 w-5">
              <path d="M4 7h12M4 13h12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 4v3M13 4v3M7 13v3M13 13v3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Sitio asignado</p>
            <p className="text-base font-semibold text-slate-900">
              {sites[0]?.name ?? 'No hay sitio asignado'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.45)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Sitio</p>
          <h3 className="text-lg font-semibold text-slate-900">Selecciona dónde marcarás</h3>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {sites.map((site) => {
          const isActive = site.id === selectedSiteId;
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => onSelect(site.id)}
              className={`group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200/40 bg-white/70 p-4 text-left shadow-[0_18px_45px_-40px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:border-blue-400/60 hover:shadow-[0_24px_60px_-38px_rgba(59,130,246,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-blue-400 ${
                isActive ? 'border-blue-400/70 ring-2 ring-blue-300/70' : ''
              }`}
              aria-pressed={isActive}
            >
              <span className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                <span className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-blue-600/10" />
              </span>
              <span className="relative flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    isActive
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                      : 'bg-blue-50 text-blue-500'
                  }`}
                >
                  {site.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-base font-medium text-slate-900">{site.name}</span>
              </span>
              <span className="relative text-xs text-slate-500">
                Elegir este sitio actualizará tu geocerca y registro de marcas.
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default SiteSelector;
