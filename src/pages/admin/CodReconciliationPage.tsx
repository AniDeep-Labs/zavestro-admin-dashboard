import React from 'react';
import { codReconciliationApi, hubsApi } from '../../api/adminApi';
import type { CodDeposit, CodReconciliationParams } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Modal } from '../../components/Modal/Modal';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';
import { UilImport, UilRefresh, UilTimes } from "@iconscout/react-unicons";

const fmtINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const CodReconciliationPage: React.FC = () => {
  const [hubId, setHubId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [status, setStatus] = React.useState<'' | 'pending' | 'confirmed'>('');
  const [deposits, setDeposits] = React.useState<CodDeposit[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  // Finance confirm modal (G-28/D19)
  const [confirmTarget, setConfirmTarget] = React.useState<CodDeposit | null>(null);
  const [countedAmount, setCountedAmount] = React.useState('');
  const [varianceReason, setVarianceReason] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const params = (): CodReconciliationParams => ({
    hub_id: hubId || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    status: status || undefined,
  });

  React.useEffect(() => {
    hubsApi.list().then(r => setHubs(r.hubs)).catch(() => { /* hub filter is optional */ });
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    codReconciliationApi.list(params())
      .then(setDeposits)
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId, startDate, endDate, status]);

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

  const clearFilters = () => { setHubId(''); setStartDate(''); setEndDate(''); setStatus(''); };

  const openConfirm = (d: CodDeposit) => {
    setConfirmTarget(d);
    setCountedAmount(String(d.total_amount));
    setVarianceReason('');
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const counted = Number(countedAmount);
    if (!Number.isFinite(counted) || counted < 0) {
      showToast('error', 'Enter the counted amount'); return;
    }
    const declared = Number(confirmTarget.total_amount);
    const hasVariance = Math.abs(counted - declared) >= 0.01;
    if (hasVariance && !varianceReason.trim()) {
      showToast('error', 'Variance reason required', `Counted ${fmtINR(counted)} ≠ declared ${fmtINR(declared)}`);
      return;
    }
    setConfirming(true);
    try {
      await codReconciliationApi.confirm(confirmTarget.id, counted, hasVariance ? varianceReason.trim() : undefined);
      showToast('success', 'Deposit confirmed', hasVariance ? `Variance recorded: ${fmtINR(counted - declared)}` : undefined);
      setConfirmTarget(null);
      load();
    } catch (e) {
      showToast('error', 'Confirm failed', e instanceof Error ? e.message : undefined);
    } finally { setConfirming(false); }
  };

  // Client-side summary over the returned rows (endpoint caps at 500).
  // "Pending" = awaiting FINANCE confirmation (this page is finance's worklist).
  const totalAmount = deposits.reduce((sum, d) => sum + Number(d.total_amount), 0);
  const pending = deposits.filter(d => !d.finance_confirmed_at);
  const pendingAmount = pending.reduce((sum, d) => sum + Number(d.total_amount), 0);
  const confirmedCount = deposits.length - pending.length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>COD Reconciliation</h1>
        <button className={styles.exportBtn} onClick={handleExport} disabled={exporting || deposits.length === 0}>
          <UilImport size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Deposits</div>
          <div className={s.summaryValue}>{loading ? '—' : deposits.length}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Total Amount</div>
          <div className={s.summaryValue}>{loading ? '—' : fmtINR(totalAmount)}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Pending Confirmation</div>
          <div className={`${s.summaryValue} ${s.pendingAccent}`}>{loading ? '—' : pending.length}</div>
          {!loading && pending.length > 0 && <div className={s.summarySub}>{fmtINR(pendingAmount)} uncollected at HQ</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Confirmed</div>
          <div className={s.summaryValue}>{loading ? '—' : confirmedCount}</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={hubId} onChange={e => setHubId(e.target.value)}>
          <option value="">All Hubs</option>
          {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <input className={s.dateInput} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="Start date" />
        <input className={s.dateInput} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="End date" />
        <select className={styles.filterSelect} value={status} onChange={e => setStatus(e.target.value as '' | 'pending' | 'confirmed')}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
        </select>
        <button className={styles.clearBtn} onClick={clearFilters}><UilTimes size={14} /> Clear</button>
        <button className={styles.clearBtn} onClick={load} title="Refresh"><UilRefresh size={14} /> Refresh</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Deposit</th><th>Hub</th><th>Dispatch Staff</th><th>Orders</th><th>Amount</th>
            <th>Submitted</th><th>Hub Confirm</th><th>Finance Confirm</th><th></th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 9 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            )) : deposits.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No COD deposits match these filters.</td></tr>
            ) : deposits.map(d => (
              <tr key={d.id} className={styles.row}>
                <td className={s.depositId}>{d.id.slice(0, 8)}</td>
                <td>{d.hub_name}</td>
                <td><div className={styles.customerName}>{d.staff_name}</div></td>
                <td>{d.order_count}</td>
                <td className={styles.total}>
                  {fmtINR(Number(d.total_amount))}
                  {d.variance_reason && (
                    <div className={s.summarySub} title={d.variance_reason}>
                      counted {fmtINR(Number(d.counted_amount))} — {d.variance_reason}
                    </div>
                  )}
                </td>
                <td className={styles.date}>{fmtDate(d.created_at)}</td>
                <td>
                  <span className={`${styles.stagePill} ${d.confirmed_at ? styles.stageSuccess : styles.stageWarning}`}
                    title={d.confirmed_by_name ? `by ${d.confirmed_by_name}` : undefined}>
                    {d.confirmed_at ? 'Received' : 'Pending'}
                  </span>
                </td>
                <td>
                  <span className={`${styles.stagePill} ${d.finance_confirmed_at ? styles.stageSuccess : styles.stageWarning}`}
                    title={d.finance_confirmed_by_name ? `by ${d.finance_confirmed_by_name}` : undefined}>
                    {d.finance_confirmed_at ? 'Confirmed' : 'Pending'}
                  </span>
                </td>
                <td>
                  {!d.finance_confirmed_at && (
                    <button className={styles.exportBtn} onClick={() => openConfirm(d)}>
                      Confirm…
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>
          {loading ? 'Loading…' : `${deposits.length} deposit${deposits.length !== 1 ? 's' : ''}${deposits.length === 500 ? ' (showing latest 500)' : ''}`}
        </span>
      </div>

      {/* Finance confirm modal (G-28/D19): counted-vs-declared with mandatory variance reason */}
      <Modal
        open={confirmTarget !== null}
        onClose={() => !confirming && setConfirmTarget(null)}
        title="Confirm COD deposit"
        size="sm"
        footer={
          <>
            <button className={styles.clearBtn} onClick={() => setConfirmTarget(null)} disabled={confirming}>
              Cancel
            </button>
            <button className={styles.exportBtn} onClick={handleConfirm} disabled={confirming}>
              {confirming ? 'Confirming…' : 'Confirm deposit'}
            </button>
          </>
        }
      >
        {confirmTarget && (
          <div className={s.confirmBody}>
            <p className={s.confirmMeta}>
              {confirmTarget.hub_name} · {confirmTarget.staff_name} · {confirmTarget.order_count} order{confirmTarget.order_count !== 1 ? 's' : ''} · declared <strong>{fmtINR(Number(confirmTarget.total_amount))}</strong>
            </p>
            <label className={s.confirmLabel}>
              Counted / banked amount (₹)
              <input
                className={s.dateInput}
                type="number"
                min="0"
                step="0.01"
                value={countedAmount}
                onChange={e => setCountedAmount(e.target.value)}
                autoFocus
              />
            </label>
            {Math.abs(Number(countedAmount) - Number(confirmTarget.total_amount)) >= 0.01 && (
              <label className={s.confirmLabel}>
                Variance reason (required — counted differs from declared)
                <input
                  className={s.dateInput}
                  type="text"
                  value={varianceReason}
                  onChange={e => setVarianceReason(e.target.value)}
                  placeholder="e.g. short ₹200 — rider to deposit balance tomorrow"
                />
              </label>
            )}
            <p className={s.confirmNote}>
              This records the cash as verified against the bank. It is logged with your account and cannot be undone from this screen.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CodReconciliationPage;
