import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import type { User } from '@supabase/supabase-js';
import { createRouteSupabaseClient, getServiceSupabase } from '@/lib/supabase/server';
import { runQuery } from '@/lib/db/postgres';

export const runtime = 'nodejs';

const DEFAULT_PASSWORD = 'Geimser2026.';

type ParsedMember = {
  name: string;
  email: string;
  rut: string | null;
};

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return email || null;
}

function normalizeRut(value: unknown) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();

  if (!cleaned) {
    return null;
  }

  if (cleaned.length < 2) {
    return cleaned;
  }

  return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
}

function parseMembersFromWorkbook(buffer: Buffer): ParsedMember[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('nombre') && (normalized.includes('correo') || normalized.includes('email'));
  });

  if (headerIndex === -1) {
    return [];
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const nameIndex = headers.findIndex((header) => header === 'nombre');
  const emailIndex = headers.findIndex((header) => header === 'correo' || header === 'email');
  const rutIndex = headers.findIndex((header) => header === 'rut');

  return rows
    .slice(headerIndex + 1)
    .map((row) => ({
      name: String(row[nameIndex] ?? '').trim(),
      email: normalizeEmail(row[emailIndex]) ?? '',
      rut: rutIndex >= 0 ? normalizeRut(row[rutIndex]) : null,
    }))
    .filter((row) => row.name && row.email);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createRouteSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rows: [actor] } = await runQuery<{ role: string }>(
      'select role from people where id = $1::uuid and is_active = true limit 1',
      [user.id]
    );

    if (!actor || !['ADMIN', 'SUPERVISOR'].includes(actor.role)) {
      return NextResponse.json({ error: 'Sin permisos para importar usuarias' }, { status: 403 });
    }

    const { rows: [campaign] } = await runQuery<{ id: string; name: string }>(
      'select id::text, name from campaigns_local where id = $1::uuid limit 1',
      [campaignId]
    );

    if (!campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const formData = await request.formData();
    const upload = formData.get('file');
    const providedPassword = String(formData.get('password') ?? '').trim();
    const password = providedPassword || DEFAULT_PASSWORD;

    if (!(upload instanceof File)) {
      return NextResponse.json({ error: 'Debes adjuntar un Excel o CSV' }, { status: 400 });
    }

    const parsed = parseMembersFromWorkbook(Buffer.from(await upload.arrayBuffer()));
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No encontré filas válidas con Nombre/Correo/RUT' }, { status: 400 });
    }

    const uniqueMembers = Array.from(
      new Map(parsed.map((member) => [member.email, member])).values()
    );

    const serviceSupabase = getServiceSupabase();
    const listed = await serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUsers = (listed.data?.users ?? []) as User[];
    const authUserByEmail = new Map(
      authUsers
        .filter((item) => item.email)
        .map((item) => [String(item.email).toLowerCase(), item])
    );

    const results: Array<Record<string, unknown>> = [];

    for (const member of uniqueMembers) {
      try {
        const existingAuth = authUserByEmail.get(member.email);
        let authUserId = existingAuth?.id ?? null;

        const { rows: [existingPerson] } = await runQuery<{
          id: string;
          role: string;
          email: string | null;
        }>(
          'select id::text, role, email from people where lower(email) = $1 limit 1',
          [member.email]
        );

        if (existingPerson && ['ADMIN', 'SUPERVISOR', 'DT_VIEWER'].includes(existingPerson.role)) {
          results.push({
            email: member.email,
            name: member.name,
            status: 'skipped',
            reason: `El correo ya pertenece a un usuario ${existingPerson.role}.`,
          });
          continue;
        }

        if (existingAuth) {
          const { error: updateAuthError } = await serviceSupabase.auth.admin.updateUserById(existingAuth.id, {
            email: member.email,
            password,
            user_metadata: {
              full_name: member.name,
              rut: member.rut,
            },
            app_metadata: {
              role: 'WORKER',
            },
          });

          if (updateAuthError) {
            throw new Error(updateAuthError.message);
          }
        } else {
          const { data: createdUser, error: createAuthError } = await serviceSupabase.auth.admin.createUser({
            email: member.email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: member.name,
              rut: member.rut,
            },
            app_metadata: {
              role: 'WORKER',
            },
          });

          if (createAuthError || !createdUser.user) {
            throw new Error(createAuthError?.message ?? 'No fue posible crear el usuario');
          }

          authUserId = createdUser.user.id;
        }

        const personId = authUserId ?? existingPerson?.id;
        if (!personId) {
          throw new Error('No se pudo resolver el usuario de autenticación');
        }

        await runQuery(
          `
            insert into people (id, name, email, rut, role, campaign_id, is_active)
            values ($1::uuid, $2, $3, $4, 'WORKER', $5::uuid, true)
            on conflict (id) do update set
              name = excluded.name,
              email = excluded.email,
              rut = excluded.rut,
              role = 'WORKER',
              campaign_id = excluded.campaign_id,
              is_active = true
          `,
          [personId, member.name, member.email, member.rut, campaignId]
        );

        results.push({
          email: member.email,
          name: member.name,
          rut: member.rut,
          status: existingAuth || existingPerson ? 'updated' : 'created',
          folder_ready: true,
        });
      } catch (error) {
        results.push({
          email: member.email,
          name: member.name,
          status: 'error',
          reason: (error as Error).message,
        });
      }
    }

    const createdCount = results.filter((item) => item.status === 'created').length;
    const updatedCount = results.filter((item) => item.status === 'updated').length;
    const errorCount = results.filter((item) => item.status === 'error').length;
    const skippedCount = results.filter((item) => item.status === 'skipped').length;

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      credentials: {
        password,
      },
      summary: {
        total_rows: uniqueMembers.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      results,
    });
  } catch (error) {
    console.error('[API/campaigns/[id]/members/import] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
