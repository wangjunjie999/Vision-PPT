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

  it('canonicalizes lens and light data away in 3D mode', () => {
    const original = createSchematicImageSignature({
      ...baseSignatureInput,
      is3DCamera: true,
      lightItems: [{
        id: 'legacy-light',
        hardwareId: 'light-1',
        position: { x: 100, y: 200 },
        rotation: 30,
        distanceMm: 120,
        horizontalMm: 20,
        verticalMm: 100,
        angle: '30',
      }],
    });
    const movedLegacyLight = createSchematicImageSignature({
      ...baseSignatureInput,
      is3DCamera: true,
      lensId: 'different-lens',
      lightId: 'different-light',
      light: { x: 999, y: 888 },
      lightRotation: 60,
      lightDistance: 500,
      diagramLightDistanceMm: 350,
      lightDistanceHorizontalMm: 50,
      lightDistanceVerticalMm: 320,
      lightCount: 8,
      lightItems: [{
        id: 'legacy-light-2',
        hardwareId: 'light-2',
        position: { x: 300, y: 400 },
        rotation: 60,
        distanceMm: 350,
        horizontalMm: 50,
        verticalMm: 320,
        angle: '60',
      }],
    });

    const parsed = JSON.parse(original);
    expect(parsed.lensId).toBeNull();
    expect(parsed.lightId).toBeNull();
    expect(parsed.light).toBeNull();
    expect(parsed.lightCount).toBe(0);
    expect(parsed.lightItems).toEqual([]);
    expect(movedLegacyLight).toBe(original);
  });
});
