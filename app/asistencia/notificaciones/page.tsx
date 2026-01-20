import DashboardLayout, { WORKER_NAV } from '../../../components/layout/DashboardLayout';
import AlertList from '../components/AlertList';

export default function WorkerNotificationsPage() {
  return (
    <DashboardLayout
      title="Notificaciones"
      description="Aprobaciones, alertas y cambios relevantes para tu jornada."
      breadcrumb={[{ label: 'Empleado' }, { label: 'Notificaciones' }]}
      navItems={WORKER_NAV}
    >
      <AlertList />
    </DashboardLayout>
  );
}

