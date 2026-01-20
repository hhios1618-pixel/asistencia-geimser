import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../lib/db/postgres';
import { authorizeManager } from '../_shared';

export const runtime = 'nodejs';

const updateSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  salary_monthly: z.number().nonnegative().nullable().optional(),
  employment_type: z.string().nullable().optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  termination_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export async function GET() {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { rows } = await runQuery<{
    id: string;
    name: string;
    email: string | null;
    service: string | null;
    is_active: boolean;
    business_id: string | null;
    business_name: string | null;
    position_id: string | null;
    position_name: string | null;
    salary_monthly: number | null;
    employment_type: string | null;
    birth_date: string | null;
    hire_date: string | null;
    termination_date: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  }>(
    `select
       p.id,
       p.name,
       p.email,
       p.service,
       p.is_active,
       p.business_id,
       b.name as business_name,
       p.position_id,
       pos.name as position_name,
       p.salary_monthly,
       p.employment_type,
       p.birth_date::text as birth_date,
       p.hire_date::text as hire_date,
       p.termination_date::text as termination_date,
       p.address_line1,
       p.address_line2,
       p.city,
       p.region,
       p.country
     from public.people p
     left join public.hr_businesses b on b.id = p.business_id
     left join public.hr_positions pos on pos.id = p.position_id
     order by p.name asc`
  );

  return NextResponse.json({ items: rows });
}

export async function PATCH(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const data = parsed.data;
  await runQuery(
    `update public.people set
       business_id = $2,
       position_id = $3,
       salary_monthly = $4,
       employment_type = $5,
       birth_date = $6,
       hire_date = $7,
       termination_date = $8,
       address_line1 = $9,
       address_line2 = $10,
       city = $11,
       region = $12,
       country = $13
     where id = $1`,
    [
      data.id,
      data.business_id ?? null,
      data.position_id ?? null,
      data.salary_monthly ?? null,
      data.employment_type ?? null,
      data.birth_date ?? null,
      data.hire_date ?? null,
      data.termination_date ?? null,
      data.address_line1 ?? null,
      data.address_line2 ?? null,
      data.city ?? null,
      data.region ?? null,
      data.country ?? null,
    ]
  );

  return NextResponse.json({ ok: true });
}

