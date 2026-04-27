import React from 'react';
import { useNavigate } from 'react-router-dom';
import { hubsApi } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './HubsListPage.module.css';

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

const statusCss: Record<string, string> = {
  Active: 'statusActive', Inactive: 'statusInactive',
  'At Capacity': 'statusCapacity', Critical: 'statusCritical',
};

export const HubsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true); setError('');
    hubsApi.list({ search: debouncedSearch || undefined, status: statusFilter || undefined })
      .then(r => { setHubs(r.hubs); setTotal(r.total); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter]);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Stitching Hubs</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/hubs/new')}>+ Add Hub</button>
      </div>

      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search hub name or city…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Active</option><option>Inactive</option>
          <option>At Capacity</option><option>Critical</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>
      </div>

      {error && !loading && (
        <div className={styles.errorBanner}>{error} <button className={styles.retryBtn} onClick={() => setSearch(s => s)}>Retry</button></div>
      )}

      {loading ? (
        <div className={styles.grid}>
          {Array.from({length: 6}).map((_, i) => <div key={i} className={`${styles.hubCard} ${styles.skeletonCard}`}><div className={styles.skeleton} style={{height:20,marginBottom:8}}/><div className={styles.skeleton} style={{height:14}}/></div>)}
        </div>
      ) : hubs.length === 0 ? (
        <div className={styles.empty}>No hubs found.</div>
      ) : (
        <div className={styles.grid}>
          {hubs.map(hub => (
            <div key={hub.id} className={styles.hubCard} onClick={() => navigate(`/admin/hubs/${hub.id}`)}>
              <div className={styles.hubHeader}>
                <div>
                  <div className={styles.hubName}>{hub.name}</div>
                  <div className={styles.hubLocation}>{hub.city}, {hub.state}</div>
                </div>
                <span className={`${styles.hubStatus} ${styles[statusCss[hub.status]]}`}>{hub.status}</span>
              </div>
              <div className={styles.hubStats}>
                <div className={styles.stat}><div className={styles.statVal}>{hub.activeOrders}</div><div className={styles.statLabel}>Active Orders</div></div>
                <div className={styles.stat}><div className={styles.statVal}>{hub.tailorCount}</div><div className={styles.statLabel}>Tailors</div></div>
                <div className={styles.stat}><div className={styles.statVal}>{hub.qcPassRate}%</div><div className={styles.statLabel}>QC Pass</div></div>
              </div>
              <div className={styles.capacityRow}>
                <span className={styles.capacityLabel}>Capacity</span>
                <div className={styles.capacityBar}>
                  <div className={`${styles.capacityFill} ${hub.capacityUsed >= 100 ? styles.capacityFull : hub.capacityUsed >= 80 ? styles.capacityHigh : styles.capacityNormal}`}
                    style={{ width: `${Math.min(hub.capacityUsed, 100)}%` }} />
                </div>
                <span className={styles.capacityPct}>{hub.capacityUsed}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && <div className={styles.pagination}>{total} hub{total !== 1 ? 's' : ''} total</div>}
    </div>
  );
};
