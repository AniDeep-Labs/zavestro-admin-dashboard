import React from 'react';
import { useNavigate } from 'react-router-dom';
import { alterationsApi, ordersApi } from '../../api/adminApi';
import type { AlterationRequest, AdminOrder, CustomerLookupResult } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import { AgeCell , PhoneCell } from '../../components/DataCells';
import { EmptyState } from '../../components/EmptyState';
import { Drawer } from '../../components/Drawer/Drawer';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import { Textarea } from '../../components/Textarea/Textarea';
import { CustomerQuickLookup } from '../../components/CustomerQuickLookup/CustomerQuickLookup';
import styles from './OrdersListPage.module.css';
import d from './AlterationsListPage.module.css';
import { UilAngleLeft, UilAngleRight, UilSearch, UilTimes, UilPlus } from "@iconscout/react-unicons";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

// [SUP-31-3] The statuses an alteration can ACTUALLY hold, in lifecycle order.
//
// This list used to be ['pending','in_progress','completed','cancelled'] and every
// one of the four was dead: measured against the live API, each returned 0 rows,
// and `pending` and `cancelled` are not even legal values — the DB's CHECK
// constraint (migrations 177 + 202) allows the eleven below. Meanwhile the two
// statuses the rows were actually in, `in_alteration` and `redelivered`, were not
// offered at all. A filter where every option is a dead end is worse than no
// filter: it reads as "there is nothing here".
const STATUSES = [
  'requested',
  'agent_visit_scheduled',
  'agent_visit_completed',
  'agent_visit_failed',
  'in_alteration',
  'alteration_qc',
  'ready_for_redelivery',
  'redelivered',
  // Kept for backwards compat with pre-migration rows (constraint 177).
  'in_progress',
  'completed',
  'rejected',
];

// The states in which an alteration is still SOMEBODY'S PROBLEM. Everything else
// is terminal, and an alteration sitting in a terminal state is not aging.
const TERMINAL_STATUSES = new Set(['redelivered', 'completed', 'rejected']);

const AGING_DAYS = 5; // P1 alteration TAT target — surfaced where support lives

function useDebounce<T>(v: T, delay: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), delay); return () => clearTimeout(t); }, [v, delay]);
  return dv;
}

// [SUP-31-3] Aging = still open and older than the TAT, whatever "open" is called.
//
// This tested `status === 'pending' || status === 'in_progress'` — two values the
// alteration machine does not produce — so a garment sitting in `in_alteration`
// for a month never entered the "Aging" panel, which is the page's entire reason
// to exist as a worklist. Written as "not terminal" so a new intermediate status
// is caught by default rather than silently exempted, which is how this broke.
const isAging = (a: AlterationRequest) =>
  !TERMINAL_STATUSES.has(a.status) &&
  Date.now() - new Date(a.created_at).getTime() > AGING_DAYS * 24 * 3_600_000;

