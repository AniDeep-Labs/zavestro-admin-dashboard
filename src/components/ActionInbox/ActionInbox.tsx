import React from 'react';
import { useNavigate } from 'react-router-dom';
import { navCountsApi, getAdminCapabilities } from '../../api/adminApi';
import type { NavCounts } from '../../api/adminApi';
import styles from './ActionInbox.module.css';

/**
 * The role-aware "what needs me today" inbox (FABLE-ADMIN-UIUX §1.3).
 * Reads the capability-filtered nav-counts; each present key with a non-zero
 * count becomes one deep-linked row to the filtered list that resolves it.
 * Empty inbox is the success state ("All clear ✓").
 *
 * `compact` renders the dashboard variant (card with header); without it the
 * caller frames it.
 */
type Tone = 'blocked' | 'qc' | 'pending' | 'fit';

interface InboxItem {
  key: keyof NavCounts;
  label: (n: number) => string;
  to: string;
  tone: Tone;
}

// Ordered by urgency — money/stuck first.
const ITEMS: InboxItem[] = [
  { key: 'stuck_orders', tone: 'blocked', to: '/admin/orders?view=stuck',
    label: n => `${n} order${n === 1 ? '' : 's'} stuck over 48h` },
  { key: 'refund_approvals_pending', tone: 'blocked', to: '/admin/returns?status=defect_confirmed',
    label: n => `${n} refund${n === 1 ? '' : 's'} awaiting approval` },
  { key: 'credit_approvals_pending', tone: 'blocked', to: '/admin/finance/credit-approvals',
    label: n => `${n} credit request${n === 1 ? '' : 's'} awaiting approval` },
  { key: 'refunds_awaiting', tone: 'blocked', to: '/admin/finance/refunds',
    label: n => `${n} refund${n === 1 ? '' : 's'} awaiting disbursal` },
  { key: 'cod_unconfirmed', tone: 'qc', to: '/admin/finance/cod-reconciliation',
    label: n => `${n} COD deposit${n === 1 ? '' : 's'} to confirm` },
  { key: 'cod_variances_open', tone: 'blocked', to: '/admin/finance/cod-reconciliation',
    label: n => `${n} COD variance${n === 1 ? '' : 's'} to resolve` },
  { key: 'below_reorder', tone: 'qc', to: '/admin/procurement/stock',
    label: n => `${n} fabric SKU${n === 1 ? '' : 's'} below reorder` },
  { key: 'listings_oos', tone: 'qc', to: '/admin/catalog/listings',
    label: n => `${n} live listing${n === 1 ? '' : 's'} out of stock` },
  { key: 'returns_requested', tone: 'pending', to: '/admin/returns',
    label: n => `${n} return${n === 1 ? '' : 's'} to review` },
  { key: 'tickets_open', tone: 'pending', to: '/admin/support',
    label: n => `${n} open support ticket${n === 1 ? '' : 's'}` },
  { key: 'samples_review', tone: 'fit', to: '/admin/design/samples',
    label: n => `${n} sample${n === 1 ? '' : 's'} awaiting review` },
  { key: 'restock_pending', tone: 'pending', to: '/admin/procurement/restock',
    label: n => `${n} restock request${n === 1 ? '' : 's'} pending` },
];

export const ActionInbox: React.FC = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = React.useState<NavCounts | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = () => navCountsApi.get().then(c => { if (alive) setCounts(c); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (counts === null) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>Needs you today</div>
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
      </div>
    );
  }

  const active = ITEMS.filter(it => (counts[it.key] ?? 0) > 0);

  // [PEN-38-3] An account with NO capabilities has an empty inbox for a reason
  // that has nothing to do with the business being quiet. It was shown a green
  // tick and "All clear — nothing needs you right now ✓", beside copy pointing at
  // a nav with one item, with no statement that the account has no role, no
  // "awaiting approval", no next step and nobody to contact. The brief asks that a
  // zero-capability account be told the truth; a tick is the opposite of it.
  //
  // This is the same failure-as-emptiness family as the rest of RC-3 — except
  // here the thing being misreported is the account's own status.
  const hasNoRole = getAdminCapabilities().length === 0;

  return (
    <div className={styles.card}>
      <div className={styles.header}>{hasNoRole ? 'Your account' : 'Needs you today'}</div>
      {hasNoRole ? (
        <div className={styles.pending}>
          <strong>Your account is awaiting a role.</strong>
          <div>
            A super admin needs to assign one before you can use the console. Until then the
            navigation is empty because nothing has been granted to you — not because there is
            nothing to do.
          </div>
        </div>
      ) : active.length === 0 ? (
        <div className={styles.clear}>All clear — nothing needs you right now ✓</div>
      ) : (
        <div className={styles.list}>
          {active.map(it => (
            <button key={it.key} className={styles.row} onClick={() => navigate(it.to)}>
              <span className={`${styles.dot} ${styles[`dot-${it.tone}`]}`} />
              <span className={styles.label}>{it.label(counts[it.key] as number)}</span>
              <span className={styles.arrow}>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionInbox;
