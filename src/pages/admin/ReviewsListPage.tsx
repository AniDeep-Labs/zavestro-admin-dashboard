import React from 'react';
import { reviewsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { AdminReview } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useDialog } from '../../components/Modal/useDialog'; // [DSA-45-2]
import styles from './OrdersListPage.module.css';
import rs from './ReviewsListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilSearch, UilStar, UilTimes } from "@iconscout/react-unicons";

const LIMIT = 25;

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <UilStar
          key={i}
          size={13}
          fill={i < rating ? 'var(--color-gold, #D4A574)' : 'none'}
          stroke={i < rating ? 'var(--color-gold, #D4A574)' : 'var(--color-text-muted, #9A9188)'}
        />
      ))}
    </span>
  );
}

export const ReviewsListPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [reviews, setReviews] = React.useState<AdminReview[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = React.useState(false);
  // T2-36 (SP-5): reject-with-reason modal — holds the target review ids (single or bulk).
  const [rejectIds, setRejectIds] = React.useState<string[] | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const rejectDialog = useDialog(!!(rejectIds), () => setRejectIds(null), 'Reject review');

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    reviewsApi.listPending(page, LIMIT)
      .then(r => { setReviews(r.reviews); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = search
    ? reviews.filter(r =>
        r.user_name.toLowerCase().includes(search.toLowerCase()) ||
        r.product_name.toLowerCase().includes(search.toLowerCase())
      )
    : reviews;

  // Shared worker: moderate a set of ids. Only rows that SUCCEED leave the list; failed rows
  // stay put (and stay selected) so a partial bulk failure never makes rows silently vanish.
  const runModerate = async (ids: string[], approve: boolean, reason?: string) => {
    if (ids.length === 0) return;
    if (ids.length === 1) setActionId(ids[0]); else setBulkRunning(true);
    const done = new Set<string>();
    for (const id of ids) {
      try {
        await reviewsApi.moderate(id, approve, reason);
        done.add(id);
      } catch { /* keep going; failed rows remain visible */ }
    }
    setReviews(prev => prev.filter(r => !done.has(r.id)));
    setTotal(prev => Math.max(0, prev - done.size));
    setSelected(prev => { const n = new Set(prev); done.forEach(id => n.delete(id)); return n; });
    setActionId(null);
    setBulkRunning(false);
    const failed = ids.length - done.size;
    const verb = approve ? 'approved' : 'rejected';
    if (failed === 0) showToast('success', `${done.size} ${verb}`);
    else showToast('info', `${done.size}/${ids.length} ${verb}`, `${failed} failed and remain in the list.`);
  };

  const toggle = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected(prev => (prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id))));

  // A rejection needs a reason (T2-36 / SP-5): open the modal with the target ids (single or bulk).
  const openReject = (ids: string[]) => { if (ids.length) { setRejectIds(ids); setRejectReason(''); } };
  const confirmReject = async () => {
    if (!rejectIds) return;
    const ids = rejectIds;
    setRejectIds(null);
    await runModerate(ids, false, rejectReason.trim());
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Reviews</h1>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginLeft: 10 }}>
          Pending moderation
        </span>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search customer or product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setPage(1); }}>
          <UilTimes size={14} /> Clear
        </button>
      </div>

      {/* BulkBar (FABLE-ADMIN-UIUX §2.2) — appears on multi-select */}
      {selected.size > 0 && (
        <div className={rs.bulkBar}>
          <span className={rs.bulkCount}>{selected.size} selected</span>
          <button className={rs.bulkApprove} disabled={bulkRunning} onClick={() => runModerate([...selected], true)}>
            {bulkRunning ? 'Working…' : 'Approve selected'}
          </button>
          <button className={rs.bulkReject} disabled={bulkRunning} onClick={() => openReject([...selected])}>
            Reject selected
          </button>
          <button className={rs.bulkClear} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={rs.checkCol}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Customer</th>
              <th>Product</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Photos</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={8} className={styles.empty}>No pending reviews.</td>
                </tr>
              )
              : filtered.map(r => (
                <tr key={r.id} className={styles.row}>
                  <td className={rs.checkCol} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select review" />
                  </td>
                  <td>
                    <div className={styles.customerName}>{r.user_name}</div>
                    {/* T2-36 (SP-5): verified-purchase compliance artifact. */}
                    {r.verified_purchase && <span className={rs.verifiedChip}>✓ Verified purchase</span>}
                  </td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.product_name}
                  </td>
                  <td><StarRating rating={r.rating} /></td>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.comment ?? <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td>
                    {r.photo_keys.length > 0 ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.photo_keys.slice(0, 3).map(key => (
                          R2_PUBLIC_URL ? (
                            <a key={key} href={`${R2_PUBLIC_URL}/${key}`} target="_blank" rel="noopener noreferrer">
                              <img
                                src={`${R2_PUBLIC_URL}/${key}`}
                                alt="review"
                                style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border-light)' }}
                              />
                            </a>
                          ) : (
                            <span key={key} style={{ fontSize: 11, opacity: 0.6 }}>photo</span>
                          )
                        ))}
                        {r.photo_keys.length > 3 && (
                          <span style={{ fontSize: 11, alignSelf: 'center', opacity: 0.6 }}>
                            +{r.photo_keys.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ opacity: 0.35, fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td className={styles.date}>
                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className={styles.actionBtn}
                      disabled={actionId === r.id}
                      onClick={() => runModerate([r.id], true)}
                      style={{ marginRight: 4, background: 'var(--green, #1F6B4F)', color: '#fff', border: 'none' }}
                    >
                      {actionId === r.id ? '…' : 'Approve'}
                    </button>
                    <button
                      className={styles.actionBtn}
                      disabled={actionId === r.id}
                      onClick={() => openReject([r.id])}
                      style={{ background: 'var(--color-error, #D75B5B)', color: '#fff', border: 'none' }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* T2-36 (SP-5): reject-with-reason — required for single AND bulk (one shared reason). */}
      {rejectIds && (
        <div className={rs.modalOverlay} onClick={() => setRejectIds(null)}>
          <div className={rs.modal} {...rejectDialog.dialogProps} onClick={e => e.stopPropagation()}>
            <h3 className={rs.modalTitle}>
              Reject {rejectIds.length > 1 ? `${rejectIds.length} reviews` : 'review'}?
            </h3>
            <p className={rs.modalHint}>
              A reason is recorded with the rejection (compliance). The customer isn't shown this.
            </p>
            <textarea
              className={rs.reasonInput}
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Off-topic / abusive language / not about the product"
            />
            <div className={rs.modalActions}>
              <button className={styles.clearBtn} onClick={() => setRejectIds(null)}>Cancel</button>
              <button
                className={rs.bulkReject}
                disabled={!rejectReason.trim() || bulkRunning}
                onClick={confirmReject}
              >
                {bulkRunning ? 'Rejecting…' : 'Reject with reason'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>
          {loading ? 'Loading…' : `${total} pending review${total !== 1 ? 's' : ''}`}
        </span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
            <UilAngleLeft size={15} /> Prev
          </button>
          <span className={styles.pageIndicator}>Page {page} of {Math.max(1, Math.ceil(total / LIMIT))}</span>
          <button className={styles.pageBtn} disabled={reviews.length < LIMIT || loading} onClick={() => setPage(p => p + 1)}>
            Next <UilAngleRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
