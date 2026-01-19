import DashboardLayout, { SUPERVISOR_NAV } from '../../../components/layout/DashboardLayout';
import { getSupervisorAlerts } from '../../../lib/reports/supervisor';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import type { Tables } from '../../../types/database';
import { redirect } from 'next/navigation';
import StatusBadge from '../../../components/ui/StatusBadge';

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
  return user.id;
}

export default async function SupervisorAlertsPage() {
  const supervisorId = await getContext();
  const alerts = await getSupervisorAlerts(supervisorId);

  return (
    <DashboardLayout
      title="Alertas de operación"
      description="Revisa y gestiona las incidencias generadas por tu equipo."
      breadcrumb={[{ label: 'Supervisor', href: '/supervisor' }, { label: 'Alertas' }]}
      navItems={SUPERVISOR_NAV}
    >
      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_80px_-58px_rgba(37,99,235,0.5)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Incidencias</p>
            <h2 className="text-lg font-semibold text-slate-900">{alerts.length} alertas registradas</h2>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-3xl border border-slate-100 bg-white/95 p-5 text-sm text-slate-600 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{alert.kind}</p>
                  <p className="text-xs text-slate-400">{alert.site ?? 'Sitio no especificado'}</p>
                </div>
                <StatusBadge
                  label={alert.resolved ? 'Resuelta' : 'Pendiente'}
                  variant={alert.resolved ? 'success' : 'warning'}
                />
              </div>
              {alert.person && <p className="mt-2 text-xs text-slate-500">Responsable: {alert.person}</p>}
              {typeof alert.metadata?.description === 'string' && (
                <p className="mt-2 text-xs text-slate-500">{alert.metadata.description}</p>
              )}
              <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
                {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(alert.ts))}
              </p>
            </article>
          ))}
          {alerts.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
              Sin alertas pendientes para tus sitios.
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
