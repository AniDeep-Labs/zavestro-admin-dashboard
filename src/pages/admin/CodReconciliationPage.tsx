import React from 'react';
import { Download, X, RefreshCw } from 'lucide-react';
import { codReconciliationApi, hubsApi } from '../../api/adminApi';
import type { CodDeposit, CodReconciliationParams } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';

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

  // Client-side summary over the returned rows (endpoint caps at 500).
  const totalAmount = deposits.reduce((sum, d) => sum + d.total_amount, 0);
  const pending = deposits.filter(d => !d.confirmed_at);
  const pendingAmount = pending.reduce((sum, d) => sum + d.total_amount, 0);
  const confirmedCount = deposits.length - pending.length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>COD Reconciliation</h1>
        <button className={styles.exportBtn} onClick={handleExport} disabled={exporting || deposits.length === 0}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
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
        <button className={styles.clearBtn} onClick={clearFilters}><X size={14} /> Clear</button>
        <button className={styles.clearBtn} onClick={load} title="Refresh"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Deposit</th><th>Hub</th><th>Dispatch Staff</th><th>Orders</th><th>Amount</th>
            <th>Submitted</th><th>Status</th><th>Confirmed By</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            )) : deposits.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No COD deposits match these filters.</td></tr>
            ) : deposits.map(d => (
              <tr key={d.id} className={styles.row}>
                <td className={s.depositId}>{d.id.slice(0, 8)}</td>
                <td>{d.hub_name}</td>
                <td><div className={styles.customerName}>{d.staff_name}</div></td>
                <td>{d.order_count}</td>
                <td className={styles.total}>{fmtINR(d.total_amount)}</td>
                <td className={styles.date}>{fmtDate(d.created_at)}</td>
                <td>
                  <span className={`${styles.stagePill} ${d.confirmed_at ? styles.stageSuccess : styles.stageWarning}`}>
                    {d.confirmed_at ? 'Confirmed' : 'Pending'}
                  </span>
                </td>
                <td className={styles.date}>{d.confirmed_by_name ?? '—'}</td>
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
    </div>
  );
};

export default CodReconciliationPage;
