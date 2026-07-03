import React from 'react';
import { designsApi } from '../../api/adminApi';
import type { DesignOverviewRow } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import { StatusBadge } from '../../components';

export const DesignOverviewPage: React.FC = () => {
  const [rows, setRows] = React.useState<DesignOverviewRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  React.useEffect(() => {
    setLoading(true);
    designsApi
      .overview()
      .then(setRows)
      .catch((e) =>
        setToasts((t) => [
          ...t,
          createToast('error', 'Load failed', e instanceof Error ? e.message : undefined),
        ]),
      )
      .finally(() => setLoading(false));
  }, []);

  const totalSold = rows.reduce((s, r) => s + r.units_sold, 0);
  const published = rows.filter((r) => r.status === 'published').length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Design Overview</h1>
        <span className={styles.pagination}>
          {loading ? '' : `${rows.length} designs · ${published} published · ${totalSold} units sold`}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Design</th><th>Garment</th><th>Gender</th><th>Fabric match</th>
              <th>Distributed to hubs</th><th>Units sold</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No designs yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>{r.garment_type}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.gender ?? '—'}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>
                    {r.fabrics.length ? r.fabrics.join(', ') : <span style={{ opacity: 0.5 }}>none</span>}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>
                    {r.hubs.length ? r.hubs.join(', ') : <span style={{ opacity: 0.5 }}>not distributed</span>}
                  </td>
                  <td className={styles.total} style={{ fontWeight: 600 }}>{r.units_sold}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DesignOverviewPage;
