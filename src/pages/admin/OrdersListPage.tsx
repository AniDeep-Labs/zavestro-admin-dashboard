import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '../../api/adminApi';
import type { AdminOrder, OrderStage } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { downloadCsv, datedFilename } from '../../utils/csv';
import styles from './OrdersListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilImport, UilSearch, UilTimes } from "@iconscout/react-unicons";

const LIMIT = 25;

const stageLabels: Record<OrderStage, string> = {
  payment_pending: 'Payment Pending', payment_confirmed: 'Payment Confirmed',
  awaiting_measurement: 'Awaiting Measurement', measurement_complete: 'Measurement Done',
  fabric_sourced: 'Fabric Sourced', in_tailoring: 'In Tailoring',
  quality_check: 'Quality Check', ready_to_dispatch: 'Ready to Dispatch',
  dispatched: 'Dispatched', delivered: 'Delivered',
  return_requested: 'Return Requested', returned: 'Returned',
};

const stageCss: Record<OrderStage, string> = {
  payment_pending: 'stageNeutral', payment_confirmed: 'stageBlue',
  awaiting_measurement: 'stageWarning', measurement_complete: 'stageBlue',
  fabric_sourced: 'stageBlue', in_tailoring: 'stageWarning',
  quality_check: 'stageWarning', ready_to_dispatch: 'stageSuccess',
  dispatched: 'stageSuccess', delivered: 'stageSuccess',
  return_requested: 'stageError', returned: 'stageNeutral',
};

function getActionNeeded(o: AdminOrder): { label: string; css: string } | null {
  switch (o.stage) {
    case 'payment_confirmed':
      return { label: 'Schedule Visit', css: 'actionWarning' };
    case 'awaiting_measurement':
      if (!o.linked_measurement_booking_id) return { label: 'Book Visit', css: 'actionError' };
      return { label: 'Visit Booked', css: 'actionInfo' };
    case 'measurement_complete':
      if (!o.craftsperson_id) return { label: 'Assign Tailor', css: 'actionWarning' };
      return null;
    case 'fabric_sourced':
      return { label: 'Start Tailoring', css: 'actionWarning' };
    case 'quality_check':
      return { label: 'QC Needed', css: 'actionWarning' };
    case 'ready_to_dispatch':
      return { label: 'Dispatch', css: 'actionWarning' };
    case 'return_requested':
      return { label: 'Handle Return', css: 'actionError' };
    default:
      return null;
  }
}

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const OrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [exporting, setExporting] = React.useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true); setError('');
    ordersApi.list({ search: debouncedSearch || undefined, stage: stageFilter as OrderStage || undefined, page, limit: LIMIT })
      .then(r => { setOrders(r.orders); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, stageFilter, page]);

  // Exports ALL orders matching the current filters (not just the current page),
  // via the shared CSV util (proper escaping + Excel BOM).
  const exportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all: AdminOrder[] = [];
      for (let p = 1; p <= 500; p++) {
        const r = await ordersApi.list({
          search: debouncedSearch || undefined,
          stage: (stageFilter as OrderStage) || undefined,
          page: p,
          limit: 100,
        });
        all.push(...r.orders);
        if (p >= r.totalPages || r.orders.length === 0) break;
      }
      downloadCsv<AdminOrder>(
        datedFilename('orders'),
        [
          { header: 'Order ID', value: o => o.reference_id || o.id },
          { header: 'Customer', value: o => o.customer },
          { header: 'Phone', value: o => o.phone },
          { header: 'Email', value: o => o.email ?? '' },
          { header: 'Stage', value: o => stageLabels[o.stage] ?? o.stage },
          { header: 'Status', value: o => o.status },
          { header: 'Hub', value: o => o.hub },
          { header: 'Total (INR)', value: o => o.total },
          { header: 'Created', value: o => o.created },
        ],
        all,
      );
      showToast('success', 'Export ready', `${all.length} order${all.length === 1 ? '' : 's'} exported.`);
    } catch {
      showToast('error', 'Export failed', 'Could not export orders. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Orders</h1>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={exportCSV} disabled={exporting}><UilImport size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}</button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order ID or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}>
          <option value="">All Stages</option>
          {(Object.keys(stageLabels) as OrderStage[]).map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStageFilter(''); setPage(1); }}><UilTimes size={14} /> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Ref</th><th>Order ID</th><th>Customer</th><th>Products</th>
            <th>Stage</th><th>Hub</th><th>Total</th><th>Date</th><th>Action Needed</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: 9}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={9} className={styles.empty}>
                {error}<br/><button className={styles.retryBtn} onClick={() => setPage(1)}>Retry</button>
              </td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No orders found.</td></tr>
            ) : orders.map(o => {
              const action = getActionNeeded(o);
              return (
              <tr key={o.id} className={`${styles.row} ${o.overdue ? styles.rowOverdue : ''}`}
                onClick={() => navigate(`/admin/orders/${o.id}`)}>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{o.reference_id ?? '—'}</td>
                <td className={styles.orderId}>{o.id}</td>
                <td>
                  <div className={styles.customerName}>{o.customer}</div>
                  <div className={styles.customerPhone}>{o.phone}</div>
                </td>
                <td className={styles.products}>
                  {o.products?.slice(0,2).join(', ')}
                  {(o.products?.length ?? 0) > 2 ? ` +${o.products.length - 2}` : ''}
                </td>
                <td><span className={`${styles.stagePill} ${styles[stageCss[o.stage]]}`}>{stageLabels[o.stage]}</span></td>
                <td className={styles.hub}>{o.hub}</td>
                <td className={styles.total}>₹{o.total?.toLocaleString('en-IN')}</td>
                <td className={styles.date}>{o.created}</td>
                <td>
                  {action && <span className={`${styles.actionBadge} ${styles[action.css]}`}>{action.label}</span>}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} order${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><UilAngleLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next <UilAngleRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};

export default OrdersListPage;
