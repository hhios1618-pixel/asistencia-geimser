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

  const headerCells = lines[0].split('\t').map((c) => c.trim());
  const expected = COLLABORATORS_SHEET_HEADERS;

  // Accept either exact template header or a data-only paste (without header).
  const hasHeader =
    headerCells.length >= expected.length &&
    expected.every((h, idx) => normalizeHeader(headerCells[idx]) === normalizeHeader(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: CollaboratorSheetRow[] = [];
  for (const line of dataLines) {
    const cells = line.split('\t');
    const rutFull = normalizeCell(cells[0]);
    if (rutFull && normalizeHeader(rutFull) === normalizeHeader(expected[0])) {
      // Header-like row slipped in; skip.
      continue;
    }
    if (!rutFull) continue;

    const row: CollaboratorSheetRow = {
      rut_full: rutFull,
      rut_base: normalizeCell(cells[1]),
      rut_dv: normalizeCell(cells[2]),
      ficha_numero: normalizeCell(cells[3]),
      nombre_completo: normalizeCell(cells[4]),
      empresa: normalizeCell(cells[5]),
      area: normalizeCell(cells[6]),
      estado: normalizeCell(cells[7]),
      sub_estado: normalizeCell(cells[8]),
      fecha_fin_licencia: parseDateToIso(normalizeCell(cells[9])),
      tipo_contrato: normalizeCell(cells[10]),
      jornada_laboral: parseIntOrNull(normalizeCell(cells[11])),
      cliente: normalizeCell(cells[12]),
      servicio: normalizeCell(cells[13]),
      campania: normalizeCell(cells[14]),
      cargo: normalizeCell(cells[15]),
      supervisor: normalizeCell(cells[16]),
      coordinador: normalizeCell(cells[17]),
      sub_gerente: normalizeCell(cells[18]),
      genero: normalizeCell(cells[19]),
      fecha_nacimiento: parseDateToIso(normalizeCell(cells[20])),
      estado_civil: normalizeCell(cells[21]),
      nacionalidad: normalizeCell(cells[22]),
      correo_personal: normalizeCell(cells[23]),
      telefono_celular: normalizeCell(cells[24]),
      telefono_fijo: normalizeCell(cells[25]),
      direccion: normalizeCell(cells[26]),
      comuna: normalizeCell(cells[27]),
      ciudad: normalizeCell(cells[28]),
      nivel_educacional: normalizeCell(cells[29]),
      especialidad: normalizeCell(cells[30]),
      contacto_emergencia: normalizeCell(cells[31]),
      parentesco_emergencia: normalizeCell(cells[32]),
      telefono_emergencia: normalizeCell(cells[33]),
      alergias: normalizeCell(cells[34]),
      fecha_alta: parseDateToIso(normalizeCell(cells[35])),
      fecha_baja: parseDateToIso(normalizeCell(cells[36])),
      antiguedad_dias: parseIntOrNull(normalizeCell(cells[37])),
      motivo_baja: normalizeCell(cells[38]),
      tipo_remuneracion: normalizeCell(cells[39]),
      centro_costo_id: normalizeCell(cells[40]),
      centro_costo_descripcion: normalizeCell(cells[41]),
      rol: normalizeCell(cells[42]),
      banco_transferencia: normalizeCell(cells[43]),
      tipo_cuenta_transferencia: normalizeCell(cells[44]),
      numero_cuenta: normalizeCell(cells[45]),
      cargas_familiares: parseIntOrNull(normalizeCell(cells[46])),
      salud: normalizeCell(cells[47]),
      afp: normalizeCell(cells[48]),
      fecha_contrato: parseDateToIso(normalizeCell(cells[49])),
      termino_contrato: parseDateToIso(normalizeCell(cells[50])),
      registro_contrato_dt: parseDateToIso(normalizeCell(cells[51])),
      renovacion1_contrato: parseDateToIso(normalizeCell(cells[52])),
      termino_renovacion1_contrato: parseDateToIso(normalizeCell(cells[53])),
      renovacion_indefinido: normalizeCell(cells[54]),
      sueldo_bruto: parseMoneyOrNull(normalizeCell(cells[55])),
      gratificacion: parsePercentOrNull(normalizeCell(cells[56])),
      movilizacion: parseMoneyOrNull(normalizeCell(cells[57])),
      colacion: parseMoneyOrNull(normalizeCell(cells[58])),
      anexo_confidencialidad: parseDateToIso(normalizeCell(cells[59])),
      anexo_horario: parseDateToIso(normalizeCell(cells[60])),
      anexo_cambio_renta: parseDateToIso(normalizeCell(cells[61])),
      pacto_hhee: parseDateToIso(normalizeCell(cells[62])),
      sindicato: normalizeCell(cells[63]),
      demanda: normalizeCell(cells[64]),
      notebook: normalizeCell(cells[65]),
      llaves_oficina_cerr_superior: normalizeCell(cells[66]),
      llaves_oficina_cerr_inferior: normalizeCell(cells[67]),
      correo_corporativo: normalizeCell(cells[68]),
      correo_gmail_corporativo: normalizeCell(cells[69]),
      correo_cliente: normalizeCell(cells[70]),
    };

    rows.push(row);
  }

  return rows;
};
