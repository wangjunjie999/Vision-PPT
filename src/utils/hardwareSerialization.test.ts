import { describe, expect, it } from 'vitest';
import {
  sanitizeController,
  sanitizeHardwareArray,
  sanitizeHardwareItem,
} from './hardwareSerialization';

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some(hasUndefined);
}

describe('hardware serialization helpers', () => {
  it('keeps JSON-safe hardware fields and drops undefined or nested values', () => {
    const sanitized = sanitizeHardwareItem({
      id: 'cam-1',
      brand: 'Basler',
      model: 'acA2500',
      image_url: 'https://example.com/cam.png',
      front_view_url: 'https://example.com/cam-front.png',
      top_view_url: 'https://example.com/cam-top.png',
      model_3d_url: 'https://example.com/cam.glb',
      resolution: '2592x1944',
      max_sensor_size: '2/3"',
      resolving_power: 160,
      tags: ['area', 42, 'mono'],
      ignoredNested: { unsafe: true },
      power: undefined,
    });

    expect(sanitized).toEqual({
      id: 'cam-1',
      brand: 'Basler',
      model: 'acA2500',
      image_url: 'https://example.com/cam.png',
      front_view_url: 'https://example.com/cam-front.png',
      top_view_url: 'https://example.com/cam-top.png',
      model_3d_url: 'https://example.com/cam.glb',
      resolution: '2592x1944',
      max_sensor_size: '2/3"',
      resolving_power: 160,
      tags: ['area', 'mono'],
    });
    expect(hasUndefined(sanitized)).toBe(false);
    expect(JSON.parse(JSON.stringify(sanitized))).toEqual(sanitized);
  });

  it('filters invalid hardware array entries', () => {
    expect(sanitizeHardwareArray([
      { id: 'cam-1', brand: 'Basler' },
      null,
      { id: '' },
      'cam-2',
    ])).toEqual([{ id: 'cam-1', brand: 'Basler' }]);
  });

  it('serializes IPC controller selections as JSON objects', () => {
    expect(sanitizeController({
      id: 'ipc-1',
      brand: 'Advantech',
      model: 'MIC-770',
      image_url: 'https://example.com/ipc.png',
      cpu: 'Intel i7',
      memory: '32GB',
    })).toEqual({
      id: 'ipc-1',
      brand: 'Advantech',
      model: 'MIC-770',
      image_url: 'https://example.com/ipc.png',
      cpu: 'Intel i7',
      memory: '32GB',
    });
  });
});
