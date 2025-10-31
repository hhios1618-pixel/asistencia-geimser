import DashboardLayout, { WORKER_NAV } from '../../../components/layout/DashboardLayout';
import { HistoryTable } from '../components/HistoryTable';

export default function WorkerHistoryPage() {
  return (
    <DashboardLayout
      title="Historial de marcajes"
      description="Consulta, filtra y exporta tus registros de asistencia."
      breadcrumb={[{ label: 'Asistencia', href: '/asistencia' }, { label: 'Historial' }]}
      navItems={WORKER_NAV}
    >
      <HistoryTable />
    </DashboardLayout>
  );
}
