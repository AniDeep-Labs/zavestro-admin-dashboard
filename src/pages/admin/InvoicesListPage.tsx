import React from 'react';
import { Search, X, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { invoicesApi } from '../../api/adminApi';
import type { Invoice } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const STATUS_CSS: Record<string, string> = {
  generated: 'stageSuccess', pending_generation: 'stageWarning', failed: 'stageError',
};

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const InvoicesListPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
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
    invoicesApi.list({
      orderId: debouncedSearch || undefined,
      status: statusFilter || undefined,
      page,
      limit: 25,
    })
      .then(r => { setInvoices(r.invoices); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, page]);

  const handleDownload = async (inv: Invoice) => {
    if (inv.status !== 'generated') {
      showToast('warning', 'Not ready', 'Invoice PDF has not been generated yet');
      return;
    }
    setActionId(inv.id);
    try {
      const { url } = await invoicesApi.getDownloadUrl(inv.id);
      window.open(url, '_blank');
    } catch (e) {
      showToast('error', 'Download failed', e instanceof Error ? e.message : undefined);
    } finally { setActionId(null); }
  };

  const handleRegenerate = async (inv: Invoice) => {
    setActionId(inv.id);
    try {
      await invoicesApi.regenerate(inv.id);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'pending_generation' } : i));
      showToast('success', 'Queued', `Invoice ${inv.invoice_number} queued for regeneration`);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setActionId(null); }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Invoices</h1>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search by Order ID…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="generated">Generated</option>
          <option value="pending_generation">Pending Generation</option>
          <option value="failed">Failed</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Invoice #</th><th>Order</th><th>Customer</th><th>Status</th><th>Date</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : invoices.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No invoices found.</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className={styles.row}>
                <td className={styles.orderId}>{inv.invoice_number}</td>
                <td className={styles.orderId}>{inv.order_number}</td>
                <td><div className={styles.customerName}>{inv.customer_name}</div></td>
                <td><span className={`${styles.stagePill} ${styles[STATUS_CSS[inv.status] ?? 'stageNeutral']}`}>{inv.status.replace(/_/g, ' ')}</span></td>
                <td className={styles.date}>{new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionBtn}
                      disabled={actionId === inv.id || inv.status !== 'generated'}
                      onClick={() => handleDownload(inv)}
                      title="Download PDF"
                    >
                      <Download size={13}/>
                    </button>
                    <button
                      className={styles.actionBtn}
                      disabled={actionId === inv.id}
                      onClick={() => handleRegenerate(inv)}
                      title="Regenerate"
                    >
                      <RefreshCw size={13}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} invoice${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page}</span>
          <button className={styles.pageBtn} disabled={invoices.length < 25 || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};
