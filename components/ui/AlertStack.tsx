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
    <section className="glass-panel flex h-full flex-col rounded-3xl border border-[rgba(255,255,255,0.12)] bg-white/5 p-6 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.65)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Alertas</p>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {items.length === 0 && <p className="text-sm text-slate-400">{emptyMessage}</p>}
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-[0_16px_40px_-32px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{item.title}</p>
              {item.severity && (
                <StatusBadge label={severityLabel[item.severity]} variant={severityVariant[item.severity]} />
              )}
            </div>
            {item.detail && <p className="mt-1 text-xs text-slate-400">{item.detail}</p>}
            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
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
