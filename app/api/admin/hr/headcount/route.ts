import { NextResponse } from 'next/server';
import { runQuery } from '../../../../../lib/db/postgres';
import { authorizeManager } from '../_shared';

export const runtime = 'nodejs';

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { rows } = await runQuery<{
    business_id: string | null;
    business_name: string | null;
    position_id: string | null;
    position_name: string | null;
    headcount_active: number;
    headcount_total: number;
    payroll_monthly_active: number;
  }>(
    `select
       business_id,
       business_name,
       position_id,
       position_name,
       headcount_active,
       headcount_total,
       payroll_monthly_active
     from public.hr_headcount
     order by business_name nulls last, position_name nulls last`
  );

  return NextResponse.json({ items: rows });
}

