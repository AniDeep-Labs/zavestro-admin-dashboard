import React from 'react';
import { Link } from 'react-router-dom';
import { codReconciliationApi, hubsApi } from '../../api/adminApi';
import type { CodDeposit, CodDepositOrder, CodReconciliationParams, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Modal } from '../../components/Modal/Modal';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { StatusBadge, PageHeader, EmptyState } from '../../components';
import { AgeCell } from '../../components/DataCells';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';
import ds from './DistributionPage.module.css';
import { UilImport, UilRefresh, UilTimes, UilAngleRight, UilAngleDown } from '@iconscout/react-unicons';
import { money } from '../../utils/money';

// ACP-2 [KA8-15]: one money formatter for the whole admin (src/utils/money.ts).
// This page declared its own; five pages did, every one different, producing four
// shapes of the same amount product-wide — two of them in the same table row.
const fmtINR = (n: number | null | undefined) => money(n);
// ACP-6 [KA11-6]: one date formatter for the admin.
import { fmtDate } from '../../utils/date';
const lagHours = (d: CodDeposit) =>
  ((d.finance_confirmed_at ? new Date(d.finance_confirmed_at) : new Date()).getTime() - new Date(d.created_at).getTime()) / 3_600_000;

export const CodReconciliationPage: React.FC = () => {
  const [hubId, setHubId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [deposits, setDeposits] = React.useState<CodDeposit[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // confirm modal (G-28/D19)
  const [confirmTarget, setConfirmTarget] = React.useState<CodDeposit | null>(null);
  const [countedAmount, setCountedAmount] = React.useState('');
  const [varianceReason, setVarianceReason] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);

  // resolve-variance modal
  const [resolveTarget, setResolveTarget] = React.useState<CodDeposit | null>(null);
  const [resolution, setResolution] = React.useState('');
  const [resolving, setResolving] = React.useState(false);

  // expandable orders-covered
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [ordersById, setOrdersById] = React.useState<Record<string, CodDepositOrder[]>>({});

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const params = (): CodReconciliationParams => ({
    hub_id: hubId || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  });

  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    codReconciliationApi
      .list(params())
      .then(setDeposits)
      .catch((e) => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId, startDate, endDate]);

  React.useEffect(load, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await codReconciliationApi.downloadCsv(params());
      showToast('success', 'Exported', 'CSV download started');
    } catch (e) {
      showToast('error', 'Export failed', e instanceof Error ? e.message : undefined);
    } finally { setExporting(false); }
  };

  const clearFilters = () => { setHubId(''); setStartDate(''); setEndDate(''); };

  const toggleOrders = (d: CodDeposit) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(d.id)) next.delete(d.id);
      else {
        next.add(d.id);
        if (!ordersById[d.id]) {
          codReconciliationApi.orders(d.id)
            .then((o) => setOrdersById((m) => ({ ...m, [d.id]: o })))
            .catch(() => setOrdersById((m) => ({ ...m, [d.id]: [] })));
        }
      }
      return next;
    });
  };

  const openConfirm = (d: CodDeposit) => {
    setConfirmTarget(d);
    setCountedAmount(String(d.total_amount));
    setVarianceReason('');
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const counted = Number(countedAmount);
    if (!Number.isFinite(counted) || counted < 0) { showToast('error', 'Enter the counted amount'); return; }
    const declared = Number(confirmTarget.total_amount);
    const hasVariance = Math.abs(counted - declared) >= 0.01;
    if (hasVariance && !varianceReason.trim()) {
      showToast('error', 'Variance reason required', `Counted ${fmtINR(counted)} ≠ declared ${fmtINR(declared)}`);
      return;
    }
    setConfirming(true);
    try {
      await codReconciliationApi.confirm(confirmTarget.id, counted, hasVariance ? varianceReason.trim() : undefined);
      showToast('success', 'Deposit confirmed', hasVariance ? `Variance recorded: ${fmtINR(counted - declared)} — now open until resolved` : undefined);
      setConfirmTarget(null);
      load();
    } catch (e) {
      showToast('error', 'Confirm failed', e instanceof Error ? e.message : undefined);
    } finally { setConfirming(false); }
  };

  const handleResolve = async () => {
    if (!resolveTarget || !resolution.trim()) { showToast('error', 'Enter how the variance was resolved'); return; }
    setResolving(true);
    try {
      await codReconciliationApi.resolveVariance(resolveTarget.id, resolution.trim());
      showToast('success', 'Variance resolved');
      setResolveTarget(null); setResolution('');
      load();
    } catch (e) {
      showToast('error', 'Resolve failed', e instanceof Error ? e.message : undefined);
    } finally { setResolving(false); }
  };

  const isVarianceOpen = (d: CodDeposit) => !!d.finance_confirmed_at && !!d.variance_reason && !d.variance_resolved_at;
  const awaiting = deposits.filter((d) => !d.finance_confirmed_at);
  const variancesOpen = deposits.filter(isVarianceOpen);
  const confirmed = deposits.filter((d) => d.finance_confirmed_at && (!d.variance_reason || d.variance_resolved_at));

  const outstanding = awaiting.reduce((sum, d) => sum + Number(d.total_amount), 0);
  const avgLagDays = deposits.length ? deposits.reduce((sum, d) => sum + lagHours(d), 0) / deposits.length / 24 : 0;

  const ordersRow = (d: CodDeposit, cols: number) => {
    if (!expanded.has(d.id)) return null;
    const list = ordersById[d.id];
    return (
      <tr key={`${d.id}-orders`} className={s.orderList}>
        <td colSpan={cols}>
          <div className={s.orderInner}>
            {!list ? <span className={s.orderRowMuted}>Loading orders…</span>
              : list.length === 0 ? <span className={s.orderRowMuted}>No orders linked to this deposit.</span>
              : list.map((o) => (
                <div key={o.id} className={s.orderRow}>
                  <Link to={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                  <span className={s.orderRowMuted}>{o.customer_name ?? '—'}</span>
                  <span className={styles.total}>{fmtINR(Number(o.payable_amount))}</span>
                </div>
              ))}
          </div>
        </td>
      </tr>
    );
  };

  // [KA8-6] A deposit tied to 0 orders rendered as a button with a disclosure chevron —
  // promising detail that cannot exist, to the one person whose job is matching cash to what
  // the cash was FOR. A control that expands nothing is worse than no control: it costs a
  // click to learn that the answer is unavailable.
  //
  // Zero is also a fact worth stating rather than hiding: a deposit with no orders linked is
  // either a deposit recorded before its orders were, or one that will never reconcile.
  const ordersCell = (d: CodDeposit) =>
    d.order_count ? (
      <button className={s.expandBtn} onClick={(e) => { e.stopPropagation(); toggleOrders(d); }}>
        {expanded.has(d.id) ? <UilAngleDown size={14} /> : <UilAngleRight size={14} />}{d.order_count}
      </button>
    ) : (
      <span className={s.noOrders} title="No orders are linked to this deposit, so there is nothing to expand. The cash was recorded without the orders it covers.">
        0 — none linked
      </span>
    );

  // kind: awaiting | variance | confirmed → trailing column differs.
  const section = (title: string, list: CodDeposit[], kind: 'awaiting' | 'variance' | 'confirmed', accent = false) =>
    list.length === 0 ? null : (
      <section className={ds.section}>
        <h2 className={ds.sectionTitle}>
          <span className={accent ? s.pendingAccent : undefined}>{title}</span> <span className={ds.count}>{list.length}</span>
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Deposit</th><th>Hub</th><th>Dispatch staff</th><th>Orders</th><th className="moneyCell">Amount</th>
                {kind === 'awaiting' ? <th>Age</th> : <th>{kind === 'variance' ? 'Variance' : 'Confirmed'}</th>}
                <th>Hub confirm</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const cols = 8;
                const variance = d.counted_amount != null ? Number(d.counted_amount) - Number(d.total_amount) : 0;
                return (
                  <React.Fragment key={d.id}>
                    <tr className={styles.row}>
                      <td className={s.depositId}>{d.id.slice(0, 8)}</td>
                      <td>{d.hub_name}</td>
                      <td><div className={styles.customerName}>{d.staff_name}</div></td>
                      <td>{ordersCell(d)}</td>
                      {/* [FIN-35-3] Declared, with the shortfall against what the linked
                          orders actually owe.
                          The variance shown elsewhere is declared−counted, which cannot
                          see an under-declaration: hand over less, declare less, and the
                          count matches the declaration perfectly. Comparing the declaration
                          to the ORDERS is the only thing that catches it. Shown only when
                          orders are linked — with none, a number here would be a claim
                          rather than a measurement. */}
                      <td className={`moneyCell ${styles.total}`}>
                        {fmtINR(Number(d.total_amount))}
                        {(() => {
                          if (!d.order_count || d.expected_amount == null) return null;
                          const short = Number(d.total_amount) - Number(d.expected_amount);
                          if (Math.abs(short) < 0.01) return null;
                          return (
                            <div
                              className={s.underDeclared}
                              title={`Orders in this deposit total ${fmtINR(Number(d.expected_amount))}. The depositor declared ${fmtINR(Number(d.total_amount))}.`}
                            >
                              {short < 0 ? `${fmtINR(Math.abs(short))} under orders` : `${fmtINR(short)} over orders`}
                            </div>
                          );
                        })()}
                      </td>
                      {kind === 'awaiting' ? (
                        <td><AgeCell since={d.created_at} warnAfterH={48} alertAfterH={96} /></td>
                      ) : kind === 'variance' ? (
                        <td className={s.varianceNote} title={d.variance_reason ?? undefined}>
                          {variance > 0 ? '+' : ''}{fmtINR(variance)} — {d.variance_reason}
                        </td>
                      ) : (
                        <td className={styles.date} title={d.finance_confirmed_by_name ? `by ${d.finance_confirmed_by_name}` : undefined}>
                          {fmtDate(d.finance_confirmed_at)}
                          {d.variance_resolved_at && <div className={s.summarySub}>variance resolved</div>}
                        </td>
                      )}
                      <td>
                        <span title={d.confirmed_by_name ? `by ${d.confirmed_by_name}` : undefined}>
                          <StatusBadge status={d.confirmed_at ? 'received' : 'pending'} label={d.confirmed_at ? 'Received' : 'Pending'} />
                        </span>
                      </td>
                      <td>
                        {kind === 'awaiting' && <Button variant="primary" size="sm" onClick={() => openConfirm(d)}>Confirm…</Button>}
                        {kind === 'variance' && <Button variant="primary" size="sm" onClick={() => { setResolveTarget(d); setResolution(''); }}>Resolve…</Button>}
                        {kind === 'confirmed' && <StatusBadge status="confirmed" />}
                      </td>
                    </tr>
                    {ordersRow(d, cols)}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageHeader
        eyebrow="Finance · Money"
        title="COD Reconciliation"
        subtitle="Confirm each cash deposit against the bank. A counted ≠ declared mismatch opens a variance that stays visible until you resolve it."
        actions={
          <>
            <Button variant="ghost" onClick={handleExport} disabled={exporting || deposits.length === 0}><UilImport size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}</Button>
            <Button variant="ghost" onClick={load}><UilRefresh size={15} /> Refresh</Button>
          </>
        }
      />

      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>COD outstanding</div>
          <div className={`${s.summaryValue} ${awaiting.length ? s.pendingAccent : ''}`}>{loading ? '—' : fmtINR(outstanding)}</div>
          {!loading && <div className={s.summarySub}>{awaiting.length} deposit{awaiting.length !== 1 ? 's' : ''} awaiting confirmation</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Avg deposit lag</div>
          <div className={s.summaryValue}>{loading ? '—' : `${avgLagDays.toFixed(1)}d`}</div>
          {!loading && <div className={s.summarySub}>submit → finance confirm</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Open variances</div>
          <div className={`${s.summaryValue} ${variancesOpen.length ? s.pendingAccent : ''}`}>{loading ? '—' : variancesOpen.length}</div>
          {/* [KA8-7] The sub-label rendered only when the count was non-zero, so the two
              cards that most need a qualifier were bare zeros — and ZERO is exactly when a
              reader needs to know what the number counts. A bare 0 beside "Confirmed" could
              mean nothing has been confirmed or nothing has been submitted; those are very
              different mornings for whoever reconciles the cash. */}
          {!loading && <div className={s.summarySub}>cash mismatches to resolve</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Confirmed</div>
          <div className={s.summaryValue}>{loading ? '—' : confirmed.length}</div>
          {!loading && <div className={s.summarySub}>deposits matched against the bank</div>}
        </div>
      </div>

      <div className={ds.toolbar}>
        <select className={ds.hubSel} value={hubId} onChange={(e) => setHubId(e.target.value)}>
          <option value="">All Hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <span className={s.dateWrap}><input className={s.dateInput} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" /></span>
        <span className={s.dateWrap}><input className={s.dateInput} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" /></span>
        {(hubId || startDate || endDate) && (
          <button className={styles.clearBtn} onClick={clearFilters}><UilTimes size={14} /> Clear</button>
        )}
      </div>

      {loading ? (
        <div className={styles.tableWrap}><table className={styles.table}><tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
          ))}
        </tbody></table></div>
      ) : deposits.length === 0 ? (
        <EmptyState title="No COD deposits ✓" body="Deposits awaiting confirmation, open variances, and confirmed cash will appear here." />
      ) : (
        <>
          {section('Awaiting confirmation', awaiting, 'awaiting', true)}
          {section('Variances — open', variancesOpen, 'variance', true)}
          {section('Confirmed', confirmed, 'confirmed')}
        </>
      )}

      {/* Confirm (G-28/D19) */}
      <Modal
        open={confirmTarget !== null}
        onClose={() => !confirming && setConfirmTarget(null)}
        title="Confirm COD deposit"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)} disabled={confirming}>Cancel</Button>
            <Button variant="primary" state={confirming ? 'loading' : 'default'} onClick={handleConfirm}>Confirm deposit</Button>
          </>
        }
      >
        {confirmTarget && (
          <div className={s.confirmBody}>
            <p className={s.confirmMeta}>
              {confirmTarget.hub_name} · {confirmTarget.staff_name} · {confirmTarget.order_count} order{confirmTarget.order_count !== 1 ? 's' : ''} · declared <strong>{fmtINR(Number(confirmTarget.total_amount))}</strong>
            </p>
            <Input label="Counted / banked amount (₹)" type="number" value={countedAmount} onChange={setCountedAmount} />
            {Math.abs(Number(countedAmount) - Number(confirmTarget.total_amount)) >= 0.01 && (
              <Input label="Variance reason (required — counted differs from declared)" value={varianceReason} onChange={setVarianceReason} placeholder="e.g. short ₹200 — rider to deposit balance tomorrow" />
            )}
            <p className={s.confirmNote}>Records the cash as verified against the bank, logged with your account. A mismatch opens a variance you must resolve later.</p>
          </div>
        )}
      </Modal>

      {/* Resolve variance */}
      <Modal
        open={resolveTarget !== null}
        onClose={() => !resolving && setResolveTarget(null)}
        title="Resolve variance"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveTarget(null)} disabled={resolving}>Cancel</Button>
            <Button variant="primary" state={resolving ? 'loading' : 'default'} onClick={handleResolve}>Mark resolved</Button>
          </>
        }
      >
        {resolveTarget && (
          <div className={s.confirmBody}>
            <p className={s.confirmMeta}>
              {resolveTarget.hub_name} · declared {fmtINR(Number(resolveTarget.total_amount))} · counted {fmtINR(Number(resolveTarget.counted_amount ?? 0))} · <span className={s.varianceNote}>{resolveTarget.variance_reason}</span>
            </p>
            <Input label="How was it resolved?" value={resolution} onChange={setResolution} placeholder="e.g. rider deposited the ₹200 balance on 12 Jun / written off as float" />
            <p className={s.confirmNote}>This closes the variance with your note, logged with your account.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CodReconciliationPage;
