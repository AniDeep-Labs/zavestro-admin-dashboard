import React from 'react';
import type { SortState } from '../../hooks/useTableSort';
import css from './SortableTh.module.css';

/**
 * A `<th>` that sorts. Renders the arrow for the active column only, and carries `aria-sort`
 * so the state is available to a screen reader rather than living purely in a glyph.
 */
export function SortableTh<K extends string>({
  sortKey,
  sort,
  onToggle,
  className,
  children,
}: {
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => onToggle(sortKey)} className={css.sortBtn}>
        {children}
        <span aria-hidden="true" className={active ? undefined : css.idle}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
