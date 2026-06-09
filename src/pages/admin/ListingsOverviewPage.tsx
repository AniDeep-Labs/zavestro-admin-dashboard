import React from 'react';
import { listingsAdminApi } from '../../api/adminApi';
import type { ListingOverviewRow } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

export const ListingsOverviewPage: React.FC = () => {
  const [rows, setRows] = React.useState<ListingOverviewRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hubFilter, setHubFilter] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  React.useEffect(() => {
    setLoading(true);
    listingsAdminApi
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

  const hubs = Array.from(new Set(rows.map((r) => r.hub_name))).sort();
  const visible = hubFilter ? rows.filter((r) => r.hub_name === hubFilter) : rows;
  const active = rows.filter((r) => r.is_active).length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Listings Overview</h1>
        <span className={styles.pagination}>
          {loading ? '' : `${rows.length} listings · ${active} active · ${hubs.length} hubs`}
        </span>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Listing (design)</th><th>Garment</th><th>Fabric</th><th>Hub</th><th>Price</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No listings yet. Listings are published by the catalog manager once a sample is reviewed.</td></tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id}>
                  <td className={styles.customerName} style={{ fontWeight: 500 }}>{r.design_name}</td>
                  <td>{r.garment_type}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{r.fabric_name}</td>
                  <td>{r.hub_name}</td>
                  <td className={styles.total} style={{ fontWeight: 600 }}>₹{Number(r.price).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`${styles.stagePill} ${r.is_active ? styles.stageSuccess : styles.stageNeutral}`}>
                      {r.is_active ? 'Live' : 'Hidden'}
                    </span>
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

export default ListingsOverviewPage;
