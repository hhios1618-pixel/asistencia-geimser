'use client';

import Link from 'next/link';

type QuickActionCardProps = {
  title: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
  accent?: 'blue' | 'emerald' | 'amber' | 'indigo';
};

const accentMap: Record<Required<QuickActionCardProps>['accent'], string> = {
  blue: 'from-[#7cc8ff] to-[#5aa7f5] text-[#05060c]',
  emerald: 'from-[#64dfc3] to-[#43b59f] text-[#041014]',
  amber: 'from-[#f6c96f] to-[#f59e3b] text-[#1f1305]',
  indigo: 'from-[#a8b7ff] to-[#7c91ff] text-[#0b0f1c]',
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
