import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../../../lib/db/postgres';
import { authorizeManager } from '../../_shared';

export const runtime = 'nodejs';

const bodySchema = z.object({ run_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const { role } = await authorizeManager();
  if (!role) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });

  try {
    const { rows } = await runQuery<{ result: unknown }>(
      'select public.fn_payroll_calculate_run($1::uuid) as result',
      [parsed.data.run_id]
    );
    return NextResponse.json({ result: rows[0]?.result ?? null });
  } catch (error) {
    console.error('[payroll_calculate] failed', error);
    return NextResponse.json({ error: 'CALCULATION_FAILED' }, { status: 500 });
  }
}

