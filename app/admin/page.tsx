import { redirect } from 'next/navigation';
import DashboardLayout from '../../components/layout/DashboardLayout';
import KpiCard from '../../components/ui/KpiCard';
import QuickActionCard from '../../components/ui/QuickActionCard';
import AlertStack from '../../components/ui/AlertStack';
import StatusBadge from '../../components/ui/StatusBadge';
import { getAdminOverview, type AdminOverviewData } from '../../lib/reports/overview';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import type { Tables } from '../../types/database';
import { IconUserCheck, IconMapPin, IconUsers, IconReportAnalytics, IconBuilding, IconCashBanknote, IconBellRinging, IconCake } from '@tabler/icons-react';
import { runQuery } from '../../lib/db/postgres';
import { resolveUserRole } from '../../lib/auth/role';

export const dynamic = 'force-dynamic';

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
  const role = await resolveUserRole(user, defaultRole);
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

const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  CALCULATED: 'Calculada',
  FINALIZED: 'Finalizada',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

export default async function AdminHomePage() {
  const { user } = await authorizeAdmin();
  const overview = await getAdminOverview();

  const [{ rows: attendanceTodayRows }, { rows: pendingRequestRows }, { rows: payrollRows }, { rows: birthdaysRows }] =
    await Promise.all([
      runQuery<{ active_checkins: number; in_today: number }>(
        `with last_event as (
           select person_id, max(event_ts) as last_ts
           from public.attendance_marks
           where event_ts::date = current_date
           group by person_id
         ),
         last_type as (
           select m.person_id, m.event_type
           from public.attendance_marks m
           join last_event le on le.person_id = m.person_id and le.last_ts = m.event_ts
         )
         select
           coalesce(count(*) filter (where lt.event_type = 'IN'), 0) as active_checkins,
           coalesce((
             select count(distinct person_id)
             from public.attendance_marks
             where event_ts::date = current_date and event_type = 'IN'
           ), 0) as in_today
         from last_type lt`
      ),
      runQuery<{ pending_requests: number }>(
        `select count(*) as pending_requests
         from public.attendance_requests
         where status = 'PENDING'`
      ),
      runQuery<{ status: string; created_at: string; label: string | null; start_date: string; end_date: string }>(
        `select r.status, r.created_at, p.label, p.start_date::text as start_date, p.end_date::text as end_date
         from public.payroll_runs r
         join public.payroll_periods p on p.id = r.period_id
         order by r.created_at desc
         limit 1`
      ),
      runQuery<{ upcoming_birthdays: number }>(
        `with dates as (
           select
             case
               when make_date(extract(year from current_date)::int, extract(month from birth_date)::int, extract(day from birth_date)::int) < current_date
                 then make_date(extract(year from current_date)::int + 1, extract(month from birth_date)::int, extract(day from birth_date)::int)
               else make_date(extract(year from current_date)::int, extract(month from birth_date)::int, extract(day from birth_date)::int)
             end as next_bday
           from public.people
           where birth_date is not null and is_active = true
         )
         select count(*) as upcoming_birthdays
         from dates
         where next_bday <= (current_date + interval '30 days')`
      ),
    ]);

  const todayAttendance = attendanceTodayRows[0] ?? { active_checkins: 0, in_today: 0 };
  const pendingRequests = pendingRequestRows[0]?.pending_requests ?? 0;
  const absencesToday = Math.max(overview.totals.active_people - todayAttendance.in_today, 0);

  const payroll = payrollRows[0] ?? null;
  const payrollLabel = payroll?.label ?? (payroll ? `${payroll.start_date} → ${payroll.end_date}` : '—');
  const payrollStatus = payroll?.status ? (PAYROLL_STATUS_LABELS[payroll.status] ?? payroll.status) : 'Sin procesos';

  const upcomingBirthdays = birthdaysRows[0]?.upcoming_birthdays ?? 0;

  const quickActions = [
    {
      title: 'Añadir empleado',
      description: 'Incorpora y edita ficha laboral.',
      href: '/admin/rrhh?panel=employees',
      icon: <IconUserCheck size={20} />,
      accent: 'cyan' as const,
    },
    {
      title: 'Aprobar ausencias',
      description: 'Revisa solicitudes del equipo.',
      href: '/supervisor/solicitudes',
      icon: <IconBuilding size={20} />,
      accent: 'fuchsia' as const,
    },
    {
      title: 'Ejecutar nómina',
      description: 'Calcula y valida procesos del período.',
      href: '/admin/payroll?panel=runs',
      icon: <IconCashBanknote size={20} />,
      accent: 'cyan' as const,
    },
    {
      title: 'Revisar alertas',
      description: 'Monitorea incidencias y anomalías.',
      href: '/admin/alertas',
      icon: <IconBellRinging size={20} />,
      accent: 'neutral' as const,
    },
  ];

  return (
    <DashboardLayout
      title="Panel corporativo"
      description={`Bienvenido, ${user.user_metadata?.full_name ?? user.email}. Visión unificada de asistencia, RR.HH. y nómina.`}
      breadcrumb={[{ label: 'Administración' }, { label: 'Resumen' }]}
      actions={
        <div className="flex gap-2">
          <a
            href="/asistencia"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_55px_-40px_rgba(0,0,0,0.75)] transition hover:border-[rgba(0,229,255,0.35)] hover:bg-white/15 hover:text-white"
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
        <KpiCard title="Fichajes activos" value={todayAttendance.active_checkins} hint="Hoy" icon={<IconUserCheck size={22} />} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Ausencias del día" value={absencesToday} hint="Sin IN registrado" icon={<IconUsers size={22} />} />
        <KpiCard title="Solicitudes pendientes" value={pendingRequests} hint="Aprobación requerida" icon={<IconReportAnalytics size={22} />} />
        <KpiCard title="Estado de nómina" value={payrollStatus} hint={payrollLabel} icon={<IconCashBanknote size={22} />} />
        <KpiCard title="Cumpleaños (30 días)" value={upcomingBirthdays} hint="Próximos" icon={<IconCake size={22} />} />
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
