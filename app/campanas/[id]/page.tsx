import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/role';
import DashboardLayout, { ADMIN_NAV, SUPERVISOR_NAV } from '@/components/layout/DashboardLayout';
import type { Tables } from '@/types/database';
import { runQuery } from '@/lib/db/postgres';
import DataRoomClient from './components/DataRoomClient';

export const dynamic = 'force-dynamic';

type Role = Tables['people']['Row']['role'];
const isManager = (role: Role) => role === 'ADMIN' || role === 'SUPERVISOR';

type CampaignRow = {
  id: string;
  crm_campaign_id: string | null;
  name: string;
  status: string | null;
  channel: string | null;
  client_name: string | null;
  client_rut: string | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
  is_active: boolean;
  worker_count: number;
  document_count: number;
  client_access_count: number;
};

async function getCampaign(id: string) {
  try {
    const { rows: [c] } = await runQuery<CampaignRow>(`
      select
        cl.id, cl.crm_campaign_id, cl.name, cl.status, cl.channel,
        cl.client_name, cl.client_rut, cl.client_contact_name, cl.client_contact_email,
        cl.is_active,
        count(distinct p.id) filter (where p.role = 'WORKER' and p.is_active)::int as worker_count,
        count(distinct cd.id)::int as document_count,
        count(distinct cca.id) filter (where cca.is_active)::int as client_access_count
      from campaigns_local cl
      left join people p on p.campaign_id = cl.id
      left join campaign_documents cd on cd.campaign_id = cl.id
      left join campaign_client_access cca on cca.campaign_id = cl.id
      where cl.id = $1
      group by cl.id
    `, [id]);
    return c ?? null;
  } catch { return null; }
}

async function getTeam(id: string) {
  try {
    const { rows } = await runQuery(`
      select
        p.id, p.rut, p.name, p.email, p.phone, p.role,
        p.is_active, p.hire_date, p.employment_type,
        pos.name as position_name,
        count(distinct cas.work_date) filter (
          where cas.work_date >= date_trunc('month', current_date) and cas.status = 'PRESENT'
        )::int as days_present_this_month,
        max(cas.work_date)::text as last_work_date,
        count(distinct cd.id) filter (where cd.visible_to_worker)::int as worker_docs_count
      from people p
      left join hr_positions pos on pos.id = p.position_id
      left join crm_attendance_sync cas on cas.person_id = p.id
      left join campaign_documents cd on cd.person_id = p.id and cd.campaign_id = $1
      where p.campaign_id = $1 and p.role = 'WORKER'
      group by p.id, pos.name
      order by p.name asc
    `, [id]);
    return rows;
  } catch { return []; }
}

async function getDocuments(id: string) {
  try {
    const { rows } = await runQuery(`
      select
        cd.id, cd.doc_type, cd.period_label, cd.file_name,
        cd.file_size_bytes, cd.mime_type, cd.visible_to_worker,
        cd.visible_to_client, cd.notes, cd.created_at,
        p.name as worker_name, p.rut as worker_rut,
        up.name as uploaded_by_name
      from campaign_documents cd
      left join people p on p.id = cd.person_id
      left join people up on up.id = cd.uploaded_by
      where cd.campaign_id = $1
      order by cd.created_at desc
    `, [id]);
    return rows;
  } catch { return []; }
}

async function getAccesses(id: string) {
  try {
    const { rows } = await runQuery(`
      select
        cca.id, cca.access_level, cca.expires_at::text, cca.is_active,
        cca.last_accessed_at::text, cca.created_at::text,
        p.name as client_name, p.email as client_email
      from campaign_client_access cca
      join people p on p.id = cca.person_id
      where cca.campaign_id = $1
      order by cca.is_active desc, cca.created_at desc
    `, [id]);
    return rows;
  } catch { return []; }
}

async function getAttendance(id: string) {
  try {
    const { rows } = await runQuery(`
      select
        p.id as person_id, p.name as worker_name,
        count(cas.id) filter (where cas.status = 'PRESENT')::int as present,
        count(cas.id) filter (where cas.status = 'ABSENT')::int as absent,
        count(cas.id) filter (where cas.status = 'LATE')::int as late,
        round(coalesce(sum(cas.hours_worked), 0)::numeric, 1) as total_hours,
        max(cas.work_date)::text as last_date
      from people p
      left join crm_attendance_sync cas on cas.person_id = p.id
        and cas.work_date >= date_trunc('month', current_date)
      where p.campaign_id = $1 and p.role = 'WORKER' and p.is_active
      group by p.id, p.name
      order by p.name asc
    `, [id]);
    return rows;
  } catch { return []; }
}

export default async function DataRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);
  if (!isManager(role)) redirect('/agente');

  const [campaign, team, documents, accesses, attendance] = await Promise.all([
    getCampaign(id),
    getTeam(id),
    getDocuments(id),
    getAccesses(id),
    getAttendance(id),
  ]);

  if (!campaign) notFound();

  const navItems = role === 'ADMIN' ? ADMIN_NAV : SUPERVISOR_NAV;

  return (
    <DashboardLayout
      title={campaign.name ?? 'Campaña'}
      description={campaign.client_name ? `Cliente: ${campaign.client_name}` : 'Data Room de campaña'}
      breadcrumb={[
        { label: 'Campañas', href: '/campanas' },
        { label: campaign.name ?? id },
      ]}
      navItems={navItems}
    >
      <DataRoomClient
        campaign={campaign as Parameters<typeof DataRoomClient>[0]['campaign']}
        team={team as Parameters<typeof DataRoomClient>[0]['team']}
        documents={documents as Parameters<typeof DataRoomClient>[0]['documents']}
        accesses={accesses as Parameters<typeof DataRoomClient>[0]['accesses']}
        attendance={attendance as Parameters<typeof DataRoomClient>[0]['attendance']}
        userRole={role}
        campaignId={id}
      />
    </DashboardLayout>
  );
}
