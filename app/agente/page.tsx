import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PageHeader, PageContent } from '@/components/layout/DashboardLayout';
import { runQuery } from '@/lib/db/postgres';
import AgenteDashboard from './components/AgenteDashboard';

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

  const [profile, { records, summary }, recentDocs] = await Promise.all([
    getProfile(user.id),
    getAttendanceThisMonth(user.id),
    getRecentDocs(user.id),
  ]);

  if (!profile) redirect('/login');

  return (
    <>
      <PageHeader
        title="Mi espacio"
        description={profile.campaign_name ? `Campaña: ${profile.campaign_name}` : 'Portal del trabajador'}
        breadcrumb={[{ label: profile.name }]}
      />
      <PageContent>
        <AgenteDashboard
          profile={profile}
          summary={summary}
          recentAttendance={records.slice(0, 7)}
          recentDocs={recentDocs as Parameters<typeof AgenteDashboard>[0]['recentDocs']}
        />
      </PageContent>
    </>
  );
}
