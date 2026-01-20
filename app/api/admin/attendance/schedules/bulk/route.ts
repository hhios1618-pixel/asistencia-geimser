import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createRouteSupabaseClient } from '../../../../../../lib/supabase/server';
import { runQuery } from '../../../../../../lib/db/postgres';
import type { Tables } from '../../../../../../types/database';
import { resolveUserRole } from '../../../../../../lib/auth/role';

export const runtime = 'nodejs';

const isManager = (role: Tables['people']['Row']['role']) => role === 'ADMIN' || role === 'SUPERVISOR';

const authorize = async () => {
  const supabase = await createRouteSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { userId: null as string | null, role: null as Tables['people']['Row']['role'] | null } as const;
  }

  const defaultRole = (process.env.NEXT_PUBLIC_DEFAULT_LOGIN_ROLE as Tables['people']['Row']['role']) ?? 'ADMIN';
  const role = await resolveUserRole(authData.user, defaultRole);

  if (!isManager(role)) {
    return { userId: authData.user.id as string, role: null } as const;
  }
  return { userId: authData.user.id as string, role } as const;
};

type RawCsvRow = Record<string, string>;

type NormalizedRow = {
  index: number;
  person_id?: string;
  person_ref?: string;
  email?: string;
  rut?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
  week_label?: string;
};

type BulkMode = 'replace' | 'append';

const jsonRowSchema = z
  .object({
    person_id: z.string().uuid().optional(),
    person_ref: z.string().optional(),
    email: z.string().email().optional(),
    rut: z.string().optional(),
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string(),
    end_time: z.string(),
    break_minutes: z.number().int().min(0).default(60),
    week_label: z.string().optional(),
  })
  .extend({ index: z.number().optional() });

const jsonPayloadSchema = z.object({
  mode: z.enum(['replace', 'append']).default('replace'),
  dryRun: z.boolean().default(false),
  source: z.string().optional(),
  label: z.string().optional(),
  week_label: z.string().optional(),
  rows: z.array(jsonRowSchema),
});

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((cell) => cell.trim());
}

function parseCsv(text: string): RawCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, '') // remove BOM
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]!).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const row: RawCsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() ?? '';
    });
    return row;
  });
}

const requiredColumns = ['day_of_week', 'start', 'end'];

const normalizeTime = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.slice(0, 5);
  return null;
};

function normalizeRows(rows: RawCsvRow[], defaultWeek?: string) {
  const normalized: NormalizedRow[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const lowerRow: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      lowerRow[key.toLowerCase()] = value;
    });

    const hasPerson =
      (lowerRow.person_id?.trim() ?? '').length > 0 ||
      (lowerRow.person_ref?.trim() ?? '').length > 0 ||
      (lowerRow.identificador_persona?.trim() ?? '').length > 0 ||
      (lowerRow.email?.trim() ?? '').length > 0 ||
      (lowerRow.rut?.trim() ?? '').length > 0;

    const missingRequired = requiredColumns.some((col) => !(lowerRow[col] ?? '').trim());
    if (!hasPerson || missingRequired) {
      errors.push({ index: idx + 2, error: 'Faltan datos obligatorios (persona, day_of_week, start, end).' });
      return;
    }

    const day = Number(lowerRow.day_of_week ?? lowerRow.dia ?? lowerRow.dia_semana);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      errors.push({ index: idx + 2, error: 'day_of_week debe estar entre 0 (domingo) y 6 (sábado).' });
      return;
    }

    const start = normalizeTime(lowerRow.start ?? lowerRow.inicio ?? '');
    const end = normalizeTime(lowerRow.end ?? lowerRow.termino ?? '');
    if (!start || !end) {
      errors.push({ index: idx + 2, error: 'Formato de hora inválido. Use HH:MM (24h).' });
      return;
    }

    const breakMinutes = Number(lowerRow.break_minutes ?? lowerRow.colacion ?? 60);
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
      errors.push({ index: idx + 2, error: 'break_minutes debe ser un número entero mayor o igual a 0.' });
      return;
    }

    normalized.push({
      index: idx + 2, // considering header is line 1
      person_id: lowerRow.person_id?.trim() || undefined,
      person_ref:
        lowerRow.person_ref?.trim() ||
        lowerRow.identificador_persona?.trim() ||
        lowerRow.identificador?.trim() ||
        undefined,
      email: lowerRow.email?.trim() || undefined,
      rut: lowerRow.rut?.trim() || undefined,
      day_of_week: day,
      start_time: start,
      end_time: end,
      break_minutes: breakMinutes,
      week_label: (lowerRow.semana ?? lowerRow.week_label ?? defaultWeek ?? '').trim() || undefined,
    });
  });

  return { normalized, errors };
}

async function resolvePeople(rows: NormalizedRow[]) {
  const ids = new Set<string>();
  const emails = new Set<string>();
  const ruts = new Set<string>();

  rows.forEach((row) => {
    if (row.person_id) ids.add(row.person_id);
    if (row.email) emails.add(row.email.toLowerCase());
    if (row.rut) ruts.add(row.rut.toLowerCase());
  });

  const { rows: people } = await runQuery<Pick<Tables['people']['Row'], 'id' | 'email' | 'rut' | 'name'>>(
    `select id, email, rut, name from public.people
     where (id = any($1::uuid[]))
        or (email is not null and lower(email) = any($2::text[]))
        or (rut is not null and lower(rut) = any($3::text[]))`,
    [Array.from(ids), Array.from(emails), Array.from(ruts)]
  );

  const map = new Map<string, Tables['people']['Row']>();
  people.forEach((person) => {
    map.set(person.id as string, person as Tables['people']['Row']);
    if (person.email) map.set(person.email.toLowerCase(), person as Tables['people']['Row']);
    if (person.rut) map.set(person.rut.toLowerCase(), person as Tables['people']['Row']);
  });

  return map;
}

