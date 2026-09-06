import React from 'react';

/**
 * [KA4-15] Sortable table headers.
 *
 * Central Stock and Cross-hub Stock exist to compare quantities across SKUs and hubs, and
 * neither offered a way to order by any of them — you could read "which hub holds the most
 * denim?" off the screen only by scanning every row.
 *
 * Deliberately client-side over the rows already loaded. Both tables fetch their full set
 * (they are per-hub inventories, not paginated feeds), so sorting here reorders exactly what
 * the operator is looking at. A server sort would also silently change WHICH rows are shown
 * the moment either table gains a page limit, which is a different and more surprising act.
 *
 * `null` sorts last in both directions. A missing quantity is not a small one — putting it
 * at the bottom of an ascending sort would make "no costed receipts yet" read as "cheapest".
 */
export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

export function useTableSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => string | number | null | undefined>,
  initial?: { key: K; dir: SortDir },
) {
  const [sort, setSort] = React.useState<SortState<K>>({
    key: initial?.key ?? null,
    dir: initial?.dir ?? 'desc',
  });

  const toggle = React.useCallback((key: K) => {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : // A new column starts descending: on an inventory table the interesting end is
          // almost always the big one — most stock, most capital, most overdue.
          { key, dir: 'desc' },
    );
  }, []);

  const sorted = React.useMemo(() => {
    if (!sort.key) return rows;
    const get = accessors[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const aEmpty = av === null || av === undefined || av === '';
      const bEmpty = bv === null || bv === undefined || bv === '';
      if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1; // nulls last, always
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv), 'en-IN', { numeric: true }) * factor;
    });
  }, [rows, sort, accessors]);

  return { sort, toggle, sorted };
}
