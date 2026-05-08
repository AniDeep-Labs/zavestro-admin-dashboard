import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, Check, MessageSquare, UserCheck, PauseCircle,
  FileText, Scissors, ShieldCheck,
} from 'lucide-react';
import { ordersApi, invoicesApi } from '../../api/adminApi';
import type { AdminOrder, OrderStage, OrderTimelineEntry } from '../../api/adminApi';
import { StaffAssignmentDropdown } from '../../components/StaffAssignmentDropdown/StaffAssignmentDropdown';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './OrderDetailPage.module.css';

// ── Stage stepper config ─────────────────────────────────────────────────────

const STAGES: { key: OrderStage; label: string }[] = [
  { key: 'payment_pending',    label: 'Payment\nPending' },
  { key: 'payment_confirmed',  label: 'Payment\nConfirmed' },
  { key: 'fabric_sourced',     label: 'Fabric\nSourced' },
  { key: 'in_tailoring',       label: 'In\nTailoring' },
  { key: 'quality_check',      label: 'Quality\nCheck' },
  { key: 'ready_to_dispatch',  label: 'Ready to\nDispatch' },
  { key: 'dispatched',         label: 'Dispatched' },
  { key: 'delivered',          label: 'Delivered' },
];

const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.key, i])) as Record<string, number>;

// ── Timeline helpers ─────────────────────────────────────────────────────────

function timelineClass(eventType?: string): string {
  switch (eventType) {
    case 'note':       return styles.timelineNote;
    case 'assignment': return styles.timelineAssign;
    case 'hold':       return styles.timelineHold;
    case 'admin_override': return styles.timelineAdmin;
    default:           return '';
  }
}

function timelineIcon(eventType?: string) {
  switch (eventType) {
    case 'note':           return <MessageSquare size={13} />;
    case 'assignment':     return <UserCheck size={13} />;
    case 'hold':           return <PauseCircle size={13} />;
    case 'admin_override': return <FileText size={13} />;
    default:               return <Check size={13} />;
  }
}

