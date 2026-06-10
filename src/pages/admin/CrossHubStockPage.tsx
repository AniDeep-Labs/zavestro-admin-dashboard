import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fabricsApi, hubsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { FabricStockRow, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');

export const CrossHubStockPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<FabricStockRow[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    fabricsApi
      .stock({ hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) =>
        setToasts((t) => [...t, createToast('error', 'Load failed', e instanceof Error ? e.message : undefined)]),
      )
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

  const totalAvail = rows.reduce((s, r) => s + Number(r.available_meters), 0);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Cross-hub Stock</h1>
        <span className={styles.pagination}>{loading ? '' : `${rows.length} SKU·hub rows · ${totalAvail.toLocaleString('en-IN')}m available`}</span>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Hub</th><th>Fabric</th><th>Code</th><th>Available (m)</th><th>Reserved (m)</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No stock yet. Stock lands here when distributions/restocks are received.</td></tr>
            ) : (
              rows.map((r) => {
                const avail = Number(r.available_meters);
                return (
                  <tr key={`${r.hub_id}-${r.fabric_code}`} className={styles.row} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`)}>
                    <td className={styles.customerName} style={{ fontWeight: 500 }}>{r.hub_name}</td>
                    <td>
                      <div className={styles.fabricCell}>
                        {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                        <span>{r.fabric_name}</span>
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{r.fabric_code}</td>
                    <td className={styles.total} style={{ fontWeight: 600, color: avail <= 0 ? 'var(--color-error)' : undefined }}>{avail}</td>
                    <td className={styles.total} style={{ color: 'var(--color-text-secondary)' }}>{Number(r.reserved_meters)}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(r.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CrossHubStockPage;
