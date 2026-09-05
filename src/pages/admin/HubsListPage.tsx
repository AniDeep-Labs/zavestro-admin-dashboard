import React from 'react';
import { useNavigate } from 'react-router-dom';
import { hubsApi } from '../../api/adminApi';
import type { Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './HubsListPage.module.css';
import { UilPlus, UilTimes } from "@iconscout/react-unicons";
import { StatusBadge } from '../../components';

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

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

  // T3-9 (§2.3): a bump key so Retry actually re-runs the load (the old Retry did
  // setSearch(s => s), a no-op that never changed state → never refetched).
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    setLoading(true); setError('');
    hubsApi.list({ search: debouncedSearch || undefined, status: statusFilter || undefined })
      .then(r => { setHubs(r.hubs); setTotal(r.total); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, reloadKey]);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Stitching Hubs</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/hubs/new')}><UilPlus size={15}/> Add Hub</button>
      </div>

      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search hub name or city…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Active</option><option>Inactive</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); }}><UilTimes size={14}/> Clear</button>
      </div>

      {error && !loading && (
        <div className={styles.errorBanner}>{error} <button className={styles.retryBtn} onClick={() => setReloadKey(k => k + 1)}>Retry</button></div>
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
                  <div className={styles.hubName}>
                    {hub.name}
                    {hub.reference_id && (
                      <span className={styles.refChip}>{hub.reference_id}</span>
                    )}
                  </div>
                  <div className={styles.hubLocation}>{[hub.city, hub.state].map(s => s?.trim()).filter(Boolean).join(', ')}</div>
                </div>
                <StatusBadge status={hub.status.toLowerCase()} label={hub.status} />
              </div>
              <div className={styles.hubStats}>
                <div className={styles.stat}><div className={styles.statVal}>{hub.activeOrders}</div><div className={styles.statLabel}>Active Orders</div></div>
                <div className={styles.stat}><div className={styles.statVal}>{hub.tailorCount}</div><div className={styles.statLabel}>Tailors</div></div>
                {/* [KA2-9 / SHL-4-2] "—" and a reason, never a fabricated number.
                    The backend was fixed to send NULL when nothing has been inspected —
                    its comment even says "the frontend renders '—' and not yet measured" —
                    but this surface was never updated, so a null rendered as a bare "%".
                    Before that it was the literal 100, which is the worse failure: a
                    permanently green quality metric suppresses the alarm it exists to
                    raise, and on an empty hub "100% QC Pass" beside "0 Active Orders" is a
                    perfect score for work nobody has done. */}
                <div className={styles.stat}>
                  <div className={styles.statVal}>
                    {hub.qcPassRate === null ? '—' : `${hub.qcPassRate}%`}
                  </div>
                  <div className={styles.statLabel}>
                    {hub.qcPassRate === null ? 'QC Pass · not yet measured' : 'QC Pass'}
                  </div>
                </div>
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