function timelineText(entry: OrderTimelineEntry): string {
  const et = entry.event_type ?? 'stage_change';
  if (et === 'note') return entry.note ?? 'Note added';
  if (et === 'assignment') return entry.note ?? 'Staff assigned';
  if (et === 'hold') return entry.note ? `On hold: ${entry.note}` : 'Order placed on hold';
  return `Stage → ${entry.to_stage.replace(/_/g, ' ')}${entry.note ? ` — ${entry.note}` : ''}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = React.useState<AdminOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Override modal
  const [showOverrideModal, setShowOverrideModal] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState('');
  const [overrideStage, setOverrideStage] = React.useState('');
  const [overrideChecks, setOverrideChecks] = React.useState([false, false]);
  const [overriding, setOverriding] = React.useState(false);

  // Invoice
  const [invoiceLoading, setInvoiceLoading] = React.useState(false);
  const [invoiceGenerating, setInvoiceGenerating] = React.useState(false);

  // Staff assignment
  const [assigningCraft, setAssigningCraft] = React.useState(false);
  const [assigningQC, setAssigningQC] = React.useState(false);

  // Note entry
  const [noteText, setNoteText] = React.useState('');
  const [addingNote, setAddingNote] = React.useState(false);

  // Delivery date inline edit
  const [editingDelivery, setEditingDelivery] = React.useState(false);
  const [deliveryDate, setDeliveryDate] = React.useState('');
  const [savingDelivery, setSavingDelivery] = React.useState(false);

  // Hold reason inline edit
  const [editingHold, setEditingHold] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState('');
  const [savingHold, setSavingHold] = React.useState(false);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(order ? `Order ${order.reference_id ?? order.id}` : undefined);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    ordersApi.get(id)
      .then(o => {
        setOrder(o);
        setDeliveryDate(o.estimated_delivery_date ?? '');
        setHoldReason(o.on_hold_reason ?? '');
      })
      .catch(e => showToast('error', 'Failed to load order', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const reload = () => {
    if (!id) return;
    ordersApi.get(id).then(o => {
      setOrder(o);
      setDeliveryDate(o.estimated_delivery_date ?? '');
      setHoldReason(o.on_hold_reason ?? '');
    }).catch(() => {});
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOverride = async () => {
    if (!order || !overrideStage) return;
    setOverriding(true);
    try {
      const { stage, status } = await ordersApi.updateStage(order.uuid ?? order.id, overrideStage as OrderStage, overrideReason);
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

  const handleGenerateInvoice = async () => {
    if (!order) return;
    setInvoiceGenerating(true);
    try {
      await invoicesApi.generateForOrder(order.uuid ?? order.id);
      showToast('success', 'Invoice queued', 'Invoice generation queued. It will appear on the Invoices page shortly.');
    } catch (e) {
      showToast('error', 'Invoice error', e instanceof Error ? e.message : undefined);
    } finally {
      setInvoiceGenerating(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setInvoiceLoading(true);
    try {
      const { invoices } = await invoicesApi.list({ orderId: order.uuid ?? order.id, limit: 1 });
      if (invoices.length === 0 || invoices[0].status !== 'generated') {
        showToast('info', 'No invoice ready', 'Use "Generate Invoice" first.');
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

  const handleAssignCraft = async (staffId: string | null) => {
    if (!order) return;
    setAssigningCraft(true);
    try {
      await ordersApi.assignCraftsperson(order.uuid ?? order.id, staffId);
      setOrder(prev => prev ? { ...prev, craftsperson_id: staffId } : prev);
      showToast('success', staffId ? 'Craftsperson assigned' : 'Craftsperson unassigned');
      reload();
    } catch (e) {
      showToast('error', 'Assignment failed', e instanceof Error ? e.message : undefined);
    } finally {
      setAssigningCraft(false);
    }
  };

  const handleAssignQC = async (staffId: string | null) => {
    if (!order) return;
    setAssigningQC(true);
    try {
      await ordersApi.assignQCStaff(order.uuid ?? order.id, staffId);
      setOrder(prev => prev ? { ...prev, qc_staff_id: staffId } : prev);
      showToast('success', staffId ? 'QC staff assigned' : 'QC staff unassigned');
      reload();
    } catch (e) {
      showToast('error', 'Assignment failed', e instanceof Error ? e.message : undefined);
    } finally {
      setAssigningQC(false);
    }
  };

  const handleAddNote = async () => {
    if (!order || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const entry = await ordersApi.addTimelineNote(order.uuid ?? order.id, noteText.trim());
      setOrder(prev => prev ? { ...prev, timeline: [entry, ...(prev.timeline ?? [])] } : prev);
      setNoteText('');
      showToast('success', 'Note added');
    } catch (e) {
      showToast('error', 'Failed to add note', e instanceof Error ? e.message : undefined);
    } finally {
      setAddingNote(false);
    }
  };

  const handleSaveDelivery = async () => {
    if (!order) return;
    setSavingDelivery(true);
    try {
      await ordersApi.updateLifecycle(order.uuid ?? order.id, { estimated_delivery_date: deliveryDate || null });
      setOrder(prev => prev ? { ...prev, estimated_delivery_date: deliveryDate || null } : prev);
      setEditingDelivery(false);
      showToast('success', 'Delivery date updated');
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleSaveHold = async () => {
    if (!order) return;
    setSavingHold(true);
    try {
      await ordersApi.updateLifecycle(order.uuid ?? order.id, { on_hold_reason: holdReason || null });
      setOrder(prev => prev ? { ...prev, on_hold_reason: holdReason || null } : prev);
      setEditingHold(false);
      showToast('success', holdReason ? 'Hold reason saved' : 'Hold cleared');
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSavingHold(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.page}><div className={styles.loadingMsg}>Loading order…</div></div>;
  if (!order) return <div className={styles.page}><div className={styles.loadingMsg}>Order not found.</div></div>;

  const currentIdx = STAGE_IDX[order.stage] ?? -1;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/orders')}>
        <ChevronLeft size={15} /> Back to Orders
      </button>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.orderHeader}>
          <div>
            <div className={styles.orderId}>
              {order.id}
              {order.reference_id && <span className={styles.refBadge}>{order.reference_id}</span>}
            </div>
            <div className={styles.orderMeta}>
              Created {order.created}
              {order.customer_ref && (
                <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, background: 'var(--color-bg-secondary)', padding: '1px 5px', borderRadius: 3 }}>
                  {order.customer_ref}
                </span>
              )}
            </div>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.pill} ${styles.pillGreen}`}>{order.mode}</span>
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

      {/* ── Stage stepper ───────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Order Stage</h3>
        <div className={styles.stepper}>
          {STAGES.map((s, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            return (
              <div key={s.key} className={`${styles.stepperItem} ${done ? styles.stepDone : ''} ${current ? styles.stepCurrent : ''}`}>
                <div className={styles.stepCircle}>
                  {done ? <Check size={13} /> : <span>{i + 1}</span>}
                </div>
                <div className={styles.stepLabel}>{s.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={styles.actionBtn} style={{ height: 36, fontSize: 13 }} onClick={() => setShowOverrideModal(true)}>
            Override Stage
          </button>
          <div className={styles.statusRow} style={{ border: 'none', padding: 0, marginLeft: 4 }}>
            <span className={styles.metaLabel} style={{ marginRight: 6 }}>Hub:</span>
            <span className={styles.metaValue}>{order.hub}</span>
          </div>
          {order.on_hold_reason && (
            <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: 'rgba(201,153,94,0.15)', color: '#9A6B3A', fontWeight: 600 }}>
              ⏸ On Hold
            </span>
          )}
        </div>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.main}>

          {/* ── Items ────────────────────────────────────────────────────────── */}
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
                    <tr key={i}><td>{p}</td><td>1</td><td>—</td><td>—</td></tr>
                  ))
                }
              </tbody>
            </table>
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-border-light)', marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <div>
                <span className={styles.metaLabel} style={{ marginRight: 8 }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* ── Staff Assignments ─────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Staff Assignments</h3>
            <div className={styles.assignRow}>
              <div>
                <div className={styles.assignLabel}><Scissors size={11} style={{ display: 'inline', marginRight: 4 }} />Craftsperson</div>
                <StaffAssignmentDropdown
                  value={order.craftsperson_id ?? null}
                  onChange={handleAssignCraft}
                  hubId={order.hub_id ?? undefined}
                  showWorkload
                  filterRoles={['tailor', 'cutter', 'finisher']}
                  disabled={assigningCraft}
                  placeholder="Assign craftsperson…"
                />
                {order.craftsperson_name && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    {order.craftsperson_role} {order.craftsperson_ref && <span style={{ fontFamily: 'monospace' }}>{order.craftsperson_ref}</span>}
                  </div>
                )}
              </div>
              <div>
                <div className={styles.assignLabel}><ShieldCheck size={11} style={{ display: 'inline', marginRight: 4 }} />QC Staff</div>
                <StaffAssignmentDropdown
                  value={order.qc_staff_id ?? null}
                  onChange={handleAssignQC}
                  hubId={order.hub_id ?? undefined}
                  showWorkload
                  filterRoles={['quality_checker']}
                  disabled={assigningQC}
                  placeholder="Assign QC staff…"
                />
                {order.qc_staff_name && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    {order.qc_staff_role} {order.qc_staff_ref && <span style={{ fontFamily: 'monospace' }}>{order.qc_staff_ref}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Linked Entities ───────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Linked Bookings</h3>
            <div className={styles.linkedGrid}>
              <div className={styles.linkedCard}>
                <div className={styles.linkedType}>Measurement Booking</div>
                {order.linked_measurement_booking_id ? (
                  <>
                    <div className={styles.linkedRef}>{order.linked_measurement_booking_ref ?? order.linked_measurement_booking_id.slice(0, 8)}</div>
                    <button
                      className={styles.linkBtn}
                      onClick={() => navigate(`/admin/measurement-bookings/${order.linked_measurement_booking_id}`)}
                    >
                      View →
                    </button>
                  </>
                ) : (
                  <div className={styles.linkedNone}>Not linked</div>
                )}
              </div>
              <div className={styles.linkedCard}>
                <div className={styles.linkedType}>Home Visit</div>
                {order.linked_home_visit_id ? (
                  <>
                    <div className={styles.linkedRef}>{order.linked_home_visit_ref ?? order.linked_home_visit_id.slice(0, 8)}</div>
                    <button
                      className={styles.linkBtn}
                      onClick={() => navigate(`/admin/home-visits/${order.linked_home_visit_id}`)}
                    >
                      View →
                    </button>
                  </>
                ) : (
                  <div className={styles.linkedNone}>Not linked</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Activity Timeline ─────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Order Journey</h3>
            <div className={styles.timeline}>
              {(order.timeline ?? []).length > 0
                ? (order.timeline ?? []).map((entry, i) => (
                  <div key={entry.id ?? i} className={`${styles.timelineEntry} ${timelineClass(entry.event_type)}`}>
                    <div className={styles.timelineDot}>{timelineIcon(entry.event_type)}</div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineText}>{timelineText(entry)}</div>
                      <div className={styles.timelineMeta}>
                        {new Date(entry.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {entry.changed_by_email && (
                          <span className={styles.timelineBy}> · {entry.changed_by_email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
                : <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>No stage transitions yet.</div>
              }
            </div>
            <div className={styles.noteForm}>
              <input
                className={styles.noteInput}
                placeholder="Add a note to the timeline…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
              />
              <button className={styles.noteSubmit} disabled={!noteText.trim() || addingNote} onClick={handleAddNote}>
                {addingNote ? '…' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* ── Payment ───────────────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Payment</h3>
            {(order.payments ?? []).length === 0 ? (
              <div className={styles.paymentGrid}>
                <div><div className={styles.metaLabel}>Amount</div><div className={styles.metaValue}>₹{order.total.toLocaleString('en-IN')}</div></div>
                <div><div className={styles.metaLabel}>Status</div><div className={styles.metaValue}><span className={styles.captured}>pending</span></div></div>
              </div>
            ) : (order.payments ?? []).map((p, i) => (
              <div key={p.id ?? i} className={styles.paymentGrid}>
                <div><div className={styles.metaLabel}>Method</div><div className={styles.metaValue}>{p.payment_method ?? '—'}</div></div>
                <div><div className={styles.metaLabel}>Amount</div><div className={styles.metaValue}>₹{parseFloat(String(p.amount)).toLocaleString('en-IN')}</div></div>
                {p.payment_gateway_id && <div><div className={styles.metaLabel}>Payment ID</div><div className={styles.metaValue}>{p.payment_gateway_id}</div></div>}
                <div><div className={styles.metaLabel}>Status</div><div className={styles.metaValue}><span className={styles.captured}>{p.status}</span></div></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        <div className={styles.sidebar}>

          {/* Delivery Date */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Delivery</h3>
            <div style={{ marginBottom: 10 }}>
              <div className={styles.metaLabel}>Est. Delivery Date</div>
              {editingDelivery ? (
                <div className={styles.inlineEdit}>
                  <input
                    type="date"
                    className={styles.inlineInput}
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                  />
                  <button className={styles.inlineSave} disabled={savingDelivery} onClick={handleSaveDelivery}>
                    {savingDelivery ? '…' : 'Save'}
                  </button>
                  <button className={styles.actionBtnSecondary} style={{ height: 34, padding: '0 10px', fontSize: 12 }} onClick={() => { setEditingDelivery(false); setDeliveryDate(order.estimated_delivery_date ?? ''); }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className={styles.inlineEdit}>
                  <span className={styles.metaValue}>{order.estimated_delivery_date ?? '—'}</span>
                  <button className={styles.linkBtn} onClick={() => setEditingDelivery(true)}>Edit</button>
                </div>
              )}
            </div>
            <div>
              <div className={styles.metaLabel}>On Hold Reason</div>
              {editingHold ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    className={styles.fieldTextarea}
                    rows={2}
                    placeholder="Reason for hold (leave empty to clear)…"
                    value={holdReason}
                    onChange={e => setHoldReason(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={styles.inlineSave} disabled={savingHold} onClick={handleSaveHold}>
                      {savingHold ? '…' : 'Save'}
                    </button>
                    <button className={styles.actionBtnSecondary} style={{ height: 34, padding: '0 10px', fontSize: 12 }} onClick={() => { setEditingHold(false); setHoldReason(order.on_hold_reason ?? ''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.inlineEdit}>
                  <span className={styles.metaValue} style={{ color: order.on_hold_reason ? '#9A6B3A' : 'var(--color-text-tertiary)', fontSize: 13 }}>
                    {order.on_hold_reason ?? 'Not on hold'}
                  </span>
                  <button className={styles.linkBtn} onClick={() => setEditingHold(true)}>Edit</button>
                </div>
              )}
            </div>
          </div>

          {/* Admin Actions */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Admin Actions</h3>
            <div className={styles.actionList}>
              <button className={styles.overrideBtn} onClick={() => setShowOverrideModal(true)}>Override Status</button>
              <button className={styles.actionBtnSecondary} disabled={invoiceGenerating} onClick={handleGenerateInvoice}>
                {invoiceGenerating ? 'Queuing…' : 'Generate Invoice'}
              </button>
              <button className={styles.actionBtnSecondary} disabled={invoiceLoading} onClick={handleDownloadInvoice}>
                {invoiceLoading ? 'Loading…' : 'Download Invoice'}
              </button>
              <button className={styles.cancelBtn}>Cancel Order</button>
            </div>
          </div>

          {/* Cancellation reason */}
          {order.cancellation_reason && (
            <div className={styles.card}>
              <h3 className={styles.sectionTitle} style={{ color: 'var(--color-error)' }}>Cancellation</h3>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{order.cancellation_reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Override modal ──────────────────────────────────────────────────── */}
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
                {STAGES.map(s => (
                  <option key={s.key} value={s.key}>{s.label.replace('\n', ' ')}</option>
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
