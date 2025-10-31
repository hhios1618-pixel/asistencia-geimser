import DashboardLayout, { SUPERVISOR_NAV } from '../../../components/layout/DashboardLayout';
import { getSupervisorSiteDetails } from '../../../lib/reports/supervisor';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import type { Tables } from '../../../types/database';
import { redirect } from 'next/navigation';
import KpiCard from '../../../components/ui/KpiCard';

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

export default async function SupervisorSitesPage() {
  const supervisorId = await getContext();
  const sites = await getSupervisorSiteDetails(supervisorId);

  const totalPeople = sites.reduce((sum, site) => sum + site.total_people, 0);
  const totalMarks = sites.reduce((sum, site) => sum + site.marks_today, 0);

  return (
    <DashboardLayout
      title="Sitios asignados"
      description="Administra tus locaciones, su dotación y actividad reciente."
      breadcrumb={[{ label: 'Supervisor', href: '/supervisor' }, { label: 'Sitios' }]}
      navItems={SUPERVISOR_NAV}
    >
      <section className="grid gap-4 md:grid-cols-2">
        <KpiCard title="Sitios bajo tu cargo" value={sites.length} icon={<span>🏢</span>} />
        <KpiCard title="Dotación total" value={totalPeople} icon={<span>👥</span>} />
        <KpiCard title="Marcas hoy" value={totalMarks} icon={<span>🕒</span>} />
      </section>

      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_80px_-58px_rgba(37,99,235,0.5)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sitios</p>
            <h2 className="text-lg font-semibold text-slate-900">Resumen por locación</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <article
              key={site.id}
              className="rounded-3xl border border-slate-100 bg-white/95 p-5 text-sm text-slate-600 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800">{site.name}</p>
                <span className="text-xs text-slate-400">ID {site.id.slice(0, 8)}…</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span>Dotación</span>
                  <span className="font-semibold text-slate-700">{site.total_people}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Marcas hoy</span>
                  <span className="font-semibold text-slate-700">{site.marks_today}</span>
                </div>
              </div>
            </article>
          ))}
          {sites.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
              Aún no tienes sitios asignados.
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}

