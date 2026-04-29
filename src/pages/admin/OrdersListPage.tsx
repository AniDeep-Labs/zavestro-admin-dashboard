import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ordersApi } from '../../api/adminApi';
import type { AdminOrder, OrderStage } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const LIMIT = 25;

const stageLabels: Record<OrderStage, string> = {
  payment_pending: 'Payment Pending', payment_confirmed: 'Payment Confirmed',
  fabric_sourced: 'Fabric Sourced', in_tailoring: 'In Tailoring',
  quality_check: 'Quality Check', ready_to_dispatch: 'Ready to Dispatch',
  dispatched: 'Dispatched', delivered: 'Delivered',
  return_requested: 'Return Requested', returned: 'Returned',
};

const stageCss: Record<OrderStage, string> = {
  payment_pending: 'stageNeutral', payment_confirmed: 'stageBlue',
  fabric_sourced: 'stageBlue', in_tailoring: 'stageWarning',
  quality_check: 'stageWarning', ready_to_dispatch: 'stageSuccess',
  dispatched: 'stageSuccess', delivered: 'stageSuccess',
  return_requested: 'stageError', returned: 'stageNeutral',
};

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const OrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true); setError('');
    ordersApi.list({ search: debouncedSearch || undefined, stage: stageFilter as OrderStage || undefined, mode: modeFilter || undefined, page, limit: LIMIT })
      .then(r => { setOrders(r.orders); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, stageFilter, modeFilter, page]);

  const exportCSV = () => {
    const rows = [['Order ID','Customer','Mode','Stage','Hub','Total','Created'],
      ...orders.map(o => [o.id, o.customer, o.mode, stageLabels[o.stage], o.hub, `₹${o.total}`, o.created])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Orders</h1>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={exportCSV}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order ID or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}>
          <option value="">All Stages</option>
          {(Object.keys(stageLabels) as OrderStage[]).map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
        </select>
        <select className={styles.filterSelect} value={modeFilter} onChange={e => { setModeFilter(e.target.value); setPage(1); }}>
          <option value="">All Modes</option>
          <option value="Simplified">Simplified</option>
          <option value="Luxe">Luxe</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStageFilter(''); setModeFilter(''); setPage(1); }}><X size={14} /> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Order ID</th><th>Customer</th><th>Mode</th><th>Products</th>
            <th>Stage</th><th>Hub</th><th>Total</th><th>Date</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: 8}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={8} className={styles.empty}>
                {error}<br/><button className={styles.retryBtn} onClick={() => setPage(1)}>Retry</button>
              </td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No orders found.</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className={`${styles.row} ${o.overdue ? styles.rowOverdue : ''}`}
                onClick={() => navigate(`/admin/orders/${o.id}`)}>
                <td className={styles.orderId}>{o.id}</td>
                <td>
                  <div className={styles.customerName}>{o.customer}</div>
                  <div className={styles.customerPhone}>{o.phone}</div>
                </td>
                <td><span className={`${styles.modePill} ${o.mode === 'Luxe' ? styles.pillGold : styles.pillGreen}`}>{o.mode}</span></td>
                <td className={styles.products}>
                  {o.products?.slice(0,2).join(', ')}
                  {(o.products?.length ?? 0) > 2 ? ` +${o.products.length - 2}` : ''}
                </td>
                <td><span className={`${styles.stagePill} ${styles[stageCss[o.stage]]}`}>{stageLabels[o.stage]}</span></td>
                <td className={styles.hub}>{o.hub}</td>
                <td className={styles.total}>₹{o.total?.toLocaleString('en-IN')}</td>
                <td className={styles.date}>{o.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} order${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};
