import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ordersApi, orderExceptionsApi } from '../../api/adminApi';
import type { AdminOrder, AssignableAdmin } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { CopyId, AgeCell, MoneyCell , PhoneCell } from '../../components/DataCells';
import { PeekDrawer } from '../../components/PeekDrawer';
import { downloadCsv, datedFilename } from '../../utils/csv';
import styles from './OrdersListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilImport, UilSearch, UilTimes } from "@iconscout/react-unicons";

const LIMIT = 25;

// The stage filter offers the CANONICAL stages (backend order-transitions.ts) —
// the old dropdown listed legacy names that matched no real rows.
const FILTER_STAGES = [
  'pending_payment', 'awaiting_measurement', 'measurement_complete', 'payment_confirmed',
  'cutting', 'in_tailoring', 'quality_check', 'rework',
  'ready_for_dispatch', 'shipped', 'delivered', 'delivery_failed', 'cancelled', 'refunded',
];

// Saved views (FABLE-ADMIN-UIUX §8C): the queues an operator actually opens.
const VIEWS = [
  { key: 'all', label: 'All', params: {} },
  { key: 'stuck', label: 'Stuck > 48h', params: { stuck: true } },
  { key: 'cod', label: 'COD', params: { paymentMethod: 'cod' } },
  { key: 'measure', label: 'Awaiting measurement', params: { stage: 'awaiting_measurement' } },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

const EMPTY_COPY: Record<ViewKey, { title: string; body?: string }> = {
  all: { title: 'No orders found', body: 'Orders appear here as customers check out.' },
  stuck: { title: 'No stuck orders ✓', body: 'Nothing has been sitting in a stage for more than 48 hours.' },
  cod: { title: 'No COD orders', body: 'No cash-on-delivery orders match the current filters.' },
  measure: { title: 'No orders awaiting measurement', body: 'Every measured-path order has its visit done.' },
};

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const OrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  // List state lives in the URL (search/stage/view/page) so back, refresh and
  // deep-links all preserve it — the §1.1 back-behavior rule.
  const [sp, setSp] = useSearchParams();
  const view = (VIEWS.find(v => v.key === sp.get('view'))?.key ?? 'all') as ViewKey;
  const search = sp.get('search') ?? '';
  const stageFilter = sp.get('stage') ?? '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  // T2-17: the stuck view is an exception inbox — default to what needs an owner (Unclaimed).
  const isStuck = view === 'stuck';
  const ownerFilter = (isStuck ? (sp.get('owner') ?? 'unowned') : 'all') as 'unowned' | 'mine' | 'all';
  // T2-33 (F-4): the Finance P&L / settlement drill-down lands here with a hub + date window.
  const hubIdFilter = sp.get('hub_id') ?? '';
  const fromFilter = sp.get('from') ?? '';
  const toFilter = sp.get('to') ?? '';
  const hubLabel = sp.get('hub_name') ?? ''; // display only, carried by the drill link
  const drillActive = !!(hubIdFilter || fromFilter || toFilter);

  const setParam = (key: string, value: string) => {
    setSp(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [exporting, setExporting] = React.useState(false);
  const [assignable, setAssignable] = React.useState<AssignableAdmin[]>([]);
  const [assignOpenId, setAssignOpenId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // SP-9: quick-look peek so an operator can triage a row without leaving the queue.
  const [peek, setPeek] = React.useState<AdminOrder | null>(null);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const queryParams = React.useCallback((p: number, limit: number) => {
    const viewParams = VIEWS.find(v => v.key === view)?.params ?? {};
    return {
      search: debouncedSearch || undefined,
      stage: stageFilter || undefined,
      ...viewParams,
      owner: isStuck ? ownerFilter : undefined,
      hub_id: hubIdFilter || undefined,
      from: fromFilter || undefined,
      to: toFilter || undefined,
      page: p,
      limit,
    };
  }, [debouncedSearch, stageFilter, view, isStuck, ownerFilter, hubIdFilter, fromFilter, toFilter]);

  const reload = React.useCallback(() => {
    setLoading(true); setError('');
    ordersApi.list(queryParams(page, LIMIT))
      .then(r => { setOrders(r.orders); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [queryParams, page]);

  React.useEffect(() => { reload(); }, [reload]);

  // Load the assignee picker lazily the first time the stuck (exception) view is opened.
  React.useEffect(() => {
    if (isStuck && assignable.length === 0) {
      orderExceptionsApi.assignable().then(setAssignable).catch(() => { /* picker just stays empty */ });
    }
  }, [isStuck, assignable.length]);

  // Exception actions operate on the real order UUID (o.uuid); refresh the list + badge after.
  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(label);
    try {
      await fn();
      setAssignOpenId(null);
      reload();
    } catch (e) {
      showToast('error', 'Action failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusyId(null);
    }
  };
  const claim = (o: AdminOrder) => runAction(o.id, () => orderExceptionsApi.claim(o.uuid ?? o.id));
  const release = (o: AdminOrder) => runAction(o.id, () => orderExceptionsApi.release(o.uuid ?? o.id));
  const assign = (o: AdminOrder, adminId: string) =>
    runAction(o.id, () => orderExceptionsApi.claim(o.uuid ?? o.id, { assigned_to: adminId }));

  // Exports ALL orders matching the current filters (not just the current page).
  const exportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all: AdminOrder[] = [];
      for (let p = 1; p <= 500; p++) {
        const r = await ordersApi.list(queryParams(p, 100));
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
          { header: 'Stage', value: o => statusLabel(o.stage) },
          { header: 'Status', value: o => o.status },
          { header: 'Payment', value: o => o.payment_method ?? '' },
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

  const clearAll = () => setSp(new URLSearchParams(), { replace: true });
  const hasFilters = !!(search || stageFilter || view !== 'all');

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Orders</h1>
        <div className={styles.headerActions}>
          {/* AG-S3 (scan): the only way into the tag sheet. A route with no link
              is unreachable — the same "no caller" problem the scan work exists
              to avoid, in a different guise. */}
          <button className={styles.exportBtn} onClick={() => navigate('/admin/orders/tags')}>Garment tags</button>
          <button className={styles.exportBtn} onClick={exportCSV} disabled={exporting}><UilImport size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}</button>
        </div>
      </div>

      {/* Saved views — the operator's queues lead, filters refine */}
      <div className={styles.viewChips}>
        {VIEWS.map(v => (
          <button
            key={v.key}
            className={`${styles.viewChip} ${view === v.key ? styles.viewChipActive : ''}`}
            onClick={() => setParam('view', v.key === 'all' ? '' : v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* T2-33 (F-4): drill-down filter banner — shown when arriving from a Finance P&L /
          settlement row. Makes the scope explicit and one-click clearable. */}
      {drillActive && (
        <div className={styles.drillBanner}>
          <span>
            Filtered from Finance
            {hubLabel ? ` · ${hubLabel}` : hubIdFilter ? ' · one hub' : ''}
            {fromFilter || toFilter ? ` · ${fromFilter || '…'} → ${toFilter || '…'}` : ''}
          </span>
          <button
            className={styles.drillClear}
            onClick={() =>
              setSp(prev => {
                const next = new URLSearchParams(prev);
                ['hub_id', 'from', 'to', 'hub_name', 'page'].forEach(k => next.delete(k));
                return next;
              }, { replace: true })
            }
          >
            <UilTimes size={14} /> Clear
          </button>
        </div>
      )}

      {/* T2-17: ownership sub-filter for the stuck exception inbox */}
      {isStuck && (
        <div className={styles.subFilter}>
          <span className={styles.subFilterLabel}>Ownership</span>
          {(['unowned', 'mine', 'all'] as const).map(k => (
            <button
              key={k}
              className={`${styles.viewChip} ${ownerFilter === k ? styles.viewChipActive : ''}`}
              onClick={() => setParam('owner', k)}
            >
              {k === 'unowned' ? 'Unclaimed' : k === 'mine' ? 'Mine' : 'All'}
            </button>
          ))}
        </div>
      )}

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order ID, customer or phone…"
            value={search} onChange={e => setParam('search', e.target.value)} />
        </div>
        <select className={styles.filterSelect} value={stageFilter} onChange={e => setParam('stage', e.target.value)}>
          <option value="">All Stages</option>
          {FILTER_STAGES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        {hasFilters && (
          <button className={styles.clearBtn} onClick={clearAll}><UilTimes size={14} /> Clear</button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Ref</th><th>Order ID</th><th>Customer</th><th>Products</th>
            <th>Stage</th><th>Age</th><th>Hub</th><th>Total</th><th>Date</th>
            {isStuck && <th>Owner</th>}
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: isStuck ? 10 : 9}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={isStuck ? 10 : 9}>
                <EmptyState
                  title="Couldn't load orders"
                  body={error}
                  action={{ label: 'Retry', onClick: () => setParam('page', '') }}
                  size="compact"
                />
              </td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={isStuck ? 10 : 9}>
                <EmptyState
                  title={EMPTY_COPY[view].title}
                  body={hasFilters && view === 'all' ? 'Nothing matches the current filters.' : EMPTY_COPY[view].body}
                  action={hasFilters ? { label: 'Clear filters', onClick: clearAll } : undefined}
                  size="compact"
                />
              </td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className={`${styles.row} ${o.overdue ? styles.rowOverdue : ''}`}
                onClick={() => setPeek(o)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter") (() => setPeek(o))?.(); }}>
                <td>{o.reference_id ? <CopyId value={o.reference_id} /> : '—'}</td>
                <td className={styles.orderId}>{o.id}</td>
                <td>
                  <div className={styles.customerName}>{o.customer}</div>
                  <div className={styles.customerPhone}><PhoneCell phone={o.phone} /></div>
                </td>
                <td className={styles.products}>
                  {o.products?.slice(0,2).join(', ')}
                  {(o.products?.length ?? 0) > 2 ? ` +${o.products.length - 2}` : ''}
                </td>
                <td><StatusBadge status={o.stage} /></td>
                <td><AgeCell since={o.updated_at} /></td>
                <td className={styles.hub}>{o.hub}</td>
                <td><MoneyCell amount={o.total} /></td>
                <td className={styles.date}>{o.created}</td>
                {isStuck && (
                  <td className={styles.ownerCell} onClick={e => e.stopPropagation()}>
                    {o.exception_owner ? (
                      <div className={styles.ownedWrap}>
                        <span className={styles.ownerChip} title={`Owned since ${o.exception_claimed_at ? new Date(o.exception_claimed_at).toLocaleString('en-IN') : ''}`}>
                          {o.exception_owner}
                        </span>
                        <button className={styles.ownerBtn} disabled={busyId === o.id} onClick={() => release(o)}>Release</button>
                      </div>
                    ) : assignOpenId === o.id ? (
                      <select
                        className={styles.assignSelect}
                        autoFocus
                        defaultValue=""
                        disabled={busyId === o.id}
                        onChange={e => { if (e.target.value) assign(o, e.target.value); }}
                        onBlur={() => setAssignOpenId(null)}
                      >
                        <option value="" disabled>Assign to…</option>
                        {assignable.map(a => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
                      </select>
                    ) : (
                      <div className={styles.ownedWrap}>
                        <span className={styles.unownedChip}>Unclaimed</span>
                        <button className={styles.ownerBtn} disabled={busyId === o.id} onClick={() => claim(o)}>Claim</button>
                        <button className={styles.ownerBtnGhost} disabled={busyId === o.id || assignable.length === 0} onClick={() => setAssignOpenId(o.id)}>Assign</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SP-9: quick-look — triage a row (stage, age, hub, ₹, contact) without
          leaving the queue; escalate to the full order only when needed. */}
      <PeekDrawer
        open={peek !== null}
        onClose={() => setPeek(null)}
        title={peek ? peek.customer : ''}
        subtitle={peek ? (peek.reference_id ?? peek.id) : undefined}
        status={peek ? <StatusBadge status={peek.stage} /> : undefined}
        fullLink={
          peek
            ? {
                label: 'Open full order',
                onClick: () => navigate(`/admin/orders/${peek.id}`),
              }
            : undefined
        }
      >
        {peek && (
          <dl className={styles.peekList}>
            <div className={styles.peekRow}>
              <dt>Contact</dt>
              <dd>{peek.phone || '—'}</dd>
            </div>
            <div className={styles.peekRow}>
              <dt>Products</dt>
              <dd>{peek.products?.length ? peek.products.join(', ') : '—'}</dd>
            </div>
            <div className={styles.peekRow}>
              <dt>Age in stage</dt>
              <dd><AgeCell since={peek.updated_at} /></dd>
            </div>
            <div className={styles.peekRow}>
              <dt>Hub</dt>
              <dd>{peek.hub || '—'}</dd>
            </div>
            <div className={styles.peekRow}>
              <dt>Total</dt>
              <dd><MoneyCell amount={peek.total} /></dd>
            </div>
            <div className={styles.peekRow}>
              <dt>Payment</dt>
              <dd>{peek.payment_method ? peek.payment_method.toUpperCase() : '—'}</dd>
            </div>
            <div className={styles.peekRow}>
              <dt>Placed</dt>
              <dd>{peek.created}</dd>
            </div>
            {peek.exception_owner && (
              <div className={styles.peekRow}>
                <dt>Exception owner</dt>
                <dd>{peek.exception_owner}</dd>
              </div>
            )}
          </dl>
        )}
      </PeekDrawer>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} order${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setParam('page', String(page - 1))}><UilAngleLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setParam('page', String(page + 1))}>Next <UilAngleRight size={15}/></button>
        </div>
      </div>
    </div>
  );
};

export default OrdersListPage;
