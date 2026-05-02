import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { alterationsApi } from '../../api/adminApi';
import type { AlterationRequest } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};

const STATUS_CSS: Record<string, string> = {
  pending: 'stageWarning', in_progress: 'stageBlue', completed: 'stageSuccess', cancelled: 'stageNeutral',
};

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const AlterationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [alterations, setAlterations] = React.useState<AlterationRequest[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    alterationsApi.list({ status: statusFilter || undefined, page, limit: 25 })
      .then(r => { setAlterations(r.alterations); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  const filtered = debouncedSearch
    ? alterations.filter(a =>
        a.order_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : alterations;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Alterations</h1>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Order</th><th>Customer</th><th>Phone</th><th>Description</th><th>Status</th><th>Date</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No alteration requests found.</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} className={styles.row} onClick={() => navigate(`/admin/alterations/${a.id}`)}>
                <td className={styles.orderId}>{a.order_number}</td>
                <td><div className={styles.customerName}>{a.customer_name}</div></td>
                <td><div className={styles.customerPhone}>{a.customer_phone}</div></td>
                <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</td>
                <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[a.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[a.status] ?? a.status}</span></td>
                <td className={styles.date}>{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} alteration${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page}</span>
          <button className={styles.pageBtn} disabled={alterations.length < 25 || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};
