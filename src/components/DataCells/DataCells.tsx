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

/**
 * ACP-3 — ONE masked phone. [KA7-2] [KA8-10] [KA7-15]
 *
 * Measured: `/admin/users` renders `••••••0000`; orders, returns, alterations,
 * support and finance/refunds all print `+919999900000` in full, for the same
 * customers. **Two masking policies in one console, and the unmasked one is on
 * the busier, more exportable pages** — including the finance console, which has
 * the least reason of any of them to call anyone.
 *
 * Masking is the default and revealing is a deliberate act, matching the server
 * (`/customers/lookup` now masks unless asked, and logs the full variant). This
 * is display-side only: the value is already in the payload, so it is a
 * shoulder-surfing and screenshot control, not an access control. Said plainly
 * because the difference matters — the access control is the read policy.
 */
export const PhoneCell: React.FC<{ phone?: string | null; reveal?: boolean }> = ({
  phone,
  reveal = false,
}) => {
  const [shown, setShown] = React.useState(reveal);
  if (!phone) return <span className={styles.muted}>—</span>;
  const digits = phone.replace(/\D/g, '');
  const masked = digits.length >= 4 ? `••••••${digits.slice(-4)}` : '••••';
  return (
    <span className={styles.phone}>
      {shown ? phone : masked}
      {!shown && (
        <button
          type="button"
          className={styles.revealBtn}
          title="Show the full number"
          aria-label="Show the full phone number"
          onClick={(e) => {
            e.stopPropagation(); // rows are clickable — don't navigate
            setShown(true);
          }}
        >
          show
        </button>
      )}
    </span>
  );
};

/**
 * ACP-3 — ONE masked email, the twin of PhoneCell. [KA11-3]
 *
 * An email address identifies a customer as directly as a phone number and is the
 * likelier target of the two: it is the reset-password channel. It was printed in full on
 * every detail page that showed it, while the same console masked the phone beside it —
 * so the masking policy protected the weaker identifier and published the stronger one.
 *
 * Display-side only, exactly like PhoneCell: the value is already in the payload, so this
 * is a shoulder-surfing and screenshot control, not an access control. The access control
 * is the read policy on the endpoint.
 */
export const EmailCell: React.FC<{ email?: string | null; reveal?: boolean }> = ({
  email,
  reveal = false,
}) => {
  const [shown, setShown] = React.useState(reveal);
  if (!email || !email.trim()) return <span className={styles.muted}>—</span>;
  const [user, domain] = email.split('@');
  // Keep the first character and the domain: enough to recognise an address you already
  // know, not enough to write it down.
  const masked = domain ? `${user.slice(0, 1)}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}` : '••••';
  return (
    <span className={styles.phone}>
      {shown ? email : masked}
      {!shown && (
        <button
          type="button"
          className={styles.revealBtn}
          title="Show the full email address"
          aria-label="Show the full email address"
          onClick={(e) => {
            e.stopPropagation();
            setShown(true);
          }}
        >
          show
        </button>
      )}
    </span>
  );
};

/**
 * [KA7-15] An erased customer is a TOMBSTONE, not a person called "Deleted
 * customer". It rendered in the NAME column at the same weight and colour as a
 * real name, beside a *Deactivated* chip — so a DPDP erasure looked like an
 * ordinary account belonging to someone with an unusual name.
 */
const ERASED = /^(deleted customer|erased|redacted)$/i;
export const CustomerNameCell: React.FC<{ name?: string | null }> = ({ name }) => {
  if (!name || !name.trim()) return <span className={styles.muted}>—</span>;
  if (ERASED.test(name.trim())) return <span className={styles.tombstone}>— erased —</span>;
  return <>{name}</>;
};
