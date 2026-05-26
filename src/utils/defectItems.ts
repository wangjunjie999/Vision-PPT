export interface NormalizedDefectItem {
  name: string;
  minSize: string;
}

export function normalizeDefectItems(
  defectItems: unknown,
  defectClasses: unknown,
  fallbackMinSize: unknown,
): NormalizedDefectItem[] {
  if (Array.isArray(defectItems)) {
    return defectItems
      .map((item: any) => ({
        name: String(item?.name || '').trim(),
        minSize: item?.minSize != null ? String(item.minSize) : '',
      }))
      .filter(item => item.name);
  }

  const fallbackSize = fallbackMinSize != null ? String(fallbackMinSize) : '';
  return (Array.isArray(defectClasses) ? defectClasses : [])
    .map(cls => ({
      name: String(cls || '').trim(),
      minSize: fallbackSize,
    }))
    .filter(item => item.name);
}

export function normalizeDefectItemsFromConfig(config: Record<string, unknown> | null | undefined) {
  if (!config) return [];
  return normalizeDefectItems(config.defectItems, config.defectClasses || config.defectTypes, config.minDefectSize);
}

export function formatDefectItems(items: NormalizedDefectItem[], unit = 'mm') {
  return items
    .map(item => item.minSize ? `${item.name}: ${item.minSize}${unit}` : item.name)
    .join('、');
}

export function getMinimumDefectSize(items: NormalizedDefectItem[]) {
  const values = items
    .map(item => parseFloat(item.minSize))
    .filter(value => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}
