import DashboardLayout, { SUPERVISOR_NAV } from '../../components/layout/DashboardLayout';
import KpiCard from '../../components/ui/KpiCard';
import QuickActionCard from '../../components/ui/QuickActionCard';
import AlertStack from '../../components/ui/AlertStack';
import StatusBadge from '../../components/ui/StatusBadge';
import { getSupervisorOverview } from '../../lib/reports/supervisor';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import type { Tables } from '../../types/database';
import { redirect } from 'next/navigation';
import { IconMapPin, IconUsers, IconAlertTriangle, IconUserCheck } from '@tabler/icons-react';

const isSupervisor = (role: Tables['people']['Row']['role']) => role === 'SUPERVISOR' || role === 'ADMIN';

const getUserContext = async () => {
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

  return { user, role } as const;
};

const buildAlertItems = (overview: Awaited<ReturnType<typeof getSupervisorOverview>>) =>
  overview.latestMarks.slice(0, 4).map((mark, index) => ({
    id: `${mark.person}-${mark.event_ts}-${index}`,
    title: `${mark.person} ${mark.event_type === 'IN' ? 'ingresó' : 'salió'}`,
    detail: mark.site ?? 'Sitio no registrado',
    timestamp: mark.event_ts,
    severity: mark.event_type === 'IN' ? ('info' as const) : ('warning' as const),
  }));

export default async function SupervisorDashboard() {
  const { user } = await getUserContext();
  const overview = await getSupervisorOverview(user.id);

  const quickActions = [
    {
      title: 'Revisar alertas',
      description: 'Gestiona incidentes y confirma su resolución.',
      href: '/supervisor/alertas',
      icon: <IconAlertTriangle size={20} />,
      accent: 'amber' as const,
    },
    {
      title: 'Control de asistencia',
      description: 'Verifica las marcas recientes de tu equipo.',
      href: '/supervisor',
      icon: <IconUserCheck size={20} />,
      accent: 'indigo' as const,
    },
    {
      title: 'Sitios asignados',
      description: 'Administra geocercas y responsables locales.',
      href: '/supervisor/sitios',
      icon: <IconMapPin size={20} />,
      accent: 'emerald' as const,
    },
  ];

  return (
    <DashboardLayout
      title="Panel de supervisor"
      description="Controla el estado diario de tu equipo y resuelve incidencias en tiempo real."
      breadcrumb={[{ label: 'Supervisor' }, { label: 'Resumen' }]}
      navItems={SUPERVISOR_NAV}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Colaboradores activos" value={overview.activePeople} icon={<IconUsers size={22} />} />
        <KpiCard title="Sitios bajo tu cargo" value={overview.sites.length} icon={<IconMapPin size={22} />} />
        <KpiCard title="Alertas pendientes" value={overview.pendingAlerts} icon={<IconAlertTriangle size={22} />} />
        <KpiCard title="Marcas de hoy" value={overview.marksToday} icon={<IconUserCheck size={22} />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_70px_-52px_rgba(37,99,235,0.45)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sitios</p>
          <h3 className="text-lg font-semibold text-slate-900">Despliegue operativo</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.sites.map((site) => (
              <div key={site.id} className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">{site.name}</p>
                <p className="text-xs text-slate-400">ID {site.id.slice(0, 8)}…</p>
              </div>
            ))}
            {overview.sites.length === 0 && <p className="text-sm text-slate-400">No tienes sitios asignados por ahora.</p>}
          </div>
        </div>
        <AlertStack
          title="Actividad reciente"
          description="Últimas marcas registradas"
          items={buildAlertItems(overview)}
          emptyMessage="Sin marcas aún en tus sitios."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => (
          <QuickActionCard key={action.title} {...action} />
        ))}
      </section>

      <section className="glass-panel rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Marcas recientes</p>
        <h3 className="text-lg font-semibold text-slate-900">Detalle por colaborador</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.latestMarks.map((mark, index) => (
            <div key={`${mark.person}-${mark.event_ts}-${index}`} className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">{mark.person}</p>
                <StatusBadge label={mark.event_type === 'IN' ? 'Entrada' : 'Salida'} variant={mark.event_type === 'IN' ? 'success' : 'warning'} />
              </div>
              <p className="text-xs text-slate-400">{mark.site ?? 'Sitio desconocido'}</p>
              <p className="mt-2 text-xs text-slate-500">
                {new Intl.DateTimeFormat('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                }).format(new Date(mark.event_ts))}
              </p>
            </div>
          ))}
          {overview.latestMarks.length === 0 && <p className="text-sm text-slate-400">Todavía no se registran marcas en tus sitios.</p>}
        </div>
      </section>
    </DashboardLayout>
  );
}
