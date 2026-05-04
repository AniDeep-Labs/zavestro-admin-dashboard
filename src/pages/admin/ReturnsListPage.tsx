import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { returnsApi } from '../../api/adminApi';
import type { ReturnRequest } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', under_review: 'Under Review',
};

const STATUS_CSS: Record<string, string> = {
  pending: 'stageWarning', approved: 'stageSuccess', rejected: 'stageError', under_review: 'stageBlue',
};

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const ReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [returns, setReturns] = React.useState<ReturnRequest[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    returnsApi.list({ status: statusFilter || undefined, page, limit: 25 })
      .then(r => { setReturns(r.returns); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  const filtered = debouncedSearch
    ? returns.filter(r =>
        r.order_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        r.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : returns;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Returns</h1>
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
            <th>Order</th><th>Customer</th><th>Phone</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No return requests found.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className={styles.row} onClick={() => navigate(`/admin/returns/${r.id}`)}>
                <td className={styles.orderId}>{r.order_number}</td>
                <td><div className={styles.customerName}>{r.customer_name}</div></td>
                <td><div className={styles.customerPhone}>{r.customer_phone}</div></td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[r.status] ?? 'stageNeutral']}`}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
                <td className={styles.date}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                  {r.status === 'pending' || r.status === 'under_review' ? (
                    <>
                      <button className={styles.actionBtn} disabled={actionId === r.id} onClick={async () => {
                        setActionId(r.id);
                        try {
                          await returnsApi.review(r.id, { status: 'approved' });
                          setReturns(prev => prev.map(x => x.id === r.id ? { ...x, status: 'approved' } : x));
                          showToast('success', 'Return approved', r.order_number);
                        } catch (e) { showToast('error', 'Failed', e instanceof Error ? e.message : undefined); }
                        finally { setActionId(null); }
                      }} style={{ marginRight: 4, background: 'var(--green)', color: '#fff', border: 'none' }}>
                        {actionId === r.id ? '…' : 'Approve'}
                      </button>
                      <button className={styles.actionBtn} disabled={actionId === r.id} onClick={async () => {
                        setActionId(r.id);
                        try {
                          await returnsApi.review(r.id, { status: 'rejected' });
                          setReturns(prev => prev.map(x => x.id === r.id ? { ...x, status: 'rejected' } : x));
                          showToast('success', 'Return rejected', r.order_number);
                        } catch (e) { showToast('error', 'Failed', e instanceof Error ? e.message : undefined); }
                        finally { setActionId(null); }
                      }} style={{ background: 'var(--color-error, #dc3545)', color: '#fff', border: 'none' }}>
                        Reject
                      </button>
                    </>
                  ) : (
                    <button className={styles.actionBtn} onClick={() => navigate(`/admin/returns/${r.id}`)}>Review</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} return${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page}</span>
          <button className={styles.pageBtn} disabled={returns.length < 25 || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};
