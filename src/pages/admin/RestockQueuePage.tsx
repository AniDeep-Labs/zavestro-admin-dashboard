import React from 'react';
import { useHubContextFilter } from '../../utils/useHubContextFilter'; // [SHL-3-8]
import { useNavigate, useSearchParams } from 'react-router-dom';
import { restockApi, fabricsApi, hubsApi, adminAuthExtApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { RestockRequest, Fabric, Hub, FabricStockRow } from '../../api/adminApi';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge, PageHeader, EmptyState, NoHubAssigned } from '../../components';
import { AgeCell } from '../../components/DataCells';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';
import ds from './DistributionPage.module.css';
import rs from './RestockQueuePage.module.css';
import { UilPlus } from '@iconscout/react-unicons';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');
const numv = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
// Tone from the shared vocab key; label override keeps the restock-flow phrasing.
const PILL: Record<string, { key: string; label: string }> = {
  requested: { key: 'requested', label: 'Requested' },
  shipped: { key: 'in_transit', label: 'Sent · in transit' },
  fulfilled: { key: 'received', label: 'Received · in stock' },
  cancelled: { key: 'cancelled', label: 'Cancelled' },
};

type ConfirmState = {
  title: string;
  message: React.ReactNode;
  label: string;
  variant?: 'primary' | 'danger';
  run: () => Promise<void>;
};

