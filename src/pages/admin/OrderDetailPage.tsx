import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ordersApi, invoicesApi } from '../../api/adminApi';
import type { AdminOrder, OrderStage } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrderDetailPage.module.css';

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
  const [invoiceLoading, setInvoiceLoading] = React.useState(false);

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

  const handleDownloadInvoice = async () => {
    if (!order) return;
    const orderId = order.uuid ?? order.id;
    setInvoiceLoading(true);
    try {
      const { invoices } = await invoicesApi.list({ orderId, limit: 1 });
      if (invoices.length === 0 || invoices[0].status !== 'generated') {
        await invoicesApi.generateForOrder(orderId);
        showToast('info', 'Invoice queued', 'Invoice is being generated. Check the Invoices page in a few moments.');
      } else {
        const { url } = await invoicesApi.getDownloadUrl(invoices[0].id);
        window.open(url, '_blank');
      }
    } catch (e) {
      showToast('error', 'Invoice error', e instanceof Error ? e.message : undefined);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!order || !overrideStage) return;
    setOverriding(true);
    try {
      const { stage, status } = await ordersApi.updateStage(order.id, overrideStage as OrderStage, overrideReason);
      setOrder(prev => prev ? { ...prev, stage, status } : prev);
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
      <button className={styles.backBtn} onClick={() => navigate('/admin/orders')}><ChevronLeft size={15}/> Back to Orders</button>

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
              {order.user_id && (
                <button className={styles.linkBtn} onClick={() => navigate(`/admin/users/${order.user_id}`)}>View Profile →</button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Items</h3>
            <table className={styles.itemsTable}>
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                {(order.items ?? []).length > 0
                  ? (order.items ?? []).map(it => (
                    <tr key={it.id}>
                      <td>{it.product_name}</td>
                      <td>{it.quantity}</td>
                      <td>₹{it.unit_price.toLocaleString('en-IN')}</td>
                      <td>₹{(it.quantity * it.unit_price).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                  : order.products.map((p, i) => (
                    <tr key={i}>
                      <td>{p}</td>
                      <td>1</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* Timeline */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Order Journey</h3>
            <div className={styles.timeline}>
              {(order.timeline ?? []).length > 0
                ? (order.timeline ?? []).map((entry, i) => (
                  <div key={entry.id ?? i} className={styles.timelineEntry}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineText}>
                        Stage: <strong>{entry.to_stage.replace(/_/g, ' ')}</strong>
                        {entry.note ? ` — ${entry.note}` : ''}
                      </div>
                      <div className={styles.timelineMeta}>
                        {new Date(entry.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
                : <div className={styles.timelineEntry} style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>No stage transitions yet.</div>
              }
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
              <button className={styles.actionBtnSecondary} disabled={invoiceLoading} onClick={handleDownloadInvoice}>
                {invoiceLoading ? 'Loading…' : 'Download Invoice'}
              </button>
              <button className={styles.cancelBtn}>Cancel Order</button>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Audit Trail</h3>
            <div className={styles.auditList}>
              <div className={styles.auditEntry}>Status set to active · admin@zavestro.in · 1h ago</div>
              <div className={styles.auditEntry}>Hub reassigned · admin_ops@zavestro.in · 2h ago</div>
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
