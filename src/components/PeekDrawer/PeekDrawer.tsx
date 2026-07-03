import React from 'react';
import { Drawer } from '../Drawer';
import styles from './PeekDrawer.module.css';

/**
 * PeekDrawer - the canonical "quick look" panel (FABLE-ADMIN-UIUX 2.6). Lets a
 * list row reveal its detail without leaving the list. Composes the base Drawer
 * (right side, esc/overlay close) and adds a structured header (title +
 * subtitle + status slot), a scrollable body, a sticky footer for actions, and
 * an "open full record" link so the user can escalate to the full page.
 */
export interface PeekDrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Status chip slot (usually a <StatusBadge/>). */
  status?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer actions. */
  footer?: React.ReactNode;
  /** "Open full record ->" escalation. */
  fullLink?: { label?: string; onClick: () => void };
  width?: string;
}

export const PeekDrawer: React.FC<PeekDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  status,
  children,
  footer,
  fullLink,
  width = '460px',
}) => (
  <Drawer open={open} onClose={onClose} width={width} className={styles.drawer}>
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headTop}>
          <div className={styles.titleWrap}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {status && <div className={styles.status}>{status}</div>}
        </div>
        {fullLink && (
          <button type="button" className={styles.fullLink} onClick={fullLink.onClick}>
            {fullLink.label ?? 'Open full record'} &rarr;
          </button>
        )}
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  </Drawer>
);
