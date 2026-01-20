import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../lib/db/postgres';
import { authorizeManager } from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const runId = request.nextUrl.searchParams.get('run_id');
  const parsedId = z.string().uuid().safeParse(runId);
  if (!parsedId.success) return NextResponse.json({ error: 'INVALID_RUN_ID' }, { status: 400 });

  const { rows } = await runQuery<{
    id: string;
    person_id: string;
    person_name: string;
    business_name: string | null;
    position_name: string | null;
    days_worked: number;
    salary_base: number | null;
    gross: number | null;
    deductions: number | null;
    net: number | null;
  }>(
    `with ctx as (
       select r.id as run_id, pp.id as period_id, pp.start_date, pp.end_date
       from public.payroll_runs r
       join public.payroll_periods pp on pp.id = r.period_id
       where r.id = $1::uuid
     ),
     days as (
       select ad.person_id, count(*) as days_worked
       from public.attendance_daily ad, ctx
       where ad.work_date between ctx.start_date and ctx.end_date
         and ad.has_in = true
       group by ad.person_id
     )
     select
       ps.id,
       ps.person_id,
       p.name as person_name,
       b.name as business_name,
       pos.name as position_name,
       coalesce(d.days_worked, 0) as days_worked,
       ps.salary_base,
       ps.gross,
       ps.deductions,
       ps.net
     from public.payroll_payslips ps
     join public.people p on p.id = ps.person_id
     left join public.hr_businesses b on b.id = ps.business_id
     left join public.hr_positions pos on pos.id = ps.position_id
     left join days d on d.person_id = ps.person_id
     where ps.run_id = $1::uuid
     order by p.name asc`,
    [parsedId.data]
  );

  return NextResponse.json({ items: rows });
}

