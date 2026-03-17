import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

// GET /api/campaigns/[id]/team — equipo de una campaña
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createRouteSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [person] } = await runQuery<{ role: string }>(
      `select role from people where id = $1 and is_active = true`,
      [user.id]
    );
    if (!person || !['ADMIN', 'SUPERVISOR'].includes(person.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { rows: team } = await runQuery(`
      select
        p.id,
        p.rut,
        p.name,
        p.email,
        p.phone,
        p.role,
        p.is_active,
        p.hire_date,
        p.termination_date,
        p.employment_type,
        p.salary_monthly,
        pos.name as position_name,
        -- días trabajados este mes
        count(distinct cas.work_date) filter (
          where cas.work_date >= date_trunc('month', current_date)
            and cas.status = 'PRESENT'
        ) as days_present_this_month,
        -- último registro
        max(cas.work_date) as last_work_date,
        -- documentos
        count(distinct cd.id) filter (where cd.visible_to_worker = true) as worker_docs_count
      from people p
      left join hr_positions pos on pos.id = p.position_id
      left join crm_attendance_sync cas on cas.person_id = p.id
      left join campaign_documents cd on cd.person_id = p.id and cd.campaign_id = $1
      where p.campaign_id = $1
        and p.role = 'WORKER'
      group by p.id, pos.name
      order by p.name asc
    `, [campaignId]);

    return NextResponse.json({ team });
  } catch (error) {
    console.error('[API/campaigns/[id]/team] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
