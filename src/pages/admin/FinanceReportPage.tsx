import React from "react";
import { Link } from "react-router-dom";
import { financeApi, hubsApi } from "../../api/adminApi";
import type {
  FinanceReportParams,
  SettlementReport,
  SettlementHub,
  SettlementDay,
  PnlReport,
  PnlHub,
  Hub,
} from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { PageHeader, EmptyState } from "../../components";
import { Button } from "../../components/Button/Button";
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
            {settlement!.variance_tracked === false && (
              <p className={s.summarySub} style={{ marginBottom: 12 }}>
                Book side only — what Razorpay actually settled (deposited amount, fees) isn't ingested yet, so a Razorpay-vs-books variance isn't tracked.
              </p>
            )}
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
