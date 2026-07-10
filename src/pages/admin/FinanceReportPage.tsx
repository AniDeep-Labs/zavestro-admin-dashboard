import React from "react";
import { Link } from "react-router-dom";
import { financeApi, hubsApi } from "../../api/adminApi";
import type {
  FinanceReportParams,
  SettlementReport,
  SettlementHub,
  SettlementDay,
  SettlementRow,
  PnlReport,
  PnlHub,
  Hub,
} from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { PageHeader, EmptyState } from "../../components";
import { Button } from "../../components/Button/Button";
import { Can } from "../../components/Can/Can";
import styles from "./OrdersListPage.module.css";
import s from "./CodReconciliationPage.module.css";
import ds from "./DistributionPage.module.css";
import { UilRefresh, UilTimes, UilImport } from "@iconscout/react-unicons";
import { downloadCsv, datedFilename } from "../../utils/csv";

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const SummaryCard: React.FC<{ label: string; value?: number; loading: boolean; accent?: boolean; est?: boolean }> = ({ label, value, loading, accent, est }) => (
  <div className={s.summaryCard}>
    <div className={s.summaryLabel}>{label}{est && <span className={s.estTag}>est.</span>}</div>
    <div className={`${s.summaryValue}${accent ? ` ${s.pendingAccent}` : ""}`}>
      {loading || value === undefined ? "—" : fmtINR(value)}
    </div>
  </div>
);

const skeletonRows = (cols: number) =>
  Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>{Array.from({ length: cols }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
  ));

