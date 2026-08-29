import React from 'react';
import { useNavigate } from 'react-router-dom';
import { returnsApi, ordersApi } from '../../api/adminApi';
import type { ReturnRequest, AdminOrder, CustomerLookupResult, ReturnSection } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import { Textarea } from '../../components/Textarea/Textarea';
import { CustomerQuickLookup } from '../../components/CustomerQuickLookup/CustomerQuickLookup';
import styles from './OrdersListPage.module.css';
import { PhoneCell } from '../../components/DataCells'; // ACP-3 [KA7-2]: masked by default
import ds from './DistributionPage.module.css';
import d from './AlterationsListPage.module.css';
import { UilSearch, UilTimes, UilPlus } from "@iconscout/react-unicons";
import { StatusBadge } from '../../components';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

// T2-31 (SP-4): the sectioned worklist. Order matters — the actionable bucket leads.
const SECTIONS: { key: ReturnSection; title: string }[] = [
  { key: 'needs_action', title: 'Needs action' },
  { key: 'pickup', title: 'Pickup & inspection' },
  { key: 'refund', title: 'Refund in progress' },
  { key: 'closed', title: 'Closed' },
];
const RETURN_REASONS = [
  { v: 'defective', l: 'Defective / quality issue → refund' },
  { v: 'wrong_item', l: 'Wrong item received → refund' },
  { v: 'wrong_measurements', l: 'Fit / measurements wrong → alteration' },
  { v: 'changed_mind', l: 'Changed mind → declined' },
  { v: 'other', l: 'Other → manual review' },
];

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const ReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [returns, setReturns] = React.useState<ReturnRequest[]>([]);
  // [SCA-44-3] server-aggregated truth, so a header count is not "what loaded"
  const [sectionCounts, setSectionCounts] = React.useState<Record<string, number> | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  // Create-on-behalf flow (search customer → pick delivered order → reason)
  const [showCreate, setShowCreate] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [selCustomer, setSelCustomer] = React.useState<CustomerLookupResult | null>(null);
  const [custOrders, setCustOrders] = React.useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = React.useState(false);
  const [selOrderId, setSelOrderId] = React.useState('');
  const [createReason, setCreateReason] = React.useState('defective');
  const [createDesc, setCreateDesc] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  // Worklist: pull the newest 100 and group by section client-side (RefundsPage pattern).
  // Closed returns age out naturally since the list is newest-first.
  //
  // [SUP-31-5] SEARCH, though, goes to the server. Filtering the loaded 100 in the
  // browser meant the 101st return could not be found at all — and since the list is
  // newest-first, "closed returns age out naturally" also means NEEDS ACTION ages out
  // once volume passes 100. The server also matches customer_phone, which this page
  // displays as its own column and which is the only identifier a caller reliably has.
  React.useEffect(() => {
    setLoading(true);
    returnsApi.list({ limit: 100, search: debouncedSearch || undefined })
      .then(r => {
        setReturns(r.returns);
        // [SCA-44-3] The TRUE counts, from the server, over the whole set.
        setSectionCounts(r.section_counts ?? null);
        setTruncated(!!r.truncated);
      })
      .catch(e => showToast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [refreshTick, debouncedSearch]);

  React.useEffect(() => {
    if (!selCustomer) { setCustOrders([]); setSelOrderId(''); return; }
    setLoadingOrders(true);
    ordersApi.list({ userId: selCustomer.id, limit: 20 })
      .then(r => setCustOrders(r.orders.filter(o => o.stage === 'delivered')))
      .catch(() => setCustOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [selCustomer]);

  const resetCreate = () => {
    setShowCreate(false); setSelCustomer(null); setCustOrders([]);
    setSelOrderId(''); setCreateReason('defective'); setCreateDesc('');
  };

  const handleCreate = async () => {
    if (!selCustomer || !selOrderId) {
      showToast('error', 'Pick a customer and a delivered order');
      return;
    }
    setCreating(true);
    try {
      await returnsApi.create({
        user_id: selCustomer.id,
        order_id: selOrderId,
        reason: createReason,
        description: createDesc.trim() || undefined,
      });
      showToast('success', 'Return created', 'Ops will inspect; finance approves any refund.');
      resetCreate();
      setRefreshTick(t => t + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast('error',
        msg?.includes('already exists') ? 'A return is already open on this order' : 'Failed',
        msg);
    } finally {
      setCreating(false);
    }
  };

  // [SUP-31-5] The server has already applied the search — re-filtering here would
  // silently drop phone matches, since these rows are matched on digits.
  const filtered = returns;

  const bySection = (key: ReturnSection) => filtered.filter(r => (r.section ?? 'closed') === key);
  // [SCA-44-3] Show what EXISTS, not what happened to load. The header used to
  // count the rows in the browser, so at 101 returns an operator could not tell a
  // quiet day from a truncated list — and nothing on screen changed shape to say so.
  //
  // [SUP-31-5] This used to fall back to the loaded count during a search, because the
  // search ran in the browser and the server's counts described the unfiltered set. The
  // search is now part of the same WHERE that produces those counts, so they describe
  // the filtered set and stay authoritative — which matters most here: a phone search
  // that matches beyond the loaded page would otherwise under-report its own results.
  const sectionCount = (key: ReturnSection, loaded: number) =>
    sectionCounts ? (sectionCounts[key] ?? loaded) : loaded;

  const renderSection = ({ key, title }: { key: ReturnSection; title: string }) => {
    const list = bySection(key);
    // [KA7-17] An empty bucket collapses to ONE LINE. Four expanded sections, two
    // of them a full header + a zero + "Nothing here.", meant the operator scrolled
    // past two announcements of nothing to reach one row of actual work. A worklist
    // should spend its vertical space on work.
    if (list.length === 0) {
      return (
        <div className={ds.emptyBucket} key={key}>
          {title} <span className={ds.count}>{sectionCount(key, 0)}</span>
        </div>
      );
    }
    return (
      <section className={ds.section} key={key}>
        <h2 className={ds.sectionTitle}>
          {title} <span className={ds.count}>{sectionCount(key, list.length)}</span>
          {!debouncedSearch && sectionCount(key, list.length) > list.length && (
            <span className={ds.count} title="More exist than are loaded on this page">
              · showing {list.length}
            </span>
          )}
        </h2>
        {(
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th>Order</th><th>Customer</th><th>Phone</th><th>Reason</th><th>Policy</th><th>Status</th><th>Date</th>
              </tr></thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} className={styles.row} {...rowActivation(() => navigate(`/admin/returns/${r.id}`))}>
                    <td className={styles.orderId}>{r.order_number}</td>
                    <td><div className={styles.customerName}>{r.customer_name}</div></td>
                    <td><div className={styles.customerPhone}><PhoneCell phone={r.customer_phone} /></div></td>
                    <td className={styles.reasonCell}>{r.reason}</td>
                    <td>{r.policy_verdict?.label ?? '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className={styles.date}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>
          Returns
          {/* [SCA-44-3] Say that this is a window, rather than letting the page
              imply the window is the whole world. The counts in the section
              headers are the server's, over everything. */}
          {truncated && (
            <span className={ds.count} title="This page shows the newest 100; the section counts are over all returns">
              showing the newest {returns.length}
            </span>
          )}
        </h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <UilPlus size={15} /> New return
        </Button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order, customer or phone…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search && (
          <button className={styles.clearBtn} onClick={() => setSearch('')}><UilTimes size={14}/> Clear</button>
        )}
      </div>

      {loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}><tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            ))}
          </tbody></table>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.tableWrap}><table className={styles.table}><tbody>
          <tr><td colSpan={7} className={styles.empty}>No return requests found.</td></tr>
        </tbody></table></div>
      ) : (
        SECTIONS.map(renderSection)
      )}

      {/* Create on behalf — search customer → pick delivered order → reason */}
      <Modal open={showCreate} onClose={resetCreate} title="New return request">
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
                <p className={d.createHint}>This customer has no delivered orders — a return needs one.</p>
              ) : (
                <select className={styles.filterSelect} value={selOrderId} onChange={e => setSelOrderId(e.target.value)}>
                  <option value="">Select an order…</option>
                  {custOrders.map(o => (
                    <option key={o.uuid ?? o.id} value={o.uuid ?? o.id}>
                      {o.reference_id ?? o.id} · ₹{o.total.toLocaleString('en-IN')} · {o.created}
                    </option>
                  ))}
                </select>
              )}

              <label className={d.createLabel}>Reason</label>
              <select className={styles.filterSelect} value={createReason} onChange={e => setCreateReason(e.target.value)}>
                {RETURN_REASONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>

              <label className={d.createLabel}>Details (optional)</label>
              <Textarea value={createDesc} onChange={setCreateDesc} placeholder="What did the customer report?" rows={3} />
            </>
          )}

          <div className={d.createActions}>
            <Button variant="ghost" size="sm" onClick={resetCreate}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}
              disabled={!selCustomer || !selOrderId || creating}
              state={creating ? 'loading' : 'default'}>
              Create return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
