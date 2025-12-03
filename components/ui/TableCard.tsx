'use client';

type TableCardProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function TableCard({ title, description, actions, children }: TableCardProps) {
  return (
    <section className="glass-panel overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.12)] bg-white/5 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.65)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Listado</p>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto px-6 py-5">{children}</div>
    </section>
  );
}

export default TableCard;
