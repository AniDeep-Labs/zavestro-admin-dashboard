import React from "react";
import { fabricsApi, restockApi, R2_PUBLIC_URL } from "../../api/adminApi";
import type { FabricStockRow } from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { Modal } from "../../components/Modal/Modal";
import base from "./AppConfigPage.module.css";
import s from "./FabricStockPage.module.css";
import { UilRedo, UilHistory } from "@iconscout/react-unicons";

const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
const fmtM = (v: string | number | null | undefined) => `${num(v).toLocaleString("en-IN")} m`;

/**
 * The CM's hub fabric stock — what fabric (and how many metres) the hub holds, what's
 * reserved, what's running low, and its stock value. `fabricsApi.stock({})` is auto-scoped
 * to the CM's hub server-side (an explicit hub_id would override). Inline Request-Restock.
 */
export const FabricStockPage: React.FC = () => {
  const [rows, setRows] = React.useState<FabricStockRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [restock, setRestock] = React.useState<FabricStockRow | null>(null);
  const [qty, setQty] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fabricsApi
      .stock({}) // backend scopes to the CM's hub
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load fabric stock"))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  const imgOf = (keys: string[] | null) =>
    keys && keys[0] && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${keys[0]}` : "";
  const reorderOf = (r: FabricStockRow) => num(r.reorder_meters);
  const isLow = (r: FabricStockRow) => reorderOf(r) > 0 && num(r.available_meters) <= reorderOf(r);
  const valueOf = (r: FabricStockRow) =>
    r.price_per_meter != null ? num(r.available_meters) * num(r.price_per_meter) : null;

  const lowCount = rows.filter(isLow).length;

  const submitRestock = async () => {
    if (!restock) return;
    const q = Number(qty);
    if (!q || q <= 0) {
      showToast("error", "Enter a valid quantity (metres)");
      return;
    }
    setSaving(true);
    try {
      await restockApi.create({
        fabric_id: restock.fabric_id,
        hub_id: restock.hub_id,
        qty: q,
        demand_note: note.trim() || undefined,
      });
      showToast("success", `Restock requested — ${restock.fabric_name}`);
      setRestock(null);
      setQty("");
      setNote("");
    } catch (e) {
      showToast("error", "Request failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className={base.pageHeader}>
        <div>
          <h1 className={base.title}>Fabric Stock</h1>
          <p className={s.intro}>
            Fabric your hub holds — available &amp; reserved metres, low-stock flags, and value.
            The “Feeds” line shows which listings draw on each fabric and how many garments
            (<strong>bold</strong>) each can still make from the shared stock. Running low? Request a restock inline.
          </p>
        </div>
        <button className={s.ghostBtn} onClick={load}>
          <UilRedo size={14} /> Refresh
        </button>
      </div>

      {lowCount > 0 && (
        <div className={s.lowBanner}>
          ⚠️ {lowCount} fabric{lowCount === 1 ? "" : "s"} at or below the reorder point — request a restock.
        </div>
      )}

      {loading ? (
        <div className={`${base.card} ${s.msg}`}>Loading…</div>
      ) : error ? (
        <div className={`${base.card} ${s.msg}`}>
          <span>Couldn’t load stock — {error}</span>
          <button className={s.ghostBtn} onClick={load}>
            <UilRedo size={13} /> Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className={`${base.card} ${s.msg}`}>
          No fabric in stock yet. Fabric arrives via <strong>Fabric for Listing</strong> (request →
          receive) or a fulfilled restock.
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Fabric</th>
                <th className={s.numCol}>Available</th>
                <th className={s.numCol}>Reserved</th>
                <th className={s.numCol}>Reorder at</th>
                <th className={s.numCol}>Stock value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.fabric_id} className={isLow(r) ? s.lowRow : ""}>
                  <td>
                    <div className={s.fabricCell}>
                      <div className={s.thumb}>
                        {imgOf(r.fabric_image_keys) ? (
                          <img src={imgOf(r.fabric_image_keys)} alt={r.fabric_name} />
                        ) : (
                          <span className={s.noImg}>—</span>
                        )}
                      </div>
                      <div>
                        <div className={s.fabricName}>{r.fabric_name}</div>
                        <div className={s.fabricCode}>{r.fabric_code}</div>
                        {r.listings && r.listings.length > 0 && (() => {
                          // [CM-19-3] "Feeds" counted DRAFTS as live demand. Rendered on
                          // DNM-9: "Feeds 1 listing: Slim Oxford Shirt 33" — where that
                          // listing is is_active:false and cannot be bought. A CM reading
                          // which listings depend on a fabric was told a draft consumes it.
                          // The flag was already in the payload.
                          const live = r.listings!.filter((l) => l.is_active);
                          const drafts = r.listings!.filter((l) => !l.is_active);
                          return (
                            <div className={s.feeds}>
                              {live.length > 0 ? (
                                <>
                                  Feeds {live.length} live listing{live.length === 1 ? "" : "s"}:{" "}
                                  {live.map((l, k) => (
                                    <span key={l.listing_id} className={s.feedItem}>
                                      {l.design_name} <strong>{l.garments_available ?? "—"}</strong>
                                      {k < live.length - 1 ? " · " : ""}
                                    </span>
                                  ))}
                                </>
                              ) : (
                                <>No live listing draws on this fabric yet.</>
                              )}
                              {drafts.length > 0 && (
                                <span className={s.feedDrafts}>
                                  {" "}
                                  · {drafts.length} draft{drafts.length === 1 ? "" : "s"} (
                                  {drafts.map((l) => l.design_name).join(", ")}) — not yet buyable
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                  <td className={s.numCol}>
                    <span className={isLow(r) ? s.lowVal : ""}>{fmtM(r.available_meters)}</span>
                    {isLow(r) && <span className={s.lowChip}>Low</span>}
                  </td>
                  <td className={s.numCol}>{fmtM(r.reserved_meters)}</td>
                  <td className={s.numCol}>{reorderOf(r) > 0 ? fmtM(r.reorder_meters) : "—"}</td>
                  <td className={s.numCol}>
                    {valueOf(r) != null ? `₹${num(valueOf(r)).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className={s.numCol}>
                    <button className={s.restockBtn} onClick={() => setRestock(r)}>
                      <UilHistory size={13} /> Request Restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!restock}
        onClose={() => setRestock(null)}
        title={restock ? `Request restock — ${restock.fabric_name}` : ""}
        size="sm"
        footer={
          <div className={s.modalActions}>
            <button className={s.ghostBtn} onClick={() => setRestock(null)}>
              Cancel
            </button>
            <button className={base.addBtn} disabled={saving} onClick={submitRestock}>
              {saving ? "Requesting…" : "Request"}
            </button>
          </div>
        }
      >
        {restock && (
          <div className={s.form}>
            <label className={s.flbl}>
              Quantity (metres)
              <input
                className={s.finp}
                type="number"
                min={1}
                value={qty}
                placeholder="e.g. 50"
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <label className={s.flbl}>
              Note (optional)
              <input
                className={s.finp}
                value={note}
                placeholder="e.g. high demand on white poplin"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <span className={s.fhint}>
              Currently {fmtM(restock.available_meters)} available
              {reorderOf(restock) > 0 ? ` · reorder at ${fmtM(restock.reorder_meters)}` : ""}.
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FabricStockPage;
