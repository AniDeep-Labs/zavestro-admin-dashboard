import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { returnsApi } from '../../api/adminApi';
import type { ReturnRequest } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', under_review: 'Under Review',
};

export const ReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ret, setRet] = React.useState<ReturnRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [reviewStatus, setReviewStatus] = React.useState('approved');
  const [reviewNote, setReviewNote] = React.useState('');
  const [refundAmount, setRefundAmount] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!id) return;
    returnsApi.get(id)
      .then(setRet)
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReview = async () => {
    if (!ret) return;
    setSaving(true);
    try {
      const updated = await returnsApi.review(ret.id, {
        status: reviewStatus,
        review_note: reviewNote || undefined,
        refund_amount: refundAmount ? Number(refundAmount) : undefined,
      });
      setRet(updated);
      showToast('success', 'Return reviewed', `Status set to ${STATUS_LABELS[reviewStatus] ?? reviewStatus}`);
    } catch (e) {
      showToast('error', 'Review failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  if (loading) return <div className={styles.page}><div>Loading return…</div></div>;
  if (!ret) return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/returns')}><ChevronLeft size={15}/> Back</button>
      <div>Return not found.</div>
    </div>
  );

  const isReviewed = ret.status === 'approved' || ret.status === 'rejected';

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/returns')}><ChevronLeft size={15}/> Back to Returns</button>

      <div className={styles.twoCol}>
        <div className={styles.main}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Return Request</h2>
            <div className={styles.infoGrid}>
              <div><div className={styles.metaLabel}>Order</div><div className={styles.metaValue}>{ret.order_number}</div></div>
              <div><div className={styles.metaLabel}>Customer</div><div className={styles.metaValue}>{ret.customer_name}</div></div>
              <div><div className={styles.metaLabel}>Phone</div><div className={styles.metaValue}>{ret.customer_phone}</div></div>
              <div><div className={styles.metaLabel}>Current Status</div><div className={styles.metaValue}>{STATUS_LABELS[ret.status] ?? ret.status}</div></div>
              <div><div className={styles.metaLabel}>Submitted</div><div className={styles.metaValue}>{new Date(ret.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className={styles.metaLabel}>Reason</div>
              <div style={{ marginTop: 6, padding: '12px 14px', background: 'var(--color-bg-secondary)', borderRadius: 8, fontSize: 14 }}>{ret.reason}</div>
            </div>
            {ret.review_note && (
              <div style={{ marginTop: 12 }}>
                <div className={styles.metaLabel}>Review Note</div>
                <div style={{ marginTop: 6, padding: '12px 14px', background: 'var(--color-bg-secondary)', borderRadius: 8, fontSize: 14 }}>{ret.review_note}</div>
              </div>
            )}
          </div>

          {!isReviewed && (
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>Review Return</h3>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label className={styles.metaLabel}>Decision</label>
                  <select className={styles.fieldSelect} value={reviewStatus} onChange={e => setReviewStatus(e.target.value)}>
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                    <option value="under_review">Mark Under Review</option>
                  </select>
                </div>
                {reviewStatus === 'approved' && (
                  <div className={styles.field}>
                    <label className={styles.metaLabel}>Refund Amount (₹)</label>
                    <input className={styles.fieldInput} type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="Leave blank to refund full amount" />
                  </div>
                )}
                <div className={styles.field}>
                  <label className={styles.metaLabel}>Review Note</label>
                  <textarea className={styles.fieldTextarea} rows={3} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Optional note to the customer…" />
                </div>
                <button
                  className={styles.addBtn}
                  disabled={saving}
                  onClick={handleReview}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {saving ? 'Saving…' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
