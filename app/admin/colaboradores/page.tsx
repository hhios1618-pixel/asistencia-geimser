import DashboardLayout from '../../../components/layout/DashboardLayout';
import LogoutButton from '../../asistencia/components/LogoutButton';
import CollaboratorsSheetClient from './components/CollaboratorsSheetClient';

export const dynamic = 'force-dynamic';

export default function AdminCollaboratorsSheetPage() {
  return (
    <DashboardLayout
      title="Planilla de colaboradores"
      description="Repositorio base de información RR.HH. (importable desde planilla)."
      breadcrumb={[
        { label: 'Administración', href: '/admin' },
        { label: 'RR.HH.', href: '/admin/rrhh?panel=employees' },
        { label: 'Planilla' },
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
      <CollaboratorsSheetClient />
    </DashboardLayout>
  );
}

