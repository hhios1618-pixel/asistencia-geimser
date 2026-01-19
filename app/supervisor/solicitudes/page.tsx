import DashboardLayout, { SUPERVISOR_NAV } from '../../../components/layout/DashboardLayout';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import type { Tables } from '../../../types/database';
import { redirect } from 'next/navigation';
import RequestsInbox from '../components/RequestsInbox';

export const dynamic = 'force-dynamic';

const isSupervisor = (role: Tables['people']['Row']['role']) => role === 'SUPERVISOR' || role === 'ADMIN';

async function getContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'WORKER';
  const role =
    (user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isSupervisor(role)) {
    redirect('/asistencia');
  }
  return true;
}

export default async function SupervisorRequestsPage() {
  await getContext();

  return (
    <DashboardLayout
      title="Solicitudes del equipo"
      description="Aprueba o rechaza permisos y cambios de turno enviados por tus colaboradores."
      breadcrumb={[{ label: 'Supervisor', href: '/supervisor' }, { label: 'Solicitudes' }]}
      navItems={SUPERVISOR_NAV}
    >
      <RequestsInbox />
    </DashboardLayout>
  );
}
