import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../lib/db/postgres';
import { authorizeManager, uuidParamSchema } from '../_shared';

export const runtime = 'nodejs';

const businessSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { rows } = await runQuery<{
    id: string;
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    is_active: boolean;
  }>(
    `select id, name, legal_name, tax_id, is_active
     from public.hr_businesses
     order by name asc`
  );

  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = businessSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const data = parsed.data;
  await runQuery(
    `insert into public.hr_businesses(id, name, legal_name, tax_id, is_active)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set
       name = excluded.name,
       legal_name = excluded.legal_name,
       tax_id = excluded.tax_id,
       is_active = excluded.is_active`,
    [data.id, data.name.trim(), data.legal_name ?? null, data.tax_id ?? null, data.is_active ?? true]
  );

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 });
  }

  await runQuery('delete from public.hr_businesses where id = $1', [parsedId.data]);
  return NextResponse.json({ ok: true });
}

