import { redirect } from 'next/navigation';
import DashboardLayout from '../../components/layout/DashboardLayout';
import KpiCard from '../../components/ui/KpiCard';
import QuickActionCard from '../../components/ui/QuickActionCard';
import AlertStack from '../../components/ui/AlertStack';
import StatusBadge from '../../components/ui/StatusBadge';
import { getAdminOverview, type AdminOverviewData } from '../../lib/reports/overview';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import type { Tables } from '../../types/database';
import { IconUserCheck, IconMapPin, IconUsers, IconReportAnalytics } from '@tabler/icons-react';

const ROLE_LABELS: Record<Tables['people']['Row']['role'], string> = {
  WORKER: 'Trabajador',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  DT_VIEWER: 'DT Viewer',
};

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

async function authorizeAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role =
    (user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isManager(role)) {
    redirect('/asistencia');
  }

  return { user, role } as const;
}

function buildAlertItems(data: AdminOverviewData): Parameters<typeof AlertStack>[0]['items'] {
  return data.topSites.slice(0, 3).map((site, index) => ({
    id: `${site.site}-${index}`,
    title: site.site,
    detail: `${site.total} marcas en las últimas 24 h`,
    timestamp: new Date().toISOString(),
    severity: site.total > 50 ? 'warning' : 'info',
  }));
}

export default async function AdminHomePage() {
  const { user } = await authorizeAdmin();
  const overview = await getAdminOverview();

  const quickActions = [
    {
      title: 'Gestionar asistencia',
      description: 'Revisa marcas, ajustes y auditoría diaria.',
      href: '/admin/asistencia',
      icon: <IconUserCheck size={20} />,
      accent: 'indigo' as const,
    },
    {
      title: 'Administrar personas',
      description: 'Incorpora nuevos colaboradores y gestiona roles.',
      href: '/admin/asistencia?panel=people',
      icon: <IconUsers size={20} />,
      accent: 'emerald' as const,
    },
    {
      title: 'Sitios y geocercas',
      description: 'Configura ubicaciones, radios permitidos y responsables.',
      href: '/admin/asistencia?panel=sites',
      icon: <IconMapPin size={20} />,
      accent: 'amber' as const,
    },
    {
      title: 'Reportes ejecutivos',
      description: 'Genera reportes PDF/CSV para dirección y clientes.',
      href: '/admin/asistencia?panel=dt',
      icon: <IconReportAnalytics size={20} />,
      accent: 'blue' as const,
    },
  ];

  return (
    <DashboardLayout
      title="Panel corporativo"
      description={`Bienvenido, ${user.user_metadata?.full_name ?? user.email}. Control total de la operación de asistencia.`}
      breadcrumb={[{ label: 'Administración' }, { label: 'Resumen' }]}
      actions={
        <div className="flex gap-2">
          <a
            href="/asistencia"
            className="rounded-full border border-[rgba(255,255,255,0.12)] bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[rgba(255,255,255,0.2)] hover:bg-white/16"
          >
            Ir a mi jornada
          </a>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Colaboradores activos"
          value={overview.totals.active_people}
          hint="Totales corporativos"
          icon={<IconUsers size={22} />}
        />
        <KpiCard
          title="Sitios operativos"
          value={overview.totals.total_sites}
          hint="Todos los niveles"
          icon={<IconMapPin size={22} />}
        />
        <KpiCard
          title="Marcas 30 días"
          value={overview.totals.marks_last_30}
          hint="Entradas + salidas"
          icon={<IconUserCheck size={22} />}
        />
        <KpiCard
          title="Colaboradores inactivos"
          value={overview.totals.inactive_people}
          hint="Revisión requerida"
          icon={<IconReportAnalytics size={22} />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_-52px_rgba(37,99,235,0.45)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Actividad semanal</p>
              <h3 className="text-lg font-semibold text-slate-900">Tendencia de marcajes</h3>
            </div>
            <StatusBadge label="Últimos 7 días" variant="info" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {overview.marksByDay.map((mark) => (
              <div key={mark.day} className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric' }).format(new Date(mark.day))}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{mark.total} marcas</p>
                <div className="mt-2 text-xs text-slate-500">
                  IN: {mark.in_total} · OUT: {mark.out_total}
                </div>
              </div>
            ))}
          </div>
        </div>
        <AlertStack
          title="Alertas recientes"
          description="Eventos detectados en los últimos sitios marcados"
          items={buildAlertItems(overview)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <QuickActionCard key={action.title} {...action} />
        ))}
      </section>

      <section className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ingresos recientes</p>
        <h3 className="text-lg font-semibold text-slate-900">Últimos colaboradores incorporados</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.recentPeople.map((person, index) => (
            <div key={`${person.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/90 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600">
                {person.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? '')
                  .join('') || 'PG'}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{person.name}</p>
                <p className="text-xs text-slate-400">{ROLE_LABELS[person.role]}</p>
              </div>
              <StatusBadge label={new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(person.created_at))} variant="default" />
            </div>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
