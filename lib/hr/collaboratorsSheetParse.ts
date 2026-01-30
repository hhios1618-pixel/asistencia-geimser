import type { CollaboratorSheetRow } from './collaboratorsSheetTypes';
import { COLLABORATORS_SHEET_HEADERS } from './collaboratorsSheetTemplate';

const normalizeCell = (value: string | undefined) => {
  const cleaned = (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

const normalizeHeader = (value: string | undefined) =>
  (value ?? '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const parseDateToIso = (raw: string | null): string | null => {
  if (!raw) return null;
  const value = raw.trim();

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parseTriplet = (aRaw: string, bRaw: string, yRaw: string) => {
    const a = Number.parseInt(aRaw, 10);
    const b = Number.parseInt(bRaw, 10);
    const year = Number.parseInt(yRaw, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(year)) return null;
    if (year < 1900 || year > 2200) return null;

    // Heuristic: default to M/D/YYYY, but switch to D/M/YYYY when obvious.
    const month = a > 12 && b <= 12 ? b : a;
    const day = a > 12 && b <= 12 ? a : b;

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // M/D/YYYY or D/M/YYYY from exports (Excel/Sheets)
  const slash = value.split('/');
  if (slash.length === 3) {
    const [a, b, y] = slash;
    const parsed = parseTriplet(a, b, y);
    if (parsed) return parsed;
  }

  // D-M-YYYY / M-D-YYYY (some locales)
  const dash = value.split('-');
  if (dash.length === 3 && dash[0]?.length <= 2 && dash[1]?.length <= 2 && dash[2]?.length === 4) {
    const [a, b, y] = dash;
    const parsed = parseTriplet(a, b, y);
    if (parsed) return parsed;
  }

  return null;
};

const parseIntOrNull = (raw: string | null): number | null => {
  if (!raw) return null;
  const digits = raw.replace(/[^\d-]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  // Postgres `integer` is 32-bit signed
  if (n > 2147483647 || n < -2147483648) return null;
  return n;
};

const parseMoneyOrNull = (raw: string | null): number | null => {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
};

const parsePercentOrNull = (raw: string | null): number | null => {
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const normalized = match[0].replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
};

export const getTemplateTsv = () => `${COLLABORATORS_SHEET_HEADERS.join('\t')}\n`;

export const parseCollaboratorsTsv = (tsv: string): CollaboratorSheetRow[] => {
  const normalized = (tsv ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const expected = COLLABORATORS_SHEET_HEADERS;
  const expectedNorm = expected.map((h) => normalizeHeader(h));
  const expectedNormSet = new Set(expectedNorm);

  // Files often include title rows or leading notes. Find the most likely header row in first N lines.
  const scanN = Math.min(12, lines.length);
  let headerIndex: number | null = null;
  let bestScore = 0;
  for (let i = 0; i < scanN; i += 1) {
    const cells = lines[i]!.split('\t').map((c) => c.trim());
    const norms = cells.map((c) => normalizeHeader(c));
    const score = norms.filter((n) => expectedNormSet.has(n)).length;
    const hasRut = norms.includes(normalizeHeader(expected[0]));
    const hasNombre = norms.includes(normalizeHeader('NombreCompleto'));
    if (hasRut && hasNombre && score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }

  // If we didn't find a strong header row, we still allow headerless imports.
  const hasHeader = headerIndex != null && bestScore >= 6;
  const headerCells = hasHeader ? lines[headerIndex!]!.split('\t').map((c) => c.trim()) : [];

  // Build a best-effort mapping expectedIndex -> actualIndex using header names (tolerates reordering / extra cols).
  const headerMap = new Map<number, number>();
  if (hasHeader) {
    const headerNorms = headerCells.map((c) => normalizeHeader(c));
    let cursor = 0;
    for (let expectedIdx = 0; expectedIdx < expectedNorm.length; expectedIdx += 1) {
      const want = expectedNorm[expectedIdx]!;
      let found = -1;
      for (let j = cursor; j < headerNorms.length; j += 1) {
        if (headerNorms[j] === want) {
          found = j;
          break;
        }
      }
      if (found >= 0) {
        headerMap.set(expectedIdx, found);
        cursor = found + 1;
      }
    }
  }

  const dataLines = hasHeader ? lines.slice(headerIndex! + 1) : lines;

  const rows: CollaboratorSheetRow[] = [];
  for (const line of dataLines) {
    const cells = line.split('\t');
    const getCell = (idx: number) => cells[headerMap.get(idx) ?? idx];
    const rutFull = normalizeCell(getCell(0));
    if (rutFull && normalizeHeader(rutFull) === normalizeHeader(expected[0])) {
      // Header-like row slipped in; skip.
      continue;
    }
    if (!rutFull) continue;

    const row: CollaboratorSheetRow = {
      rut_full: rutFull,
      rut_base: normalizeCell(getCell(1)),
      rut_dv: normalizeCell(getCell(2)),
      ficha_numero: normalizeCell(getCell(3)),
      nombre_completo: normalizeCell(getCell(4)),
      empresa: normalizeCell(getCell(5)),
      area: normalizeCell(getCell(6)),
      estado: normalizeCell(getCell(7)),
      sub_estado: normalizeCell(getCell(8)),
      fecha_fin_licencia: parseDateToIso(normalizeCell(getCell(9))),
      tipo_contrato: normalizeCell(getCell(10)),
      jornada_laboral: parseIntOrNull(normalizeCell(getCell(11))),
      cliente: normalizeCell(getCell(12)),
      servicio: normalizeCell(getCell(13)),
      campania: normalizeCell(getCell(14)),
      cargo: normalizeCell(getCell(15)),
      supervisor: normalizeCell(getCell(16)),
      coordinador: normalizeCell(getCell(17)),
      sub_gerente: normalizeCell(getCell(18)),
      genero: normalizeCell(getCell(19)),
      fecha_nacimiento: parseDateToIso(normalizeCell(getCell(20))),
      estado_civil: normalizeCell(getCell(21)),
      nacionalidad: normalizeCell(getCell(22)),
      correo_personal: normalizeCell(getCell(23)),
      telefono_celular: normalizeCell(getCell(24)),
      telefono_fijo: normalizeCell(getCell(25)),
      direccion: normalizeCell(getCell(26)),
      comuna: normalizeCell(getCell(27)),
      ciudad: normalizeCell(getCell(28)),
      nivel_educacional: normalizeCell(getCell(29)),
      especialidad: normalizeCell(getCell(30)),
      contacto_emergencia: normalizeCell(getCell(31)),
      parentesco_emergencia: normalizeCell(getCell(32)),
      telefono_emergencia: normalizeCell(getCell(33)),
      alergias: normalizeCell(getCell(34)),
      fecha_alta: parseDateToIso(normalizeCell(getCell(35))),
      fecha_baja: parseDateToIso(normalizeCell(getCell(36))),
      antiguedad_dias: parseIntOrNull(normalizeCell(getCell(37))),
      motivo_baja: normalizeCell(getCell(38)),
      tipo_remuneracion: normalizeCell(getCell(39)),
      centro_costo_id: normalizeCell(getCell(40)),
      centro_costo_descripcion: normalizeCell(getCell(41)),
      rol: normalizeCell(getCell(42)),
      banco_transferencia: normalizeCell(getCell(43)),
      tipo_cuenta_transferencia: normalizeCell(getCell(44)),
      numero_cuenta: normalizeCell(getCell(45)),
      cargas_familiares: parseIntOrNull(normalizeCell(getCell(46))),
      salud: normalizeCell(getCell(47)),
      afp: normalizeCell(getCell(48)),
      fecha_contrato: parseDateToIso(normalizeCell(getCell(49))),
      termino_contrato: parseDateToIso(normalizeCell(getCell(50))),
      registro_contrato_dt: parseDateToIso(normalizeCell(getCell(51))),
      renovacion1_contrato: parseDateToIso(normalizeCell(getCell(52))),
      termino_renovacion1_contrato: parseDateToIso(normalizeCell(getCell(53))),
      renovacion_indefinido: normalizeCell(getCell(54)),
      sueldo_bruto: parseMoneyOrNull(normalizeCell(getCell(55))),
      gratificacion: parsePercentOrNull(normalizeCell(getCell(56))),
      movilizacion: parseMoneyOrNull(normalizeCell(getCell(57))),
      colacion: parseMoneyOrNull(normalizeCell(getCell(58))),
      anexo_confidencialidad: parseDateToIso(normalizeCell(getCell(59))),
      anexo_horario: parseDateToIso(normalizeCell(getCell(60))),
      anexo_cambio_renta: parseDateToIso(normalizeCell(getCell(61))),
      pacto_hhee: parseDateToIso(normalizeCell(getCell(62))),
      sindicato: normalizeCell(getCell(63)),
      demanda: normalizeCell(getCell(64)),
      notebook: normalizeCell(getCell(65)),
      llaves_oficina_cerr_superior: normalizeCell(getCell(66)),
      llaves_oficina_cerr_inferior: normalizeCell(getCell(67)),
      correo_corporativo: normalizeCell(getCell(68)),
      correo_gmail_corporativo: normalizeCell(getCell(69)),
      correo_cliente: normalizeCell(getCell(70)),
    };

    rows.push(row);
  }

  return rows;
};
