import { redirect } from 'next/navigation';
import DashboardLayout, { WORKER_NAV } from '../../../components/layout/DashboardLayout';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { getEffectiveWeeklySchedules, toWeekStartISO } from '../../../lib/attendance/schedules';

export const dynamic = 'force-dynamic';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;

export default async function WorkerSchedulePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const weekStartISO = toWeekStartISO(new Date());
  const schedules = await getEffectiveWeeklySchedules(user.id as string, weekStartISO);

  return (
    <DashboardLayout
      title="Mi horario"
      description="Tu planificación semanal y descansos asociados."
      breadcrumb={[{ label: 'Colaborador' }, { label: 'Mi horario' }]}
      navItems={WORKER_NAV}
    >
      <section className="glass-panel rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_32px_90px_-60px_rgba(0,0,0,0.55)]">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Semana</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Turnos configurados</h2>
        <p className="mt-2 text-sm text-slate-500">Semana desde {weekStartISO}.</p>
        <p className="mt-2 text-sm text-slate-500">Si ves inconsistencias, solicita un cambio a tu supervisor.</p>

        <div className="mt-6 overflow-auto rounded-3xl border border-slate-100 bg-white/80">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Día</th>
                <th className="px-4 py-3 text-left">Inicio</th>
                <th className="px-4 py-3 text-left">Término</th>
                <th className="px-4 py-3 text-left">Pausa</th>
              </tr>
            </thead>
            <tbody>
              {(schedules ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-800">{DAY_LABELS[row.day_of_week] ?? row.day_of_week}</td>
                  <td className="px-4 py-3 text-slate-700">{row.start_time}</td>
                  <td className="px-4 py-3 text-slate-700">{row.end_time}</td>
                  <td className="px-4 py-3 text-slate-600">{row.break_minutes} min</td>
                </tr>
              ))}
              {(schedules ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-sm text-slate-400">
                    No hay turnos asignados todavía.
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
