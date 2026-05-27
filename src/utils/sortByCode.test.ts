import { describe, expect, it } from 'vitest';
import { sortByEntityOrder } from './sortByCode';

describe('sortByEntityOrder', () => {
  it('uses persisted sort_order before fallback fields', () => {
    const items = [
      { id: 'b', code: 'DB.02', sort_order: 2, created_at: '2026-01-02' },
      { id: 'a', code: 'DB.01', sort_order: 1, created_at: '2026-01-01' },
      { id: 'c', code: 'DB.03', sort_order: 0, created_at: '2026-01-03' },
    ];

    expect(sortByEntityOrder(items).map(item => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('falls back to natural code order for rows without sort_order', () => {
    const items = [
      { id: '10', code: 'DB260101.10', sort_order: null, created_at: '2026-01-03' },
      { id: '2', code: 'DB260101.02', sort_order: null, created_at: '2026-01-02' },
      { id: '1', code: 'DB260101.01', sort_order: null, created_at: '2026-01-01' },
    ];

    expect(sortByEntityOrder(items, 'code').map(item => item.id)).toEqual(['1', '2', '10']);
  });

  it('can fall back to newest project first', () => {
    const items = [
      { id: 'old', sort_order: null, created_at: '2026-01-01' },
      { id: 'new', sort_order: null, created_at: '2026-01-03' },
      { id: 'middle', sort_order: null, created_at: '2026-01-02' },
    ];

    expect(sortByEntityOrder(items, 'createdDesc').map(item => item.id)).toEqual(['new', 'middle', 'old']);
  });
});
