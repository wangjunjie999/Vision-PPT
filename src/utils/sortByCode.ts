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
