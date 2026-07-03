import React from 'react';
import styles from './FilterBar.module.css';

/**
 * FilterBar - the canonical filter/search row for list pages
 * (FABLE-ADMIN-UIUX 2.4). Lays out a search field + filter controls on the
 * left and bulk/secondary actions on the right, wrapping cleanly on mobile.
 * It does NOT own filter state - pass controlled inputs as children so every
 * list keeps its URL-synced filters.
 */
export interface FilterBarProps {
  /** Leading search input (or any primary control). */
  search?: React.ReactNode;
  /** Filter controls (selects, chips, toggles). */
  children?: React.ReactNode;
  /** Right-aligned actions (export, saved views, bulk ops). */
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  children,
  actions,
  className = '',
}) => (
  <div className={`${styles.bar} ${className}`} role="search">
    {search && <div className={styles.search}>{search}</div>}
    {children && <div className={styles.filters}>{children}</div>}
    {actions && <div className={styles.actions}>{actions}</div>}
  </div>
);
