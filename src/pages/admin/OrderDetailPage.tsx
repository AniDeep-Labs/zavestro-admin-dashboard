import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/adminApi';
import type { AdminOrder, OrderStage } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrderDetailPage.module.css';

const TIMELINE_MOCK = [
  { icon: '🛒', text: 'Order created by customer', time: 'Apr 13, 2:14 PM', actor: 'Customer' },
  { icon: '💳', text: 'Payment confirmed', time: 'Apr 13, 2:15 PM', actor: 'System' },
  { icon: '🧵', text: 'Assigned to tailor', time: 'Apr 14, 10:30 AM', actor: 'Hub Manager' },
  { icon: '✂️', text: 'Stage: fabric_sourced → in_tailoring', time: 'Apr 14, 10:31 AM', actor: 'Tailor' },
  { icon: '✅', text: 'QC Pass', time: 'Apr 18, 3:45 PM', actor: 'QC Staff' },
];

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = React.useState<AdminOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [showOverrideModal, setShowOverrideModal] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState('');
  const [overrideStage, setOverrideStage] = React.useState('');
  const [overrideChecks, setOverrideChecks] = React.useState([false, false]);
  const [overriding, setOverriding] = React.useState(false);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    ordersApi.get(id)
      .then(setOrder)
      .catch(e => showToast('error', 'Failed to load order', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const handleOverride = async () => {
    if (!order || !overrideStage) return;
    setOverriding(true);
    try {
      const updated = await ordersApi.updateStage(order.id, overrideStage as OrderStage, overrideReason);
      setOrder(updated);
      setShowOverrideModal(false);
      setOverrideReason(''); setOverrideStage(''); setOverrideChecks([false, false]);
      showToast('success', 'Stage updated', `Order moved to ${overrideStage.replace(/_/g, ' ')}`);
    } catch (e) {
      showToast('error', 'Override failed', e instanceof Error ? e.message : undefined);
    } finally {
      setOverriding(false);
    }
  };

  if (loading) return <div className={styles.page}><div className={styles.loadingMsg}>Loading order…</div></div>;
  if (!order) return <div className={styles.page}><div className={styles.loadingMsg}>Order not found.</div></div>;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/orders')}>← Back to Orders</button>

      <div className={styles.twoCol}>
        {/* Left: detail */}
        <div className={styles.main}>
          {/* Order summary */}
          <div className={styles.card}>
            <div className={styles.orderHeader}>
              <div>
                <div className={styles.orderId}>{order.id}</div>
                <div className={styles.orderMeta}>
                  Created {order.created} · Last updated: just now
                </div>
              </div>
              <div className={styles.badges}>
                <span className={`${styles.pill} ${order.mode === 'Luxe' ? styles.pillGold : styles.pillGreen}`}>{order.mode}</span>
                <span className={`${styles.statusPill} ${styles[`status-${order.status}`]}`}>{order.status}</span>
              </div>
            </div>
            <div className={styles.customerRow}>
              <span className={styles.customerLabel}>Customer</span>
              <span className={styles.customerName}>{order.customer}</span>
              <span className={styles.customerPhone}>{order.phone}</span>
              <button className={styles.linkBtn} onClick={() => navigate('/admin/users')}>View Profile →</button>
            </div>
          </div>

          {/* Items */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Items</h3>
            <table className={styles.itemsTable}>
              <thead>
                <tr><th>Product</th><th>Variant</th><th>Qty</th><th>Total</th></tr>
              </thead>
              <tbody>
                {order.products.map((p, i) => (
                  <tr key={i}>
                    <td>{p}</td>
                    <td>Navy Blue · Cotton</td>
                    <td>1</td>
                    <td>₹{Math.floor(order.total / order.products.length).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.profileNote}>Fit profile: Self · Shirt category · v2</div>
          </div>

          {/* Timeline */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Order Journey</h3>
            <div className={styles.timeline}>
              {TIMELINE_MOCK.map((entry, i) => (
                <div key={i} className={styles.timelineEntry}>
                  <div className={styles.timelineDot}>{entry.icon}</div>
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineText}>{entry.text}</div>
                    <div className={styles.timelineMeta}>{entry.time} · {entry.actor}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Payment</h3>
            <div className={styles.paymentGrid}>
              <div><div className={styles.metaLabel}>Method</div><div className={styles.metaValue}>UPI · Google Pay</div></div>
              <div><div className={styles.metaLabel}>Amount</div><div className={styles.metaValue}>₹{order.total.toLocaleString()}</div></div>
              <div><div className={styles.metaLabel}>Payment ID</div><div className={styles.metaValue}>pay_QFxXXXXX</div></div>
              <div><div className={styles.metaLabel}>Status</div><div className={styles.metaValue}><span className={styles.captured}>captured</span></div></div>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Current Status</h3>
            <div className={styles.statusRow}>
              <div className={styles.metaLabel}>Stage</div>
              <div className={styles.metaValue}>{order.stage.replace(/_/g, ' ')}</div>
            </div>
            <div className={styles.statusRow}>
              <div className={styles.metaLabel}>Hub</div>
              <div className={styles.metaValue}>{order.hub}</div>
            </div>
            <div className={styles.statusRow}>
              <div className={styles.metaLabel}>Tailor</div>
              <div className={styles.metaValue}>Rajan K.</div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Admin Actions</h3>
            <div className={styles.actionList}>
              <button className={styles.overrideBtn} onClick={() => setShowOverrideModal(true)}>Override Status</button>
              <button className={styles.actionBtnSecondary}>Reassign Hub</button>
              <button className={styles.actionBtnSecondary}>Download Invoice</button>
              <button className={styles.cancelBtn}>Cancel Order</button>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Audit Trail</h3>
            <div className={styles.auditList}>
              <div className={styles.auditEntry}>Status set to active · admin@zavestro.com · 1h ago</div>
              <div className={styles.auditEntry}>Hub reassigned · admin_ops@zavestro.com · 2h ago</div>
            </div>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/system/audit')}>View full audit →</button>
          </div>
        </div>
      </div>

      {/* Override modal */}
      {showOverrideModal && (
        <div className={styles.modalOverlay} onClick={() => setShowOverrideModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Override Order Status</h3>
            <div className={styles.warningBanner}>
              ⚠ Manual overrides bypass normal validation. They are logged in the audit trail with your admin ID.
            </div>
            <div className={styles.currentStatus}>
              <span>Current Stage: <strong>{order.stage}</strong></span>
              <span>Lifecycle: <strong>{order.status}</strong></span>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Override to (Stage)</label>
              <select className={styles.fieldSelect} value={overrideStage} onChange={e => setOverrideStage(e.target.value)}>
                <option value="">Select stage…</option>
                {['payment_pending', 'payment_confirmed', 'fabric_sourced', 'in_tailoring', 'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason (required, min 20 chars)</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="e.g., Courier confirmed delivery but webhook failed to update status."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.checkList}>
              {['I understand this action will be logged with my admin account', `I have verified this is the correct order (${order.id})`].map((label, i) => (
                <label key={i} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={overrideChecks[i]}
                    onChange={e => {
                      const next = [...overrideChecks];
                      next[i] = e.target.checked;
                      setOverrideChecks(next);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowOverrideModal(false)}>Cancel</button>
              <button
                className={styles.applyBtn}
                disabled={!overrideStage || overrideReason.length < 20 || !overrideChecks.every(Boolean) || overriding}
                onClick={handleOverride}
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
