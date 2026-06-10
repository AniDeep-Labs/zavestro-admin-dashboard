import React from "react";
import { financeApi, hubsApi } from "../../api/adminApi";
import type {
  FinanceReportParams,
  SettlementReport,
  PnlReport,
  Hub,
} from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import styles from "./OrdersListPage.module.css";
import s from "./CodReconciliationPage.module.css";
import { UilRefresh, UilTimes } from "@iconscout/react-unicons";

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const SummaryCard: React.FC<{
  label: string;
  value?: number;
  loading: boolean;
  accent?: boolean;
}> = ({ label, value, loading, accent }) => (
  <div className={s.summaryCard}>
    <div className={s.summaryLabel}>{label}</div>
    <div className={`${s.summaryValue}${accent ? ` ${s.pendingAccent}` : ""}`}>
      {loading || value === undefined ? "—" : fmtINR(value)}
    </div>
  </div>
);

const skeletonRows = (cols: number) =>
  Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j}>
          <div className={styles.skeleton} />
        </td>
      ))}
    </tr>
  ));

export const FinanceReportPage: React.FC<{ mode?: "settlement" | "pnl" }> = ({
  mode = "settlement",
}) => {
  const [hubId, setHubId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [settlement, setSettlement] = React.useState<SettlementReport | null>(
    null,
  );
  const [pnl, setPnl] = React.useState<PnlReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    hubsApi
      .list()
      .then((r) => setHubs(r.hubs))
      .catch(() => {
        /* hub filter is optional */
      });
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
    p.catch((e) =>
      showToast(
        "error",
        "Load failed",
        e instanceof Error ? e.message : undefined,
      ),
    ).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hubId, startDate, endDate]);

  React.useEffect(load, [load]);

  const clearFilters = () => {
    setHubId("");
    setStartDate("");
    setEndDate("");
  };

  const title = mode === "settlement" ? "Online Settlement" : "Per-Hub P&L";

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={s.summary}>
        {mode === "settlement" ? (
          <>
            <SummaryCard
              label="Gross (online)"
              value={settlement?.totals.gross_online}
              loading={loading}
            />
            <SummaryCard
              label="Refunded"
              value={settlement?.totals.refunded}
              loading={loading}
              accent
            />
            <SummaryCard
              label="Net settled"
              value={settlement?.totals.net_settled}
              loading={loading}
            />
          </>
        ) : (
          <>
            <SummaryCard
              label="Revenue"
              value={pnl?.totals.revenue}
              loading={loading}
            />
            <SummaryCard
              label="Fabric cost"
              value={pnl?.totals.fabric_cost}
              loading={loading}
            />
            <SummaryCard
              label="Refunds"
              value={pnl?.totals.refunds}
              loading={loading}
              accent
            />
            <SummaryCard
              label="Profit"
              value={pnl?.totals.profit}
              loading={loading}
            />
          </>
        )}
      </div>

      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={hubId}
          onChange={(e) => setHubId(e.target.value)}
        >
          <option value="">All Hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input
          className={s.dateInput}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="Start date"
        />
        <input
          className={s.dateInput}
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="End date"
        />
        <button className={styles.clearBtn} onClick={clearFilters}>
          <UilTimes size={14} /> Clear
        </button>
        <button className={styles.clearBtn} onClick={load} title="Refresh">
          <UilRefresh size={14} /> Refresh
        </button>
      </div>

      <div className={styles.tableWrap}>
        {mode === "settlement" ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hub</th>
                <th>Orders</th>
                <th>Gross (online)</th>
                <th>Refunded</th>
                <th>Net settled</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows(5)
              ) : !settlement || settlement.hubs.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No online settlements in this window.
                  </td>
                </tr>
              ) : (
                <>
                  {settlement.hubs.map((h, i) => (
                    <tr key={h.hub_id ?? i} className={styles.row}>
                      <td>{h.hub_name ?? "Unassigned"}</td>
                      <td>{h.orders}</td>
                      <td className={styles.total}>{fmtINR(h.gross_online)}</td>
                      <td>{fmtINR(h.refunded)}</td>
                      <td className={styles.total}>{fmtINR(h.net_settled)}</td>
                    </tr>
                  ))}
                  <tr className={styles.row} style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td />
                    <td className={styles.total}>
                      {fmtINR(settlement.totals.gross_online)}
                    </td>
                    <td>{fmtINR(settlement.totals.refunded)}</td>
                    <td className={styles.total}>
                      {fmtINR(settlement.totals.net_settled)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hub</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Fabric cost</th>
                <th>Refunds</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows(6)
              ) : !pnl || pnl.hubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    No P&amp;L data in this window.
                  </td>
                </tr>
              ) : (
                <>
                  {pnl.hubs.map((h, i) => (
                    <tr key={h.hub_id ?? i} className={styles.row}>
                      <td>{h.hub_name ?? "Unassigned"}</td>
                      <td>{h.orders}</td>
                      <td>{fmtINR(h.revenue)}</td>
                      <td>{fmtINR(h.fabric_cost)}</td>
                      <td>{fmtINR(h.refunds)}</td>
                      <td className={styles.total}>{fmtINR(h.profit)}</td>
                    </tr>
                  ))}
                  <tr className={styles.row} style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td />
                    <td>{fmtINR(pnl.totals.revenue)}</td>
                    <td>{fmtINR(pnl.totals.fabric_cost)}</td>
                    <td>{fmtINR(pnl.totals.refunds)}</td>
                    <td className={styles.total}>
                      {fmtINR(pnl.totals.profit)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {mode === "pnl" && pnl?.note && (
        <p className={styles.pagination} style={{ marginTop: 10 }}>
          {pnl.note}
        </p>
      )}
    </div>
  );
};

export default FinanceReportPage;
