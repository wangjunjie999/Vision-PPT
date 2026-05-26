export const SCHEMATIC_IMAGE_SIGNATURE_VERSION = 3;

type SchematicPoint = { x: number; y: number };

function roundForSignature(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function createSchematicImageSignature({
  cameraId,
  lensId,
  lightId,
  controllerId,
  camera,
  light,
  cameraRotation,
  lightRotation,
  fovAngle,
  lightDistance,
  workingDistanceMm,
  fovWidthMm,
  diagramLightDistanceMm,
  lightDistanceHorizontalMm,
  lightDistanceVerticalMm,
  lightCount,
  lightItems,
  is3DCamera,
  distanceUnit,
}: {
  cameraId?: string | null;
  lensId?: string | null;
  lightId?: string | null;
  controllerId?: string | null;
  camera: SchematicPoint;
  light: SchematicPoint;
  cameraRotation: number;
  lightRotation: number;
  fovAngle: number;
  lightDistance: number;
  workingDistanceMm?: number | null;
  fovWidthMm?: number | null;
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
    angle?: string;
  }>;
  is3DCamera?: boolean;
  distanceUnit?: string;
}) {
  return JSON.stringify({
    v: SCHEMATIC_IMAGE_SIGNATURE_VERSION,
    cameraId: cameraId || null,
    lensId: lensId || null,
    lightId: lightId || null,
    controllerId: controllerId || null,
    camera: { x: roundForSignature(camera.x), y: roundForSignature(camera.y) },
    light: { x: roundForSignature(light.x), y: roundForSignature(light.y) },
    cameraRotation: roundForSignature(cameraRotation),
    lightRotation: roundForSignature(lightRotation),
    fovAngle: roundForSignature(fovAngle),
    lightDistance: roundForSignature(lightDistance),
    workingDistanceMm: workingDistanceMm ? roundForSignature(workingDistanceMm) : null,
    fovWidthMm: fovWidthMm ? roundForSignature(fovWidthMm) : null,
    diagramLightDistanceMm: diagramLightDistanceMm ? roundForSignature(diagramLightDistanceMm) : null,
    lightDistanceHorizontalMm: lightDistanceHorizontalMm !== null && lightDistanceHorizontalMm !== undefined ? roundForSignature(lightDistanceHorizontalMm) : null,
    lightDistanceVerticalMm: lightDistanceVerticalMm ? roundForSignature(lightDistanceVerticalMm) : null,
    lightCount: lightCount || 1,
    lightItems: (lightItems || []).map(item => ({
      id: item.id,
      hardwareId: item.hardwareId || null,
      position: item.position ? { x: roundForSignature(item.position.x), y: roundForSignature(item.position.y) } : null,
      rotation: typeof item.rotation === 'number' ? roundForSignature(item.rotation) : null,
      distanceMm: item.distanceMm !== null && item.distanceMm !== undefined ? roundForSignature(item.distanceMm) : null,
      horizontalMm: item.horizontalMm !== null && item.horizontalMm !== undefined ? roundForSignature(item.horizontalMm) : null,
      verticalMm: item.verticalMm !== null && item.verticalMm !== undefined ? roundForSignature(item.verticalMm) : null,
      angle: item.angle || null,
    })),
    is3DCamera: Boolean(is3DCamera),
    distanceUnit: distanceUnit || 'mm',
  });
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
