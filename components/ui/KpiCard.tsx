'use client';

import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react';

type KpiCardProps = {
  title: string;
  value: string | number;
  metric?: string;
  delta?: number;
  deltaLabel?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: React.ReactNode;
  hint?: string;
};

const trendIconMap = {
  up: <IconArrowUpRight size={16} />,
  down: <IconArrowDownRight size={16} />,
  flat: <IconMinus size={16} />,
};

export function KpiCard({
  title,
  value,
  metric,
  delta,
  deltaLabel,
  trend = 'flat',
  icon,
  hint,
}: KpiCardProps) {
  const formattedDelta =
    typeof delta === 'number'
      ? `${delta > 0 ? '+' : ''}${new Intl.NumberFormat('es-CL', {
          maximumFractionDigits: 1,
        }).format(delta)}%`
      : deltaLabel;

  const isPositive = typeof delta === 'number' ? delta >= 0 : trend === 'up';

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_24px_80px_-52px_rgba(37,99,235,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_90px_-52px_rgba(37,99,235,0.55)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">{title}</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-semibold text-slate-900">
              {typeof value === 'number'
                ? new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(value)
                : value}
            </p>
            {metric && <span className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{metric}</span>}
          </div>
        </div>
        {icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-inner">
            {icon}
          </span>
        )}
      </div>
      {(formattedDelta || hint) && (
        <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
          {formattedDelta ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${
                isPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                  : 'border-rose-200 bg-rose-50 text-rose-600'
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80">
                {trendIconMap[trend]}
              </span>
              {formattedDelta}
            </span>
          ) : (
            <span />
          )}
          {hint && <span className="text-[10px] font-medium text-slate-400">{hint}</span>}
        </div>
      )}
    </article>
  );
}

export default KpiCard;
