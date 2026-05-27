import { describe, expect, it } from 'vitest';
import { createSchematicImageSignature, SCHEMATIC_IMAGE_SIGNATURE_VERSION } from './schematicImageSignature';

const baseSignatureInput = {
  cameraId: 'camera-1',
  lensId: 'lens-1',
  lightId: 'light-1',
  controllerId: 'controller-1',
  camera: { x: 275, y: 77 },
  light: { x: 275, y: 231 },
  product: { x: 275, y: 420 },
  cameraRotation: 0,
  lightRotation: 0,
  fovAngle: 45,
  lightDistance: 335,
  workingDistanceMm: 300,
  fovWidthMm: 100,
  diagramLightDistanceMm: 200,
  lightDistanceHorizontalMm: 0,
  lightDistanceVerticalMm: 200,
  lightCount: 1,
  lightItems: [],
  is3DCamera: false,
  distanceUnit: 'mm',
};

describe('createSchematicImageSignature', () => {
  it('includes product position in the current signature version', () => {
    const original = createSchematicImageSignature(baseSignatureInput);
    const moved = createSchematicImageSignature({
      ...baseSignatureInput,
      product: { x: 275, y: 350 },
    });

    expect(JSON.parse(original).v).toBe(SCHEMATIC_IMAGE_SIGNATURE_VERSION);
    expect(JSON.parse(original).product).toEqual({ x: 275, y: 420 });
    expect(moved).not.toBe(original);
  });
});
