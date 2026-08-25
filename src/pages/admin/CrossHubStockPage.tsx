import React from 'react';
import { useHubContextFilter } from '../../utils/useHubContextFilter'; // [SHL-3-8]
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { fabricsApi, hubsApi, distributionApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type {
  FabricStockRow,
  Hub,
  Distribution,
  HubStockVariance,
  StaleReservation,
} from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { EmptyState, PageHeader } from '../../components';
import { Button } from '../../components/Button/Button';
import { MoneyCell, AgeCell } from '../../components/DataCells';
import styles from './OrdersListPage.module.css';
import ds from './DistributionPage.module.css';
import s from './CodReconciliationPage.module.css';
import cs from './CrossHubStockPage.module.css';
import { UilImport } from '@iconscout/react-unicons';
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');

const DEAD_STOCK_DAYS = 60; // SOLUTIONS P8: no movement for 60d = a decision you forgot to make

// The supply brain (G-29): exceptions lead — below-reorder, dead stock, and
// in-transit first, then the full grid. Reorder points editable inline; capital ₹
// (available + reserved metres we own) visible per row and per filtered view.
export const CrossHubStockPage: React.FC = () => {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = React.useState<FabricStockRow[]>([]);
  const [inTransit, setInTransit] = React.useState<Distribution[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  // Filter to a single fabric (spec §295) — also the `?fabric=` deep-link target (spec §284).
  const [fabricFilter, setFabricFilter] = React.useState(sp.get('fabric') ?? '');
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  // inline reorder-point edit
  const [editKey, setEditKey] = React.useState('');
  const [editVal, setEditVal] = React.useState('');
  const [savingReorder, setSavingReorder] = React.useState(false);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    fabricsApi
      .stock({ hub_id: hubFilter || undefined })
      .then(setRows)
      .catch((e) => toast('error', 'Load failed', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
    // In-transit pushes (open distributions) — an exception lead, not part of the grid.
    distributionApi
      .list({ status: 'pushed', hub_id: hubFilter || undefined })
      .then(setInTransit)
      .catch(() => setInTransit([]));
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);
  // T1-10: count-variance + monthly-count-due by hub.
  const [variance, setVariance] = React.useState<HubStockVariance[]>([]);
  React.useEffect(() => { fabricsApi.hubStockVariance().then(setVariance).catch(() => {}); }, []);
  // T1-12: stale-reservation exception view + guarded release.
  const [staleRes, setStaleRes] = React.useState<StaleReservation[]>([]);
  const [releaseFor, setReleaseFor] = React.useState<string | null>(null);
  const [releaseReason, setReleaseReason] = React.useState('');
  const [releasing, setReleasing] = React.useState(false);
  const loadStale = React.useCallback(() => {
    fabricsApi.staleReservations().then(setStaleRes).catch(() => {});
  }, []);
  React.useEffect(() => { loadStale(); }, [loadStale]);
  const doRelease = async (orderId: string) => {
    if (!releaseReason.trim()) { toast('error', 'A reason is required'); return; }
    setReleasing(true);
    try {
      await fabricsApi.releaseStaleReservation(orderId, releaseReason.trim());
      toast('success', 'Reservation released', 'The fabric is freed and the order is on hold.');
      setReleaseFor(null); setReleaseReason('');
      loadStale(); load();
    } catch (e) {
      toast('error', 'Release failed', e instanceof Error ? e.message : undefined);
    } finally {
      setReleasing(false);
    }
  };

  const hubName = (id: string) => hubs.find((h) => h.id === id)?.name ?? '—';

  const saveReorder = async (r: FabricStockRow) => {
    const v = editVal.trim();
    const meters = v === '' ? null : Number(v);
    if (meters !== null && (!Number.isFinite(meters) || meters < 0)) {
      toast('error', 'Enter a non-negative number (empty clears the point)');
      return;
    }
    setSavingReorder(true);
    try {
      await fabricsApi.setReorderPoint(r.hub_id, r.fabric_id, meters);
      setRows((prev) =>
        prev.map((x) =>
          x.hub_id === r.hub_id && x.fabric_id === r.fabric_id
            ? { ...x, reorder_meters: meters }
            : x,
        ),
      );
      setEditKey('');
      toast('success', meters === null ? 'Reorder point cleared' : `Reorder point set: ${meters}m`);
    } catch (e) {
      toast('error', 'Save failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSavingReorder(false);
    }
  };

  // Derived views
  const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));
  // Capital tied up = ALL metres we own (available + reserved-to-orders, not yet cut) × ₹/m.
  const value = (r: FabricStockRow) => {
    const ppm = num(r.price_per_meter);
    return ppm == null ? null : (Number(r.available_meters) + Number(r.reserved_meters)) * ppm;
  };

  // Distinct fabrics across the (hub-filtered) rows, for the fabric filter dropdown.
  const fabricOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => { if (!seen.has(r.fabric_id)) seen.set(r.fabric_id, `${r.fabric_name}${r.fabric_code ? ` (${r.fabric_code})` : ''}`); });
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const setFabric = (id: string) => {
    setFabricFilter(id);
    if (id) sp.set('fabric', id); else sp.delete('fabric');
    setSp(sp, { replace: true });
  };

  const visibleRows = fabricFilter ? rows.filter((r) => r.fabric_id === fabricFilter) : rows;
  const visibleTransit = fabricFilter ? inTransit.filter((d) => d.fabric_id === fabricFilter) : inTransit;

  const belowReorder = visibleRows.filter(
    (r) => r.reorder_meters != null && Number(r.available_meters) < Number(r.reorder_meters),
  );
  const deadStock = visibleRows.filter(
    (r) =>
      Number(r.available_meters) > 0 &&
      Date.now() - new Date(r.updated_at).getTime() > DEAD_STOCK_DAYS * 24 * 3_600_000,
  );
  const totalAvail = visibleRows.reduce((sum, r) => sum + Number(r.available_meters), 0);
  const totalValue = visibleRows.reduce((sum, r) => sum + (value(r) ?? 0), 0);

  // ── Matrix pivot (spec §294): fabric rows × hub columns ──
  const matrixHubs = React.useMemo(() => {
    const m = new Map<string, string>();
    visibleRows.forEach((r) => { if (!m.has(r.hub_id)) m.set(r.hub_id, r.hub_name); });
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleRows]);
  const matrixFabrics = React.useMemo(() => {
    const m = new Map<string, FabricStockRow>();
    visibleRows.forEach((r) => { if (!m.has(r.fabric_id)) m.set(r.fabric_id, r); });
    return [...m.values()].sort((a, b) => a.fabric_name.localeCompare(b.fabric_name));
  }, [visibleRows]);
  const cellMap = React.useMemo(() => {
    const m = new Map<string, FabricStockRow>();
    visibleRows.forEach((r) => m.set(`${r.fabric_id}|${r.hub_id}`, r));
    return m;
  }, [visibleRows]);
  // Per-hub capital + available footer (spec §294 "footer row: capital in stock ₹ per hub").
  const hubTotals = React.useMemo(() => {
    const m = new Map<string, { avail: number; capital: number }>();
    visibleRows.forEach((r) => {
      const cur = m.get(r.hub_id) ?? { avail: 0, capital: 0 };
      cur.avail += Number(r.available_meters);
      cur.capital += value(r) ?? 0;
      m.set(r.hub_id, cur);
    });
    return m;
  }, [visibleRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Hub', 'Fabric', 'Code', 'Available (m)', 'Reserved (m)', 'Reorder at (m)', '₹/m', 'Capital ₹ (avail+reserved)', 'Last moved'];
    const lines = visibleRows.map((r) =>
      [
        r.hub_name, r.fabric_name, r.fabric_code,
        Number(r.available_meters), Number(r.reserved_meters),
        r.reorder_meters != null ? Number(r.reorder_meters) : '',
        num(r.price_per_meter) ?? '',
        value(r) != null ? Math.round(value(r)!) : '',
        new Date(r.updated_at).toISOString().slice(0, 10),
      ].map(cell).join(','),
    );
    const csv = [header.map(cell).join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross-hub-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rowKey = (r: FabricStockRow) => `${r.hub_id}-${r.fabric_id}`;
  const openLedger = (r: FabricStockRow) =>
    navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`);
  const createDistribution = (r: FabricStockRow) =>
    navigate(
      `/admin/procurement/distribution?fabric_id=${r.fabric_id}&hub_id=${r.hub_id}`,
    );
  // Fabric name → its PDP (spec §297 out-link), without swallowing the row's click-to-ledger.
  const fabricNameLink = (r: FabricStockRow) => (
    <Link to={`/admin/procurement/fabrics/${r.fabric_id}`} className={cs.nameLink} onClick={(e) => e.stopPropagation()}>
      {r.fabric_name}
    </Link>
  );

  const exceptionTable = (list: FabricStockRow[], kind: 'reorder' | 'dead') => (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr>
          <th>Hub</th><th>Fabric</th><th>Available</th>
          {kind === 'reorder' ? <th>Reorder at</th> : <th>No movement since</th>}
          {/* T3-4 (W-P4): the raw draw behind the reorder point — makes it checkable, not trusted. */}
          {kind === 'reorder' && <th>Consumed (30d)</th>}
          <th>Capital</th><th></th>
        </tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={rowKey(r)} className={styles.row} {...rowActivation(() => openLedger(r))}>
              <td className={styles.customerName}>{r.hub_name}</td>
              <td>
                <div className={styles.fabricCell}>
                  {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                  {fabricNameLink(r)}
                </div>
              </td>
              <td className={styles.total}>{Number(r.available_meters)}m</td>
              <td className={styles.date}>
                {kind === 'reorder'
                  ? `${Number(r.reorder_meters)}m`
                  : new Date(r.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </td>
              {kind === 'reorder' && (
                <td className={styles.total}>
                  {r.consumed_30d != null ? `${Number(r.consumed_30d).toLocaleString('en-IN')}m` : '—'}
                  {r.reorder_suggestion != null && (
                    <div className={cs.sugg}>suggests ≈{Number(r.reorder_suggestion)}m</div>
                  )}
                </td>
              )}
              <td><MoneyCell amount={value(r)} /></td>
              <td>
                {/* below-reorder → push more (create distribution); dead stock is
                    OVER-supply → reviewing the movement ledger is the right action,
                    not pushing more in. */}
                <button
                  className={styles.exportBtn}
                  onClick={(e) => { e.stopPropagation(); (kind === 'reorder' ? createDistribution : openLedger)(r); }}
                >
                  {kind === 'reorder' ? 'Create distribution →' : 'Review movement →'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Procurement · Supply"
        title="Cross-hub Stock"
        subtitle="The supply brain — what's below reorder, what's dead, what's in transit, and every SKU's stock & capital per hub."
        actions={<Button variant="ghost" onClick={exportCsv} disabled={visibleRows.length === 0}><UilImport size={15} /> Export CSV</Button>}
      />

      {/* T1-10: count-variance + monthly-count-due by hub. */}
      {variance.some((v) => v.total_skus > 0) && (
        <div className={cs.varPanel}>
          <div className={cs.varTitle}>Stock count · variance by hub</div>
          <div className={cs.varGrid}>
            {variance.filter((v) => v.total_skus > 0).map((v) => (
              <div key={v.hub_id} className={cs.varCard}>
                <div className={cs.varHub}>{v.hub_name}</div>
                <div className={cs.varMeta}>
                  {v.skus_due_for_count > 0
                    ? <span className={cs.varDue}>{v.skus_due_for_count} of {v.total_skus} SKU{v.total_skus === 1 ? '' : 's'} due for count</span>
                    : <span>all {v.total_skus} counted</span>}
                </div>
                <div className={cs.varMeta}>
                  {v.count_adjustments > 0
                    ? `${v.count_adjustments} adjustment${v.count_adjustments === 1 ? '' : 's'} · ${v.total_variance_meters}m corrected`
                    : 'no variance recorded'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* T1-12: stale-reservation exception view + guarded release. */}
      {staleRes.length > 0 && (
        <div className={cs.stalePanel}>
          <div className={cs.staleTitle}>
            ⚠ Stale reservations — fabric locked on orders that haven't reached cutting
          </div>
          <div className={cs.staleList}>
            {staleRes.map((r) => (
              <div key={r.order_id} className={cs.staleRow}>
                <div className={cs.staleInfo}>
                  <Link to={`/admin/orders/${r.order_id}`} className={cs.staleOrder}>
                    {r.order_number}
                  </Link>
                  <span className={cs.staleMeta}>
                    {r.reserved_meters}m · {r.hub_name ?? '—'} · {r.stage.replace(/_/g, ' ')} ·{' '}
                    <strong className={cs.staleAge}>{r.age_days}d old</strong>
                    {r.customer_name ? ` · ${r.customer_name}` : ''}
                  </span>
                </div>
                {releaseFor === r.order_id ? (
                  <div className={cs.staleReleaseForm}>
                    <input
                      className={cs.staleReason}
                      value={releaseReason}
                      placeholder="reason (e.g. customer unreachable 20d)"
                      onChange={(e) => setReleaseReason(e.target.value)}
                    />
                    <Button variant="ghost" onClick={() => { setReleaseFor(null); setReleaseReason(''); }}>
                      Cancel
                    </Button>
                    <Button onClick={() => doRelease(r.order_id)} state={releasing ? 'loading' : 'default'}>
                      Release + hold
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => { setReleaseFor(r.order_id); setReleaseReason(''); }}>
                    Release
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={ds.toolbar}>
        <select className={ds.hubSel} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select className={cs.fabricSel} value={fabricFilter} onChange={(e) => setFabric(e.target.value)}>
          <option value="">All fabrics</option>
          {fabricOptions.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      {/* The numbers a supply manager steers by */}
      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>SKU·hub rows</div>
          <div className={s.summaryValue}>{loading ? '—' : visibleRows.length}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Meters available</div>
          <div className={s.summaryValue}>{loading ? '—' : `${totalAvail.toLocaleString('en-IN')}m`}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Capital in stock</div>
          <div className={s.summaryValue}>{loading ? '—' : `₹${Math.round(totalValue).toLocaleString('en-IN')}`}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Below reorder</div>
          <div className={`${s.summaryValue} ${belowReorder.length ? s.pendingAccent : ''}`}>
            {loading ? '—' : belowReorder.length}
          </div>
        </div>
      </div>

      {/* Exceptions FIRST — what needs ordering, what's bleeding capital, what's coming */}
      {!loading && belowReorder.length > 0 && (
        <section className={ds.section}>
          <h2 className={ds.sectionTitle}>Below reorder point <span className={ds.count}>{belowReorder.length}</span></h2>
          {exceptionTable(belowReorder, 'reorder')}
        </section>
      )}
      {!loading && deadStock.length > 0 && (
        <section className={ds.section}>
          <h2 className={ds.sectionTitle}>Dead stock — no movement for {DEAD_STOCK_DAYS}+ days <span className={ds.count}>{deadStock.length}</span></h2>
          {exceptionTable(deadStock, 'dead')}
        </section>
      )}
      {!loading && visibleTransit.length > 0 && (
        <section className={ds.section}>
          <h2 className={ds.sectionTitle}>In transit <span className={ds.count}>{visibleTransit.length}</span></h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Design</th><th>Fabric</th><th>To hub</th><th>Meters</th><th>Age</th></tr></thead>
              <tbody>
                {visibleTransit.map((d) => (
                  <tr
                    key={d.id}
                    className={styles.row}
                     {...rowActivation(() => navigate(`/admin/procurement/distribution?hub_id=${d.hub_id}`))}>
                    <td className={styles.customerName}>{d.design_name}</td>
                    <td>
                      <div className={styles.fabricCell}>
                        {swatch(d.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(d.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                        <span>{d.fabric_name ?? 'hub stocks SKU'}</span>
                      </div>
                    </td>
                    <td>{hubName(d.hub_id)}</td>
                    <td className={styles.total}>{Number(d.sellable_qty)}m</td>
                    <td><AgeCell since={d.created_at} warnAfterH={120} alertAfterH={240} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!loading && belowReorder.length === 0 && deadStock.length === 0 && visibleTransit.length === 0 && visibleRows.length > 0 && (
        <EmptyState title="Nothing below reorder, no dead stock, nothing in transit ✓" size="compact" />
      )}

      {/* The full grid — fabric × hub matrix (spec §294), sticky fabric column */}
      <section className={ds.section}>
        <h2 className={ds.sectionTitle}>All stock {!loading && visibleRows.length > 0 && <span className={ds.count}>{visibleRows.length}</span>}
          <span className={cs.sugg}> · cell = available m, click to open the ledger</span>
        </h2>
        {loading ? (
          <div className={styles.tableWrap}><table className={styles.table}><tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 4 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            ))}
          </tbody></table></div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={fabricFilter ? 'No stock for this fabric' : 'No stock yet'}
            body={fabricFilter ? 'Try clearing the fabric filter.' : 'Stock lands here when distributions and restocks are received.'}
            size="compact"
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${cs.matrix}`}>
              <thead>
                <tr>
                  <th className={cs.stickyHead}>Fabric</th>
                  {matrixHubs.map((h) => <th key={h.id} className={cs.hubCol}>{h.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrixFabrics.map((f) => (
                  <tr key={f.fabric_id}>
                    <td className={cs.stickyCell}>
                      <div className={styles.fabricCell}>
                        {swatch(f.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(f.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                        <div className={styles.fabricCellText}>
                          {fabricNameLink(f)}
                          <span className={styles.fabricCellCode}>{f.fabric_code}</span>
                        </div>
                      </div>
                    </td>
                    {matrixHubs.map((h) => {
                      const r = cellMap.get(`${f.fabric_id}|${h.id}`);
                      if (!r) return <td key={h.id} className={cs.cellEmpty}>—</td>;
                      const avail = Number(r.available_meters);
                      const reserved = Number(r.reserved_meters);
                      const reorder = num(r.reorder_meters);
                      const sugg = num(r.reorder_suggestion);
                      const low = reorder != null && avail < reorder;
                      const key = rowKey(r);
                      return (
                        <td key={h.id} className={cs.hubCol}>
                          <button
                            className={`${cs.cellMeters} ${avail <= 0 ? styles.stockZero : low ? styles.stockLow : ''}`}
                            title="Open the stock ledger"
                            onClick={() => openLedger(r)}
                          >{avail.toLocaleString('en-IN')}m</button>
                          {reserved > 0 && <div className={cs.cellReserved}>{reserved.toLocaleString('en-IN')}m reserved</div>}
                          <div className={cs.cellReorder}>
                            {editKey === key ? (
                              <span className={styles.reorderEdit}>
                                <input
                                  className={styles.reorderInput}
                                  type="number"
                                  min="0"
                                  value={editVal}
                                  placeholder={sugg != null ? String(sugg) : undefined}
                                  onChange={(e) => setEditVal(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveReorder(r); if (e.key === 'Escape') setEditKey(''); }}
                                  autoFocus
                                />
                                <button className={styles.exportBtn} disabled={savingReorder} onClick={() => saveReorder(r)}>
                                  {savingReorder ? '…' : 'Save'}
                                </button>
                              </span>
                            ) : (
                              <button
                                className={styles.reorderBtn}
                                title={sugg != null
                                  ? `Suggested ≈${sugg}m (demand during lead time). Set the reorder point — below it this SKU surfaces in the exception list.`
                                  : 'Set the reorder point — below it this SKU surfaces in the exception list'}
                                onClick={() => { setEditKey(key); setEditVal(reorder != null ? String(reorder) : ''); }}
                              >
                                {reorder != null ? `RP ${reorder}m` : (sugg != null ? <>set RP <span className={cs.sugg}>≈{sugg}m</span></> : 'set RP')}
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {/* Per-hub footer: available + capital ₹ (spec §294 footer row). */}
              <tfoot>
                <tr>
                  <td className={cs.stickyCell}>Available</td>
                  {matrixHubs.map((h) => <td key={h.id} className={cs.hubCol}>{(hubTotals.get(h.id)?.avail ?? 0).toLocaleString('en-IN')}m</td>)}
                </tr>
                <tr>
                  <td className={cs.stickyCell} title="Capital tied up = (available + reserved) × ₹/m">Capital in stock</td>
                  {matrixHubs.map((h) => <td key={h.id} className={cs.hubCol}>₹{Math.round(hubTotals.get(h.id)?.capital ?? 0).toLocaleString('en-IN')}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default CrossHubStockPage;
