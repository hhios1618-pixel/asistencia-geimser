'use client';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variantClasses: Record<Variant, string> = {
  default: 'border-[rgba(255,255,255,0.2)] bg-white/10 text-slate-100',
  success: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100',
  warning: 'border-amber-400/60 bg-amber-400/10 text-amber-100',
  danger: 'border-rose-400/50 bg-rose-400/10 text-rose-100',
  info: 'border-sky-400/60 bg-sky-400/10 text-sky-100',
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