async function insertBatch(
  rows: NormalizedRow[],
  personMap: Map<string, Tables['people']['Row']>,
  mode: BulkMode,
  userId: string | null,
  label?: string,
  source?: string
) {
  const errors: Array<{ index: number; error: string }> = [];
  const resolvedRows: Array<NormalizedRow & { person_id: string }> = [];

  rows.forEach((row) => {
    let person = null as Tables['people']['Row'] | null;
    if (row.person_id) {
      person = personMap.get(row.person_id) ?? null;
    } else if (row.email) {
      person = personMap.get(row.email.toLowerCase()) ?? null;
    } else if (row.rut) {
      person = personMap.get(row.rut.toLowerCase()) ?? null;
    }
    if (!person) {
      errors.push({ index: row.index, error: 'Persona no encontrada (email/rut/id).' });
      return;
    }
    resolvedRows.push({ ...row, person_id: person.id as string });
  });

  if (resolvedRows.length === 0) {
    return { imported: 0, errors };
  }

  const personIds = Array.from(new Set(resolvedRows.map((row) => row.person_id)));
  if (mode === 'replace') {
    await runQuery('delete from public.schedules where person_id = any($1::uuid[])', [personIds]);
  }

  const groupId = randomUUID();
  let imported = 0;

  for (const row of resolvedRows) {
    await runQuery(
      `insert into public.schedules (person_id, group_id, day_of_week, start_time, end_time, break_minutes)
       values ($1, $2, $3, $4, $5, $6)`,
      [row.person_id, groupId, row.day_of_week, row.start_time, row.end_time, row.break_minutes]
    );
    imported += 1;
  }

  await runQuery(
    `insert into public.schedule_batches (id, label, week_label, source, created_by, total_rows, imported_rows, dry_run)
     values ($1, $2, $3, $4, $5, $6, $7, false)`,
    [groupId, label ?? 'Carga masiva de turnos', rows[0]?.week_label ?? null, source ?? 'bulk', userId, rows.length, imported]
  );

  return { imported, groupId, errors };
}

async function handleJsonBody(body: unknown) {
  const parsed = jsonPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return { error: 'INVALID_BODY', details: parsed.error.format() } as const;
  }
  const { rows, mode, dryRun, label, source, week_label } = parsed.data;
  const normalized: NormalizedRow[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  rows.forEach((row, idx) => {
    const start = normalizeTime(row.start_time);
    const end = normalizeTime(row.end_time);
    if (!start || !end) {
      errors.push({ index: idx + 2, error: 'Formato de hora inválido en start_time/end_time (use HH:MM).' });
      return;
    }
    normalized.push({
      index: idx + 2,
      person_id: row.person_id,
      person_ref: row.person_ref,
      email: row.email,
      rut: row.rut,
      day_of_week: row.day_of_week,
      start_time: start,
      end_time: end,
      break_minutes: row.break_minutes ?? 60,
      week_label,
    });
  });

  if (errors.length > 0) {
    return { error: 'INVALID_ROWS', details: errors } as const;
  }
  return { normalized, mode, dryRun, label, source, week: week_label } as const;
}

export async function POST(request: NextRequest) {
  const { userId, role } = await authorize();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  let normalized: NormalizedRow[] = [];
  let mode: BulkMode = 'replace';
  let dryRun = false;
  let label: string | undefined;
  let source: string | undefined;
  let weekLabel: string | undefined;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const jsonBody = await request.json();
    const parsed = await handleJsonBody(jsonBody);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error, details: parsed.details }, { status: 400 });
    }
    normalized = parsed.normalized;
    mode = parsed.mode;
    dryRun = parsed.dryRun;
    label = parsed.label;
    source = parsed.source;
    weekLabel = parsed.week;
  } else {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
    }
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 });
    }
    const defaultsWeek = formData.get('week')?.toString();
    const { normalized: parsedRows, errors } = normalizeRows(rows, defaultsWeek);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'INVALID_ROWS', errors }, { status: 400 });
    }
    normalized = parsedRows;
    mode = (formData.get('mode')?.toString() as BulkMode) ?? 'replace';
    dryRun = formData.get('dryRun') === 'true';
    label = formData.get('label')?.toString();
    source = formData.get('source')?.toString();
    weekLabel = defaultsWeek;
  }

  if (normalized.length === 0) {
    return NextResponse.json({ error: 'NO_ROWS' }, { status: 400 });
  }

  const personMap = await resolvePeople(normalized);
  const preInsertErrors: Array<{ index: number; error: string }> = [];
  const resolvedRows: NormalizedRow[] = [];
  normalized.forEach((row) => {
    let person: Tables['people']['Row'] | undefined;
    if (row.person_id) person = personMap.get(row.person_id);
    else if (row.email) person = personMap.get(row.email.toLowerCase());
    else if (row.rut) person = personMap.get(row.rut.toLowerCase());

    if (!person) {
      preInsertErrors.push({ index: row.index, error: 'Persona no encontrada (email/rut/id).' });
    } else {
      resolvedRows.push({ ...row, person_id: person.id as string });
    }
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      total: normalized.length,
      resolvable: resolvedRows.length,
      errors: preInsertErrors,
    });
  }

  const { imported, groupId, errors } = await insertBatch(resolvedRows, personMap, mode, userId, label ?? weekLabel, source);

  const combinedErrors = [...preInsertErrors, ...errors];
  return NextResponse.json({
    total: normalized.length,
    imported,
    groupId,
    week: weekLabel ?? null,
    errors: combinedErrors,
  });
}
