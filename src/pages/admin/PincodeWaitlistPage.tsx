import React from 'react';
import { Link } from 'react-router-dom';
import { pincodeWaitlistApi } from '../../api/adminApi';
import type { PincodeDemand } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { UilMapMarker, UilRefresh, UilImport } from "@iconscout/react-unicons";
import { StatusBadge } from '../../components';
import { downloadCsv, datedFilename } from '../../utils/csv';
import type { PincodeCohortEntry } from '../../api/adminApi';

// ACP-6 [KA11-6]: one date formatter for the admin.
import { fmtDate } from '../../utils/date';

export const PincodeWaitlistPage: React.FC = () => {
  const [rows, setRows] = React.useState<PincodeDemand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [onlyUnserved, setOnlyUnserved] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
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

  // T2-37 (SP-7): export the waiting-customer cohort (audited PII) for manual outreach. A
  // single pincode (per-row) exports just its waiters; the top-level export respects the filter.
  const exportCohort = async (pincode?: string) => {
    if (exporting) return;
    setExporting(true);
    try {
      const cohort: PincodeCohortEntry[] = await pincodeWaitlistApi.cohort(
        pincode ? { pincode } : { unserved: onlyUnserved },
      );
      if (cohort.length === 0) {
        showToast('info', 'Nothing to export', 'No waiting customers match.');
        return;
      }
      downloadCsv<PincodeCohortEntry>(
        datedFilename(pincode ? `pincode-${pincode}-cohort` : 'pincode-cohort'),
        [
          { header: 'Pincode', value: c => c.pincode },
          { header: 'Name', value: c => c.name },
          { header: 'Phone', value: c => c.phone },
          { header: 'Area', value: c => c.area_name ?? '' },
          { header: 'City', value: c => c.city ?? '' },
          { header: 'Joined', value: c => fmtDate(c.joined_at) },
          { header: 'Notified', value: c => (c.notified_at ? fmtDate(c.notified_at) : 'No') },
        ],
        cohort,
      );
      showToast('success', 'Export ready', `${cohort.length} waiting customer${cohort.length === 1 ? '' : 's'} exported.`);
    } catch (e) {
      showToast('error', 'Export failed', e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const visible = onlyUnserved ? rows.filter(r => !r.is_served) : rows;
  const totalWaiting = rows.reduce((s, r) => s + r.total_waiting, 0);
  const unservedCount = rows.filter(r => !r.is_served).length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Pincode Demand</h1>
        <div className={styles.headerActions}>
          {/* T2-26 (SU-8): open a pincode as a service area — cross-link the two. */}
          <Link className={styles.crossLink} to="/admin/system/service-areas">Manage service areas →</Link>
          {/* T2-37 (SP-7): export the waiting-customer cohort for manual outreach. */}
          <button className={styles.clearBtn} disabled={exporting} onClick={() => exportCohort()}>
            <UilImport size={14} /> {exporting ? 'Exporting…' : 'Export cohort CSV'}
          </button>
          <button className={styles.clearBtn} onClick={load} title="Refresh"><UilRefresh size={14} /> Refresh</button>
        </div>
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
            <th>Pincode</th><th>Area</th><th>City</th><th>Waiting</th><th>Notified</th><th>Status</th><th>First Signup</th><th></th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            )) : visible.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No pincode demand recorded yet.</td></tr>
            ) : visible.map(r => (
              <tr key={r.pincode} className={styles.row}>
                <td className={styles.orderId}><UilMapMarker size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{r.pincode}</td>
                <td>{r.area_name ?? '—'}</td>
                <td>{r.city ?? '—'}</td>
                <td className={styles.total}>{r.total_waiting}</td>
                <td>{r.notified}</td>
                <td>
                  <StatusBadge status={r.is_served ? 'served' : 'waiting'} label={r.is_served ? 'Served' : 'Not served'} />
                </td>
                <td className={styles.date}>{fmtDate(r.first_signup_at)}</td>
                <td onClick={e => e.stopPropagation()}>
                  <button className={styles.linkBtn} disabled={exporting} onClick={() => exportCohort(r.pincode)}>
                    Export
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PincodeWaitlistPage;