export const RestockQueuePage: React.FC<{ mode?: 'cm' | 'procurement' }> = ({ mode = 'procurement' }) => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const isCm = mode === 'cm';

  const [rows, setRows] = React.useState<RestockRequest[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // procurement: per-hub stock context (`${hub}-${fabric}` → row) so a pending row
  // can show the requesting hub's current on-hand inline (size/approve the push).
  const [hubStock, setHubStock] = React.useState<Record<string, FabricStockRow>>({});

  // CM request form (hub is locked to the signed-in CM's own hub).
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [myHubId, setMyHubId] = React.useState<string | null>(null);
  const [hubResolved, setHubResolved] = React.useState(false); // T2-38: me() has answered
  const [fFabric, setFFabric] = React.useState('');
  const [fQty, setFQty] = React.useState('');
  const [fNote, setFNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [actingId, setActingId] = React.useState('');

  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    restockApi
      .list({ hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
    if (isCm) {
      fabricsApi.list({ active: true }).then(setFabrics).catch(() => {});
      adminAuthExtApi.me()
        .then((m) => setMyHubId(m.hubId ?? null))
        .catch(() => {})
        .finally(() => setHubResolved(true));
    } else {
      fabricsApi
        .stock()
        .then((srows) => {
          const m: Record<string, FabricStockRow> = {};
          srows.forEach((x) => { m[`${x.hub_id}-${x.fabric_id}`] = x; });
          setHubStock(m);
        })
        .catch(() => {});
    }
  }, [isCm]);

  // Prefill from the origin context (CM's out-of-stock nudge: ?fabric=&qty=).
  React.useEffect(() => {
    if (!isCm) return;
    const f = sp.get('fabric');
    const q = sp.get('qty');
    if (f) setFFabric(f);
    if (q) setFQty(q);
  }, [isCm, sp]);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try { await confirm.run(); } finally { setConfirming(false); setConfirm(null); }
  };

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';
  const myHubName = myHubId ? hubName(myHubId) : '';

  const submit = async () => {
    if (!fFabric || !myHubId || !fQty || Number(fQty) <= 0) {
      toast('error', 'Pick a fabric and enter metres'); return;
    }
    setSubmitting(true);
    try {
      await restockApi.create({ fabric_id: fFabric, hub_id: myHubId, qty: Number(fQty), demand_note: fNote.trim() || undefined });
      toast('success', 'Restock requested', 'Procurement will ship it.');
      setFFabric(''); setFQty(''); setFNote('');
      load();
    } catch (e) {
      toast('error', 'Request failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (r: RestockRequest, status: 'shipped' | 'fulfilled' | 'cancelled') => {
    setActingId(r.id);
    try {
      const res = await restockApi.setStatus(r.id, status);
      toast('success', `Marked ${status}`, status === 'fulfilled' && res.stocked_meters ? `${res.stocked_meters}m landed in ${hubName(r.hub_id)} stock.` : undefined);
      load();
    } catch (e) {
      toast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setActingId('');
    }
  };

  const pending = rows.filter((r) => r.status === 'requested' || r.status === 'shipped');
  const fulfilled = rows.filter((r) => r.status === 'fulfilled');
  const cancelled = rows.filter((r) => r.status === 'cancelled');
  const pendCols = isCm ? 6 : 8;

  const goTrack = (r: RestockRequest) => navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`);

  const fabricCell = (r: RestockRequest) => (
    <div className={styles.fabricCell}>
      {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
      <div className={styles.fabricCellText}>
        <span className={rs.fabricName}>{r.fabric_name}</span>
        <span className={styles.fabricCellCode}>{r.fabric_code}</span>
      </div>
    </div>
  );

  // Procurement context: the requesting hub's current on-hand for this fabric.
  const stockCell = (r: RestockRequest) => {
    const st = hubStock[`${r.hub_id}-${r.fabric_id}`];
    if (!st) return <span className={rs.dim}>—</span>;
    const avail = numv(st.available_meters);
    const reorder = st.reorder_meters != null ? numv(st.reorder_meters) : null;
    const low = reorder != null && avail < reorder;
    return (
      <div className={rs.stockCtx}>
        <span className={low ? rs.stockLow : undefined}>{avail.toLocaleString('en-IN')} m on hand</span>
        {reorder != null && <span className={rs.stockSub}>reorder {reorder.toLocaleString('en-IN')} m{low ? ' · low' : ''}</span>}
      </div>
    );
  };

  const cancelBtn = (r: RestockRequest) => {
    // procurement may cancel anything in flight; CM may cancel only its own un-shipped request.
    const canCancel = isCm ? r.status === 'requested' : (r.status === 'requested' || r.status === 'shipped');
    if (!canCancel) return null;
    return (
      <Button variant="ghost" size="sm" disabled={actingId === r.id} onClick={() => setConfirm({
        title: 'Cancel this restock?', label: 'Cancel request', variant: 'danger',
        message: <>Cancel the restock for <strong>{r.fabric_name}</strong> ({r.fabric_code})?</>,
        run: () => act(r, 'cancelled'),
      })}>Cancel</Button>
    );
  };

  const pendingRow = (r: RestockRequest) => {
    const busy = actingId === r.id;
    return (
      <tr
        key={r.id}
        className={isCm ? undefined : `${styles.row} ${rs.clickRow}`}
         {...(isCm ? {} : rowActivation(() => goTrack(r)))}>
        <td>{fabricCell(r)}</td>
        {!isCm && <td>{hubName(r.hub_id)}</td>}
        {!isCm && <td>{stockCell(r)}</td>}
        <td className={styles.total}>{Number(r.qty)}</td>
        <td className={rs.noteCell}>{r.demand_note || <span className={rs.dim}>—</span>}</td>
        <td onClick={(e) => e.stopPropagation()}><AgeCell since={r.created_at} warnAfterH={72} alertAfterH={168} /></td>
        <td><StatusBadge status={PILL[r.status]?.key ?? r.status} label={PILL[r.status]?.label} /></td>
        <td onClick={(e) => e.stopPropagation()}>
          <div className={styles.rowActions}>
            {!isCm && r.status === 'requested' && (
              <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirm({
                title: 'Ship this restock?', label: 'Ship',
                message: <>Mark <strong>{Number(r.qty)}m</strong> of <strong>{r.fabric_name}</strong> ({r.fabric_code}) as sent to <strong>{hubName(r.hub_id)}</strong>? It'll show as <em>in transit</em>.</>,
                run: () => act(r, 'shipped'),
              })}>Ship</Button>
            )}
            {!isCm && r.status === 'shipped' && (
              <Button variant="primary" size="sm" disabled={busy} onClick={() => setConfirm({
                title: 'Mark received?', label: 'Yes, it arrived',
                message: <>Confirm <strong>{Number(r.qty)}m</strong> of <strong>{r.fabric_name}</strong> ({r.fabric_code}) physically arrived at <strong>{hubName(r.hub_id)}</strong>. This draws from central stock, lands it in the hub, and can't be undone.</>,
                run: () => act(r, 'fulfilled'),
              })}>Mark received</Button>
            )}
            {cancelBtn(r)}
          </div>
        </td>
      </tr>
    );
  };

  const historyRow = (r: RestockRequest) => (
    <tr
      key={r.id}
      className={isCm ? undefined : `${styles.row} ${rs.clickRow}`}
       {...(isCm ? {} : rowActivation(() => goTrack(r)))}>
      <td>{fabricCell(r)}</td>
      {!isCm && <td>{hubName(r.hub_id)}</td>}
      <td className={styles.total}>{Number(r.qty)}</td>
      <td className={rs.noteCell}>{r.demand_note || <span className={rs.dim}>—</span>}</td>
      <td><StatusBadge status={PILL[r.status]?.key ?? r.status} label={PILL[r.status]?.label} /></td>
      <td className={rs.dateCell}>{new Date(r.updated_at || r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
    </tr>
  );

  const skeleton = (cols: number, n = 4) =>
    Array.from({ length: n }).map((_, i) => (
      <tr key={`sk-${i}`}>{Array.from({ length: cols }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
    ));

  const historySection = (title: string, list: RestockRequest[]) =>
    list.length === 0 ? null : (
      <section className={ds.section}>
        <h2 className={ds.sectionTitle}>{title} <span className={ds.count}>{list.length}</span></h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Fabric</th>{!isCm && <th>Hub</th>}<th>Qty (m)</th><th>Demand note</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>{list.map(historyRow)}</tbody>
          </table>
        </div>
      </section>
    );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow={isCm ? 'Catalog · Stock' : 'Procurement · Supply'}
        title={isCm ? 'Request Restock' : 'Restock Queue'}
        subtitle={isCm
          ? 'Ask procurement to replenish a fabric at your hub, then track each request through to in-stock.'
          : 'Hubs ask for fabric — ship it from central stock and confirm it lands in their stock.'}
        meta={!loading && <span className={rs.headCount}>{pending.length} open · {rows.length} total</span>}
      />

      {/* T2-38 (PR-5): a hub-less CM can't request restocks (they're hub-scoped) — show the
          honest dead-end instead of a form that fails on submit. */}
      {isCm && hubResolved && !myHubId && <NoHubAssigned action="request restocks" />}
      {isCm && (!hubResolved || myHubId) && (
        <section className={`${styles.modalGrid} ${rs.requestCard}`}>
          <label className={styles.fieldLabel}>Fabric
            <select className={styles.filterSelect} value={fFabric} onChange={(e) => setFFabric(e.target.value)}>
              <option value="">Select…</option>
              {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>Hub
            <span className={rs.lockedHub} title="You can only request for your own hub">{myHubName || 'your hub'}</span>
          </label>
          <Input label="Metres" type="number" value={fQty} onChange={setFQty} placeholder="e.g. 40" />
          <Input label="Why (optional)" value={fNote} onChange={setFNote} placeholder="Running low" />
          <Button variant="primary" state={submitting ? 'loading' : 'default'} disabled={!myHubId} onClick={submit}><UilPlus size={15} /> Request</Button>
        </section>
      )}

      {!isCm && (
        <div className={ds.toolbar}>
          <select className={ds.hubSel} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
            <option value="">All hubs</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      )}

      {!loading && rows.length === 0 ? (
        isCm ? (
          <EmptyState title="No restock requests yet" body="Use the form above to ask procurement to replenish a fabric at your hub." />
        ) : (
          <EmptyState title="Queue is clear" body="No hub has requested a restock. Requests will appear here as hubs run low." />
        )
      ) : (
        <>
          <section className={ds.section}>
            <h2 className={ds.sectionTitle}>Pending {!loading && <span className={ds.count}>{pending.length}</span>}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fabric</th>
                    {!isCm && <th>Hub</th>}
                    {!isCm && <th>Hub stock</th>}
                    <th>Qty (m)</th>
                    <th>Demand note</th>
                    <th>Age</th>
                    <th>Status</th>
                    <th>{isCm ? '' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? skeleton(pendCols) : pending.length === 0 ? (
                    <tr><td colSpan={pendCols} className={styles.empty}>{isCm ? 'No open requests.' : 'Nothing waiting — every hub is stocked.'}</td></tr>
                  ) : pending.map(pendingRow)}
                </tbody>
              </table>
            </div>
          </section>

          {historySection('Fulfilled', fulfilled)}
          {historySection('Cancelled', cancelled)}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        variant={confirm?.variant}
        loading={confirming}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default RestockQueuePage;
