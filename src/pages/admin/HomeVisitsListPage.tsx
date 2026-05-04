import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { homeVisitsApi, hubsApi } from '../../api/adminApi';
import type { HomeVisit, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled',
};

const STATUS_CSS: Record<string, string> = {
  pending: 'stageWarning', confirmed: 'stageBlue', completed: 'stageSuccess', cancelled: 'stageNeutral',
};

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

export const HomeVisitsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [hubFilter, setHubFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [visits, setVisits] = React.useState<HomeVisit[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    hubsApi.list({ status: 'Active' }).then(r => setHubs(r.hubs)).catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    homeVisitsApi.list({
      status: statusFilter || undefined,
      date: dateFilter || undefined,
      hub_id: hubFilter || undefined,
      page,
      limit: 25,
    })
      .then(r => { setVisits(r.visits); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, dateFilter, hubFilter, page]);

  React.useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (visit: HomeVisit, newStatus: string) => {
    setUpdatingId(visit.id);
    try {
      const updated = await homeVisitsApi.updateStatus(visit.id, newStatus);
      setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
      showToast('success', 'Status updated', `${visit.customer_name} → ${STATUS_LABELS[newStatus] ?? newStatus}`);
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally { setUpdatingId(null); }
  };

  const clearFilters = () => { setStatusFilter(''); setDateFilter(''); setHubFilter(''); setPage(1); };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Home Visits</h1>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={styles.filterSelect} value={hubFilter} onChange={e => { setHubFilter(e.target.value); setPage(1); }}>
          <option value="">All Hubs</option>
          {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <input type="date" className={styles.filterSelect} value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }} />
        <button className={styles.clearBtn} onClick={clearFilters}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Customer</th><th>Phone</th><th>Scheduled</th><th>City</th><th>Hub</th><th>Assigned Staff</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : visits.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No home visits found.</td></tr>
            ) : visits.map(v => (
              <tr key={v.id} className={styles.row} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/home-visits/${v.id}`)}>
                <td><div className={styles.customerName}>{v.customer_name}</div></td>
                <td><div className={styles.customerPhone}>{v.customer_phone ?? '—'}</div></td>
                <td className={styles.date}>{new Date(v.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{v.city ?? '—'}</td>
                <td>{v.hub_name ?? '—'}</td>
                <td>{v.assigned_staff_name ?? <span style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</span>}</td>
                <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[v.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[v.status] ?? v.status}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <select
                    className={styles.filterSelect}
                    style={{ height: 30, fontSize: 12 }}
                    value={v.status}
                    disabled={updatingId === v.id}
                    onChange={e => handleStatusChange(v, e.target.value)}
                  >
                    {VALID_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} visit${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page}</span>
          <button className={styles.pageBtn} disabled={visits.length < 25 || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};
