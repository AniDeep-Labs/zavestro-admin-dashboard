import React from 'react';
import { Link } from 'react-router-dom';
import { invoicesApi, ordersApi, hubsApi } from '../../api/adminApi';
import type { Invoice, AdminOrder, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/Button/Button';
import { StatusBadge, PageHeader, Drawer, EmptyState } from '../../components';
import styles from './OrdersListPage.module.css';
import ds from './DistributionPage.module.css';
import kpi from './CodReconciliationPage.module.css';
import iv from './InvoicesListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilImport, UilPlus, UilRefresh, UilSearch, UilTimes, UilEye } from '@iconscout/react-unicons';
import { money } from '../../utils/money';

// ACP-2 [KA8-15]: one money formatter for the whole admin (src/utils/money.ts).
// This page declared its own; five pages did, every one different, producing four
// shapes of the same amount product-wide — two of them in the same table row.
const fmtINR = (n: number | null | undefined) => money(n);

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const InvoicesListPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [hubFilter, setHubFilter] = React.useState('');
  const [month, setMonth] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalInvoiced, setTotalInvoiced] = React.useState(0);
  const [totalGst, setTotalGst] = React.useState(0); // T2-19: GST itemized across the filtered set
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const debouncedSearch = useDebounce(search, 350);

  // generate modal
  const [showGenerate, setShowGenerate] = React.useState(false);
  const [orderSearch, setOrderSearch] = React.useState('');
  const [orderResults, setOrderResults] = React.useState<AdminOrder[]>([]);
  const [generatingId, setGeneratingId] = React.useState<string | null>(null);
  const debouncedOrderSearch = useDebounce(orderSearch, 350);

  // regenerate confirm + PDF preview drawer
  const [regenTarget, setRegenTarget] = React.useState<Invoice | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);
  const [preview, setPreview] = React.useState<{ inv: Invoice; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    invoicesApi.list({
      orderId: debouncedSearch || undefined,
      status: statusFilter || undefined,
      hub_id: hubFilter || undefined,
      month: month || undefined,
      page,
      limit: 25,
    })
      .then(r => { setInvoices(r.invoices); setTotal(r.total); setTotalInvoiced(r.total_invoiced ?? 0); setTotalGst(r.total_gst ?? 0); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, hubFilter, month, page, refreshTick]);

  React.useEffect(() => { hubsApi.list().then(r => setHubs(r.hubs)).catch(() => {}); }, []);

  React.useEffect(() => {
    if (!showGenerate || debouncedOrderSearch.trim().length < 2) { setOrderResults([]); return; }
    ordersApi.list({ search: debouncedOrderSearch.trim(), limit: 6 })
      .then(r => setOrderResults(r.orders))
      .catch(() => {});
  }, [showGenerate, debouncedOrderSearch]);

  const handleGenerate = async (order: AdminOrder) => {
    setGeneratingId(order.id);
    try {
      await invoicesApi.generateForOrder(order.id);
      showToast('success', 'Invoice queued', `Generation queued for ${order.reference_id ?? order.id}`);
      setShowGenerate(false); setOrderSearch(''); setOrderResults([]);
      setRefreshTick(t => t + 1);
    } catch (e) {
      showToast('error', 'Generation failed', e instanceof Error ? e.message : undefined);
    } finally { setGeneratingId(null); }
  };

  const openPreview = async (inv: Invoice) => {
    if (inv.status !== 'generated') { showToast('warning', 'Not ready', 'Invoice PDF has not been generated yet'); return; }
    setPreviewLoading(true);
    setActionId(inv.id);
    try {
      const { url } = await invoicesApi.getDownloadUrl(inv.id);
      setPreview({ inv, url });
    } catch (e) {
      showToast('error', 'Preview failed', e instanceof Error ? e.message : undefined);
    } finally { setPreviewLoading(false); setActionId(null); }
  };

  const handleDownload = async (inv: Invoice) => {
    if (inv.status !== 'generated') { showToast('warning', 'Not ready', 'Invoice PDF has not been generated yet'); return; }
    setActionId(inv.id);
    try {
      const { url } = await invoicesApi.getDownloadUrl(inv.id);
      window.open(url, '_blank');
    } catch (e) {
      showToast('error', 'Download failed', e instanceof Error ? e.message : undefined);
    } finally { setActionId(null); }
  };

  const doRegenerate = async () => {
    if (!regenTarget) return;
    setRegenerating(true);
    try {
      await invoicesApi.regenerate(regenTarget.id);
      setInvoices(prev => prev.map(i => i.id === regenTarget.id ? { ...i, status: 'pending_generation' } : i));
      showToast('success', 'Queued', `Invoice ${regenTarget.invoice_number} queued for regeneration`);
      setRegenTarget(null);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setRegenerating(false); }
  };

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setHubFilter(''); setMonth(''); setPage(1); };
  const filtered = !!(search || statusFilter || hubFilter || month);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageHeader
        eyebrow="Finance · Money"
        title="Invoices"
        subtitle="Generate, preview and re-issue customer tax invoices. Filter by hub or month for the CA's monthly pack."
        actions={<Button variant="primary" onClick={() => { setShowGenerate(true); setOrderSearch(''); setOrderResults([]); }}><UilPlus size={16} /> Generate invoice</Button>}
      />

      <div className={kpi.summary}>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>{month ? 'Invoices this month' : filtered ? 'Invoices (filtered)' : 'Invoices (total)'}</div>
          <div className={kpi.summaryValue}>{loading ? '—' : total}</div>
        </div>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Total invoiced</div>
          <div className={kpi.summaryValue}>{loading ? '—' : fmtINR(totalInvoiced)}</div>
          <div className={kpi.summarySub}>sum of order value</div>
        </div>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>GST collected</div>
          <div className={kpi.summaryValue}>{loading ? '—' : fmtINR(totalGst)}</div>
          <div className={kpi.summarySub}>CGST+SGST / IGST, itemized on generated invoices</div>
        </div>
      </div>

      <div className={ds.toolbar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search by Order ID…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={ds.hubSel} value={hubFilter} onChange={e => { setHubFilter(e.target.value); setPage(1); }}>
          <option value="">All hubs</option>
          {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select className={ds.hubSel} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="generated">Generated</option>
          <option value="pending_generation">Pending generation</option>
          <option value="failed">Failed</option>
        </select>
        <span className={iv.monthWrap}><input className={iv.monthInput} type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} aria-label="Month" /></span>
        {filtered && <button className={styles.clearBtn} onClick={clearFilters}><UilTimes size={14} /> Clear</button>}
        <button className={styles.clearBtn} onClick={() => setRefreshTick(t => t + 1)} title="Refresh"><UilRefresh size={14} /> Refresh</button>
      </div>

      {loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th>Invoice #</th><th>Order</th><th>Customer</th><th>Hub</th><th className="moneyCell">Amount</th><th className="moneyCell">GST</th><th>Status</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title={filtered ? 'No invoices match these filters' : 'No invoices yet'}
          body={filtered ? 'Try clearing the hub, month or status filters.' : 'Invoices auto-generate from orders. You can also generate one manually for a specific order.'}
          action={filtered ? { label: 'Clear filters', onClick: clearFilters } : { label: 'Generate invoice', onClick: () => { setShowGenerate(true); setOrderSearch(''); setOrderResults([]); } }}
        />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th>Invoice #</th><th>Order</th><th>Customer</th><th>Hub</th><th className="moneyCell">Amount</th><th className="moneyCell">GST</th><th>Status</th><th>Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className={styles.row}>
                    <td className={styles.orderId}>{inv.invoice_number}</td>
                    <td className={styles.orderId}><Link to={`/admin/orders/${inv.order_id}`} className={styles.orderId}>{inv.order_number}</Link></td>
                    <td><div className={styles.customerName}>{inv.customer_name}</div></td>
                    <td>{inv.hub_name ?? '—'}</td>
                    <td className={styles.total}>{inv.payable_amount != null ? fmtINR(Number(inv.payable_amount)) : '—'}</td>
                    <td>{inv.tax_total != null ? `${fmtINR(Number(inv.tax_total))} ${inv.is_interstate ? 'IGST' : 'GST'}` : '—'}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td className={styles.date}>{new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} disabled={(actionId === inv.id) || inv.status !== 'generated'} onClick={() => openPreview(inv)} title="Preview PDF"><UilEye size={13}/></button>
                        <button className={styles.actionBtn} disabled={(actionId === inv.id) || inv.status !== 'generated'} onClick={() => handleDownload(inv)} title="Download PDF"><UilImport size={13}/></button>
                        <button className={styles.actionBtn} disabled={actionId === inv.id} onClick={() => setRegenTarget(inv)} title="Regenerate"><UilRefresh size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.paginationRow}>
            <span className={styles.pagination}>{`${total} invoice${total !== 1 ? 's' : ''} total`}</span>
            <div className={styles.pageButtons}>
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}><UilAngleLeft size={15}/> Prev</button>
              <span className={styles.pageIndicator}>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
              <button className={styles.pageBtn} disabled={invoices.length < 25} onClick={() => setPage(p => p + 1)}>Next <UilAngleRight size={15}/></button>
            </div>
          </div>
        </>
      )}

      {/* Regenerate confirm — replaces the customer-visible invoice */}
      <ConfirmDialog
        open={regenTarget !== null}
        title="Regenerate this invoice?"
        message={regenTarget ? <>This re-issues <strong>{regenTarget.invoice_number}</strong> and <strong>replaces the customer-visible PDF</strong>. Use it after a correction. Continue?</> : ''}
        confirmLabel="Regenerate"
        loading={regenerating}
        onConfirm={doRegenerate}
        onCancel={() => setRegenTarget(null)}
      />

      {/* PDF preview drawer */}
      <Drawer open={preview !== null} onClose={() => setPreview(null)} title={preview ? `Invoice ${preview.inv.invoice_number}` : 'Invoice'} width="720px">
        {preview && (
          <>
            <div className={iv.drawerActions}>
              <Button variant="ghost" onClick={() => window.open(preview.url, '_blank')}><UilImport size={15} /> Download</Button>
            </div>
            <iframe className={iv.pdfFrame} src={preview.url} title={`Invoice ${preview.inv.invoice_number}`} />
          </>
        )}
      </Drawer>

      {previewLoading && null}

      {showGenerate && (
        <div className={styles.modalOverlay} onClick={() => setShowGenerate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Generate Invoice</h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Find the order to invoice — generation is queued and the PDF appears once ready. (Invoices auto-generate from orders; use this to create or re-trigger one manually.)
            </p>
            <div style={{ position: 'relative' }}>
              <input className={styles.fieldInput} autoFocus placeholder="Search order by number or customer…"
                value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              {orderResults.length > 0 && (
                <div className={styles.searchDropdown}>
                  {orderResults.map(o => (
                    <button key={o.id} className={styles.searchResult} disabled={generatingId !== null}
                      onClick={() => handleGenerate(o)}>
                      <span style={{ fontWeight: 500 }}>{o.reference_id ?? o.id}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                        {o.customer ?? ''}{generatingId === o.id ? ' · generating…' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {debouncedOrderSearch.trim().length >= 2 && orderResults.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                  No orders found for "{orderSearch}".
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowGenerate(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesListPage;
