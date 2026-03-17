import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { runQuery } from '@/lib/db/postgres';
import { resolveUserRole } from '@/lib/auth/role';
import MiAsistenciaClient from './MiAsistenciaClient';
import type { Tables } from '@/types/database';
type Role = Tables['people']['Row']['role'];

export const dynamic = 'force-dynamic';

export default async function MiAsistenciaPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);
  const isAdmin = role === 'ADMIN' || role === 'SUPERVISOR';

  const adminBackAction = isAdmin ? (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[rgba(255,255,255,0.1)] bg-white/[0.04] text-slate-400 hover:text-white hover:border-[rgba(0,229,255,0.3)] hover:bg-[rgba(0,229,255,0.06)] transition-all"
    >
      ← Panel Admin
    </Link>
  ) : null;

  // Get last 3 months of attendance
  const { rows: records } = await runQuery<{
    work_date: string;
    status: string;
    hours_worked: number | null;
    check_in_time: string | null;
    check_out_time: string | null;
  }>(`
    select
      work_date::text,
      status,
      hours_worked,
      check_in_time::text,
      check_out_time::text
    from crm_attendance_sync
    where person_id = $1
      and work_date >= current_date - interval '3 months'
    order by work_date desc
  `, [user.id]).catch(() => ({ rows: [] }));

  return (
    <DashboardLayout
      title="Mi asistencia"
      description="Historial de asistencia sincronizado desde el CRM."
      breadcrumb={[{ label: 'Mi espacio', href: '/agente' }, { label: 'Asistencia' }]}
      navVariant="agente"
      logoHref={isAdmin ? '/admin' : '/agente'}
      actions={adminBackAction}
    >
      <MiAsistenciaClient records={records} />
    </DashboardLayout>
  );
}
