import { redirect } from 'next/navigation';
import DashboardLayout, { WORKER_NAV } from '../../../components/layout/DashboardLayout';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import RequestsClient from '../components/RequestsClient';

export const dynamic = 'force-dynamic';

export default async function WorkerRequestsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardLayout
      title="Solicitudes"
      description="Gestiona permisos y cambios de turno con tus supervisores."
      breadcrumb={[{ label: 'Asistencia', href: '/asistencia' }, { label: 'Solicitudes' }]}
      navItems={WORKER_NAV}
    >
      <RequestsClient />
    </DashboardLayout>
  );
}
