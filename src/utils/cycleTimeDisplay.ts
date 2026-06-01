export interface WorkstationCycleTimeSource {
  cycle_time?: number | string | null;
  acceptance_criteria?: {
    cycle_time?: string | null;
  } | null;
}

const CYCLE_UNIT_RE = /(s\s*\/\s*pcs|s\s*\/\s*pc|秒\s*\/\s*件|秒|s\s*\/\s*次)$/i;

export function getWorkstationCycleTimeValue(workstation: WorkstationCycleTimeSource | null | undefined): string | number | null {
  const acceptanceCycle = workstation?.acceptance_criteria?.cycle_time;
  if (typeof acceptanceCycle === 'string' && acceptanceCycle.trim()) return acceptanceCycle.trim();
  return workstation?.cycle_time ?? null;
}

export function formatWorkstationCycleTimePlain(
  workstation: WorkstationCycleTimeSource | null | undefined,
  empty = '-',
): string {
  const value = getWorkstationCycleTimeValue(workstation);
  if (value === null || value === undefined || value === '') return empty;
  return String(value).trim();
}

export function formatWorkstationCycleTime(
  workstation: WorkstationCycleTimeSource | null | undefined,
  unit = ' s/pcs',
  empty = '-',
): string {
  const text = formatWorkstationCycleTimePlain(workstation, '');
  if (!text) return empty;
  return CYCLE_UNIT_RE.test(text) ? text : `${text}${unit}`;
}

export function parseWorkstationCycleTimeSeconds(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.replace(/，/g, '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
