import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeManager } from '../_shared';
import { runQuery } from '../../../../../lib/db/postgres';
import { ensureHrBlacklistTable } from '../../../../../lib/db/ensureTrainingAndBlacklistTables';
import { normalizeRutComparable } from '../../../../../lib/hr/rut';

// Blist es de alta sensibilidad: solo accesible para perfil ADMIN (no SUPERVISOR)
const authorizeAdmin = async () => {
  const result = await authorizeManager();
  if (!result.role || result.role !== 'ADMIN') return { role: null } as const;
  return result;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createBlacklistSchema = z.object({
  rut: z.string().min(3),
  full_name: z.string().trim().max(180).optional().nullable(),
  reason: z.string().trim().max(600).optional().nullable(),
  source: z.string().trim().max(180).optional().nullable(),
  notes: z.string().trim().max(1500).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const { role } = await authorizeAdmin();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await ensureHrBlacklistTable();

  const rut = (request.nextUrl.searchParams.get('rut') ?? '').trim();
  if (rut) {
    const normalized = normalizeRutComparable(rut);
    if (!normalized) {
      return NextResponse.json({ error: 'INVALID_RUT' }, { status: 400 });
    }

    const { rows } = await runQuery<{
      id: string;
      rut_display: string;
      full_name: string | null;
      reason: string | null;
      source: string | null;
      notes: string | null;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `select
         id::text as id,
         rut_display,
         full_name,
         reason,
         source,
         notes,
         active,
         created_at::text as created_at,
         updated_at::text as updated_at
       from public.hr_blacklist
       where rut_normalized = $1
         and active = true
       order by updated_at desc
       limit 1`,
      [normalized]
    );

    const found = rows[0] ?? null;
    return NextResponse.json({
      rut_normalized: normalized,
      found: Boolean(found),
      status: found ? 'NO_CONTRATAR' : 'EVALUABLE',
      item: found,
    });
  }

  const { rows } = await runQuery<{
    id: string;
    rut_display: string;
    rut_normalized: string;
    full_name: string | null;
    reason: string | null;
    source: string | null;
    notes: string | null;
    active: boolean;
    created_by_name: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `select
       id::text as id,
       rut_display,
       rut_normalized,
       full_name,
       reason,
       source,
       notes,
       active,
       created_by_name,
       created_at::text as created_at,
       updated_at::text as updated_at
     from public.hr_blacklist
     order by updated_at desc
     limit 2000`
  );

  return NextResponse.json({ items: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const { role } = await authorizeAdmin();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createBlacklistSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  await ensureHrBlacklistTable();

  const normalized = normalizeRutComparable(parsed.data.rut);
  if (!normalized) {
    return NextResponse.json({ error: 'INVALID_RUT' }, { status: 400 });
  }

  await runQuery(
    `insert into public.hr_blacklist (
       id,
       rut_normalized,
       rut_display,
       full_name,
       reason,
       source,
       notes,
       active,
       created_at,
       updated_at
     ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, now(), now())
     on conflict (rut_normalized) do update set
       rut_display = excluded.rut_display,
       full_name = excluded.full_name,
       reason = excluded.reason,
       source = excluded.source,
       notes = excluded.notes,
       active = excluded.active,
       updated_at = now()`,
    [
      crypto.randomUUID(),
      normalized,
      parsed.data.rut.trim(),
      parsed.data.full_name?.trim() || null,
      parsed.data.reason?.trim() || null,
      parsed.data.source?.trim() || null,
      parsed.data.notes?.trim() || null,
      parsed.data.active ?? true,
    ]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { role } = await authorizeAdmin();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await ensureHrBlacklistTable();

  const id = (request.nextUrl.searchParams.get('id') ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  }

  await runQuery(`delete from public.hr_blacklist where id = $1::uuid`, [id]);
  return NextResponse.json({ ok: true });
}
