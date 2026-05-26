import { describe, expect, it } from 'vitest';
import {
  getLensImagingAutoFill,
  getLensImagingAutoFillKey,
} from './lensImagingAutoFill';

describe('lens imaging auto-fill helpers', () => {
  it('maps lens aperture and max sensor size to imaging fields', () => {
    expect(getLensImagingAutoFill({
      id: 'lens-1',
      aperture: ' F1.4 ',
      max_sensor_size: ' 2/3" ',
    })).toEqual({
      lensAperture: 'F1.4',
      depthOfField: '2/3"',
    });
  });

  it('leaves missing lens values empty so callers can preserve manual input', () => {
    expect(getLensImagingAutoFill({
      id: 'lens-2',
      aperture: '',
      max_sensor_size: null,
    })).toEqual({
      lensAperture: '',
      depthOfField: '',
    });
  });

  it('builds a stable key from the selected lens parameters', () => {
    expect(getLensImagingAutoFillKey({
      id: 'lens-1',
      aperture: 'F1.4',
      max_sensor_size: '2/3"',
    })).toBe('lens-1|F1.4|2/3"');
    expect(getLensImagingAutoFillKey(null)).toBe('');
  });
});
