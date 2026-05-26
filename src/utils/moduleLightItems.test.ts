import { describe, expect, it } from 'vitest';
import {
  getModuleLightGeometryPatch,
  normalizeModuleLightItems,
} from './moduleLightItems';

describe('module light item helpers', () => {
  it('normalizes legacy single-light fields into one light item', () => {
    const items = normalizeModuleLightItems(undefined, {
      selectedLight: 'light_1',
      lightMode: '常亮',
      lightAngle: '45',
      lightDistance: '100',
      lightDistanceHorizontal: '60',
      lightDistanceVertical: '80',
      lightNote: 'test',
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      selectedLight: 'light_1',
      lightMode: '常亮',
      lightAngle: '45',
      lightDistance: '100',
      lightDistanceHorizontal: '60',
      lightDistanceVertical: '80',
      lightNote: 'test',
    });
  });

  it('recalculates shortest light distance from horizontal and vertical components', () => {
    const patch = getModuleLightGeometryPatch(
      { lightDistance: '', lightDistanceHorizontal: '', lightDistanceVertical: '' },
      { lightDistanceHorizontal: '60', lightDistanceVertical: '80' },
    );

    expect(patch.lightDistance).toBe('100');
  });

  it('recalculates vertical component when shortest distance changes', () => {
    const patch = getModuleLightGeometryPatch(
      { lightDistance: '100', lightDistanceHorizontal: '60', lightDistanceVertical: '80' },
      { lightDistance: '130' },
    );

    expect(patch.lightDistanceVertical).toBe('115.326');
  });
});
