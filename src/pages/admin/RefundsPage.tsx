import React from "react";
import { useHubContextFilter } from "../../utils/useHubContextFilter"; // [SHL-3-8]
import { Link } from "react-router-dom";
import { refundsApi, hubsApi } from "../../api/adminApi";
import type { RefundEntry, Hub } from "../../api/adminApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { StatusBadge, PageHeader, EmptyState } from "../../components";
import { AgeCell , PhoneCell } from "../../components/DataCells";
import { Button } from "../../components/Button/Button";
import styles from "./OrdersListPage.module.css";
import s from "./CodReconciliationPage.module.css";
import ds from "./DistributionPage.module.css";
import { UilRefresh, UilImport } from "@iconscout/react-unicons";
import { downloadCsv, datedFilename } from "../../utils/csv";
import { money } from "../../utils/money";

// ACP-2 [KA8-15]: one money formatter for the whole admin (src/utils/money.ts).
// This page declared its own; five pages did, every one different, producing four
// shapes of the same amount product-wide — two of them in the same table row.
const fmtINR = (n: number | null | undefined) => money(n);
// ACP-6 [KA11-6]: one date formatter for the admin.
import { fmtDate } from "../../utils/date";
// [FIN-36-1] The APPROVED amount, not the order's total. This field used to be
// `orders.payable_amount` aliased over the approved figure, and it drives the
// AMOUNT column, the disburse confirm, the toast AND the CSV — so on a partial
// refund every one of them instructed finance to overpay.
const amount = (r: RefundEntry) => Number(r.refund_amount) || 0;
const orderTotal = (r: RefundEntry) =>
  r.order_payable_amount === undefined ? null : Number(r.order_payable_amount) || 0;
/** True when this is a PARTIAL refund — worth saying out loud on a payment screen. */
const isPartial = (r: RefundEntry) => {
  const t = orderTotal(r);
  return t !== null && t > amount(r) + 0.5;
};

// Manual COD refunds finance must physically pay out; a FAILED Razorpay refund is also
// finance's to handle (pay out-of-band → mark disbursed). Both fire mark-complete.
const isAwaiting = (r: RefundEntry) => r.refund_method === "manual_transfer" && r.refund_status === "initiated";
const isFailed = (r: RefundEntry) => r.refund_status === "failed";
const canDisburse = (r: RefundEntry) => isAwaiting(r) || isFailed(r);

