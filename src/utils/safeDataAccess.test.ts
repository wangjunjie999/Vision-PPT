import { describe, expect, it } from 'vitest';
import { safeController, safeHardwareArray } from './safeDataAccess';

describe('safe hardware selection access', () => {
  it('filters null and malformed hardware entries', () => {
    const result = safeHardwareArray([
      null,
      undefined,
      'camera-id',
      { brand: 'Missing id' },
      { id: '' },
      { id: 'cam-1', brand: 'Basler', model: 'ace', model_3d_url: 'camera.glb' },
    ]);

    expect(result).toEqual([
      { id: 'cam-1', brand: 'Basler', model: 'ace', model_3d_url: 'camera.glb' },
    ]);
  });

  it('returns the default value for non-array hardware selections', () => {
    const fallback = [{ id: 'fallback', brand: 'Fallback' }];

    expect(safeHardwareArray(null, fallback)).toBe(fallback);
    expect(safeHardwareArray({ id: 'not-array' }, fallback)).toBe(fallback);
  });

  it('filters malformed controller selections', () => {
    expect(safeController(null)).toBeNull();
    expect(safeController({ brand: 'No id' })).toBeNull();
    expect(safeController({ id: '' })).toBeNull();
    expect(safeController({ id: 'ipc-1', brand: 'Advantech' })).toEqual({
      id: 'ipc-1',
      brand: 'Advantech',
    });
  });
});
