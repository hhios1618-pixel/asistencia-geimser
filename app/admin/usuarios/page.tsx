import DashboardLayout from '../../../components/layout/DashboardLayout';
import LogoutButton from '../../asistencia/components/LogoutButton';
import { PeopleAdmin } from '../asistencia/components/PeopleAdmin';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  return (
    <DashboardLayout
      title="Usuarios"
      description="Crea y administra usuarios, roles y asignaciones."
      breadcrumb={[
        { label: 'Administración', href: '/admin' },
        { label: 'Usuarios' },
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
      <PeopleAdmin />
    </DashboardLayout>
  );
}

