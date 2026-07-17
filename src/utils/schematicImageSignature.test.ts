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

  it('includes distance display inputs that affect rendered schematic labels', () => {
    const original = createSchematicImageSignature({
      ...baseSignatureInput,
      workingDistanceInput: '200~250',
      workingDistanceToleranceInput: '15',
      diagramLightDistanceInput: '180~220',
      lightItems: [{ id: 'light-1', distanceInput: '180~220', distanceMm: 200 }],
    });
    const changedLabel = createSchematicImageSignature({
      ...baseSignatureInput,
      workingDistanceInput: '210~240',
      workingDistanceToleranceInput: '10',
      diagramLightDistanceInput: '180~220',
      lightItems: [{ id: 'light-1', distanceInput: '180~220', distanceMm: 200 }],
    });

    const parsed = JSON.parse(original);
    expect(parsed.workingDistanceInput).toBe('200~250');
    expect(parsed.workingDistanceToleranceInput).toBe('15');
    expect(parsed.diagramLightDistanceInput).toBe('180~220');
    expect(parsed.lightItems[0].distanceInput).toBe('180~220');
    expect(changedLabel).not.toBe(original);
  });

  it('invalidates a 2D schematic when its scan subtype or effective FOV changes', () => {
    const areaScan = createSchematicImageSignature({
      ...baseSignatureInput,
      twoDCameraType: 'area_scan',
      fovWidthMm: 50,
    });
    const lineScan = createSchematicImageSignature({
      ...baseSignatureInput,
      twoDCameraType: 'line_scan',
      fovWidthMm: 50,
    });
    const widerLineScan = createSchematicImageSignature({
      ...baseSignatureInput,
      twoDCameraType: 'line_scan',
      fovWidthMm: 75,
    });

    expect(JSON.parse(areaScan).twoDCameraType).toBe('area_scan');
    expect(JSON.parse(lineScan)).toMatchObject({
      twoDCameraType: 'line_scan',
      fovWidthMm: 50,
    });
    expect(lineScan).not.toBe(areaScan);
    expect(widerLineScan).not.toBe(lineScan);
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

  it('includes only 3D optical form fields in the 3D schematic signature', () => {
    const original = createSchematicImageSignature({
      ...baseSignatureInput,
      is3DCamera: true,
      threeDConfig: {
        model: 'LJ-S080',
        orderModel: '3D-APS-2',
        scanLineWidth: '35',
        dataPoints: '3200×6400',
        detectionMethod: '3D相机垂直固定',
        referenceDistance: '160',
        detectionSteps: ['固定相机'],
      },
    });
    const changedMeasurementMethod = createSchematicImageSignature({
      ...baseSignatureInput,
      is3DCamera: true,
      threeDConfig: {
        model: 'LJ-S080',
        orderModel: '3D-APS-2',
        scanLineWidth: '35',
        dataPoints: '3200×6400',
        detectionMethod: '3D相机固定在三轴上',
        referenceDistance: '500',
        detectionSteps: ['固定相机'],
      },
    });
    const changedOpticalModel = createSchematicImageSignature({
      ...baseSignatureInput,
      is3DCamera: true,
      threeDConfig: {
        model: '3D-M051280',
        orderModel: '3D-APS-2',
        scanLineWidth: '35',
        dataPoints: '3200×6400',
      },
    });

    expect(JSON.parse(original).threeDConfig).toMatchObject({
      model: 'LJ-S080',
      orderModel: '3D-APS-2',
      scanLineWidth: '35',
      dataPoints: '3200×6400',
    });
    expect(JSON.parse(original).threeDConfig.detectionMethod).toBeUndefined();
    expect(JSON.parse(original).threeDConfig.referenceDistance).toBeUndefined();
    expect(JSON.parse(original).threeDConfig.detectionSteps).toBeUndefined();
    expect(changedMeasurementMethod).toBe(original);
    expect(changedOpticalModel).not.toBe(original);
  });
});
