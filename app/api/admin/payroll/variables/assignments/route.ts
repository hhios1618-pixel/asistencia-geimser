import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../../lib/db/postgres';
import { authorizeManager } from '../../_shared';

export const runtime = 'nodejs';

const createSchema = z.object({
  id: z.string().uuid(),
  person_id: z.string().uuid(),
  period_id: z.string().uuid(),
  variable_type_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const periodId = request.nextUrl.searchParams.get('period_id');
  const parsedId = z.string().uuid().safeParse(periodId);
  if (!parsedId.success) return NextResponse.json({ error: 'INVALID_PERIOD_ID' }, { status: 400 });

  const { rows } = await runQuery<{
    id: string;
    person_id: string;
    person_name: string;
    variable_type_id: string;
    code: string;
    label: string;
    line_type: string;
    amount: number;
    notes: string | null;
  }>(
    `select
       pv.id,
       pv.person_id,
       p.name as person_name,
       pv.variable_type_id,
       vt.code,
       vt.label,
       vt.line_type,
       pv.amount,
       pv.notes
     from public.payroll_person_variables pv
     join public.people p on p.id = pv.person_id
     join public.payroll_variable_types vt on vt.id = pv.variable_type_id
     where pv.period_id = $1::uuid
     order by p.name asc, vt.code asc`,
    [parsedId.data]
  );

  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });

  const data = parsed.data;
  await runQuery(
    `insert into public.payroll_person_variables(id, person_id, period_id, variable_type_id, amount, notes)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (person_id, period_id, variable_type_id) do update set
       amount = excluded.amount,
       notes = excluded.notes`,
    [data.id, data.person_id, data.period_id, data.variable_type_id, data.amount, data.notes ?? null]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 });

  await runQuery('delete from public.payroll_person_variables where id = $1', [parsedId.data]);
  return NextResponse.json({ ok: true });
}

