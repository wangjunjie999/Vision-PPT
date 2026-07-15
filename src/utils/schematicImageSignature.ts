export const SCHEMATIC_IMAGE_SIGNATURE_VERSION = 8;

type SchematicPoint = { x: number; y: number };

function roundForSignature(value: number) {
  return Math.round(value * 1000) / 1000;
}

function textForSignature(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

export function createSchematicImageSignature({
  cameraId,
  lensId,
  lightId,
  controllerId,
  camera,
  light,
  product,
  cameraRotation,
  lightRotation,
  fovAngle,
  lightDistance,
  workingDistanceInput,
  workingDistanceMm,
  workingDistanceToleranceInput,
  fovWidthMm,
  diagramLightDistanceInput,
  diagramLightDistanceMm,
  lightDistanceHorizontalMm,
  lightDistanceVerticalMm,
  lightCount,
  lightItems,
  is3DCamera,
  distanceUnit,
  threeDConfig,
}: {
  cameraId?: string | null;
  lensId?: string | null;
  lightId?: string | null;
  controllerId?: string | null;
  camera: SchematicPoint;
  light: SchematicPoint;
  product: SchematicPoint;
  cameraRotation: number;
  lightRotation: number;
  fovAngle: number;
  lightDistance: number;
  workingDistanceInput?: string | null;
  workingDistanceMm?: number | null;
  workingDistanceToleranceInput?: string | null;
  fovWidthMm?: number | null;
  diagramLightDistanceInput?: string | null;
  diagramLightDistanceMm?: number | null;
  lightDistanceHorizontalMm?: number | null;
  lightDistanceVerticalMm?: number | null;
  lightCount?: number;
  lightItems?: Array<{
    id: string;
    hardwareId?: string | null;
    position?: SchematicPoint;
    rotation?: number;
    distanceMm?: number | null;
    horizontalMm?: number | null;
    verticalMm?: number | null;
    distanceInput?: string | null;
    angle?: string;
  }>;
  is3DCamera?: boolean;
  distanceUnit?: string;
  threeDConfig?: Record<string, unknown> | null;
}) {
  const is3D = Boolean(is3DCamera);
  return JSON.stringify({
    v: SCHEMATIC_IMAGE_SIGNATURE_VERSION,
    cameraId: cameraId || null,
    lensId: is3D ? null : lensId || null,
    lightId: is3D ? null : lightId || null,
    controllerId: controllerId || null,
    camera: { x: roundForSignature(camera.x), y: roundForSignature(camera.y) },
    light: is3D ? null : { x: roundForSignature(light.x), y: roundForSignature(light.y) },
    product: { x: roundForSignature(product.x), y: roundForSignature(product.y) },
    cameraRotation: roundForSignature(cameraRotation),
    lightRotation: is3D ? null : roundForSignature(lightRotation),
    fovAngle: roundForSignature(fovAngle),
    lightDistance: is3D ? null : roundForSignature(lightDistance),
    workingDistanceInput: textForSignature(workingDistanceInput),
    workingDistanceMm: workingDistanceMm ? roundForSignature(workingDistanceMm) : null,
    workingDistanceToleranceInput: textForSignature(workingDistanceToleranceInput),
    fovWidthMm: fovWidthMm ? roundForSignature(fovWidthMm) : null,
    diagramLightDistanceInput: is3D ? null : textForSignature(diagramLightDistanceInput),
    diagramLightDistanceMm: is3D ? null : diagramLightDistanceMm ? roundForSignature(diagramLightDistanceMm) : null,
    lightDistanceHorizontalMm: is3D ? null : lightDistanceHorizontalMm !== null && lightDistanceHorizontalMm !== undefined ? roundForSignature(lightDistanceHorizontalMm) : null,
    lightDistanceVerticalMm: is3D ? null : lightDistanceVerticalMm ? roundForSignature(lightDistanceVerticalMm) : null,
    lightCount: is3D ? 0 : lightCount || 1,
    lightItems: is3D ? [] : (lightItems || []).map(item => ({
      id: item.id,
      hardwareId: item.hardwareId || null,
      position: item.position ? { x: roundForSignature(item.position.x), y: roundForSignature(item.position.y) } : null,
      rotation: typeof item.rotation === 'number' ? roundForSignature(item.rotation) : null,
      distanceInput: textForSignature(item.distanceInput),
      distanceMm: item.distanceMm !== null && item.distanceMm !== undefined ? roundForSignature(item.distanceMm) : null,
      horizontalMm: item.horizontalMm !== null && item.horizontalMm !== undefined ? roundForSignature(item.horizontalMm) : null,
      verticalMm: item.verticalMm !== null && item.verticalMm !== undefined ? roundForSignature(item.verticalMm) : null,
      angle: item.angle || null,
    })),
    is3DCamera: is3D,
    threeDConfig: is3D ? normalizeThreeDConfigForSignature(threeDConfig) : null,
    distanceUnit: distanceUnit || 'mm',
  });
}

function normalizeThreeDConfigForSignature(config: Record<string, unknown> | null | undefined) {
  if (!config || typeof config !== 'object') return null;
  const fields = [
    'model',
    'orderModel',
    'scanLineWidth',
    'dataPoints',
  ];
  const normalized: Record<string, unknown> = {};
  fields.forEach(field => {
    const value = config[field];
    normalized[field] = value === null || value === undefined ? null : String(value).trim() || null;
  });
  return normalized;
}

export function getSchematicImageSignatureVersion(signature: unknown) {
  if (!signature) return null;

  try {
    const parsed = typeof signature === 'string' ? JSON.parse(signature) : signature;
    if (!parsed || typeof parsed !== 'object') return null;
    const version = (parsed as { v?: unknown }).v;
    return typeof version === 'number' && Number.isFinite(version) ? version : null;
  } catch {
    return null;
  }
}

export function hasCurrentSchematicImageSignature(signature: unknown) {
  const version = getSchematicImageSignatureVersion(signature);
  return version !== null && version >= SCHEMATIC_IMAGE_SIGNATURE_VERSION;
}

export function readSavedSchematicImageSignature(rawLayout: unknown) {
  let layout = rawLayout;
  if (typeof rawLayout === 'string') {
    try {
      layout = JSON.parse(rawLayout);
    } catch {
      layout = null;
    }
  }

  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return undefined;
  const signature = (layout as { savedImageSignature?: unknown }).savedImageSignature;
  return typeof signature === 'string' ? signature : undefined;
}

export function hasCurrentSchematicLayoutSignature(rawLayout: unknown) {
  return hasCurrentSchematicImageSignature(readSavedSchematicImageSignature(rawLayout));
}
