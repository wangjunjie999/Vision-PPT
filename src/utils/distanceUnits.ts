export type DistanceUnit = 'mm' | 'cm' | 'm';

export const DISTANCE_UNITS: DistanceUnit[] = ['mm', 'cm', 'm'];

export const DISTANCE_UNIT_FACTORS: Record<DistanceUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

export function normalizeDistanceUnit(value: unknown): DistanceUnit {
  return value === 'cm' || value === 'm' ? value : 'mm';
}

export function parseDistanceInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseSignedDistanceInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toMillimeters(value: unknown, unit: DistanceUnit): number | null {
  const parsed = parseDistanceInput(value);
  return parsed === null ? null : parsed * DISTANCE_UNIT_FACTORS[unit];
}

export function signedToMillimeters(value: unknown, unit: DistanceUnit): number | null {
  const parsed = parseSignedDistanceInput(value);
  return parsed === null ? null : parsed * DISTANCE_UNIT_FACTORS[unit];
}

export function fromMillimeters(value: number, unit: DistanceUnit): number {
  return value / DISTANCE_UNIT_FACTORS[unit];
}

export function formatDistanceInput(value: number, unit: DistanceUnit): string {
  const converted = fromMillimeters(value, unit);
  const precision = unit === 'm' ? 3 : unit === 'cm' ? 1 : 0;
  const rounded = Number(converted.toFixed(precision));
  return String(rounded);
}

export function formatDistanceLabel(valueMm: number | null | undefined, unit: DistanceUnit): string {
  if (valueMm === null || valueMm === undefined || !Number.isFinite(valueMm) || valueMm <= 0) {
    return '待填写';
  }
  return `${formatDistanceInput(valueMm, unit)}${unit}`;
}
