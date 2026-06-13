import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fabricsApi, hubsApi, R2_PUBLIC_URL } from '../../api/adminApi';
import type { FabricStockRow, Hub } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { EmptyState } from '../../components/EmptyState';
import { MoneyCell } from '../../components/DataCells';
import styles from './OrdersListPage.module.css';
import s from './CodReconciliationPage.module.css';

const swatch = (keys?: string[] | null) => (keys?.[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : '');

const DEAD_STOCK_DAYS = 60; // SOLUTIONS P8: no movement for 60d = a decision you forgot to make

// The supply brain (G-29): exceptions lead — below-reorder and dead stock first,
// then the full grid. Reorder points are editable inline; stock value ₹ visible.
export const CrossHubStockPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<FabricStockRow[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = React.useState('');
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
  }, [hubFilter]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {}); }, []);

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
  const value = (r: FabricStockRow) => {
    const ppm = num(r.price_per_meter);
    return ppm == null ? null : Number(r.available_meters) * ppm;
  };
  const belowReorder = rows.filter(
    (r) => r.reorder_meters != null && Number(r.available_meters) < Number(r.reorder_meters),
  );
  const deadStock = rows.filter(
    (r) =>
      Number(r.available_meters) > 0 &&
      Date.now() - new Date(r.updated_at).getTime() > DEAD_STOCK_DAYS * 24 * 3_600_000,
  );
  const totalAvail = rows.reduce((sum, r) => sum + Number(r.available_meters), 0);
  const totalValue = rows.reduce((sum, r) => sum + (value(r) ?? 0), 0);

  const rowKey = (r: FabricStockRow) => `${r.hub_id}-${r.fabric_id}`;
  const openLedger = (r: FabricStockRow) =>
    navigate(`/admin/procurement/track/${r.hub_id}/${r.fabric_id}`);
  const createDistribution = (r: FabricStockRow) =>
    navigate(
      `/admin/procurement/distribution?fabric_id=${r.fabric_id}&hub_id=${r.hub_id}`,
    );

  const exceptionTable = (list: FabricStockRow[], kind: 'reorder' | 'dead') => (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr>
          <th>Hub</th><th>Fabric</th><th>Available</th>
          {kind === 'reorder' ? <th>Reorder at</th> : <th>No movement since</th>}
          <th>Value</th><th></th>
        </tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={rowKey(r)} className={styles.row} onClick={() => openLedger(r)}>
              <td className={styles.customerName}>{r.hub_name}</td>
              <td>
                <div className={styles.fabricCell}>
                  {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                  <span>{r.fabric_name}</span>
                </div>
              </td>
              <td className={styles.total}>{Number(r.available_meters)}m</td>
              <td className={styles.date}>
                {kind === 'reorder'
                  ? `${Number(r.reorder_meters)}m`
                  : new Date(r.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </td>
              <td><MoneyCell amount={value(r)} /></td>
              <td>
                <button
                  className={styles.exportBtn}
                  onClick={(e) => { e.stopPropagation(); createDistribution(r); }}
                >
                  {kind === 'reorder' ? 'Create distribution →' : 'Review / restock →'}
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
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Cross-hub Stock</h1>
        <select className={styles.filterSelect} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {/* The numbers a supply manager steers by */}
      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>SKU·hub rows</div>
          <div className={s.summaryValue}>{loading ? '—' : rows.length}</div>
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

      {/* Exceptions FIRST — what needs ordering, what's bleeding capital */}
      {!loading && belowReorder.length > 0 && (
        <>
          <h3 className={styles.title}>Below reorder point</h3>
          {exceptionTable(belowReorder, 'reorder')}
        </>
      )}
      {!loading && deadStock.length > 0 && (
        <>
          <h3 className={styles.title}>Dead stock — no movement for {DEAD_STOCK_DAYS}+ days</h3>
          {exceptionTable(deadStock, 'dead')}
        </>
      )}
      {!loading && belowReorder.length === 0 && deadStock.length === 0 && rows.length > 0 && (
        <EmptyState title="Nothing below reorder, no dead stock ✓" size="compact" />
      )}

      {/* The full grid */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Hub</th><th>Fabric</th><th>Code</th><th>Available</th><th>Reserved</th><th>Reorder at</th><th>Value</th><th>Moved</th></tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8}>
                <EmptyState
                  title="No stock yet"
                  body="Stock lands here when distributions and restocks are received."
                  size="compact"
                />
              </td></tr>
            ) : (
              rows.map((r) => {
                const avail = Number(r.available_meters);
                const reorder = num(r.reorder_meters);
                const low = reorder != null && avail < reorder;
                const key = rowKey(r);
                return (
                  <tr key={key} className={styles.row} onClick={() => openLedger(r)}>
                    <td className={styles.customerName}>{r.hub_name}</td>
                    <td>
                      <div className={styles.fabricCell}>
                        {swatch(r.fabric_image_keys) ? <img className={styles.swatchThumb} src={swatch(r.fabric_image_keys)} alt="" /> : <div className={styles.swatchThumb} />}
                        <span>{r.fabric_name}</span>
                      </div>
                    </td>
                    <td className={styles.fabricCellCode}>{r.fabric_code}</td>
                    <td className={`${styles.total} ${avail <= 0 ? styles.stockZero : low ? styles.stockLow : ''}`}>{avail}m</td>
                    <td className={styles.date}>{Number(r.reserved_meters)}m</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {editKey === key ? (
                        <span className={styles.reorderEdit}>
                          <input
                            className={styles.reorderInput}
                            type="number"
                            min="0"
                            value={editVal}
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
                          title="Set the reorder point — below it this SKU surfaces in the exception list"
                          onClick={() => { setEditKey(key); setEditVal(reorder != null ? String(reorder) : ''); }}
                        >
                          {reorder != null ? `${reorder}m` : 'set…'}
                        </button>
                      )}
                    </td>
                    <td><MoneyCell amount={value(r)} /></td>
                    <td className={styles.date}>{new Date(r.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CrossHubStockPage;
