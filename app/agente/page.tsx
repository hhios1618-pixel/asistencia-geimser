import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { runQuery } from '@/lib/db/postgres';
import { resolveUserRole } from '@/lib/auth/role';
import AgenteDashboard from './components/AgenteDashboard';
import type { Tables } from '@/types/database';
type Role = Tables['people']['Row']['role'];

export const dynamic = 'force-dynamic';

type Profile = {
  name: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  hire_date: string | null;
  employment_type: string | null;
  position_name: string | null;
  campaign_name: string | null;
};

async function getProfile(userId: string) {
  try {
    const { rows: [p] } = await runQuery<Profile>(`
      select
        p.name, p.rut, p.email, p.phone,
        p.hire_date::text, p.employment_type,
        pos.name as position_name,
        cl.name as campaign_name
      from people p
      left join hr_positions pos on pos.id = p.position_id
      left join campaigns_local cl on cl.id = p.campaign_id
      where p.id = $1
    `, [userId]);
    return p ?? null;
  } catch { return null; }
}

async function getAttendanceThisMonth(userId: string) {
  try {
    const { rows } = await runQuery<{
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
        and work_date >= date_trunc('month', current_date)
      order by work_date desc
      limit 15
    `, [userId]);

    const summary = {
      present_days: rows.filter(r => r.status === 'PRESENT').length,
      absent_days: rows.filter(r => r.status === 'ABSENT').length,
      late_days: rows.filter(r => r.status === 'LATE').length,
      hours_total: rows.reduce((acc, r) => acc + (Number(r.hours_worked) || 0), 0),
    };

    return { records: rows, summary };
  } catch {
    return { records: [], summary: { present_days: 0, absent_days: 0, late_days: 0, hours_total: 0 } };
  }
}

async function getRecentDocs(userId: string) {
  try {
    const { rows } = await runQuery(`
      select
        cd.id, cd.doc_type, cd.period_label, cd.file_name, cd.created_at::text,
        cl.name as campaign_name
      from campaign_documents cd
      left join campaigns_local cl on cl.id = cd.campaign_id
      where cd.person_id = $1 and cd.visible_to_worker = true
      order by cd.created_at desc
      limit 5
    `, [userId]);
    return rows;
  } catch { return []; }
}

export default async function AgentePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);
  const isAdmin = role === 'ADMIN' || role === 'SUPERVISOR';

  const [profile, { records, summary }, recentDocs] = await Promise.all([
    getProfile(user.id),
    getAttendanceThisMonth(user.id),
    getRecentDocs(user.id),
  ]);

  if (!profile) redirect('/login');

  const adminBackAction = isAdmin ? (
    <Link
      href="/admin"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[rgba(255,255,255,0.1)] bg-white/[0.04] text-slate-400 hover:text-white hover:border-[rgba(0,229,255,0.3)] hover:bg-[rgba(0,229,255,0.06)] transition-all"
    >
      ← Panel Admin
    </Link>
  ) : null;

  return (
    <DashboardLayout
      title="Mi espacio"
      description={profile.campaign_name ? `Campaña: ${profile.campaign_name}` : 'Portal del trabajador'}
      breadcrumb={[{ label: profile.name }]}
      navVariant="agente"
      logoHref={isAdmin ? '/admin' : '/agente'}
      actions={adminBackAction}
    >
      <AgenteDashboard
        profile={profile}
        summary={summary}
        recentAttendance={records.slice(0, 7)}
        recentDocs={recentDocs as Parameters<typeof AgenteDashboard>[0]['recentDocs']}
      />
    </DashboardLayout>
  );
}
