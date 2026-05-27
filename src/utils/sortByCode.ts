/**
 * Natural sort by `code` field — handles strings like
 * DB260101.01, DB260101.02, ..., DB260101.10 in correct order.
 */
export function sortByCode<T extends { code?: string | null; created_at?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ac = a.code || '';
    const bc = b.code || '';
    if (ac && bc) {
      const cmp = ac.localeCompare(bc, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    } else if (ac && !bc) return -1;
    else if (!ac && bc) return 1;
    // Fallback to created_at
    const at = a.created_at || '';
    const bt = b.created_at || '';
    return at.localeCompare(bt);
  });
}

type SortFallback = 'code' | 'createdAsc' | 'createdDesc';

type OrderedEntity = {
  sort_order?: number | null;
  code?: string | null;
  created_at?: string | null;
};

/**
 * Sort tree entities by persisted user order first, with old deterministic
 * ordering as a fallback for pre-migration rows.
 */
export function sortByEntityOrder<T extends OrderedEntity>(
  items: T[],
  fallback: SortFallback = 'code',
): T[] {
  return [...items].sort((a, b) => {
    const ao = normalizeSortOrder(a.sort_order);
    const bo = normalizeSortOrder(b.sort_order);

    if (ao !== null && bo !== null && ao !== bo) return ao - bo;
    if (ao !== null && bo === null) return -1;
    if (ao === null && bo !== null) return 1;

    return compareByFallback(a, b, fallback);
  });
}

function normalizeSortOrder(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function compareByFallback(a: OrderedEntity, b: OrderedEntity, fallback: SortFallback): number {
  if (fallback === 'createdDesc') {
    const at = a.created_at || '';
    const bt = b.created_at || '';
    return bt.localeCompare(at);
  }

  if (fallback === 'createdAsc') {
    const at = a.created_at || '';
    const bt = b.created_at || '';
    return at.localeCompare(bt);
  }

  const ac = a.code || '';
  const bc = b.code || '';
  if (ac && bc) {
    const cmp = ac.localeCompare(bc, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  } else if (ac && !bc) return -1;
  else if (!ac && bc) return 1;

  const at = a.created_at || '';
  const bt = b.created_at || '';
  return at.localeCompare(bt);
}