export const FinanceReportPage: React.FC<{ mode?: "settlement" | "pnl" }> = ({ mode = "settlement" }) => {
  const [hubId, setHubId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [settlement, setSettlement] = React.useState<SettlementReport | null>(null);
  const [pnl, setPnl] = React.useState<PnlReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  // T2-18: manual settlement entry form (finance ingests actual Razorpay deposits)
  const emptyForm = { settlement_id: "", settled_on: "", gross_amount: "", refunds_amount: "", fees_amount: "", tax_amount: "", net_deposited: "", utr: "" };
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    hubsApi.list().then((r) => setHubs(r.hubs)).catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    const params: FinanceReportParams = {
      hub_id: hubId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    };
    const p =
      mode === "settlement"
        ? financeApi.settlement(params).then(setSettlement)
        : financeApi.pnl(params).then(setPnl);
    p.catch((e) => showToast("error", "Load failed", e instanceof Error ? e.message : undefined)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hubId, startDate, endDate]);

  React.useEffect(load, [load]);

  const clearFilters = () => { setHubId(""); setStartDate(""); setEndDate(""); };
  const filtered = !!(hubId || startDate || endDate);

  // T2-18: record one actual settlement, then refresh the reconciliation.
  const submitSettlement = async () => {
    if (!form.settlement_id.trim() || !form.settled_on || form.net_deposited === "") {
      showToast("error", "Missing fields", "Settlement ID, date and net deposited are required.");
      return;
    }
    setSaving(true);
    try {
      await financeApi.recordSettlement({
        settlement_id: form.settlement_id.trim(),
        settled_on: form.settled_on,
        gross_amount: Number(form.gross_amount) || 0,
        refunds_amount: Number(form.refunds_amount) || 0,
        fees_amount: Number(form.fees_amount) || 0,
        tax_amount: Number(form.tax_amount) || 0,
        net_deposited: Number(form.net_deposited),
        utr: form.utr.trim() || undefined,
      });
      showToast("success", "Settlement recorded");
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) {
      showToast("error", "Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const removeSettlement = async (id: string) => {
    try {
      await financeApi.deleteSettlement(id);
      showToast("success", "Settlement removed");
      load();
    } catch (e) {
      showToast("error", "Delete failed", e instanceof Error ? e.message : undefined);
    }
  };

  const syncFromRazorpay = async () => {
    if (!startDate || !endDate) {
      showToast("error", "Pick a window", "Set a start and end date to sync from Razorpay.");
      return;
    }
    try {
      const r = await financeApi.syncSettlements(startDate, endDate);
      showToast("success", "Synced", `${r.synced} settlement(s), ${r.inserted} new.`);
      load();
    } catch (e) {
      showToast("info", "Sync unavailable", e instanceof Error ? e.message : undefined);
    }
  };

  const handleExport = () => {
    if (mode === "settlement" && settlement) {
      downloadCsv<SettlementHub>(
        datedFilename("settlement"),
        [
          { header: "Hub", value: (h) => h.hub_name ?? "—" },
          { header: "Orders", value: (h) => h.orders },
          { header: "Gross (online)", value: (h) => h.gross_online },
          { header: "Refunded", value: (h) => h.refunded },
          { header: "Net settled", value: (h) => h.net_settled },
        ],
        settlement.hubs,
      );
    } else if (mode === "pnl" && pnl) {
      downloadCsv<PnlHub>(
        datedFilename("pnl"),
        [
          { header: "Hub", value: (h) => h.hub_name ?? "—" },
          { header: "Orders", value: (h) => h.orders },
          { header: "Revenue", value: (h) => h.revenue },
          { header: "Fabric cost", value: (h) => h.fabric_cost },
          { header: "Guarantee (est)", value: (h) => h.guarantee_cost },
          { header: "Delivery (est)", value: (h) => h.delivery_cost },
          { header: "Payment fees", value: (h) => h.payment_fees },
          { header: "Refunds", value: (h) => h.refunds },
          { header: "Profit", value: (h) => h.profit },
        ],
        pnl.hubs,
      );
    }
  };

  // T2-20: CA journal / Tally export for the current window — sales + GST + refunds as a file.
  const downloadJournal = async (format: "csv" | "xml") => {
    try {
      const { filename, content, mime, voucher_count } = await financeApi.journal(format, {
        hub_id: hubId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "Journal exported", `${voucher_count} voucher${voucher_count === 1 ? "" : "s"}.`);
    } catch (e) {
      showToast("error", "Export failed", e instanceof Error ? e.message : undefined);
    }
  };

  const canExport = mode === "settlement" ? !!settlement?.hubs.length : !!pnl?.hubs.length;
  const title = mode === "settlement" ? "Online Settlement" : "Per-Hub P&L";
  const subtitle = mode === "settlement"
    ? "Captured online payments per hub and per day (gross − refunds = net settled), reconciled from our books."
    : "Per-hub revenue minus fabric/procurement cost and refunds. Cost lines fill in as the data lands.";

  const settlementEmpty = !settlement || (settlement.hubs.length === 0 && (settlement.by_day?.length ?? 0) === 0);
  const pnlEmpty = !pnl || pnl.hubs.length === 0;

  const dayRow = (d: SettlementDay) => (
    <tr key={d.day} className={styles.row}>
      <td className={styles.date}>{fmtDay(d.day)}</td>
      <td>{d.orders}</td>
      <td className={styles.total}>{fmtINR(d.gross_online)}</td>
      <td>{fmtINR(d.refunded)}</td>
      <td className={styles.total}>{fmtINR(d.net_settled)}</td>
    </tr>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageHeader
        eyebrow="Finance · Money"
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="ghost" onClick={handleExport} disabled={!canExport}><UilImport size={15} /> Export CSV</Button>
            <Button variant="ghost" onClick={() => downloadJournal("csv")}><UilImport size={15} /> Journal CSV</Button>
            <Button variant="ghost" onClick={() => downloadJournal("xml")}><UilImport size={15} /> Tally XML</Button>
            <Button variant="ghost" onClick={load}><UilRefresh size={15} /> Refresh</Button>
          </>
        }
      />

      <div className={s.summary}>
        {mode === "settlement" ? (
          <>
            <SummaryCard label="Gross (online)" value={settlement?.totals.gross_online} loading={loading} />
            <SummaryCard label="Refunded" value={settlement?.totals.refunded} loading={loading} accent />
            <SummaryCard label="Net settled" value={settlement?.totals.net_settled} loading={loading} />
          </>
        ) : (
          <>
            <SummaryCard label="Revenue" value={pnl?.totals.revenue} loading={loading} />
            <SummaryCard label="Fabric cost" value={pnl?.totals.fabric_cost} loading={loading} />
            <SummaryCard label="Guarantee" value={pnl?.totals.guarantee_cost} loading={loading} est />
            <SummaryCard label="Delivery" value={pnl?.totals.delivery_cost} loading={loading} est />
            <SummaryCard label="Payment fees" value={pnl?.totals.payment_fees} loading={loading} />
            <SummaryCard label="Refunds" value={pnl?.totals.refunds} loading={loading} accent />
            <SummaryCard label="Profit" value={pnl?.totals.profit} loading={loading} />
            {/* T1-19: outstanding wallet credits — a current liability, not part of period profit. */}
            <SummaryCard label="Wallet liability (owed, current)" value={pnl?.wallet_liability} loading={loading} accent />
            {/* T1-23: fit-promise reserve to hold for the period (memo/provision, not in profit). */}
            <SummaryCard label="Guarantee reserve (memo)" value={pnl?.guarantee_reserve} loading={loading} accent />
          </>
        )}
      </div>

      <div className={ds.toolbar}>
        <select className={ds.hubSel} value={hubId} onChange={(e) => setHubId(e.target.value)}>
          <option value="">All Hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <span className={s.dateWrap}><input className={s.dateInput} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" /></span>
        <span className={s.dateWrap}><input className={s.dateInput} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" /></span>
        {filtered && <button className={styles.clearBtn} onClick={clearFilters}><UilTimes size={14} /> Clear</button>}
      </div>

      {mode === "settlement" ? (
        loading ? (
          <div className={styles.tableWrap}><table className={styles.table}><tbody>{skeletonRows(5)}</tbody></table></div>
        ) : settlementEmpty ? (
          <EmptyState title="No online settlements in this window" body="Captured online payments will appear here. Try widening the date range or clearing the hub filter." />
        ) : (
          <>
            {/* T2-18: Razorpay-vs-books reconciliation — book expected deposit vs actual, once
                real settlements are ingested. Until then the page stays honest that it's book-only. */}
            <section className={ds.section}>
              <div className={s.reconHead}>
                <h2 className={ds.sectionTitle}>Razorpay reconciliation</h2>
                <Can cap="refunds:approve">
                  <div className={s.reconActions}>
                    <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
                      {showForm ? "Cancel" : "Record settlement"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={syncFromRazorpay}>Sync from Razorpay</Button>
                  </div>
                </Can>
              </div>

              {showForm && (
                <div className={s.reconForm}>
                  {([
                    ["settlement_id", "Settlement ID *", "text"],
                    ["settled_on", "Settled on *", "date"],
                    ["gross_amount", "Gross (₹)", "number"],
                    ["refunds_amount", "Refunds (₹)", "number"],
                    ["fees_amount", "Fees (₹)", "number"],
                    ["tax_amount", "GST on fees (₹)", "number"],
                    ["net_deposited", "Net deposited (₹) *", "number"],
                    ["utr", "Bank UTR", "text"],
                  ] as const).map(([k, label, type]) => (
                    <label key={k} className={s.reconField}>
                      <span>{label}</span>
                      <input
                        className={s.dateInput}
                        type={type}
                        value={(form as Record<string, string>)[k]}
                        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                      />
                    </label>
                  ))}
                  <Button size="sm" onClick={submitSettlement} state={saving ? "loading" : "default"}>Save settlement</Button>
                </div>
              )}

              {settlement!.variance_tracked === false || !settlement!.reconciliation ? (
                <p className={s.summarySub}>
                  Book side only — no actual Razorpay settlement is ingested for this window yet, so the
                  Razorpay-vs-books variance isn't tracked. Record one above (or sync once keys are live).
                </p>
              ) : (
                <>
                  <div className={`${s.summary} ${s.reconKpis}`}>
                    <SummaryCard label="Book expected deposit" value={settlement!.reconciliation.book.expected_deposit} loading={false} />
                    <SummaryCard label="Razorpay deposited (actual)" value={settlement!.reconciliation.actual.net_deposited} loading={false} />
                    <SummaryCard label="Variance (actual − book)" value={settlement!.reconciliation.variance} loading={false} accent={Math.abs(settlement!.reconciliation.variance) >= 1} />
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Settlement</th><th>Date</th><th>Gross</th><th>Refunds</th><th>Fees</th><th>GST</th><th>Net deposited</th><th>UTR</th><th>Src</th><th></th></tr></thead>
                      <tbody>
                        {settlement!.reconciliation.by_settlement.map((r: SettlementRow) => (
                          <tr key={r.settlement_id} className={styles.row}>
                            <td className={styles.orderId}>{r.settlement_id}</td>
                            <td className={styles.date}>{fmtDay(r.settled_on)}</td>
                            <td>{fmtINR(r.gross_amount)}</td>
                            <td>{fmtINR(r.refunds_amount)}</td>
                            <td>{fmtINR(r.fees_amount)}</td>
                            <td>{fmtINR(r.tax_amount)}</td>
                            <td className={styles.total}>{fmtINR(r.net_deposited)}</td>
                            <td>{r.utr ?? "—"}</td>
                            <td>{r.source}</td>
                            <td>
                              <Can cap="refunds:approve">
                                <button className={styles.clearBtn} onClick={() => removeSettlement(r.settlement_id)}><UilTimes size={13} /></button>
                              </Can>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {(settlement!.by_day?.length ?? 0) > 0 && (
              <section className={ds.section}>
                <h2 className={ds.sectionTitle}>By day <span className={ds.count}>{settlement!.by_day!.length}</span></h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Date</th><th>Orders</th><th>Gross (online)</th><th>Refunded</th><th>Net settled</th></tr></thead>
                    <tbody>{settlement!.by_day!.map(dayRow)}</tbody>
                  </table>
                </div>
              </section>
            )}
            <section className={ds.section}>
              <h2 className={ds.sectionTitle}>By hub <span className={ds.count}>{settlement!.hubs.length}</span></h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Hub</th><th>Orders</th><th>Gross (online)</th><th>Refunded</th><th>Net settled</th></tr></thead>
                  <tbody>
                    {settlement!.hubs.map((h, i) => (
                      <tr key={h.hub_id ?? i} className={styles.row}>
                        <td>{h.hub_name ?? "Unassigned"}</td>
                        <td>{h.orders}</td>
                        <td className={styles.total}>{fmtINR(h.gross_online)}</td>
                        <td>{fmtINR(h.refunded)}</td>
                        <td className={styles.total}>{fmtINR(h.net_settled)}</td>
                      </tr>
                    ))}
                    <tr className={styles.row} style={{ fontWeight: 700 }}>
                      <td>Total</td><td />
                      <td className={styles.total}>{fmtINR(settlement!.totals.gross_online)}</td>
                      <td>{fmtINR(settlement!.totals.refunded)}</td>
                      <td className={styles.total}>{fmtINR(settlement!.totals.net_settled)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )
      ) : loading ? (
        <div className={styles.tableWrap}><table className={styles.table}><tbody>{skeletonRows(9)}</tbody></table></div>
      ) : pnlEmpty ? (
        <EmptyState title="No P&L data in this window" body="Per-hub revenue and cost lines will appear here once there are orders in range." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th>Hub</th><th>Orders</th><th>Revenue</th><th>Fabric cost</th>
              <th title="Estimate: free/waived alterations × configured per-alteration cost">Guarantee<span className={s.estTag}>est.</span></th>
              <th title="Estimate: delivered orders × configured per-order delivery cost">Delivery<span className={s.estTag}>est.</span></th>
              <th title="Razorpay fee rate on captured online payments">Payment fees</th>
              <th>Refunds</th><th>Profit</th>
            </tr></thead>
            <tbody>
              {pnl!.hubs.map((h, i) => (
                <tr key={h.hub_id ?? i} className={styles.row}>
                  <td>{h.hub_name ?? "Unassigned"}</td>
                  <td>{h.orders}</td>
                  <td>{fmtINR(h.revenue)}</td>
                  <td>{fmtINR(h.fabric_cost)}</td>
                  <td>{fmtINR(h.guarantee_cost)}</td>
                  <td>{fmtINR(h.delivery_cost)}</td>
                  <td>{fmtINR(h.payment_fees)}</td>
                  <td>{fmtINR(h.refunds)}</td>
                  <td className={styles.total}>{fmtINR(h.profit)}</td>
                </tr>
              ))}
              <tr className={styles.row} style={{ fontWeight: 700 }}>
                <td>Total</td><td />
                <td>{fmtINR(pnl!.totals.revenue)}</td>
                <td>{fmtINR(pnl!.totals.fabric_cost)}</td>
                <td>{fmtINR(pnl!.totals.guarantee_cost)}</td>
                <td>{fmtINR(pnl!.totals.delivery_cost)}</td>
                <td>{fmtINR(pnl!.totals.payment_fees)}</td>
                <td>{fmtINR(pnl!.totals.refunds)}</td>
                <td className={styles.total}>{fmtINR(pnl!.totals.profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {mode === "pnl" && pnl?.note && <p className={s.summarySub} style={{ marginTop: 10 }}>{pnl.note}</p>}

      <p className={s.summarySub} style={{ marginTop: 14 }}>
        Related: <Link to="/admin/finance/refunds">Refunds</Link> · <Link to="/admin/finance/cod-reconciliation">COD Reconciliation</Link>
      </p>
    </div>
  );
};

export default FinanceReportPage;
