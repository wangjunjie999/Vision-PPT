const MODULE_CONFIG_KEYS = [
  'defect_config',
  'positioning_config',
  'measurement_config',
  'ocr_config',
  'deep_learning_config',
] as const;

export function getModuleConfigRecord(module: unknown): Record<string, unknown> | null {
  if (!module || typeof module !== 'object') return null;
  const record = module as Record<string, unknown>;
  for (const key of MODULE_CONFIG_KEYS) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

export function getModuleImagingRecord(module: unknown): Record<string, unknown> | null {
  const config = getModuleConfigRecord(module);
  const imaging = config?.imaging;
  return imaging && typeof imaging === 'object' && !Array.isArray(imaging)
    ? imaging as Record<string, unknown>
    : null;
}

export function toBoolean3D(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
}

export function hasExplicitModule3DCameraFlag(module: unknown): boolean {
  const imaging = getModuleImagingRecord(module);
  return Boolean(imaging && Object.prototype.hasOwnProperty.call(imaging, 'is3DCamera'));
}

export function isModule3DCamera(module: unknown, legacyProjectUses3D = false): boolean {
  const imaging = getModuleImagingRecord(module);
  if (imaging && Object.prototype.hasOwnProperty.call(imaging, 'is3DCamera')) {
    return toBoolean3D(imaging.is3DCamera);
  }
  return Boolean(legacyProjectUses3D);
}

export function shouldRestoreDraftAs3DCamera(
  module: unknown,
  draftForm: unknown,
  legacyProjectUses3D = false,
): boolean {
  const draftRecord = draftForm && typeof draftForm === 'object'
    ? draftForm as Record<string, unknown>
    : null;
  return toBoolean3D(draftRecord?.is3DCamera) || isModule3DCamera(module, legacyProjectUses3D);
}
