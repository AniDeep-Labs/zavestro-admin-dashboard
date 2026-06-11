import React from "react";
import { refundsApi, hubsApi } from "../../api/adminApi";
import type { RefundEntry, Hub } from "../../api/adminApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import styles from "./OrdersListPage.module.css";
import s from "./CodReconciliationPage.module.css";
import { UilRefresh, UilTimes } from "@iconscout/react-unicons";

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const amount = (r: RefundEntry) => Number(r.refund_amount) || 0;

const STATUS_CSS: Record<string, string> = {
  pending: "stageWarning",
  initiated: "stageWarning",
  completed: "stageSuccess",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  initiated: "Initiated",
  completed: "Completed",
};

// A manual (COD) refund that's initiated is the one finance must physically disburse.
const needsDisburse = (r: RefundEntry) =>
  r.refund_method === "manual_transfer" && r.refund_status === "initiated";

export const RefundsPage: React.FC = () => {
  const [refunds, setRefunds] = React.useState<RefundEntry[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [actingId, setActingId] = React.useState("");
  const [confirm, setConfirm] = React.useState<null | {
    title: string;
    message: React.ReactNode;
    label: string;
    run: () => Promise<void>;
  }>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    refundsApi
      .list(statusFilter || undefined)
      .then(setRefunds)
      .catch((e) =>
        toast(
          "error",
          "Load failed",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
  }, [statusFilter]);

  React.useEffect(() => {
    load();
  }, [load]);
  React.useEffect(() => {
    hubsApi
      .list()
      .then((r) => setHubs(r.hubs))
      .catch(() => {
        /* hub filter optional */
      });
  }, []);

  const visible = hubFilter
    ? refunds.filter((r) => r.hub_id === hubFilter)
    : refunds;

  const awaiting = visible.filter(needsDisburse);
  const awaitingAmount = awaiting.reduce((sum, r) => sum + amount(r), 0);
  const initiatedAuto = visible.filter(
    (r) => r.refund_method === "razorpay" && r.refund_status === "initiated",
  ).length;
  const completed = visible.filter(
    (r) => r.refund_status === "completed",
  ).length;

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.run();
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  const disburse = async (r: RefundEntry) => {
    setActingId(r.id);
    try {
      await refundsApi.markComplete(r.id);
      toast(
        "success",
        "Refund marked disbursed",
        `${fmtINR(amount(r))} to ${r.customer_name ?? "customer"}`,
      );
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

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Refunds</h1>
        <button className={styles.clearBtn} onClick={load} title="Refresh">
          <UilRefresh size={14} /> Refresh
        </button>
      </div>

      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Awaiting disbursement</div>
          <div className={`${s.summaryValue} ${s.pendingAccent}`}>
            {loading ? "—" : awaiting.length}
          </div>
          {!loading && awaiting.length > 0 && (
            <div className={s.summarySub}>
              {fmtINR(awaitingAmount)} to pay out (manual)
            </div>
          )}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Auto (Razorpay)</div>
          <div className={s.summaryValue}>{loading ? "—" : initiatedAuto}</div>
          {!loading && (
            <div className={s.summarySub}>
              refunding to source automatically
            </div>
          )}
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Completed</div>
          <div className={s.summaryValue}>{loading ? "—" : completed}</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={hubFilter}
          onChange={(e) => setHubFilter(e.target.value)}
        >
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="initiated">Initiated</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <button
          className={styles.clearBtn}
          onClick={() => {
            setHubFilter("");
            setStatusFilter("");
          }}
        >
          <UilTimes size={14} /> Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Hub</th>
              <th>Amount</th>
              <th>Method</th>
              <th>To</th>
              <th>Status</th>
              <th>Initiated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j}>
                      <div className={styles.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  No refunds in this view.
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className={styles.row}>
                  <td className={styles.orderId}>{r.order_number}</td>
                  <td>
                    <div className={styles.customerName}>
                      {r.customer_name ?? "—"}
                    </div>
                    <div className={styles.customerPhone}>
                      {r.customer_phone ?? ""}
                    </div>
                  </td>
                  <td>{r.hub_name ?? "—"}</td>
                  <td className={styles.total}>{fmtINR(amount(r))}</td>
                  <td>
                    {r.refund_method === "razorpay"
                      ? "Razorpay"
                      : r.refund_method === "manual_transfer"
                        ? "Manual"
                        : "—"}
                  </td>
                  <td style={{ color: "var(--color-text-secondary)" }}>
                    {destination(r)}
                  </td>
                  <td>
                    <span
                      className={`${styles.stagePill} ${styles[STATUS_CSS[r.refund_status] ?? "stageNeutral"]}`}
                    >
                      {STATUS_LABEL[r.refund_status] ?? r.refund_status}
                    </span>
                  </td>
                  <td className={styles.date}>
                    {fmtDate(r.refund_initiated_at)}
                  </td>
                  <td>
                    {needsDisburse(r) ? (
                      <button
                        className={styles.actionBtn}
                        disabled={actingId === r.id}
                        onClick={() =>
                          setConfirm({
                            title: "Mark refund disbursed?",
                            label: "Yes, paid to source",
                            message: (
                              <>
                                Confirm <strong>{fmtINR(amount(r))}</strong> was
                                paid to{" "}
                                <strong>
                                  {r.customer_name ?? "the customer"}
                                </strong>{" "}
                                via <strong>{destination(r)}</strong> (their
                                original source / bank — never wallet). This
                                marks the refund complete and can't be undone.
                              </>
                            ),
                            run: () => disburse(r),
                          })
                        }
                      >
                        Mark disbursed
                      </button>
                    ) : r.refund_status === "completed" ? (
                      <span style={{ color: "var(--color-text-tertiary)" }}>
                        Done
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-tertiary)" }}>
                        Auto
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
