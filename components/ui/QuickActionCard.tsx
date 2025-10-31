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
  blue: 'from-blue-500 to-sky-500 text-blue-50',
  emerald: 'from-emerald-500 to-teal-500 text-emerald-50',
  amber: 'from-amber-500 to-orange-500 text-amber-50',
  indigo: 'from-indigo-500 to-purple-500 text-indigo-50',
};

export function QuickActionCard({ title, description, href, icon, accent = 'blue' }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-4 rounded-3xl border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_-52px_rgba(37,99,235,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_80px_-50px_rgba(37,99,235,0.55)]"
    >
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accentMap[accent]} text-lg font-semibold shadow-inner`}
      >
        {icon ?? title.slice(0, 2)}
      </span>
      <div className="space-y-2">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
        Gestionar
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600">
          →
        </span>
      </span>
    </Link>
  );
}

export default QuickActionCard;
