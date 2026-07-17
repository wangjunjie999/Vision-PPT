export const MODULE_CONFIG_KEYS = [
  'defect_config',
  'positioning_config',
  'measurement_config',
  'ocr_config',
  'deep_learning_config',
] as const;

export type ModuleConfigKey = typeof MODULE_CONFIG_KEYS[number];
export type TwoDCameraType = 'area_scan' | 'line_scan';

const MODULE_TYPE_CONFIG_KEYS: Record<string, ModuleConfigKey> = {
  defect: 'defect_config',
  positioning: 'positioning_config',
  measurement: 'measurement_config',
  ocr: 'ocr_config',
  deeplearning: 'deep_learning_config',
  deep_learning: 'deep_learning_config',
};

export function getObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Resolve the config owned by the module's current type first. Older records
 * occasionally kept their config in a previous type column, so the remaining
 * columns are retained as a read-only fallback.
 */
export function getActiveModuleConfig(module: unknown): Record<string, unknown> | null {
  const record = getObjectRecord(module);
  if (!record) return null;

  const activeKey = MODULE_TYPE_CONFIG_KEYS[String(record.type ?? '')];
  if (activeKey) {
    const activeConfig = getObjectRecord(record[activeKey]);
    if (activeConfig) return activeConfig;
  }

  for (const key of MODULE_CONFIG_KEYS) {
    if (key === activeKey) continue;
    const legacyConfig = getObjectRecord(record[key]);
    if (legacyConfig) return legacyConfig;
  }

  return null;
}

export function getActiveModuleImaging(module: unknown): Record<string, unknown> | null {
  return getObjectRecord(getActiveModuleConfig(module)?.imaging);
}

export function normalizeTwoDCameraType(value: unknown): TwoDCameraType {
  return value === 'line_scan' ? 'line_scan' : 'area_scan';
}

export function getModuleTwoDCameraType(module: unknown): TwoDCameraType {
  return normalizeTwoDCameraType(getActiveModuleImaging(module)?.twoDCameraType);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
}

export function isActiveModule3DCamera(module: unknown, legacyProjectUses3D = false): boolean {
  const imaging = getActiveModuleImaging(module);
  if (imaging && Object.prototype.hasOwnProperty.call(imaging, 'is3DCamera')) {
    return toBoolean(imaging.is3DCamera);
  }
  return Boolean(legacyProjectUses3D);
}
