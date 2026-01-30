import { redirect } from 'next/navigation';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QuickActionCard from '../../components/ui/QuickActionCard';
import AlertStack from '../../components/ui/AlertStack';
import StatusBadge from '../../components/ui/StatusBadge';
import { getAdminOverview, type AdminOverviewData } from '../../lib/reports/overview';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import SystemAuditPanel from './components/SystemAuditPanel';
import AdminHero from './components/AdminHero';
import PayrollTimeline from './components/PayrollTimeline';
import type { Tables } from '../../types/database';
import { IconUserCheck, IconBuilding, IconCashBanknote, IconBellRinging, IconCake } from '@tabler/icons-react';
import { runQuery } from '../../lib/db/postgres';
import { resolveUserRole } from '../../lib/auth/role';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<Tables['people']['Row']['role'], string> = {
  WORKER: 'Colaborador',
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

export default async function AdminHomePage() {
  const { user } = await authorizeAdmin();
  const overview = await getAdminOverview();

  let displayName: string =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    '';

  if (!displayName.trim()) {
    try {
      const { rows } = await runQuery<{ name: string | null }>('select name from public.people where id = $1', [
        user.id as string,
      ]);
      displayName = rows[0]?.name?.trim() ?? '';
    } catch (error) {
      console.warn('[admin] display name fallback failed', error);
    }
  }

  if (!displayName.trim()) {
    displayName =
      user.email?.split('@')[0]?.replace(/\./g, ' ') ??
      user.email ??
      'Admin';
  }

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
  const payrollStatus = payroll?.status ?? 'DRAFT';

  const upcomingBirthdays = birthdaysRows[0]?.upcoming_birthdays ?? 0;

  const quickActions = [
    {
      title: 'Añadir colaborador',
      description: 'Crea usuarios y asigna rol, sitio y servicio.',
      href: '/admin/usuarios?create=1',
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
      title=""
      description=""
      breadcrumb={[]}
    >
      {/* 1. Hero Section (No Cards) */}
      <AdminHero
        userName={displayName}
        stats={[
          { label: 'Colaboradores', value: overview.totals.active_people, subtext: 'Activos en nómina' },
          { label: 'Sitios', value: overview.totals.total_sites, subtext: 'Operativos hoy' },
          { label: 'En Turno', value: todayAttendance.active_checkins, subtext: 'Tiempo real', trend: 'up', trendValue: `${todayAttendance.active_checkins} activos` },
          { label: 'Ausencias', value: absencesToday, subtext: 'Sin marcar hoy', trend: 'down', trendValue: 'Atención' },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 2. Payroll Flow (Visual) */}
        <PayrollTimeline status={payrollStatus} periodLabel={payrollLabel} />

        {/* 3. System Health (Compact) */}
        <SystemAuditPanel />
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="glass-panel p-8 rounded-[32px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white">Tendencias de asistencia</h3>
            <StatusBadge label="Semanal" variant="info" />
          </div>

          {/* Simplified list for now, ideally a chart */}
          <div className="space-y-4">
            {overview.marksByDay.slice(0, 5).map((mark) => (
              <div key={mark.day} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors cursor-default group">
                <div className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <span className="text-sm font-medium text-slate-300">
                    {new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric' }).format(new Date(mark.day))}
                  </span>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Entradas</p>
                    <p className="font-mono text-white">{mark.in_total}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Salidas</p>
                    <p className="font-mono text-white">{mark.out_total}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Quick Actions (Refined) */}
        <div className="flex flex-col gap-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title} {...action} />
          ))}
        </div>
      </div>

    </DashboardLayout>
  );
}
