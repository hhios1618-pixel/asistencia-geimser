import DashboardLayout from '../../../components/layout/DashboardLayout';
import LogoutButton from '../../asistencia/components/LogoutButton';
import SitesAdmin from '../asistencia/components/SitesAdmin';

export const dynamic = 'force-dynamic';

export default function AdminSitesPage() {
  return (
    <DashboardLayout
      title="Sitios y ubicaciones"
      description="Configura ubicaciones, geocercas y radios permitidos."
      breadcrumb={[
        { label: 'Administración', href: '/admin' },
        { label: 'Sitios y ubicaciones' },
      ]}
      actions={
        <div className="flex gap-2">
          <a
            href="/admin"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.75)] transition hover:border-[rgba(0,229,255,0.35)] hover:bg-white/15 hover:text-white"
          >
            Volver al panel
          </a>
          <LogoutButton />
        </div>
      }
    >
      <SitesAdmin />
    </DashboardLayout>
  );
}

