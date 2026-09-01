export type HardwareSearchType = 'cameras' | 'lenses' | 'lights' | 'controllers';

const commonFields = ['brand', 'model', 'tags'] as const;

const hardwareSearchFields: Record<HardwareSearchType, readonly string[]> = {
  cameras: [
    ...commonFields,
    'resolution',
    'frame_rate',
    'interface',
    'sensor_size',
    'shutter_type',
    'focal_length',
    'aperture',
    'pixel_size_um',
    'sensor_width_mm',
    'sensor_height_mm',
  ],
  lenses: [
    ...commonFields,
    'focal_length',
    'aperture',
    'mount',
    'max_sensor_size',
    'resolving_power',
  ],
  lights: [...commonFields, 'type', 'color', 'power'],
  controllers: [...commonFields, 'cpu', 'gpu', 'memory', 'storage', 'performance'],
};

function toSearchText(value: unknown): string {
  if (Array.isArray(value)) return value.map(toSearchText).join(' ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

export function matchesHardwareSearch(
  item: Record<string, unknown>,
  type: HardwareSearchType,
  query: string,
): boolean {
  const keywords = query.toLowerCase().split(/[\s,，]+/).filter(Boolean);
  if (keywords.length === 0) return true;

  const searchableText = hardwareSearchFields[type]
    .map(field => toSearchText(item[field]))
    .join(' ')
    .toLowerCase();

  return keywords.every(keyword => searchableText.includes(keyword));
}
