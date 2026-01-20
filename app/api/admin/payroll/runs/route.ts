import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../lib/db/postgres';
import { authorizeManager } from '../_shared';

export const runtime = 'nodejs';

const runSchema = z.object({
  id: z.string().uuid(),
  period_id: z.string().uuid(),
  business_id: z.string().uuid().nullable().optional(),
  status: z.enum(['DRAFT', 'CALCULATED', 'FINALIZED', 'PAID', 'CANCELLED']).optional().default('DRAFT'),
});

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { rows } = await runQuery<{
    id: string;
    period_id: string;
    period_label: string | null;
    start_date: string;
    end_date: string;
    business_id: string | null;
    business_name: string | null;
    status: string;
    created_at: string;
  }>(
    `select
       r.id,
       r.period_id,
       pp.label as period_label,
       pp.start_date::text as start_date,
       pp.end_date::text as end_date,
       r.business_id,
       b.name as business_name,
       r.status,
       r.created_at
     from public.payroll_runs r
     join public.payroll_periods pp on pp.id = r.period_id
     left join public.hr_businesses b on b.id = r.business_id
     order by r.created_at desc`
  );

  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = runSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });

  const data = parsed.data;
  await runQuery(
    `insert into public.payroll_runs(id, period_id, business_id, status)
     values ($1, $2, $3, $4)
     on conflict (id) do update set
       period_id = excluded.period_id,
       business_id = excluded.business_id,
       status = excluded.status`,
    [data.id, data.period_id, data.business_id ?? null, data.status]
  );
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 });

  await runQuery('delete from public.payroll_runs where id = $1', [parsedId.data]);
  return NextResponse.json({ ok: true });
}

