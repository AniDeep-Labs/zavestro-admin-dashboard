import React from 'react';
import { reviewsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { AdminReview } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
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
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

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

  const handleModerate = async (id: string, approve: boolean) => {
    setActionId(id);
    try {
      await reviewsApi.moderate(id, approve);
      setReviews(prev => prev.filter(r => r.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
      showToast('success', approve ? 'Review approved' : 'Review rejected');
    } catch (e) {
      showToast('error', 'Action failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActionId(null);
    }
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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
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
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>No pending reviews.</td>
                </tr>
              )
              : filtered.map(r => (
                <tr key={r.id} className={styles.row}>
                  <td><div className={styles.customerName}>{r.user_name}</div></td>
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
                      onClick={() => handleModerate(r.id, true)}
                      style={{ marginRight: 4, background: 'var(--green, #1F6B4F)', color: '#fff', border: 'none' }}
                    >
                      {actionId === r.id ? '…' : 'Approve'}
                    </button>
                    <button
                      className={styles.actionBtn}
                      disabled={actionId === r.id}
                      onClick={() => handleModerate(r.id, false)}
                      style={{ background: 'var(--color-error, #dc3545)', color: '#fff', border: 'none' }}
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
