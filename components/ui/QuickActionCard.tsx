'use client';

import Link from 'next/link';

type QuickActionCardProps = {
  title: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
  accent?: 'cyan' | 'fuchsia' | 'neutral' | 'blue' | 'emerald' | 'amber' | 'indigo';
};

const accentMap: Record<Required<QuickActionCardProps>['accent'], string> = {
  cyan: 'from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black',
  fuchsia: 'from-[var(--accent-2)] to-[rgba(255,43,214,0.78)] text-black',
  neutral: 'from-[rgba(255,255,255,0.18)] to-[rgba(255,255,255,0.10)] text-white',
  blue: 'from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black',
  emerald: 'from-[var(--accent)] to-[rgba(0,229,255,0.72)] text-black',
  amber: 'from-[var(--accent-2)] to-[rgba(255,43,214,0.78)] text-black',
  indigo: 'from-[var(--accent-2)] to-[rgba(255,43,214,0.78)] text-black',
};

export function QuickActionCard({ title, description, href, icon, accent = 'blue' }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-4 rounded-3xl border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(150deg,rgba(17,23,34,0.92),rgba(10,12,18,0.88))] p-5 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_100px_-50px_rgba(0,0,0,0.7)]"
    >
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accentMap[accent]} text-lg font-semibold shadow-inner`}
      >
        {icon ?? title.slice(0, 2)}
      </span>
      <div className="space-y-2">
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
        Gestionar
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-white/10 text-white">
          →
        </span>
      </span>
    </Link>
  );
}

export default QuickActionCard;
