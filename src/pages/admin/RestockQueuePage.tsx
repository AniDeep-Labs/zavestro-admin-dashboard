import React from 'react';
import { restockApi, hubsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { RestockRequest, Hub } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');
const STATUS_LABELS: Record<string, string> = { requested: 'Requested', shipped: 'Shipped', fulfilled: 'Fulfilled', cancelled: 'Cancelled' };
const STATUS_CSS: Record<string, string> = { requested: 'stageWarning', shipped: 'stageBlue', fulfilled: 'stageSuccess', cancelled: 'stageNeutral' };

export const RestockQueuePage: React.FC = () => {
  const [rows, setRows] = React.useState<RestockRequest[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hubFilter, setHubFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [actingId, setActingId] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    restockApi
      .list({ status: statusFilter || undefined, hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  const act = async (r: RestockRequest, status: 'shipped' | 'fulfilled' | 'cancelled') => {
    setActingId(r.id);
    try {
      const res = await restockApi.setStatus(r.id, status);
      toast('success', `Marked ${status}`, status === 'fulfilled' && res.stocked_meters ? `${res.stocked_meters}m landed in ${hubName(r.hub_id)} stock.` : undefined);
      load();
    } catch (e) {
      toast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActingId('');
    }
  };

  const pending = rows.filter((r) => r.status === 'requested' || r.status === 'shipped').length;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Restock Queue</h1>
        <span className={styles.pagination}>{loading ? '' : `${pending} open · ${rows.length} total`}</span>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="shipped">Shipped</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Fabric</th><th>Hub</th><th>Qty (m)</th><th>Demand note</th><th>Status</th><th>Requested</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No restock requests. Catalog managers raise these when a hub runs low.</td></tr>
            ) : (
              rows.map((r) => {
                const busy = actingId === r.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.fabricCell}>
                        {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                        <div className={styles.fabricCellText}>
                          <span style={{ fontWeight: 500 }}>{r.fabric_name}</span>
                          <span className={styles.fabricCellCode}>{r.fabric_code}</span>
                        </div>
                      </div>
                    </td>
                    <td>{hubName(r.hub_id)}</td>
                    <td className={styles.total}>{Number(r.qty)}</td>
                    <td style={{ color: 'var(--color-text-secondary)', maxWidth: 240 }}>{r.demand_note || <span style={{ opacity: 0.5 }}>—</span>}</td>
                    <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[r.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {r.status === 'requested' && (
                          <Button variant="primary" size="sm" disabled={busy} onClick={() => act(r, 'shipped')}>Ship</Button>
                        )}
                        {r.status === 'shipped' && (
                          <Button variant="primary" size="sm" disabled={busy} onClick={() => act(r, 'fulfilled')}>Mark fulfilled</Button>
                        )}
                        {(r.status === 'requested' || r.status === 'shipped') && (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(r, 'cancelled')}>Cancel</Button>
                        )}
                        {(r.status === 'fulfilled' || r.status === 'cancelled') && <span style={{ opacity: 0.5 }}>—</span>}
                      </div>
                    </td>
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

export default RestockQueuePage;
