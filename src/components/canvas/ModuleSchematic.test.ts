import { describe, expect, it } from 'vitest';
import {
  getLightVerticalDistanceForY,
  getLightYForDistance,
} from './ModuleSchematic';

describe('ModuleSchematic light geometry helpers', () => {
  it('maps lights above the product to positive vertical distance', () => {
    expect(getLightVerticalDistanceForY(320, 2, 420)).toBe(200);
    expect(getLightYForDistance(200, 2, 420)).toBe(320);
  });

  it('maps lights below the product from the product bottom edge', () => {
    expect(getLightVerticalDistanceForY(560, 2, 420)).toBe(-200);
    expect(getLightYForDistance(-200, 2, 420)).toBe(560);
  });

  it('uses the nearest product edge when a dragged light crosses the product area', () => {
    expect(getLightVerticalDistanceForY(430, 2, 420)).toBe(20);
    expect(getLightVerticalDistanceForY(450, 2, 420)).toBe(-20);
  });
});
