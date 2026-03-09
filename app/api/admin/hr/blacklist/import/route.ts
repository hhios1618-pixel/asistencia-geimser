import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { authorizeManager } from '../../_shared';
import { ensureHrBlacklistTable } from '../../../../../../lib/db/ensureTrainingAndBlacklistTables';
import { normalizeRutComparable } from '../../../../../../lib/hr/rut';
import { withTransaction } from '../../../../../../lib/db/postgres';

// Blist es de alta sensibilidad: solo accesible para perfil ADMIN
const authorizeAdmin = async () => {
  const result = await authorizeManager();
  if (!result.role || result.role !== 'ADMIN') return { role: null } as const;
  return result;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ParsedBlacklistRow = {
  rut: string;
  fullName: string | null;
  reason: string | null;
  source: string | null;
  notes: string | null;
};

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeCell = (value: unknown) => {
  const parsed = String(value ?? '').replace(/\u00a0/g, ' ').trim();
  return parsed.length > 0 ? parsed : null;
};

const parseCsvLike = (text: string): string[][] => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const delimiter = normalized.includes('\t') ? '\t' : normalized.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i] ?? '';
    const next = normalized[i + 1] ?? '';

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const parseInputFile = async (file: File): Promise<string[][]> => {
  const lower = (file.name ?? '').toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = wb.SheetNames[0];
    const sheet = firstSheet ? wb.Sheets[firstSheet] : null;
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as Array<Array<unknown>>;

    return rows
      .map((row) => row.map((cell) => String(cell ?? '')))
      .filter((row) => row.some((cell) => cell.trim().length > 0));
  }

  const text = await file.text();
  return parseCsvLike(text).filter((row) => row.some((cell) => String(cell ?? '').trim().length > 0));
};

const parseRows = (rows: string[][]): ParsedBlacklistRow[] => {
  if (rows.length === 0) return [];

  const header = rows[0] ?? [];
  const normalizedHeader = header.map((value) => normalizeHeader(value));

  const findIndex = (candidates: string[]) => {
    const set = new Set(candidates);
    return normalizedHeader.findIndex((item) => set.has(item));
  };

  const detectedRutIndex = findIndex(['rut', 'rutrut', 'documento', 'cedula', 'identificacion']);
  const rutIndex = detectedRutIndex >= 0 ? detectedRutIndex : 0;
  const nameIndex = findIndex(['nombre', 'nombrecompleto', 'fullname', 'full_name']);
  const reasonIndex = findIndex(['motivo', 'razon', 'reason', 'causa', 'observacion', 'observaciones', 'glosa']);
  const sourceIndex = findIndex(['fuente', 'origen', 'source', 'empresa', 'company', 'entidad']);
  const notesIndex = findIndex(['nota', 'notas', 'comentario', 'comentarios', 'detalle']);

  const hasHeaderSignals = normalizedHeader.some((value) =>
    ['rut', 'nombre', 'motivo', 'observacion', 'reason', 'source', 'notas'].includes(value)
  );

  const dataRows = hasHeaderSignals ? rows.slice(1) : rows;

  return dataRows
    .map((row) => ({
      rut: normalizeCell(row[rutIndex]) ?? '',
      fullName: nameIndex >= 0 ? normalizeCell(row[nameIndex]) : normalizeCell(row[1]),
      reason: reasonIndex >= 0 ? normalizeCell(row[reasonIndex]) : normalizeCell(row[2]),
      source: sourceIndex >= 0 ? normalizeCell(row[sourceIndex]) : null,
      notes: notesIndex >= 0 ? normalizeCell(row[notesIndex]) : normalizeCell(row[3]),
    }))
    .filter((row) => row.rut.length > 0);
};

export async function POST(request: NextRequest) {
  const { role } = await authorizeAdmin();
  if (!role) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const replaceAll = String(form.get('replace_all') ?? 'false') === 'true';

  await ensureHrBlacklistTable();

  const parsed = parseRows(await parseInputFile(file));
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'NO_ROWS' }, { status: 400 });
  }

  const batchId = crypto.randomUUID();
  let imported = 0;
  let skipped = 0;

  await withTransaction(async (client) => {
    if (replaceAll) {
      await client.query('truncate table public.hr_blacklist');
    }

    for (const row of parsed) {
      const normalizedRut = normalizeRutComparable(row.rut);
      if (!normalizedRut) {
        skipped += 1;
        continue;
      }

      await client.query(
        `insert into public.hr_blacklist (
           id,
           rut_normalized,
           rut_display,
           full_name,
           reason,
           source,
           notes,
           active,
           import_batch_id,
           created_at,
           updated_at
         ) values ($1::uuid, $2, $3, $4, $5, $6, $7, true, $8::uuid, now(), now())
         on conflict (rut_normalized) do update set
           rut_display = excluded.rut_display,
           full_name = excluded.full_name,
           reason = excluded.reason,
           source = excluded.source,
           notes = excluded.notes,
           active = true,
           import_batch_id = excluded.import_batch_id,
           updated_at = now()`,
        [
          crypto.randomUUID(),
          normalizedRut,
          row.rut,
          row.fullName,
          row.reason,
          row.source,
          row.notes,
          batchId,
        ]
      );

      imported += 1;
    }
  });

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    batch_id: batchId,
  });
}
