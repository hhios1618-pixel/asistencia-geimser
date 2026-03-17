import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/role';
import DashboardLayout, { ADMIN_NAV, SUPERVISOR_NAV } from '@/components/layout/DashboardLayout';
import type { Tables } from '@/types/database';
import { runQuery } from '@/lib/db/postgres';
import CampanasClient from './components/CampanasClient';

export const dynamic = 'force-dynamic';

type Role = Tables['people']['Row']['role'];
const isManager = (role: Role) => role === 'ADMIN' || role === 'SUPERVISOR';

async function getStats() {
  try {
    const { rows } = await runQuery<{
      total: number;
      active: number;
      total_workers: number;
      total_docs: number;
    }>(`
      select
        count(distinct cl.id)::int as total,
        count(distinct cl.id) filter (where cl.is_active)::int as active,
        count(distinct p.id) filter (where p.role = 'WORKER' and p.is_active)::int as total_workers,
        count(distinct cd.id)::int as total_docs
      from campaigns_local cl
      left join people p on p.campaign_id = cl.id
      left join campaign_documents cd on cd.campaign_id = cl.id
    `);
    return rows[0] ?? { total: 0, active: 0, total_workers: 0, total_docs: 0 };
  } catch {
    return { total: 0, active: 0, total_workers: 0, total_docs: 0 };
  }
}

async function getCampaigns(userId: string, role: Role) {
  try {
    if (role === 'ADMIN') {
      const { rows } = await runQuery(`
        select
          cl.id, cl.crm_campaign_id, cl.name, cl.status,
          cl.channel, cl.client_name, cl.client_rut,
          cl.is_active, cl.synced_at,
          count(distinct p.id) filter (where p.role = 'WORKER' and p.is_active)::int as worker_count,
          count(distinct cd.id)::int as document_count
        from campaigns_local cl
        left join people p on p.campaign_id = cl.id
        left join campaign_documents cd on cd.campaign_id = cl.id
        group by cl.id
        order by cl.is_active desc, cl.name asc
      `);
      return rows;
    }
    const { rows } = await runQuery(`
      select
        cl.id, cl.crm_campaign_id, cl.name, cl.status,
        cl.channel, cl.client_name, cl.is_active,
        count(distinct p.id) filter (where p.role = 'WORKER' and p.is_active)::int as worker_count,
        count(distinct cd.id)::int as document_count
      from campaigns_local cl
      left join people p on p.campaign_id = cl.id
      left join campaign_documents cd on cd.campaign_id = cl.id
      where cl.id in (
        select campaign_id from people where id = $1 and campaign_id is not null
        union
        select w.campaign_id from team_assignments ta
        join people w on w.id = ta.member_id
        where ta.supervisor_id = $1 and ta.active = true and w.campaign_id is not null
      )
      group by cl.id
      order by cl.name asc
    `, [userId]);
    return rows;
  } catch {
    return [];
  }
}

export default async function CampanasPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Role) ?? 'ADMIN';
  const role = await resolveUserRole(user, defaultRole);
  if (!isManager(role)) redirect('/agente');

  const [stats, campaigns] = await Promise.all([
    getStats(),
    getCampaigns(user.id, role),
  ]);

  const navItems = role === 'ADMIN' ? ADMIN_NAV : SUPERVISOR_NAV;

  return (
    <DashboardLayout
      title="Campañas RRHH"
      description="Data rooms por campaña — documentos, equipo y acceso de clientes."
      breadcrumb={[{ label: 'RRHH' }, { label: 'Campañas' }]}
      navItems={navItems}
    >
      <CampanasClient
        initialStats={stats as Parameters<typeof CampanasClient>[0]['initialStats']}
        initialCampaigns={campaigns as Parameters<typeof CampanasClient>[0]['initialCampaigns']}
        userRole={role}
      />
    </DashboardLayout>
  );
}
