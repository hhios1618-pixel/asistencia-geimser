import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/me/attendance — asistencia del trabajador autenticado
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month'); // formato: YYYY-MM
    const year = month ? month.split('-')[0] : new Date().getFullYear().toString();
    const monthNum = month ? month.split('-')[1] : String(new Date().getMonth() + 1).padStart(2, '0');

    const startDate = `${year}-${monthNum}-01`;
    const endDate = `${year}-${monthNum}-31`;

    // Registros de asistencia del mes
    const { rows: records } = await runQuery<{
      work_date: string;
      status: string;
      hours_worked: number | null;
      check_in_time: string | null;
      check_out_time: string | null;
    }>(`
      select
        work_date,
        status,
        hours_worked,
        check_in_time::text,
        check_out_time::text
      from crm_attendance_sync
      where person_id = $1
        and work_date >= $2::date
        and work_date <= $3::date
      order by work_date desc
    `, [user.id, startDate, endDate]);

    // Resumen
    const summary = {
      total_days: records.length,
      present_days: records.filter(r => r.status === 'PRESENT').length,
      absent_days: records.filter(r => r.status === 'ABSENT').length,
      late_days: records.filter(r => r.status === 'LATE').length,
      half_days: records.filter(r => r.status === 'HALF_DAY').length,
      sick_days: records.filter(r => r.status === 'SICK_LEAVE').length,
      hours_total: records.reduce((acc, r) => acc + (Number(r.hours_worked) || 0), 0),
    };

    return NextResponse.json({ records, summary, month: `${year}-${monthNum}` });
  } catch (error) {
    console.error('[API/me/attendance] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
