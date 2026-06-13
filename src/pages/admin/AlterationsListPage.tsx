import React from 'react';
import { useNavigate } from 'react-router-dom';
import { alterationsApi } from '../../api/adminApi';
import type { AlterationRequest } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import { AgeCell } from '../../components/DataCells';
import { EmptyState } from '../../components/EmptyState';
import { Drawer } from '../../components/Drawer/Drawer';
import styles from './OrdersListPage.module.css';
import d from './AlterationsListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilSearch, UilTimes } from "@iconscout/react-unicons";

const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const AGING_DAYS = 5; // P1 alteration TAT target — surfaced where support lives

function useDebounce<T>(v: T, delay: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), delay); return () => clearTimeout(t); }, [v, delay]);
  return dv;
}

const isAging = (a: AlterationRequest) =>
  (a.status === 'pending' || a.status === 'in_progress') &&
  Date.now() - new Date(a.created_at).getTime() > AGING_DAYS * 24 * 3_600_000;

export const AlterationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [alterations, setAlterations] = React.useState<AlterationRequest[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [peek, setPeek] = React.useState<AlterationRequest | null>(null);
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
        a.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : alterations;
  const aging = filtered.filter(isAging);

  const renderRows = (list: AlterationRequest[]) =>
    list.map(a => (
      <tr key={a.id} className={styles.row} onClick={() => setPeek(a)}>
        <td className={styles.orderId}>{a.order_number}</td>
        <td><div className={styles.customerName}>{a.customer_name}</div></td>
        <td><div className={styles.customerPhone}>{a.customer_phone}</div></td>
        <td className={d.descCell}>{a.description}</td>
        <td><StatusBadge status={a.status} /></td>
        <td><AgeCell since={a.created_at} warnAfterH={AGING_DAYS * 24} alertAfterH={AGING_DAYS * 48} /></td>
      </tr>
    ));

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Alterations</h1>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map(v => <option key={v} value={v}>{statusLabel(v)}</option>)}
        </select>
        {(search || statusFilter) && (
          <button className={styles.clearBtn} onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}><UilTimes size={14}/> Clear</button>
        )}
      </div>

      {/* Aging leads — the P1 TAT exceptions where support intervenes */}
      {!loading && aging.length > 0 && (
        <>
          <h3 className={d.sectionTitle}>Aging — over {AGING_DAYS} days open</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Description</th><th>Status</th><th>Age</th></tr></thead>
              <tbody>{renderRows(aging)}</tbody>
            </table>
          </div>
        </>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Order</th><th>Customer</th><th>Phone</th><th>Description</th><th>Status</th><th>Age</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={6}><EmptyState title="No alteration requests" body="Alteration requests appear here as customers report fit issues." size="compact" /></td></tr>
            ) : renderRows(filtered)}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} alteration${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><UilAngleLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
          <button className={styles.pageBtn} disabled={alterations.length < 25 || loading} onClick={() => setPage(p => p + 1)}>Next <UilAngleRight size={15}/></button>
        </div>
      </div>

      {/* PeekDrawer detail (G-38) — read-mostly; ops executes the alteration in Phase B */}
      <Drawer open={peek !== null} onClose={() => setPeek(null)} title="Alteration request">
        {peek && (
          <div className={d.peek}>
            <div className={d.peekHead}>
              <StatusBadge status={peek.status} />
            </div>
            <dl className={d.peekList}>
              <dt>Order</dt>
              <dd>
                <button className={d.peekLink} onClick={() => navigate(`/admin/orders/${peek.order_id}`)}>
                  {peek.order_number} →
                </button>
              </dd>
              <dt>Customer</dt>
              <dd>{peek.customer_name} · {peek.customer_phone}</dd>
              <dt>Requested</dt>
              <dd>{new Date(peek.created_at).toLocaleString('en-IN')}</dd>
              <dt>Last update</dt>
              <dd>{new Date(peek.updated_at).toLocaleString('en-IN')}</dd>
              <dt>What needs altering</dt>
              <dd>{peek.description || '—'}</dd>
            </dl>
            <p className={d.peekNote}>
              The hub floor executes alterations from the ops app (Phase B). This
              view tracks status; deep-link to the order for the full history.
            </p>
            <button className={d.peekLink} onClick={() => navigate(`/admin/orders/${peek.order_id}`)}>
              Open order →
            </button>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AlterationsListPage;
