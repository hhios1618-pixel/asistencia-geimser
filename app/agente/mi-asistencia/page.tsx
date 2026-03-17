import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { NavItem } from '@/components/layout/DashboardLayout';
import { runQuery } from '@/lib/db/postgres';
import MiAsistenciaClient from './MiAsistenciaClient';
import { IconCalendar, IconFolder, IconFileText, IconCircleCheck } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';

const AGENTE_NAV: NavItem[] = [
  { label: 'Resumen',           href: '/agente',                             icon: IconCircleCheck, match: p => p === '/agente' },
  { label: 'Mis documentos',    href: '/agente/mis-documentos',              icon: IconFolder },
  { label: 'Mi asistencia',     href: '/agente/mi-asistencia',               icon: IconCalendar },
  { label: 'Mis liquidaciones', href: '/agente/mis-documentos?tipo=PAYSLIP', icon: IconFileText },
];

export default async function MiAsistenciaPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get last 3 months of attendance
  const { rows: records } = await runQuery<{
    work_date: string;
    status: string;
    hours_worked: number | null;
    check_in_time: string | null;
    check_out_time: string | null;
  }>(`
    select
      work_date::text,
      status,
      hours_worked,
      check_in_time::text,
      check_out_time::text
    from crm_attendance_sync
    where person_id = $1
      and work_date >= current_date - interval '3 months'
    order by work_date desc
  `, [user.id]).catch(() => ({ rows: [] }));

  return (
    <DashboardLayout
      title="Mi asistencia"
      description="Historial de asistencia sincronizado desde el CRM."
      breadcrumb={[{ label: 'Mi espacio', href: '/agente' }, { label: 'Asistencia' }]}
      navItems={AGENTE_NAV}
    >
      <MiAsistenciaClient records={records} />
    </DashboardLayout>
  );
}
