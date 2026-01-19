import DashboardLayout, { SUPERVISOR_NAV } from '../../../components/layout/DashboardLayout';
import { getSupervisorTeam } from '../../../lib/reports/supervisor';
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

export default async function SupervisorTeamPage() {
  const supervisorId = await getContext();
  const team = await getSupervisorTeam(supervisorId);

  return (
    <DashboardLayout
      title="Equipo asignado"
      description="Personas asociadas a tus sitios y su distribución actual."
      breadcrumb={[{ label: 'Supervisor', href: '/supervisor' }, { label: 'Equipo' }]}
      navItems={SUPERVISOR_NAV}
    >
      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_80px_-58px_rgba(37,99,235,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Colaboradores</p>
            <h2 className="text-lg font-semibold text-slate-900">{team.length} personas activas</h2>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Correo</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Sitios asignados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.map((member) => (
                <tr key={member.person_id} className="transition hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-semibold text-slate-800">{member.name}</td>
                  <td className="px-4 py-3 text-slate-600">{member.email ?? 'Sin correo'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={member.role} variant="info" />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {member.sites.length > 0 ? member.sites.join(', ') : 'Sin asignaciones'}
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                    No hay colaboradores asignados a tus sitios todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
