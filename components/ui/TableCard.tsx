'use client';

type TableCardProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function TableCard({ title, description, actions, children }: TableCardProps) {
  return (
    <section className="glass-panel overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.55)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/70 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Listado</p>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto px-6 py-5">{children}</div>
    </section>
  );
}

export default TableCard;
