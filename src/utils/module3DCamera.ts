import { getActiveModuleConfig, getActiveModuleImaging } from './moduleConfig';

export function getModuleConfigRecord(module: unknown): Record<string, unknown> | null {
  return getActiveModuleConfig(module);
}

export function getModuleImagingRecord(module: unknown): Record<string, unknown> | null {
  return getActiveModuleImaging(module);
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
