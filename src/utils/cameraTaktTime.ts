const CAMERA_TAKT_UNIT_RE = /\s*(?:s\s*\/\s*(?:次|shot|shots|pcs|pc)|秒\s*\/\s*次|秒|s)\s*$/i;

export function stripCameraTaktTimeUnit(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(CAMERA_TAKT_UNIT_RE, '').trim();
}

export function formatCameraTaktTime(value: unknown, fallback = '待定'): string {
  const stripped = stripCameraTaktTimeUnit(value);
  if (!stripped) return fallback;

  const normalized = stripped
    .replace(/\s*(~|～|至|–|—|-)\s*/g, '~')
    .replace(/\s+/g, ' ')
    .trim();

  return `${normalized}S/次`;
}
