import React from 'react';
import { RefreshCw, MapPin } from 'lucide-react';
import { pincodeWaitlistApi } from '../../api/adminApi';
import type { PincodeDemand } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const PincodeWaitlistPage: React.FC = () => {
  const [rows, setRows] = React.useState<PincodeDemand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [onlyUnserved, setOnlyUnserved] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    pincodeWaitlistApi.list()
      .then(setRows)
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  const visible = onlyUnserved ? rows.filter(r => !r.is_served) : rows;
  const totalWaiting = rows.reduce((s, r) => s + r.total_waiting, 0);
  const unservedCount = rows.filter(r => !r.is_served).length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Pincode Demand</h1>
        <button className={styles.clearBtn} onClick={load} title="Refresh"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className={styles.filterBar}>
        <span className={styles.pagination}>
          {loading ? 'Loading…' : `${totalWaiting} customers waiting across ${rows.length} pincodes · ${unservedCount} not yet served`}
        </span>
        <label className={styles.clearBtn} style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyUnserved} onChange={e => setOnlyUnserved(e.target.checked)} /> Unserved only
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Pincode</th><th>Area</th><th>City</th><th>Waiting</th><th>Notified</th><th>Status</th><th>First Signup</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            )) : visible.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No pincode demand recorded yet.</td></tr>
            ) : visible.map(r => (
              <tr key={r.pincode} className={styles.row}>
                <td className={styles.orderId}><MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{r.pincode}</td>
                <td>{r.area_name ?? '—'}</td>
                <td>{r.city ?? '—'}</td>
                <td className={styles.total}>{r.total_waiting}</td>
                <td>{r.notified}</td>
                <td>
                  <span className={`${styles.stagePill} ${r.is_served ? styles.stageSuccess : styles.stageWarning}`}>
                    {r.is_served ? 'Served' : 'Not served'}
                  </span>
                </td>
                <td className={styles.date}>{fmtDate(r.first_signup_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PincodeWaitlistPage;
