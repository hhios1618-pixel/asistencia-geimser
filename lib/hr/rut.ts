export const normalizeRut = (value: string | null | undefined) => {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9kK]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
};

export const formatRutWithDv = (rutBase: string | null | undefined, dv: string | null | undefined) => {
  const base = normalizeRut(rutBase);
  const dig = normalizeRut(dv);
  if (!base || !dig) return null;
  return `${base}-${dig}`;
};

export const normalizeRutComparable = (rutFull: string | null | undefined) => normalizeRut(rutFull);

