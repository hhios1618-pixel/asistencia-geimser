import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteSupabaseClient } from '../../../../../../lib/supabase/server';
import type { Tables } from '../../../../../../types/database';
import { runQuery } from '../../../../../../lib/db/postgres';

export const runtime = 'nodejs';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { role: null } as const;
  }
  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role =
    (authData.user.app_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    (authData.user.user_metadata?.role as Tables['people']['Row']['role'] | undefined) ??
    defaultRole;
  if (!isManager(role)) {
    return { role: null } as const;
  }
  return { role } as const;
};

export async function GET(request: NextRequest) {
  const { role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const date = parsed.success && parsed.data.date ? parsed.data.date : new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await runQuery<{
      person_id: string;
      name: string;
      service: string | null;
      business_name: string | null;
      position_name: string | null;
      work_date: string;
      first_in_ts: string | null;
      last_out_ts: string | null;
      worked_minutes: number | null;
      in_total: number | null;
      out_total: number | null;
      sites_touched: number | null;
    }>(
      `select
         p.id as person_id,
         p.name,
         p.service,
         b.name as business_name,
         pos.name as position_name,
         $1::date as work_date,
         ad.first_in_ts,
         ad.last_out_ts,
         ad.worked_minutes,
         ad.in_total,
         ad.out_total,
         ad.sites_touched
       from public.people p
       left join public.attendance_daily ad
         on ad.person_id = p.id
        and ad.work_date = $1::date
       left join public.hr_businesses b on b.id = p.business_id
       left join public.hr_positions pos on pos.id = p.position_id
       where p.is_active = true
       order by (ad.first_in_ts is null) asc, ad.first_in_ts asc nulls last, p.name asc`,
      [date]
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('[admin_daily_report] query failed', error);
    return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 });
  }
}
