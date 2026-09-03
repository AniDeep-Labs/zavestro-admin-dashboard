import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { returnsApi } from '../../api/adminApi';
import type { ReturnRequest } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import { StatusBadge, PolicyCard } from '../../components';
import { Can } from '../../components/Can/Can';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DispositionPanel } from '../../components/DispositionPanel/DispositionPanel';
import styles from './OrdersListPage.module.css';
import d from './ReturnDetailPage.module.css';
import { UilAngleLeft } from "@iconscout/react-unicons";

// T2-31: map a policy tone to its CSS-module class.
const toneClass = (tone: string) =>
  ({ success: 'toneSuccess', info: 'toneInfo', danger: 'toneDanger', neutral: 'toneNeutral' })[
    tone
  ] ?? 'toneNeutral';

export const ReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ret, setRet] = React.useState<ReturnRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [approving, setApproving] = React.useState(false);
  const [approveNote, setApproveNote] = React.useState('');
  const [refundAmt, setRefundAmt] = React.useState(''); // G-54(A): blank = full refund
  const [showApproveConfirm, setShowApproveConfirm] = React.useState(false); // T1-24
  // [SUP-31-6] Raising the free alteration a fit return is owed.
  const [altDescription, setAltDescription] = React.useState('');
  const [altNote, setAltNote] = React.useState('');
  const [raisingAlt, setRaisingAlt] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(ret ? `Return – ${ret.order_number}` : undefined);

  React.useEffect(() => {
    if (!id) return;
    returnsApi.get(id)
      .then(setRet)
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  // T1-24 (F-6): a refund is real money — validate, then require a confirm (amount +
  // destination), matching RefundsPage. No more one-click approve.
  const openApproveConfirm = () => {
    if (!ret) return;
    const payable = Number(ret.payable_amount ?? 0);
    const amt = refundAmt.trim() ? Number(refundAmt) : undefined;
    if (amt !== undefined && (!Number.isFinite(amt) || amt <= 0 || amt > payable)) {
      showToast('error', 'Invalid amount', `Enter an amount between ₹0 and the order total ₹${payable}, or leave blank for a full refund.`);
      return;
    }
    setShowApproveConfirm(true);
  };

  const handleApprove = async () => {
    if (!ret) return;
    const payable = Number(ret.payable_amount ?? 0);
    const amt = refundAmt.trim() ? Number(refundAmt) : undefined;
    if (amt !== undefined && (!Number.isFinite(amt) || amt <= 0 || amt > payable)) {
      showToast('error', 'Invalid amount', `Enter an amount between ₹0 and the order total ₹${payable}, or leave blank for a full refund.`);
      return;
    }
    setApproving(true);
    try {
      await returnsApi.approve(ret.id, approveNote.trim() || undefined, amt);
      showToast('success', 'Refund initiated', amt && amt < payable ? `Partial refund of ₹${amt} initiated.` : 'Full refund initiated to the original payment method.');
      const fresh = await returnsApi.get(ret.id);
      setRet(fresh);
      setApproveNote('');
      setRefundAmt('');
      setShowApproveConfirm(false);
    } catch (e) {
      showToast('error', 'Could not approve', e instanceof Error ? e.message : undefined);
    } finally {
      setApproving(false);
    }
  };

  if (loading) return <div className={styles.page}><div>Loading return…</div></div>;
  if (!ret) return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/returns')}><UilAngleLeft size={15}/> Back</button>
      <div>Return not found.</div>
    </div>
  );

  // [SUP-31-6] A fit return is not a refund conversation at all. `returnOutcomeFor`
  // routes `wrong_measurements` to a free alteration, and the whole Refund card used to
  // fall through to "Awaiting ops inspection" — copy about money that is never coming.
  const isAlterationPolicy = ret.policy_verdict?.outcome === 'alteration';
  const alterationDone = !!ret.linked_alteration;
  const returnClosed = ['completed', 'rejected', 'defect_rejected', 'refunded'].includes(
    ret.status,
  );

  const raiseAlteration = async () => {
    if (!id || !altDescription.trim() || raisingAlt) return;
    setRaisingAlt(true);
    try {
      const r = await returnsApi.resolveWithAlteration(id, {
        description: altDescription.trim(),
        note: altNote.trim() || undefined,
      });
      setRet(await returnsApi.get(id));
      setAltDescription('');
      setAltNote('');
      showToast(
        'success',
        'Free alteration raised',
        r.fee_status === 'free' || r.fee_status === 'waived'
          ? 'The return is closed and the garment pickup is queued. No fee to the customer.'
          : `The return is closed and the pickup is queued. Fee status: ${r.fee_status}.`,
      );
    } catch (e) {
      showToast('error', 'Could not raise the alteration', e instanceof Error ? e.message : undefined);
    } finally {
      setRaisingAlt(false);
    }
  };

  const refundDone = ret.status === 'refund_initiated' || ret.status === 'refunded';
  const rejected = ret.status === 'defect_rejected' || ret.status === 'rejected';
  const awaitingApproval = ret.status === 'defect_confirmed';
  const payable = Number(ret.payable_amount ?? 0);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/returns')}><UilAngleLeft size={15}/> Back to Returns</button>

      <div className={styles.twoCol}>
        <div className={styles.main}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Return Request</h2>
            <div className={styles.infoGrid}>
              <div><div className={styles.metaLabel}>Order</div><div className={styles.metaValue}>{ret.order_number}</div></div>
              <div><div className={styles.metaLabel}>Customer</div><div className={styles.metaValue}>{ret.customer_name}</div></div>
              <div><div className={styles.metaLabel}>Phone</div><div className={styles.metaValue}>{ret.customer_phone}</div></div>
              <div><div className={styles.metaLabel}>Status</div><div className={styles.metaValue}><StatusBadge status={ret.status} /></div></div>
              <div><div className={styles.metaLabel}>Submitted</div><div className={styles.metaValue}>{new Date(ret.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
            </div>
            {/* T2-31 (SP-4): the policy verdict — what the brand owes on this return, so
                support enforces the written policy instead of improvising. */}
            {ret.policy_verdict && (
              <div className={d.policyBanner}>
                <span className={`${d.policyChip} ${d[toneClass(ret.policy_verdict.tone)]}`}>
                  {ret.policy_verdict.label}
                </span>
                <div className={d.policyBody}>
                  <span className={d.policyLabel}>Policy</span>
                  <span className={d.policyDetail}>{ret.policy_verdict.detail}</span>
                </div>
              </div>
            )}
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

          {/* [SUP-31-6] Fit returns are settled with a free alteration, not money, so
              they get the card that matches their policy instead of refund copy. */}
          {isAlterationPolicy ? (
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>Free alteration</h3>
              {alterationDone ? (
                <div className={styles.fields}>
                  <p className={d.refundDone}>
                    <StatusBadge status={ret.linked_alteration!.status} />
                    &nbsp;This return was settled with a free alteration.
                  </p>
                  <div>
                    <div className={styles.metaLabel}>What we are altering</div>
                    <div className={d.refundNote}>{ret.linked_alteration!.description}</div>
                  </div>
                  <div>
                    <div className={styles.metaLabel}>Charge to the customer</div>
                    <div className={d.refundNote}>
                      {ret.linked_alteration!.fee_status === 'free' ||
                      ret.linked_alteration!.fee_status === 'waived'
                        ? 'None — covered by the fit policy.'
                        : `₹${ret.linked_alteration!.fee_amount ?? 0} (${ret.linked_alteration!.fee_status})`}
                    </div>
                  </div>
                  <button
                    className={`${styles.addBtn} ${d.cardAction}`}
                    // [SUP-31-8] The list's peek drawer, deep-linked. There is no
                    // /admin/alterations/:id route — a plain link there is a dead one.
                    onClick={() =>
                      navigate(`/admin/alterations?peek=${ret.linked_alteration!.id}`)
                    }
                  >
                    Open the alteration
                  </button>
                </div>
              ) : returnClosed ? (
                <p className={d.refundNote}>
                  This return is {ret.status} and no alteration is linked to it. If the customer
                  is still owed one, raise it from the order.
                </p>
              ) : (
                <Can
                  cap="orders:write"
                  fallback={
                    <p className={d.refundNote}>
                      The policy owes this customer a free alteration. A teammate with
                      orders:write can raise it here.
                    </p>
                  }
                >
                  <div className={styles.fields}>
                    <p className={d.refundNote}>
                      {ret.policy_verdict?.detail}&nbsp;Raising it books the garment pickup and
                      closes this return — the two used to be unconnected, so returns sat in
                      Needs action with no way out.
                    </p>
                    <div className={styles.field}>
                      <label className={styles.metaLabel}>What needs altering</label>
                      <textarea
                        className={styles.fieldTextarea}
                        rows={2}
                        value={altDescription}
                        onChange={e => setAltDescription(e.target.value)}
                        placeholder="e.g., Take in the waist by 2cm; shorten the sleeves by 1cm"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.metaLabel}>Note on the return (optional)</label>
                      <textarea
                        className={styles.fieldTextarea}
                        rows={2}
                        value={altNote}
                        onChange={e => setAltNote(e.target.value)}
                        placeholder="e.g., Customer confirmed the chest is fine, only the waist"
                      />
                    </div>
                    <button
                      className={`${styles.addBtn} ${d.cardAction}`}
                      disabled={raisingAlt || !altDescription.trim()}
                      onClick={raiseAlteration}
                    >
                      {raisingAlt ? 'Raising…' : 'Raise the free alteration & close this return'}
                    </button>
                  </div>
                </Can>
              )}
            </div>
          ) : (
          /* Refund — status-driven. A return is approved (and the refund initiated)
              only once ops has confirmed the defect; finance does the money action. */
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Refund</h3>

            {refundDone ? (
              <p className={d.refundDone}>
                <StatusBadge status={ret.status} /> &nbsp;Refund has been initiated to the original
                payment method. It settles via the payment provider.
              </p>
            ) : rejected ? (
              <p className={d.refundNote}>This return was rejected — no refund is due.</p>
            ) : awaitingApproval ? (
              <Can
                cap="refunds:approve"
                fallback={
                  <p className={d.refundNote}>
                    The defect is confirmed. A finance teammate (refunds:approve) approves the refund.
                  </p>
                }
              >
                <div className={styles.fields}>
                  <p className={d.refundNote}>
                    Ops has confirmed the defect. Approving initiates the refund to the customer's
                    original payment method.
                  </p>
                  <div className={styles.field}>
                    <label className={styles.metaLabel}>Refund amount (blank = full ₹{payable})</label>
                    <input
                      type="number" step="1" min="0" max={payable}
                      className={styles.fieldInput}
                      value={refundAmt}
                      onChange={e => setRefundAmt(e.target.value)}
                      placeholder={`Full refund: ₹${payable}`}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.metaLabel}>Note (optional)</label>
                    <textarea
                      className={styles.fieldTextarea}
                      rows={2}
                      value={approveNote}
                      onChange={e => setApproveNote(e.target.value)}
                      placeholder="e.g., Defect verified against photos; full refund due"
                    />
                  </div>
                  <button
                    className={styles.addBtn}
                    disabled={approving}
                    onClick={openApproveConfirm}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {approving ? 'Initiating…' : 'Approve & initiate refund'}
                  </button>
                </div>
              </Can>
            ) : (
              <p className={d.refundNote}>
                Awaiting ops inspection. Once the garment is picked up and the defect is confirmed,
                finance can approve the refund here.
              </p>
            )}
          </div>
          )}

          {/* T2-12: what happens to the returned made-for-one garment + the ₹ write-off */}
          <div className={styles.card}>
            <DispositionPanel orderId={ret.order_id} source="return" />
          </div>

          {/* T3-3 (W-S5): the policy written where the agent works (pairs with the verdict chip). */}
          <PolicyCard />
        </div>
      </div>

      {/* T1-24: confirm the money action (amount + destination), matching RefundsPage */}
      <ConfirmDialog
        open={showApproveConfirm}
        title="Approve & initiate refund?"
        message={
          <>
            Initiate a refund of{' '}
            <strong>₹{refundAmt.trim() ? Number(refundAmt) : Number(ret?.payable_amount ?? 0)}</strong>{' '}
            to <strong>{ret?.customer_name ?? 'the customer'}</strong> (order {ret?.order_number}) via
            their <strong>original payment method</strong> — never wallet. This can't be undone.
          </>
        }
        confirmLabel="Yes, initiate refund"
        loading={approving}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />
    </div>
  );
};
