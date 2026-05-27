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
