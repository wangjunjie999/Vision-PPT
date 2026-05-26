export interface ModuleLightItem {
  id: string;
  selectedLight: string;
  lightMode: string;
  lightAngle: string;
  lightDistance: string;
  lightDistanceHorizontal: string;
  lightDistanceVertical: string;
  lightNote: string;
}

export type ModuleLightItemPatch = Partial<Omit<ModuleLightItem, 'id'>>;

export function createModuleLightItem(overrides: Partial<ModuleLightItem> = {}): ModuleLightItem {
  return {
    id: overrides.id || `light-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    selectedLight: overrides.selectedLight || '',
    lightMode: overrides.lightMode || '',
    lightAngle: overrides.lightAngle || '',
    lightDistance: overrides.lightDistance || '',
    lightDistanceHorizontal: overrides.lightDistanceHorizontal || '',
    lightDistanceVertical: overrides.lightDistanceVertical || '',
    lightNote: overrides.lightNote || '',
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function hasModuleLightContent(item: Partial<ModuleLightItem> | null | undefined): boolean {
  if (!item) return false;
  return Boolean(
    item.selectedLight ||
    item.lightMode ||
    item.lightAngle ||
    item.lightDistance ||
    item.lightDistanceHorizontal ||
    item.lightDistanceVertical ||
    item.lightNote,
  );
}

export function normalizeModuleLightItems(
  raw: unknown,
  legacy?: Partial<ModuleLightItem> | null,
): ModuleLightItem[] {
  const items = Array.isArray(raw)
    ? raw
        .map((entry, index) => {
          const record = asRecord(entry);
          if (!record) return null;
          return createModuleLightItem({
            id: asString(record.id) || `light-${index + 1}`,
            selectedLight: asString(record.selectedLight ?? record.selected_light),
            lightMode: asString(record.lightMode ?? record.light_mode),
            lightAngle: asString(record.lightAngle ?? record.light_angle),
            lightDistance: asString(record.lightDistance ?? record.light_distance),
            lightDistanceHorizontal: asString(record.lightDistanceHorizontal ?? record.light_distance_horizontal),
            lightDistanceVertical: asString(record.lightDistanceVertical ?? record.light_distance_vertical),
            lightNote: asString(record.lightNote ?? record.light_note),
          });
        })
        .filter((item): item is ModuleLightItem => Boolean(item) && hasModuleLightContent(item))
    : [];

  if (items.length > 0) return items;
  return hasModuleLightContent(legacy) ? [createModuleLightItem({ id: 'light-1', ...legacy })] : [];
}

function parsePlainNumber(value: string, allowSigned = false): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (!allowSigned && parsed < 0) return null;
  return parsed;
}

function formatPlainNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function getModuleLightGeometryPatch(
  current: Pick<ModuleLightItem, 'lightDistance' | 'lightDistanceHorizontal' | 'lightDistanceVertical'>,
  patch: Partial<Pick<ModuleLightItem, 'lightDistance' | 'lightDistanceHorizontal' | 'lightDistanceVertical'>>,
) {
  const nextDistance = patch.lightDistance ?? current.lightDistance ?? '';
  const nextHorizontal = patch.lightDistanceHorizontal ?? current.lightDistanceHorizontal ?? '';
  const nextVertical = patch.lightDistanceVertical ?? current.lightDistanceVertical ?? '';
  const distance = parsePlainNumber(nextDistance);
  const horizontal = parsePlainNumber(nextHorizontal, true);
  const vertical = parsePlainNumber(nextVertical);
  const nextPatch = { ...patch };

  const componentChanged = 'lightDistanceHorizontal' in patch || 'lightDistanceVertical' in patch;
  if (componentChanged) {
    if (horizontal !== null || vertical !== null) {
      const h = horizontal ?? 0;
      const v = vertical ?? 0;
      nextPatch.lightDistance = formatPlainNumber(Math.sqrt(h * h + v * v));
    }
    return nextPatch;
  }

  if ('lightDistance' in patch && distance !== null) {
    const h = horizontal ?? 0;
    if (distance >= Math.abs(h)) {
      nextPatch.lightDistanceVertical = formatPlainNumber(Math.sqrt(distance * distance - h * h));
    }
  }

  return nextPatch;
}

export function getFirstModuleLightItem(items: ModuleLightItem[]): ModuleLightItem | null {
  return items.find(hasModuleLightContent) || null;
}
