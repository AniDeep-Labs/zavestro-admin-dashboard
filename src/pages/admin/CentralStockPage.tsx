import React from "react";
import { useSearchParams } from "react-router-dom";
import { fabricsApi, R2_PUBLIC_URL } from "../../api/adminApi";
import type { CentralStockRow, CentralReceipt, Fabric } from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { Modal } from "../../components/Modal/Modal";
import { Button } from "../../components/Button/Button";
import { PageHeader, EmptyState, MoneyCell } from "../../components";
import base from "./OrdersListPage.module.css";
import kpi from "./CodReconciliationPage.module.css";
import s from "./CentralStockPage.module.css";
import { UilPlus, UilSlidersV, UilHistory, UilImport, UilImage } from "@iconscout/react-unicons";

const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
const fmtM = (v: string | number | null | undefined) => `${num(v).toLocaleString("en-IN")} m`;
const imgOf = (keys: string[] | null) =>
  keys && keys[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : "";

/**
 * Central procurement fabric pool (Phase 3, INVENTORY-FABRIC-MODEL §3). Fabric ORIGIN:
 * procurement buys it in (received), it's drawn down as it ships to hubs (allocated).
 * available = received − allocated. Receives + adjustments are ledgered (audit trail).
 */
export const CentralStockPage: React.FC = () => {
  const [rows, setRows] = React.useState<CentralStockRow[]>([]);
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // receive
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [fabricId, setFabricId] = React.useState("");
  const [meters, setMeters] = React.useState("");
  const [note, setNote] = React.useState("");
  const [lotCode, setLotCode] = React.useState(""); // T1-9 dye-lot
  const [shadeNote, setShadeNote] = React.useState("");
  const [unitCost, setUnitCost] = React.useState(""); // T1-17 ₹/m paid
  const [saving, setSaving] = React.useState(false);
  // adjust
  const [adjustTarget, setAdjustTarget] = React.useState<CentralStockRow | null>(null);
  const [adjustDelta, setAdjustDelta] = React.useState("");
  const [adjustNote, setAdjustNote] = React.useState("");
  const [adjusting, setAdjusting] = React.useState(false);
  // history
  const [historyTarget, setHistoryTarget] = React.useState<CentralStockRow | null>(null);
  const [receipts, setReceipts] = React.useState<CentralReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = React.useState(false);
  const [broken, setBroken] = React.useState<Set<string>>(new Set());
  const markBroken = (id: string) => setBroken((b) => (b.has(id) ? b : new Set(b).add(id)));

  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fabricsApi
      .centralStock()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load central stock"))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);
  React.useEffect(() => {
    fabricsApi.list({ active: true }).then(setFabrics).catch(() => {});
  }, []);

  // Handoff from Fabrics Master ("Receive stock →" after creating a SKU): open the
  // Receive modal prefilled for that fabric. Apply once.
  const [sp, setSp] = useSearchParams();
  const handoffApplied = React.useRef(false);
  React.useEffect(() => {
    if (handoffApplied.current) return;
    const rid = sp.get("receive");
    if (rid) {
      handoffApplied.current = true;
      setFabricId(rid);
      setReceiveOpen(true);
      sp.delete("receive");
      setSp(sp, { replace: true });
    }
  }, [sp, setSp]);

  // T1-17: value at weighted-average cost-at-receipt; fall back to list price only when a
  // fabric has no costed receipts (so a list-price edit no longer revalues shelved stock).
  const costBasis = (r: CentralStockRow) =>
    r.unit_cost_wac != null ? num(r.unit_cost_wac) : r.price_per_meter != null ? num(r.price_per_meter) : null;
  const valueOf = (r: CentralStockRow) => {
    const c = costBasis(r);
    return c != null ? num(r.available_meters) * c : null;
  };

  // ── rollups ──
  const totReceived = rows.reduce((sum, r) => sum + num(r.received_meters), 0);
  const totAllocated = rows.reduce((sum, r) => sum + num(r.allocated_meters), 0);
  const totAvailable = rows.reduce((sum, r) => sum + num(r.available_meters), 0);
  const totCapital = rows.reduce((sum, r) => sum + (valueOf(r) ?? 0), 0);

  const submitReceive = async () => {
    const m = Number(meters);
    if (!fabricId) return showToast("error", "Pick a fabric");
    if (!m || m <= 0) return showToast("error", "Enter a valid quantity (metres)");
    setSaving(true);
    try {
      const next = await fabricsApi.receiveCentral({
        fabric_id: fabricId,
        meters: m,
        note: note.trim() || undefined,
        lot_code: lotCode.trim() || undefined,
        shade_note: shadeNote.trim() || undefined,
        unit_cost: unitCost.trim() && Number(unitCost) >= 0 ? Number(unitCost) : undefined,
      });
      setRows(next);
      showToast("success", `Received ${m} m into central stock`);
      setReceiveOpen(false);
      setFabricId(""); setMeters(""); setNote(""); setLotCode(""); setShadeNote(""); setUnitCost("");
    } catch (e) {
      showToast("error", "Receive failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const submitAdjust = async () => {
    if (!adjustTarget) return;
    const d = Number(adjustDelta);
    if (!d || Number.isNaN(d)) return showToast("error", "Enter a non-zero adjustment (+/- metres)");
    if (!adjustNote.trim()) return showToast("error", "A reason is required");
    setAdjusting(true);
    try {
      const next = await fabricsApi.adjustCentral({ fabric_id: adjustTarget.fabric_id, meters: d, note: adjustNote.trim() });
      setRows(next);
      showToast("success", `Adjusted ${adjustTarget.fabric_code} by ${d > 0 ? "+" : ""}${d} m`);
      setAdjustTarget(null); setAdjustDelta(""); setAdjustNote("");
    } catch (e) {
      showToast("error", "Adjustment failed", e instanceof Error ? e.message : undefined);
    } finally {
      setAdjusting(false);
    }
  };

  const openHistory = (r: CentralStockRow) => {
    setHistoryTarget(r);
    setLoadingReceipts(true);
    setReceipts([]);
    fabricsApi
      .centralReceipts(r.fabric_id)
      .then(setReceipts)
      .catch((e) => showToast("error", "Couldn't load history", e instanceof Error ? e.message : undefined))
      .finally(() => setLoadingReceipts(false));
  };

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Code", "Fabric", "Received (m)", "Allocated (m)", "Available (m)", "Value (avail ₹)"];
    const lines = rows.map((r) =>
      [r.fabric_code, r.fabric_name, num(r.received_meters), num(r.allocated_meters), num(r.available_meters), valueOf(r) ?? ""].map(cell).join(","),
    );
    const csv = [header.map(cell).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `central-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Procurement · Inventory"
        title="Central Stock"
        subtitle="The procurement pool — fabric you've bought (received), what's shipped to hubs (allocated), and what's left to distribute (available)."
        actions={
          <>
            <Button variant="ghost" onClick={exportCsv} disabled={rows.length === 0}><UilImport size={15} /> Export CSV</Button>
            <Button variant="primary" onClick={() => setReceiveOpen(true)}><UilPlus size={16} /> Receive fabric</Button>
          </>
        }
      />

      {!loading && !error && rows.length > 0 && (
        <div className={s.kpis}>
          <div className={kpi.summaryCard}><div className={kpi.summaryLabel}>Fabrics</div><div className={kpi.summaryValue}>{rows.length}</div></div>
          <div className={kpi.summaryCard}><div className={kpi.summaryLabel}>Received</div><div className={kpi.summaryValue}>{fmtM(totReceived)}</div></div>
          <div className={kpi.summaryCard}><div className={kpi.summaryLabel}>Allocated to hubs</div><div className={kpi.summaryValue}>{fmtM(totAllocated)}</div></div>
          <div className={kpi.summaryCard}><div className={kpi.summaryLabel}>Available</div><div className={kpi.summaryValue}>{fmtM(totAvailable)}</div></div>
          <div className={kpi.summaryCard}><div className={kpi.summaryLabel}>Capital (avail)</div><div className={kpi.summaryValue}>₹{Math.round(totCapital).toLocaleString("en-IN")}</div></div>
        </div>
      )}

      {error ? (
        <EmptyState title="Couldn't load central stock" body={error} action={{ label: "Retry", onClick: load }} />
      ) : (
        <div className={base.tableWrap}>
          <table className={base.table}>
            <thead>
              <tr>
                <th>Fabric</th><th>Code</th>
                <th className={s.numCol}>Received</th>
                <th className={s.numCol}>Allocated</th>
                <th className={s.numCol}>Available</th>
                <th className={s.numCol}>Value (avail)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={base.skeleton} /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState title="No central stock yet" body="Use “Receive fabric” to record a purchase — then it can be shipped to hubs." size="compact" />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.fabric_id} className={base.row} onClick={() => openHistory(r)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter") (() => openHistory(r))?.(); }}>
                    <td>
                      <div className={base.fabricCell}>
                        {imgOf(r.fabric_image_keys) && !broken.has(r.fabric_id)
                          ? <img className={base.swatchThumb} src={imgOf(r.fabric_image_keys)} alt="" onError={() => markBroken(r.fabric_id)} />
                          : <span className={base.swatchThumb}><UilImage size={16} /></span>}
                        <span>{r.fabric_name}</span>
                      </div>
                    </td>
                    <td className={base.fabricCellCode}>{r.fabric_code}</td>
                    <td className={s.numCol}>{fmtM(r.received_meters)}</td>
                    <td className={s.numCol}>{fmtM(r.allocated_meters)}</td>
                    <td className={s.numCol}><strong>{fmtM(r.available_meters)}</strong></td>
                    <td className={s.numCol}><MoneyCell amount={valueOf(r)} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={s.rowActions}>
                        <button className={s.linkBtn} onClick={() => { setAdjustTarget(r); setAdjustDelta(""); setAdjustNote(""); }}>
                          <UilSlidersV size={13} /> Adjust
                        </button>
                        <button className={s.linkBtn} onClick={() => openHistory(r)}>
                          <UilHistory size={13} /> History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Receive */}
      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Receive fabric into central stock"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button variant="primary" state={saving ? "loading" : "default"} onClick={submitReceive}>Receive</Button>
          </>
        }
      >
        <div className={s.form}>
          <label className={s.flbl}>Fabric
            <select className={s.finp} value={fabricId} onChange={(e) => setFabricId(e.target.value)}>
              <option value="">Select a fabric…</option>
              {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}{f.code ? ` · ${f.code}` : ""}</option>)}
            </select>
          </label>
          <label className={s.flbl}>Quantity received (metres)
            <input className={s.finp} type="number" min={1} value={meters} placeholder="e.g. 200" onChange={(e) => setMeters(e.target.value)} />
          </label>
          <label className={s.flbl}>Unit cost — ₹/metre paid (optional)
            <input className={s.finp} type="number" min={0} value={unitCost} placeholder="defaults to the fabric's current ₹/m" onChange={(e) => setUnitCost(e.target.value)} />
          </label>
          <label className={s.flbl}>Note (optional)
            <input className={s.finp} value={note} placeholder="e.g. PO-1042, Arvind invoice #88" onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className={s.flbl}>Dye-lot code (optional)
            <input className={s.finp} value={lotCode} placeholder="e.g. LOT-2026-0447" onChange={(e) => setLotCode(e.target.value)} />
          </label>
          <label className={s.flbl}>Shade note (optional)
            <input className={s.finp} value={shadeNote} placeholder="e.g. slightly darker than swatch" onChange={(e) => setShadeNote(e.target.value)} />
          </label>
          <span className={s.fhint}>Adds to this fabric's central pool and logs a receipt; the dye-lot is carried to hub shipments so a garment can be traced to its batch.</span>
        </div>
      </Modal>

      {/* Adjust / correct */}
      <Modal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title={`Adjust central stock · ${adjustTarget?.fabric_code ?? ""}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button variant="primary" state={adjusting ? "loading" : "default"} onClick={submitAdjust}>Apply adjustment</Button>
          </>
        }
      >
        <div className={s.form}>
          {adjustTarget && (
            <div className={s.adjustNow}>
              Now: received <strong>{fmtM(adjustTarget.received_meters)}</strong> · allocated{" "}
              <strong>{fmtM(adjustTarget.allocated_meters)}</strong> · available <strong>{fmtM(adjustTarget.available_meters)}</strong>
            </div>
          )}
          <label className={s.flbl}>Adjustment (metres, +/−)
            <input className={s.finp} type="number" value={adjustDelta} placeholder="e.g. -1800 to fix a typo, +50 found stock" onChange={(e) => setAdjustDelta(e.target.value)} />
          </label>
          <label className={s.flbl}>Reason (required)
            <input className={s.finp} value={adjustNote} placeholder="e.g. mis-keyed receive, damaged, physical count" onChange={(e) => setAdjustNote(e.target.value)} />
          </label>
          <span className={s.fhint}>Corrects the received total. Can't reduce below what's already shipped to hubs.</span>
        </div>
      </Modal>

      {/* History ledger */}
      <Modal
        open={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={`Receipt history · ${historyTarget?.fabric_code ?? ""}`}
        size="md"
      >
        {loadingReceipts ? (
          <p className={s.fhint}>Loading…</p>
        ) : receipts.length === 0 ? (
          <p className={s.fhint}>No receipts logged for this fabric yet.</p>
        ) : (
          <div className={s.ledger}>
            {receipts.map((rec) => {
              const m = num(rec.meters);
              return (
                <div key={rec.id} className={s.ledgerRow}>
                  <div className={s.ledgerMeta}>
                    <span className={s.ledgerNote}>{rec.kind === "adjust" ? "Adjustment" : "Received"}{rec.note ? ` — ${rec.note}` : ""}</span>
                    <span className={s.ledgerSub}>
                      {new Date(rec.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {rec.created_by_name ? ` · ${rec.created_by_name}` : ""}
                    </span>
                  </div>
                  <span className={m < 0 ? s.ledgerNeg : s.ledgerPos}>{m > 0 ? "+" : ""}{m.toLocaleString("en-IN")} m</span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CentralStockPage;
