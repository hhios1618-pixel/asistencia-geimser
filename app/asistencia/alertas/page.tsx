import DashboardLayout, { WORKER_NAV } from '../../../components/layout/DashboardLayout';
import AlertList from '../components/AlertList';

export default function WorkerAlertsPage() {
  return (
    <DashboardLayout
      title="Alertas personales"
      description="Visualiza solicitudes y notificaciones asociadas a tus marcajes."
      breadcrumb={[{ label: 'Asistencia', href: '/asistencia' }, { label: 'Alertas' }]}
      navItems={WORKER_NAV}
    >
      <AlertList />
    </DashboardLayout>
  );
}
