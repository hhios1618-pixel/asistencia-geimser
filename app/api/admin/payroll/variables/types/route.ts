import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../../lib/db/postgres';
import { authorizeManager } from '../../_shared';

export const runtime = 'nodejs';

const schema = z.object({
  id: z.string().uuid(),
  code: z.string().min(2),
  label: z.string().min(2),
  line_type: z.enum(['EARNING', 'DEDUCTION', 'TAX', 'OTHER']),
  is_active: z.boolean().optional().default(true),
});

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { rows } = await runQuery<{
    id: string;
    code: string;
    label: string;
    line_type: 'EARNING' | 'DEDUCTION' | 'TAX' | 'OTHER';
    is_active: boolean;
  }>(
    `select id, code, label, line_type, is_active
     from public.payroll_variable_types
     order by code asc`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });

  const data = parsed.data;
  await runQuery(
    `insert into public.payroll_variable_types(id, code, label, line_type, is_active)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set
       code = excluded.code,
       label = excluded.label,
       line_type = excluded.line_type,
       is_active = excluded.is_active`,
    [data.id, data.code.trim().toUpperCase(), data.label.trim(), data.line_type, data.is_active]
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

  await runQuery('delete from public.payroll_variable_types where id = $1', [parsedId.data]);
  return NextResponse.json({ ok: true });
}

