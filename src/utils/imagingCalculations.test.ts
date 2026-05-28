import { describe, expect, it } from 'vitest';
import { calculateImagingParams, calculatePrecisionAnalysis } from './imagingCalculations';

describe('precision redundancy strategy', () => {
  it('uses custom required pixels in precision analysis', () => {
    const result = calculatePrecisionAnalysis({
      pixelSizeMm: 0.01,
      targetFeatureSizeMm: 0.08,
      strategy: 'custom',
      customRequiredPixels: 7,
    });

    expect(result.requiredPixels).toBe(7);
    expect(result.featurePixels).toBe(8);
    expect(result.meetsRequirement).toBe(true);
  });

  it('uses custom required pixels for recommended camera resolution', () => {
    const result = calculateImagingParams({
      cameraResolution: '1000x1000',
      fov: '100x100',
      targetFeatureSizeMm: 0.2,
      redundancyStrategy: 'custom',
      customRequiredPixels: 8,
    });

    expect(result.precisionAnalysis?.requiredPixels).toBe(8);
    expect(result.meetsAccuracy).toBe(false);
    expect(result.recommendedCamera).toBe('4000x4000 (16.0MP)');
  });
});

describe('manual-first FOV reconciliation', () => {
  it('keeps user-entered FOV as the effective FOV', () => {
    const result = calculateImagingParams({
      cameraResolution: '5472x3648',
      sensorSize: '1',
      focalLength: 25,
      workingDistanceInput: 730,
      fov: '380x253',
    });

    expect(result.fovParsed).toEqual({ width: 380, height: 253 });
    expect(result.fovEffective).toEqual({ width: 380, height: 253 });
    expect(result.resolutionPerPixel).toBe('0.0694');
    expect(result.fovReconciliation?.wasAdjusted).toBe(true);
    expect(result.fovReconciliation?.effectiveFov).toEqual({ width: 380, height: 253 });
  });

  it('uses camera resolution aspect ratio when deriving sensor FOV height', () => {
    const result = calculateImagingParams({
      cameraResolution: '5472x3648',
      sensorSize: '1',
      focalLength: 25,
      workingDistanceInput: 730,
      fov: '380x253',
    });

    expect(result.fovFromSensor?.width).toBe(373.76);
    expect(result.fovFromSensor?.height).toBe(249.17);
  });

  it('can still expand FOV when explicitly requested', () => {
    const result = calculateImagingParams({
      cameraResolution: '5472x3648',
      sensorSize: '1',
      focalLength: 25,
      workingDistanceInput: 730,
      fov: '300x200',
      fovReconciliationMode: 'expand',
    });

    expect(result.fovEffective).toEqual({ width: 373.8, height: 249.2 });
  });
});