export const RefundsPage: React.FC = () => {
  const [refunds, setRefunds] = React.useState<RefundEntry[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  const [loading, setLoading] = React.useState(true);
  const [actingId, setActingId] = React.useState("");
  const [confirm, setConfirm] = React.useState<null | { title: string; message: React.ReactNode; label: string; run: () => Promise<void> }>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    refundsApi
      .list(undefined)
      .then(setRefunds)
      .catch((e) => toast("error", "Load failed", e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    hubsApi
      .list()
      .then((r) => setHubs(r.hubs))
      .catch(() =>
        // [RC-3] A silently empty hub filter reads as "this account has no hubs", which on a
        // money page changes what the operator believes they are looking at: an unfiltered
        // total looks like a hub total. Say the filter is unavailable instead of showing
        // one that quietly cannot filter.
        toast("warning", "Hub filter unavailable", "Showing every hub. Reload to try again."),
      );
  }, []);

  const visible = hubFilter ? refunds.filter((r) => r.hub_id === hubFilter) : refunds;
  const awaiting = visible.filter(isAwaiting);
  const failed = visible.filter(isFailed);
  const auto = visible.filter((r) => r.refund_method === "razorpay" && r.refund_status === "initiated");
  const completed = visible.filter((r) => r.refund_status === "completed");
  const awaitingAmount = awaiting.reduce((sum, r) => sum + amount(r), 0);

  const handleExport = () => {
    downloadCsv<RefundEntry>(
      datedFilename("refunds"),
      [
        { header: "Return ID", value: (r) => r.id },
        { header: "Order", value: (r) => r.order_number },
        { header: "Hub", value: (r) => r.hub_name },
        { header: "Customer", value: (r) => r.customer_name },
        { header: "Phone", value: (r) => r.customer_phone },
        { header: "Amount", value: (r) => amount(r) },
        { header: "Payment method", value: (r) => r.payment_method },
        { header: "Refund method", value: (r) => r.refund_method },
        { header: "Account type", value: (r) => r.refund_account_type },
        { header: "Account detail", value: (r) => r.refund_account_detail },
        { header: "Refund status", value: (r) => r.refund_status },
        { header: "Provider ref", value: (r) => r.razorpay_refund_id ?? "" },
        { header: "Failure reason", value: (r) => r.refund_failure_reason ?? "" },
        { header: "Initiated at", value: (r) => r.refund_initiated_at },
        { header: "Expected by", value: (r) => r.expected_settlement_at ?? "" },
        { header: "Completed at", value: (r) => r.refund_completed_at },
        { header: "Created at", value: (r) => r.created_at },
      ],
      visible,
    );
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try { await confirm.run(); } finally { setConfirming(false); setConfirm(null); }
  };

  const disburse = async (r: RefundEntry) => {
    setActingId(r.id);
    try {
      await refundsApi.markComplete(r.id);
      toast("success", "Refund marked disbursed", `${fmtINR(amount(r))} to ${r.customer_name ?? "customer"}`);
      load();
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : undefined);
    } finally {
      setActingId("");
    }
  };

  const destination = (r: RefundEntry) =>
    r.refund_account_type
      ? `${r.refund_account_type.toUpperCase()}${r.refund_account_detail ? ` · ${r.refund_account_detail}` : ""}`
      : r.refund_method === "razorpay"
        ? "Original payment (Razorpay)"
        : "—";

  // T3-7 (W-F3): the "where's my money?" cell — the gateway refund reference (read out to the
  // customer) + the date the money should arrive by, for in-flight refunds.
  const refCell = (r: RefundEntry) => (
    <div>
      {r.razorpay_refund_id ? (
        <div style={{ fontFamily: "monospace", fontSize: 12 }}>{r.razorpay_refund_id}</div>
      ) : (
        <div style={{ color: "var(--color-text-tertiary)" }}>
          {r.refund_method === "razorpay" ? "ref pending" : "manual transfer"}
        </div>
      )}
      {r.expected_settlement_at && (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          Expected by {fmtDate(r.expected_settlement_at)}
          {r.settlement_business_days ? ` (~${r.settlement_business_days} business days)` : ""}
        </div>
      )}
    </div>
  );

  const customerCell = (r: RefundEntry) => (
    <td>
      {r.customer_id ? (
        <Link to={`/admin/users/${r.customer_id}`} className={styles.customerName}>{r.customer_name ?? "—"}</Link>
      ) : (
        <div className={styles.customerName}>{r.customer_name ?? "—"}</div>
      )}
      <div className={styles.customerPhone}><PhoneCell phone={r.customer_phone} /></div>
    </td>
  );

  const orderCell = (r: RefundEntry) => (
    <td className={styles.orderId}>
      <Link to={`/admin/orders/${r.order_id}`} className={styles.orderId}>{r.order_number}</Link>
    </td>
  );

  const disburseBtn = (r: RefundEntry) => (
    <Button
      variant="primary"
      size="sm"
      disabled={actingId === r.id}
      onClick={() =>
        setConfirm({
          title: "Mark refund disbursed?",
          label: "Yes, paid to source",
          message: (
            <>
              Confirm <strong>{fmtINR(amount(r))}</strong>
              {isPartial(r) && <> (a PARTIAL refund of a {fmtINR(orderTotal(r) ?? 0)} order)</>} was paid to{" "}
              <strong>{r.customer_name ?? "the customer"}</strong> via{" "}
              <strong>{destination(r)}</strong> (their original source / bank — never wallet).{" "}
              {isFailed(r) && "The automatic Razorpay refund failed, so this records your manual payout. "}
              This marks the refund complete and can't be undone.
            </>
          ),
          run: () => disburse(r),
        })
      }
    >
      Mark disbursed
    </Button>
  );

  // Worklist section. `action` controls the trailing column (disburse / age / status).
  const section = (
    title: string,
    list: RefundEntry[],
    kind: "awaiting" | "failed" | "auto" | "completed",
  ) =>
    list.length === 0 ? null : (
      <section className={ds.section}>
        <h2 className={ds.sectionTitle}>{title} <span className={ds.count}>{list.length}</span></h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Hub</th><th className="moneyCell">Amount</th><th>To</th>
                {kind === "failed" && <th>Why it failed</th>}
                {/* T3-7 (W-F3): the gateway ref + expected-by for "where's my money?" */}
                {(kind === "auto" || kind === "completed") && <th>Reference</th>}
                {(kind === "awaiting" || kind === "failed" || kind === "auto") && <th>Age</th>}
                {kind === "completed" ? <th>Completed</th> : <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={styles.row}>
                  {orderCell(r)}
                  {customerCell(r)}
                  <td>{r.hub_name ?? "—"}</td>
                  {/* [FIN-36-1] the APPROVED amount, and said to be partial when it is.
                      [KA8-15] right-aligned, like every other money cell. */}
                  <td className={`moneyCell ${styles.total}`}>
                    {fmtINR(amount(r))}
                    {isPartial(r) && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-tertiary)" }}>
                        partial · order {fmtINR(orderTotal(r) ?? 0)}
                      </div>
                    )}
                  </td>
                  <td style={{ color: "var(--color-text-secondary)" }}>{destination(r)}</td>
                  {kind === "failed" && <td className={s.pendingAccent}>{r.refund_failure_reason ?? "unknown error"}</td>}
                  {(kind === "auto" || kind === "completed") && <td>{refCell(r)}</td>}
                  {(kind === "awaiting" || kind === "failed" || kind === "auto") && (
                    <td><AgeCell since={r.refund_initiated_at ?? r.created_at} warnAfterH={48} alertAfterH={120} /></td>
                  )}
                  {kind === "completed" ? (
                    <td className={styles.date}>{fmtDate(r.refund_completed_at)}</td>
                  ) : (
                    <td>{canDisburse(r) ? disburseBtn(r) : <StatusBadge status={r.refund_status} />}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Finance · Money"
        title="Refunds"
        subtitle="Disburse manual (COD) refunds, handle failed Razorpay refunds, and watch auto-refunds clear. Money goes to the source/bank — never wallet."
        actions={
          <>
            <Button variant="ghost" onClick={handleExport} disabled={visible.length === 0}><UilImport size={15} /> Export CSV</Button>
            <Button variant="ghost" onClick={load}><UilRefresh size={15} /> Refresh</Button>
          </>
        }
      />

      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Awaiting disbursement</div>
          <div className={`${s.summaryValue} ${awaiting.length ? s.pendingAccent : ""}`}>{loading ? "—" : awaiting.length}</div>
          {!loading && awaiting.length > 0 && <div className={s.summarySub}>{fmtINR(awaitingAmount)} to pay out (manual)</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Failed</div>
          <div className={`${s.summaryValue} ${failed.length ? s.pendingAccent : ""}`}>{loading ? "—" : failed.length}</div>
          {!loading && <div className={s.summarySub}>Razorpay refunds that errored</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Auto (Razorpay)</div>
          <div className={s.summaryValue}>{loading ? "—" : auto.length}</div>
          {!loading && <div className={s.summarySub}>refunding to source automatically</div>}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Completed</div>
          <div className={s.summaryValue}>{loading ? "—" : completed.length}</div>
        </div>
      </div>

      <div className={ds.toolbar}>
        <select className={ds.hubSel} value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}><tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            ))}
          </tbody></table>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title="No refunds awaiting action ✓" body="Manual disbursals, failed refunds, and in-flight auto-refunds will appear here." />
      ) : (
        <>
          {section("Awaiting disbursement", awaiting, "awaiting")}
          {section("Failed — needs handling", failed, "failed")}
          {section("Auto — in progress", auto, "auto")}
          {section("Completed", completed, "completed")}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.label}
        loading={confirming}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default RefundsPage;