export const AlterationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [alterations, setAlterations] = React.useState<AlterationRequest[]>([]);
  // [SUP-31-3] the aging panel's unpaginated source — see the effect below
  const [agingPool, setAgingPool] = React.useState<AlterationRequest[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [peek, setPeek] = React.useState<AlterationRequest | null>(null);
  const debouncedSearch = useDebounce(search, 350);

  // Create-on-behalf flow (search customer → pick delivered order → describe)
  const [showCreate, setShowCreate] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [selCustomer, setSelCustomer] = React.useState<CustomerLookupResult | null>(null);
  const [custOrders, setCustOrders] = React.useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = React.useState(false);
  const [selOrderId, setSelOrderId] = React.useState("");
  const [createDesc, setCreateDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    alterationsApi.list({ status: statusFilter || undefined, page, limit: 25 })
      .then(r => { setAlterations(r.alterations); setTotal(r.total); })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter, page, refreshTick]);

  // [SUP-31-3] The aging panel's own, unpaginated read. The exception a worklist
  // exists to surface must not depend on which page you happen to be looking at.
  // Deliberately unfiltered by the status dropdown too: filtering to one status
  // and being told nothing is late would be the same lie in a smaller box.
  React.useEffect(() => {
    alterationsApi.list({ limit: 200 })
      .then(r => setAgingPool(r.alterations))
      .catch(() => setAgingPool([]));
  }, [refreshTick]);

  // When a customer is chosen in the create modal, load their DELIVERED orders.
  React.useEffect(() => {
    if (!selCustomer) { setCustOrders([]); setSelOrderId(""); return; }
    setLoadingOrders(true);
    ordersApi.list({ userId: selCustomer.id, limit: 20 })
      .then(r => setCustOrders(r.orders.filter(o => o.stage === 'delivered')))
      .catch(() => setCustOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [selCustomer]);

  const resetCreate = () => {
    setShowCreate(false);
    setSelCustomer(null);
    setCustOrders([]);
    setSelOrderId("");
    setCreateDesc("");
  };

  const handleCreate = async () => {
    if (!selCustomer || !selOrderId || !createDesc.trim()) {
      showToast('error', 'Pick a customer, a delivered order and describe the alteration');
      return;
    }
    setCreating(true);
    try {
      const created = await alterationsApi.create({
        user_id: selCustomer.id,
        order_id: selOrderId,
        description: createDesc.trim(),
      });
      // [SUP-31-7] Report the fee the server computed; do not assert a policy.
      //
      // This said "First alteration on the order is free." flatly, while the fee is worked
      // out PER HUB from `alteration_fee` + `alteration_first_free` and returned on the
      // created row — which the client threw away. Every hub is ₹0/first-free today, so it
      // was latent rather than live; the day a hub sets a fee, the agent tells the customer
      // it is free and the customer is billed. That is the wrong way round to be wrong
      // about money.
      const fee = Number(created?.fee_amount ?? 0);
      showToast(
        'success',
        'Alteration created',
        created?.fee_status === 'waived'
          ? 'First alteration on this order — no charge at this hub.'
          : fee > 0
            ? `This hub charges ₹${fee.toLocaleString('en-IN')} for this alteration (${created?.fee_status ?? 'pending'}). Tell the customer before you proceed.`
            : 'No charge for this alteration at this hub.',
      );
      resetCreate();
      setRefreshTick(t => t + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast('error',
        msg?.includes('already exists') ? 'An alteration is already open on this order' : 'Failed',
        msg);
    } finally {
      setCreating(false);
    }
  };

  const filtered = debouncedSearch
    ? alterations.filter(a =>
        a.order_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.customer_name?.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : alterations;
  // [SUP-31-3] The aging panel scans the WHOLE set, not the visible page.
  //
  // It used to filter `filtered`, i.e. the current 25 rows, so a correctly-keyed
  // exception on page 2 was invisible — an exception panel that only sees the
  // first page is a panel that reports "nothing is late" while something is.
  const aging = agingPool.filter(isAging);

  const renderRows = (list: AlterationRequest[]) =>
    list.map(a => (
      <tr key={a.id} className={styles.row} {...rowActivation(() => setPeek(a))}>
        <td className={styles.orderId}>{a.order_number}</td>
        <td><div className={styles.customerName}>{a.customer_name}</div></td>
        <td><div className={styles.customerPhone}><PhoneCell phone={a.customer_phone} /></div></td>
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
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <UilPlus size={15} /> New alteration
        </Button>
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

      {/* Create on behalf — search customer → pick delivered order → describe */}
      <Modal open={showCreate} onClose={resetCreate} title="New alteration request">
        <div className={d.createForm}>
          <label className={d.createLabel}>Customer</label>
          <CustomerQuickLookup
            selectedCustomer={selCustomer}
            onSelect={setSelCustomer}
            onClear={() => setSelCustomer(null)}
          />

          {selCustomer && (
            <>
              <label className={d.createLabel}>Delivered order</label>
              {loadingOrders ? (
                <p className={d.createHint}>Loading orders…</p>
              ) : custOrders.length === 0 ? (
                <p className={d.createHint}>
                  This customer has no delivered orders — an alteration needs one.
                </p>
              ) : (
                <select
                  className={styles.filterSelect}
                  value={selOrderId}
                  onChange={(e) => setSelOrderId(e.target.value)}
                >
                  <option value="">Select an order…</option>
                  {custOrders.map((o) => (
                    <option key={o.uuid ?? o.id} value={o.uuid ?? o.id}>
                      {o.reference_id ?? o.id} · ₹{o.total.toLocaleString("en-IN")} · {o.created}
                    </option>
                  ))}
                </select>
              )}

              <label className={d.createLabel}>What needs altering</label>
              <Textarea
                value={createDesc}
                onChange={setCreateDesc}
                placeholder="e.g., Take in 1cm at the chest; shorten sleeves by 2cm"
                rows={3}
              />
            </>
          )}

          <div className={d.createActions}>
            <Button variant="ghost" size="sm" onClick={resetCreate}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!selCustomer || !selOrderId || !createDesc.trim() || creating}
              state={creating ? "loading" : "default"}
            >
              Create alteration
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AlterationsListPage;
