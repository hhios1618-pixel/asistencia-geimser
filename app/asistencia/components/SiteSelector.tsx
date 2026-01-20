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
      <div className="glass-panel rounded-3xl border border-[rgba(255,255,255,0.12)] bg-white/5 p-5 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-black shadow-[0_12px_30px_-18px_rgba(0,229,255,0.35)]">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" className="h-5 w-5">
              <path d="M4 7h12M4 13h12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 4v3M13 4v3M7 13v3M13 13v3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Sitio asignado</p>
            <p className="text-base font-semibold text-white">
              {sites[0]?.name ?? 'No hay sitio asignado'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="glass-panel rounded-3xl border border-[rgba(255,255,255,0.12)] bg-white/5 p-5 shadow-[0_22px_60px_-38px_rgba(0,0,0,0.65)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Sitio</p>
          <h3 className="text-lg font-semibold text-white">Selecciona dónde marcarás</h3>
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
              className={`group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border bg-white/5 p-4 text-left shadow-[0_18px_45px_-40px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5 hover:border-[rgba(0,229,255,0.35)] hover:bg-white/10 hover:shadow-[0_24px_60px_-38px_rgba(0,229,255,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]/60 ${
                isActive ? 'border-[rgba(0,229,255,0.45)] ring-1 ring-[rgba(0,229,255,0.25)]' : 'border-[rgba(255,255,255,0.12)]'
              }`}
              aria-pressed={isActive}
            >
              <span className="relative flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    isActive
                      ? 'bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-black'
                      : 'border border-[rgba(255,255,255,0.14)] bg-white/5 text-slate-100'
                  }`}
                >
                  {site.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-base font-medium text-white">{site.name}</span>
              </span>
              <span className="relative text-xs text-slate-300">
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
