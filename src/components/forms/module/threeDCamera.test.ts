import { describe, expect, it } from 'vitest';
import { getDefaultFormState } from './types';
import { needs3DOpticsStrip, strip3DOpticsFromForm } from './threeDCamera';

describe('strip3DOpticsFromForm', () => {
  it('enables 3D mode and clears lens and light fields', () => {
    const form = {
      ...getDefaultFormState(),
      selectedLens: 'lens-1',
      selectedLight: 'light-1',
      lightItems: [{
        id: 'item-1',
        selectedLight: 'light-1',
        lightMode: 'constant',
        lightAngle: '45',
        lightDistance: '120',
        lightDistanceHorizontal: '20',
        lightDistanceVertical: '100',
        lightNote: 'legacy',
      }],
      lightMode: 'constant',
      lightAngle: '45',
      lightCount: '1',
      lightDistance: '120',
      lightDistanceHorizontal: '20',
      lightDistanceVertical: '100',
      lensAperture: 'F2.8',
      depthOfField: '10',
      workingDistanceTolerance: '2',
      lightNote: 'legacy',
    };

    const stripped = strip3DOpticsFromForm(form);

    expect(stripped.is3DCamera).toBe(true);
    expect(stripped.selectedLens).toBe('');
    expect(stripped.selectedLight).toBe('');
    expect(stripped.lightItems).toEqual([]);
    expect(stripped.lightMode).toBe('');
    expect(stripped.lightAngle).toBe('');
    expect(stripped.lightCount).toBe('');
    expect(stripped.lightDistance).toBe('');
    expect(stripped.lightDistanceHorizontal).toBe('');
    expect(stripped.lightDistanceVertical).toBe('');
    expect(stripped.lensAperture).toBe('');
    expect(stripped.depthOfField).toBe('');
    expect(stripped.workingDistanceTolerance).toBe('');
    expect(stripped.lightNote).toBe('');
    expect(needs3DOpticsStrip(stripped)).toBe(false);
  });
});
