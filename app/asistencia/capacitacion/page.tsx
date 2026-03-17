import { redirect } from 'next/navigation';
import DashboardLayout, { ADMIN_NAV, SUPERVISOR_NAV, WORKER_NAV, type NavItem } from '../../../components/layout/DashboardLayout';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import type { Tables } from '../../../types/database';
import { resolveUserRole } from '../../../lib/auth/role';
import TrainingCampaignHubClient from './TrainingCampaignHubClient';

export const dynamic = 'force-dynamic';

const navByRole = (role: Tables['people']['Row']['role']): NavItem[] => {
  if (role === 'ADMIN') return ADMIN_NAV;
  if (role === 'SUPERVISOR') return SUPERVISOR_NAV;
  return WORKER_NAV;
};

export default async function TrainingCampaignHubPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'WORKER';
  const role = await resolveUserRole(user, defaultRole);

  return (
    <DashboardLayout
      title="Capacitación"
      description="Repositorio único de materiales por campaña para formación operativa continua."
      breadcrumb={[
        { label: role === 'ADMIN' ? 'Administración' : role === 'SUPERVISOR' ? 'Supervisor' : 'Asistencia' },
        { label: 'Capacitación por campaña' },
      ]}
      navItems={navByRole(role)}
    >
      <TrainingCampaignHubClient />
    </DashboardLayout>
  );
}
