import React from 'react';
import styles from './DetailShell.module.css';

/**
 * DetailShell - the canonical two-column detail layout (FABLE-ADMIN-UIUX 2.5).
 * Main story on the left, a sticky right rail (`aside`) for status / actions /
 * meta. Collapses to a single column on narrow viewports (aside moves below).
 * Pair with PageHeader as the `header` slot.
 */
export interface DetailShellProps {
  /** Usually a <PageHeader/>. Spans both columns. */
  header?: React.ReactNode;
  /** Primary content column. */
  children: React.ReactNode;
  /** Right rail - status, key facts, contextual actions. */
  aside?: React.ReactNode;
  /** Put the aside first on mobile (e.g. when status outranks the story). */
  asideFirstOnMobile?: boolean;
  /** Make the rail sticky as the main column scrolls. Off by default so it
   *  matches the admin content area's own scroll model. */
  stickyAside?: boolean;
}

export const DetailShell: React.FC<DetailShellProps> = ({
  header,
  children,
  aside,
  asideFirstOnMobile = false,
  stickyAside = false,
}) => (
  <div className={styles.shell}>
    {header}
    <div className={`${styles.grid} ${aside ? '' : styles.single}`}>
      <main className={styles.main}>{children}</main>
      {aside && (
        <aside
          className={`${styles.aside} ${stickyAside ? styles.asideSticky : ''} ${asideFirstOnMobile ? styles.asideFirst : ''}`}
        >
          {aside}
        </aside>
      )}
    </div>
  </div>
);
