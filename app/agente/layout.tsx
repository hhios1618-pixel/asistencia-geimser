import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/role';
import { DashboardShell } from '@/components/layout/DashboardLayout';
import type { Tables } from '@/types/database';

type Role = Tables['people']['Row']['role'];

export default async function AgenteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);
  const isAdmin = role === 'ADMIN' || role === 'SUPERVISOR';

  const sidebarFooter = (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-[18px] text-sm font-semibold border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.06)] text-[var(--accent)] hover:bg-[rgba(0,229,255,0.12)] hover:border-[rgba(0,229,255,0.35)] transition-all"
        >
          ← Panel Admin
        </Link>
      )}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4">
        <p className="text-xs font-medium text-[var(--accent)]">Sistema Operativo</p>
        <p className="mt-1 text-xs text-slate-400">v2.4.0 (Stable)</p>
      </div>
    </div>
  );

  return (
    <DashboardShell
      navVariant="agente"
      logoHref={isAdmin ? '/admin' : '/agente'}
      sidebarFooter={sidebarFooter}
    >
      {children}
    </DashboardShell>
  );
}
