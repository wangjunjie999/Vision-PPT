import { describe, expect, it } from 'vitest';
import {
  convertDistanceInputUnit,
  formatDistanceDisplay,
  formatDistanceInput,
  signedToMillimeters,
  toMillimeters,
} from './distanceUnits';

describe('distance unit helpers', () => {
  it('preserves negative signed distances through unit conversion', () => {
    expect(signedToMillimeters('-12', 'cm')).toBe(-120);
    expect(formatDistanceInput(-120, 'mm')).toBe('-120');
    expect(formatDistanceInput(-120, 'cm')).toBe('-12');
    expect(formatDistanceInput(-1200, 'm')).toBe('-1.2');
  });

  it('uses the midpoint of distance ranges for calculations', () => {
    expect(toMillimeters('200~250', 'mm')).toBe(225);
    expect(toMillimeters('20～25', 'cm')).toBe(225);
    expect(toMillimeters('200至250', 'mm')).toBe(225);
    expect(toMillimeters('200-250', 'mm')).toBe(225);
    expect(signedToMillimeters('-50~-70', 'mm')).toBe(-60);
  });

  it('keeps range text for display and converts both endpoints between units', () => {
    expect(formatDistanceDisplay('200~250', 'mm')).toBe('200~250mm');
    expect(formatDistanceDisplay('200~250mm', 'cm')).toBe('200~250mm');
    expect(convertDistanceInputUnit('200~250', 'mm', 'cm')).toBe('20~25');
    expect(convertDistanceInputUnit('50-70', 'cm', 'mm')).toBe('500-700');
  });
});
