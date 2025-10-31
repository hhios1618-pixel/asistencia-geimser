'use client';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantClasses: Record<Variant, string> = {
  default: 'border-slate-200 bg-slate-50 text-slate-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-600',
  danger: 'border-rose-200 bg-rose-50 text-rose-600',
  info: 'border-blue-200 bg-blue-50 text-blue-600',
};

type StatusBadgeProps = {
  label: string;
  variant?: Variant;
  leadingIcon?: React.ReactNode;
};

export function StatusBadge({ label, variant = 'default', leadingIcon }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${variantClasses[variant]}`}
    >
      {leadingIcon && <span className="text-base">{leadingIcon}</span>}
      {label}
    </span>
  );
}

export default StatusBadge;
