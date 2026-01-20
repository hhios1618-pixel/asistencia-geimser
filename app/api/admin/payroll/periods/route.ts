import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../lib/db/postgres';
import { authorizeManager } from '../_shared';

export const runtime = 'nodejs';

const periodSchema = z.object({
  id: z.string().uuid(),
  label: z.string().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['OPEN', 'CLOSED', 'PAID']).optional().default('OPEN'),
});

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { rows } = await runQuery<{
    id: string;
    label: string | null;
    start_date: string;
    end_date: string;
    status: 'OPEN' | 'CLOSED' | 'PAID';
    created_at: string;
  }>(
    `select id, label, start_date::text as start_date, end_date::text as end_date, status, created_at
     from public.payroll_periods
     order by start_date desc`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = periodSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });

  const data = parsed.data;
  await runQuery(
    `insert into public.payroll_periods(id, label, start_date, end_date, status)
     values ($1, $2, $3::date, $4::date, $5)
     on conflict (id) do update set
       label = excluded.label,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       status = excluded.status`,
    [data.id, data.label ?? null, data.start_date, data.end_date, data.status]
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

  await runQuery('delete from public.payroll_periods where id = $1', [parsedId.data]);
  return NextResponse.json({ ok: true });
}

