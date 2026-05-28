import { resolveHardwareImageUrl } from './hardwareImageUrls';

export interface HardwareJsonItem {
  id: string;
  brand?: string | null;
  model?: string | null;
  image_url?: string | null;
  front_view_url?: string | null;
  top_view_url?: string | null;
  model_3d_url?: string | null;
  [key: string]: string | number | boolean | null | string[] | undefined;
}

const HARDWARE_JSON_FIELDS = [
  'id',
  'brand',
  'model',
  'image_url',
  'front_view_url',
  'top_view_url',
  'model_3d_url',
  'resolution',
  'frame_rate',
  'interface',
  'sensor_size',
  'pixel_size_um',
  'sensor_width_mm',
  'sensor_height_mm',
  'shutter_type',
  'focal_length',
  'aperture',
  'mount',
  'max_sensor_size',
  'resolving_power',
  'type',
  'color',
  'power',
  'cpu',
  'gpu',
  'memory',
  'storage',
  'performance',
  'tags',
] as const;

function isJsonScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function normalizeImageUrl(value: unknown) {
  return typeof value === 'string' ? resolveHardwareImageUrl(value) : value;
}

export function sanitizeHardwareItem<T extends HardwareJsonItem = HardwareJsonItem>(item: unknown): T | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const source = item as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;

  const cleaned: HardwareJsonItem = { id };
  HARDWARE_JSON_FIELDS.forEach(field => {
    if (field === 'id') return;
    if (!(field in source)) return;

    const rawValue = field.endsWith('_url') ? normalizeImageUrl(source[field]) : source[field];
    if (rawValue === undefined) return;

    if (isJsonScalar(rawValue)) {
      (cleaned as Record<string, unknown>)[field] = rawValue;
      return;
    }

    if (Array.isArray(rawValue)) {
      const values = rawValue.filter((value): value is string => typeof value === 'string');
      if (values.length > 0) (cleaned as Record<string, unknown>)[field] = values;
    }
  });

  return cleaned as T;
}

export function sanitizeHardwareArray<T extends HardwareJsonItem = HardwareJsonItem>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => sanitizeHardwareItem<T>(item))
    .filter((item): item is T => Boolean(item));
}

export function sanitizeController<T extends HardwareJsonItem = HardwareJsonItem>(value: unknown): T | null {
  return sanitizeHardwareItem<T>(value);
}

export function mergeHardwareFromLibrary<T extends HardwareJsonItem = HardwareJsonItem>(
  item: unknown,
  libraryItems: unknown[],
): T | null {
  const base = sanitizeHardwareItem<T>(item);
  if (!base) return null;

  const latest = libraryItems.find(candidate => {
    return Boolean(
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      (candidate as Record<string, unknown>).id === base.id,
    );
  });

  return sanitizeHardwareItem<T>(latest ? { ...base, ...(latest as Record<string, unknown>) } : base);
}
