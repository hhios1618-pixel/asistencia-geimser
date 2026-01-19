import type { ReactNode } from 'react';

type SectionHeaderProps = {
  overline?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function SectionHeader({ overline, title, description, actions }: SectionHeaderProps) {
  return (
    <header className="glass-panel relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 px-6 py-5 shadow-[0_26px_70px_-52px_rgba(0,0,0,0.7)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-[3px] rounded-full bg-[linear-gradient(90deg,rgba(124,200,255,0.8),rgba(139,92,246,0.36),transparent)]" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          {overline && <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">{overline}</p>}
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export default SectionHeader;

