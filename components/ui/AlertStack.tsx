'use client';

import StatusBadge from './StatusBadge';

type AlertItem = {
  id: string;
  title: string;
  detail?: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'danger';
};

const severityLabel: Record<NonNullable<AlertItem['severity']>, string> = {
  info: 'INFO',
  warning: 'ALERTA',
  danger: 'CRÍTICO',
};

const severityVariant: Record<NonNullable<AlertItem['severity']>, Parameters<typeof StatusBadge>[0]['variant']> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
};

type AlertStackProps = {
  title: string;
  description?: string;
  items: AlertItem[];
  emptyMessage?: string;
};

export function AlertStack({ title, description, items, emptyMessage = 'Sin alertas recientes.' }: AlertStackProps) {
  return (
    <section className="glass-panel flex h-full flex-col rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.55)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alertas</p>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {items.length === 0 && <p className="text-sm text-slate-400">{emptyMessage}</p>}
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.25)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-800">{item.title}</p>
              {item.severity && (
                <StatusBadge label={severityLabel[item.severity]} variant={severityVariant[item.severity]} />
              )}
            </div>
            {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
              {new Intl.DateTimeFormat('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              }).format(new Date(item.timestamp))}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AlertStack;
