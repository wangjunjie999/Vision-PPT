import { describe, expect, it } from 'vitest';
import {
  formatDefectItems,
  getMinimumDefectSize,
  normalizeDefectItems,
  normalizeDefectItemsFromConfig,
} from './defectItems';

describe('defect item helpers', () => {
  it('normalizes new defect item rows', () => {
    expect(normalizeDefectItems([
      { name: '划痕', minSize: 0.2 },
      { name: ' ', minSize: 0.4 },
      { name: '凹坑' },
    ], [], null)).toEqual([
      { name: '划痕', minSize: '0.2' },
      { name: '凹坑', minSize: '' },
    ]);
  });

  it('converts legacy classes and global min size to row data', () => {
    expect(normalizeDefectItems(undefined, ['划痕', '气泡'], 0.6)).toEqual([
      { name: '划痕', minSize: '0.6' },
      { name: '气泡', minSize: '0.6' },
    ]);
  });

  it('formats and computes minimum size', () => {
    const items = normalizeDefectItemsFromConfig({
      defectItems: [
        { name: '划痕', minSize: 0.2 },
        { name: '凹坑', minSize: 0.5 },
        { name: '异物', minSize: null },
      ],
    });

    expect(formatDefectItems(items)).toBe('划痕: 0.2mm、凹坑: 0.5mm、异物');
    expect(getMinimumDefectSize(items)).toBe(0.2);
  });
});
