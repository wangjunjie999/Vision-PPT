import { isModule3DCamera } from './module3DCamera';

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Return the type-specific config object of a module (defect/measurement/positioning/ocr/deep_learning).
 */
export function getActiveModuleConfig(module: unknown): Record<string, unknown> | null {
  const m = getObject(module);
  if (!m) return null;
  return (
    getObject(m.defect_config) ||
    getObject(m.measurement_config) ||
    getObject(m.positioning_config) ||
    getObject(m.ocr_config) ||
    getObject(m.deep_learning_config) ||
    null
  );
}

/**
 * Return the imaging sub-object from the module's active config, if any.
 */
export function getActiveModuleImaging(module: unknown): Record<string, unknown> | null {
  const config = getActiveModuleConfig(module);
  return config ? getObject(config.imaging) : null;
}

/**
 * Whether the module is configured as a 3D camera module.
 */
export function isActiveModule3DCamera(module: unknown, legacyProjectUses3D = false): boolean {
  return isModule3DCamera(module, legacyProjectUses3D);
}

/**
 * Normalize the 2D camera type field. Returns 'line_scan' | 'area_scan' | undefined.
 */
export function normalizeTwoDCameraType(value: unknown): 'line_scan' | 'area_scan' | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase().replace(/[\s-]/g, '_');
  if (!v) return undefined;
  if (v === 'line_scan' || v === 'linescan' || v === 'line') return 'line_scan';
  if (v === 'area_scan' || v === 'areascan' || v === 'area' || v === 'matrix') return 'area_scan';
  return undefined;
}