import React from 'react';
import styles from './PageHeader.module.css';

/**
 * PageHeader - the canonical top of every admin page (FABLE-ADMIN-UIUX 2.3).
 * One place for eyebrow -> title -> subtitle on the left and primary actions on
 * the right, so every page reads the same. `meta` is for small status / count
 * chips that sit under the title (e.g. a StatusBadge + "#ZAV-1029").
 */
export interface PageHeaderProps {
  /** Small uppercase kicker above the title (workspace / section name). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /**
   * [KA11-5] REQUIRED, not optional.
   *
   * The audit measured it: the pages that carry a subtitle are the better pages, and finance
   * and the call console score highest largely because of theirs. A subtitle is where a page
   * says what it is FOR — which of two similar tables this is, what the numbers on it mean,
   * what it does not cover. Optional, it was the first thing dropped; required, the type
   * asks the question before the page ships.
   *
   * Pass `null` deliberately for the rare header that genuinely needs none — that is a
   * decision someone made, which is the point, rather than a field nobody filled in.
   */
  subtitle: React.ReactNode | null;
  /** Chips / badges that belong with the title (StatusBadge, ids, counts). */
  meta?: React.ReactNode;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
  /** Optional slot rendered above the title (e.g. a Breadcrumb / back link). */
  above?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  above,
}) => (
  <header className={styles.header}>
    {above && <div className={styles.above}>{above}</div>}
    <div className={styles.row}>
      <div className={styles.lead}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        {meta && <div className={styles.meta}>{meta}</div>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  </header>
);
