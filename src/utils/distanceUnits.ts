export type DistanceUnit = 'mm' | 'cm' | 'm';

export const DISTANCE_UNITS: DistanceUnit[] = ['mm', 'cm', 'm'];

export const DISTANCE_UNIT_FACTORS: Record<DistanceUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

export interface DistanceRangeInput {
  start: number;
  end: number;
  value: number;
  separator: string;
}

const DISTANCE_UNIT_SUFFIX_RE = /\s*(?:mm|cm|m)\s*$/i;
const DISTANCE_NUMBER_RE = '[+-]?\\d+(?:\\.\\d+)?';
const DISTANCE_RANGE_RE = new RegExp(
  `^\\s*(${DISTANCE_NUMBER_RE})\\s*(~|～|至|to|–|—|-)\\s*(${DISTANCE_NUMBER_RE})\\s*$`,
  'i',
);

export function normalizeDistanceUnit(value: unknown): DistanceUnit {
  return value === 'cm' || value === 'm' ? value : 'mm';
}

export function stripDistanceUnitSuffix(value: string): string {
  return value.trim().replace(DISTANCE_UNIT_SUFFIX_RE, '').trim();
}

export function parseDistanceRangeInput(value: unknown, signed = false): DistanceRangeInput | null {
  if (typeof value !== 'string') return null;
  const trimmed = stripDistanceUnitSuffix(value);
  if (!trimmed) return null;
  const match = trimmed.match(DISTANCE_RANGE_RE);
  if (!match) return null;

  const start = Number.parseFloat(match[1]);
  const end = Number.parseFloat(match[3]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (!signed && (start <= 0 || end <= 0)) return null;

  const average = (start + end) / 2;
  if (!Number.isFinite(average) || (!signed && average <= 0)) return null;

  return {
    start,
    end,
    value: average,
    separator: match[2],
  };
}

export function parseDistanceInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const range = parseDistanceRangeInput(trimmed);
  if (range) return range.value;
  const parsed = Number.parseFloat(stripDistanceUnitSuffix(trimmed));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseSignedDistanceInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const range = parseDistanceRangeInput(trimmed, true);
  if (range) return range.value;
  const parsed = Number.parseFloat(stripDistanceUnitSuffix(trimmed));
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

export function formatDistanceDisplay(
  value: unknown,
  unit: DistanceUnit,
  fallbackMm?: number | null,
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return DISTANCE_UNIT_SUFFIX_RE.test(trimmed) ? trimmed : `${trimmed}${unit}`;
    }
  }

  if (typeof fallbackMm === 'number' && Number.isFinite(fallbackMm) && fallbackMm > 0) {
    return `${formatDistanceInput(fallbackMm, unit)}${unit}`;
  }

  return '待填写';
}

export function formatDistanceInputText(
  value: unknown,
  unit: DistanceUnit,
  fallbackMm?: number | null,
): string {
  if (typeof value === 'string') {
    const trimmed = stripDistanceUnitSuffix(value);
    if (trimmed) return trimmed;
  }

  if (typeof fallbackMm === 'number' && Number.isFinite(fallbackMm) && fallbackMm > 0) {
    return formatDistanceInput(fallbackMm, unit);
  }

  return '';
}

export function convertDistanceInputUnit(
  value: string,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit,
  signed = false,
): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return value;

  const range = parseDistanceRangeInput(trimmed, signed);
  if (range) {
    const fromFactor = DISTANCE_UNIT_FACTORS[fromUnit];
    return [
      formatDistanceInput(range.start * fromFactor, toUnit),
      formatDistanceInput(range.end * fromFactor, toUnit),
    ].join(range.separator);
  }

  const mm = signed ? signedToMillimeters(trimmed, fromUnit) : toMillimeters(trimmed, fromUnit);
  return mm === null ? value : formatDistanceInput(mm, toUnit);
}

export function formatDistanceLabel(valueMm: number | null | undefined, unit: DistanceUnit): string {
  if (valueMm === null || valueMm === undefined || !Number.isFinite(valueMm) || valueMm <= 0) {
    return '待填写';
  }
  return `${formatDistanceInput(valueMm, unit)}${unit}`;
}
