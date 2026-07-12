import React from 'react';
import styles from './DataCells.module.css';
import { ageLabel, HOUR_MS } from './age';

/**
 * Small table-cell helpers (FABLE-ADMIN-UIUX §2.2):
 *  - CopyId    — click-to-copy id/order-number (operators paste these all day)
 *  - AgeCell   — relative age that turns amber/red past thresholds
 *  - MoneyCell — right-aligned tabular-nums ₹
 */

export const CopyId: React.FC<{ value: string; display?: string }> = ({ value, display }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button
      type="button"
      className={styles.copyId}
      onClick={copy}
      title={copied ? 'Copied!' : `Copy ${value}`}
    >
      {display ?? value}
      <span className={styles.copyHint}>{copied ? '✓' : '⧉'}</span>
    </button>
  );
};

export interface AgeCellProps {
  since: string | null | undefined;
  /** hours after which the age renders amber (default 48) */
  warnAfterH?: number;
  /** hours after which the age renders red (default 96) */
  alertAfterH?: number;
}

export const AgeCell: React.FC<AgeCellProps> = ({ since, warnAfterH = 48, alertAfterH = 96 }) => {
  // Snapshot the clock once per mount (lazy initializer keeps render pure).
  const [now] = React.useState(() => Date.now());
  if (!since) return <span className={styles.age}>—</span>;
  const hours = (now - new Date(since).getTime()) / HOUR_MS;
  const cls =
    hours >= alertAfterH ? styles.ageAlert : hours >= warnAfterH ? styles.ageWarn : styles.age;
  return (
    <span className={cls} title={new Date(since).toLocaleString('en-IN')}>
      {ageLabel(since, now)}
    </span>
  );
};

export const MoneyCell: React.FC<{ amount: number | string | null | undefined }> = ({ amount }) => {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (
    <span className={styles.money}>
      {n == null || Number.isNaN(n)
        ? '—'
        : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
    </span>
  );
};
