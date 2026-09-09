import React from "react";
import { Link } from "react-router-dom";
import { creditApprovalsApi } from "../../api/adminApi";
import type { CreditRequest } from "../../api/adminApi";
import { PageHeader, StatusBadge, EmptyState, statusLabel } from "../../components";
import { Button } from "../../components/Button/Button";
import { Textarea } from "../../components/Textarea/Textarea";
import { Modal } from "../../components/Modal/Modal";
import { AgeCell } from "../../components/DataCells";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { UilRefresh } from "@iconscout/react-unicons";
import styles from "./OrdersListPage.module.css";
import ds from "./DistributionPage.module.css";
import kpi from "./CodReconciliationPage.module.css";
import d from "./CreditApprovalsPage.module.css";
import { money } from "../../utils/money";

const STATUSES = ["pending", "approved", "rejected"];
// ACP-2 [KA8-15]: one money formatter for the whole admin (src/utils/money.ts).
// This page declared its own; five pages did, every one different, producing four
// shapes of the same amount product-wide — two of them in the same table row.
const fmtINR = (n: number | null | undefined) => money(n);

export const CreditApprovalsPage: React.FC = () => {
  const [status, setStatus] = React.useState("pending");
  const [allRows, setAllRows] = React.useState<CreditRequest[]>([]);
  // [KA8-9] The cap the automatic path enforces, so an approval that would cross it says so.
  const [cap, setCap] = React.useState<number | null>(null);
  const [windowDays, setWindowDays] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [tick, setTick] = React.useState(0);
  const [review, setReview] = React.useState<{ req: CreditRequest; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const toast = (t: ToastData["type"], title: string, msg?: string) =>
    setToasts((x) => [...x, createToast(t, title, msg)]);
  const dismiss = (id: string) => setToasts((x) => x.filter((y) => y.id !== id));

  React.useEffect(() => {
    setLoading(true);
    creditApprovalsApi
      .list("") // all statuses → KPIs + client-side filter
      .then((r) => { setAllRows(r.requests); setCap(r.cap); setWindowDays(r.windowDays); })
      .catch((e) => toast("error", "Failed to load", e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [tick]);

  const submit = async () => {
    if (!review) return;
    setBusy(true);
    try {
      if (review.action === "approve") {
        await creditApprovalsApi.approve(review.req.id, note.trim() || undefined);
        toast("success", "Credit approved", `${fmtINR(review.req.amount)} posted to ${review.req.customer_name}'s wallet.`);
      } else {
        // [FIN-36-4] Never `undefined` here — a rejection without a reason is the thing
        // being prevented, so the call site refuses it too rather than relying on the
        // button's disabled state.
        if (!note.trim()) {
          toast("error", "A reason is required", "Say why this is rejected — the agent has to relay it.");
          return;
        }
        await creditApprovalsApi.reject(review.req.id, note.trim());
        toast("success", "Request rejected", "No credit was posted.");
      }
      setReview(null);
      setNote("");
      setTick((t) => t + 1);
    } catch (e) {
      toast("error", "Action failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const pending = allRows.filter((r) => r.status === "pending");
  const approved = allRows.filter((r) => r.status === "approved");
  const rejected = allRows.filter((r) => r.status === "rejected");
  const pendingAmount = pending.reduce((sum, r) => sum + Number(r.amount), 0);
  const visible = allRows.filter((r) => r.status === status);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <PageHeader
        eyebrow="Finance · Money"
        title="Credit approvals"
        subtitle="Goodwill credits above support's inline cap (₹500) come here for finance sign-off (separation of duties). Approving posts the credit to the customer's wallet."
        actions={<Button variant="ghost" onClick={() => setTick((t) => t + 1)}><UilRefresh size={15} /> Refresh</Button>}
      />

      <div className={kpi.summary}>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Awaiting approval</div>
          <div className={`${kpi.summaryValue} ${pending.length ? kpi.pendingAccent : ""}`}>{loading ? "—" : pending.length}</div>
          {!loading && pending.length > 0 && <div className={kpi.summarySub}>{fmtINR(pendingAmount)} to sign off</div>}
        </div>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Approved</div>
          <div className={kpi.summaryValue}>{loading ? "—" : approved.length}</div>
        </div>
        <div className={kpi.summaryCard}>
          <div className={kpi.summaryLabel}>Rejected</div>
          <div className={kpi.summaryValue}>{loading ? "—" : rejected.length}</div>
        </div>
      </div>

      <div className={ds.toolbar}>
        <select className={ds.hubSel} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}><tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton} /></td>)}</tr>
            ))}
          </tbody></table>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={status === "pending" ? "Nothing awaiting approval ✓" : `No ${status} requests`}
          body={status === "pending" ? "Large goodwill credit requests from support land here for finance sign-off." : undefined}
          size="compact"
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th><th className="moneyCell">Amount</th>
                {/* [KA8-9] The approver saw the amount and the reason but not what the
                    customer already holds, nor what they have already been given — the exact
                    context [SUP-30-1] showed is unguarded. Same two numbers the automatic cap
                    enforces on, so this is what the machine would have said. */}
                <th className="moneyCell">Wallet now</th><th className="moneyCell">Goodwill already</th>
                <th>Reason</th><th>Requested by</th><th>Age</th><th>Status</th>
                {status === "pending" && <th />}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/admin/users/${r.user_id}`} className={d.cust}>{r.customer_name}</Link>
                    <div className={d.sub}>{r.customer_ref ?? r.customer_phone}</div>
                  </td>
                  <td className={`moneyCell ${d.amount}`}>{fmtINR(r.amount)}</td>
                  <td className="moneyCell">
                    {r.wallet_balance == null ? '—' : fmtINR(r.wallet_balance)}
                  </td>
                  <td className="moneyCell">
                    {r.goodwill_in_window == null ? '—' : fmtINR(r.goodwill_in_window)}
                    {/* The approval is what would push them over the cap the automatic path
                        enforces — said before the click, not discovered after it. */}
                    {r.goodwill_in_window != null && cap != null &&
                      r.goodwill_in_window + r.amount > cap && (
                        <div className={d.overCap}>
                          over the {fmtINR(cap)} / {windowDays}-day cap
                        </div>
                      )}
                  </td>
                  <td className={d.reason}>{r.reason}</td>
                  <td className={d.sub}>{r.requested_by_name ?? "—"}</td>
                  <td><AgeCell since={r.created_at} warnAfterH={24} alertAfterH={72} /></td>
                  <td>
                    <StatusBadge status={r.status} size="sm" />
                    {r.status !== "pending" && r.reviewed_by_name && <div className={d.sub}>by {r.reviewed_by_name}</div>}
                  </td>
                  {status === "pending" && (
                    <td className={d.actions}>
                      {/* [KA8-8] The weighting was backwards. APPROVE moves money
                          and is irreversible; REJECT needs no reason and costs
                          nothing. Approve was the filled pill and Reject a text
                          link, so the eye was pulled toward the consequential one.
                          Both are now ordinary buttons, and Approve names its
                          amount with an ellipsis — COD's "Confirm…" convention,
                          two nav items away. */}
                      <Button size="sm" variant="secondary" onClick={() => { setReview({ req: r, action: "approve" }); setNote(""); }}>
                        Approve {fmtINR(r.amount)}…
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setReview({ req: r, action: "reject" }); setNote(""); }}>Reject…</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={review !== null}
        onClose={() => setReview(null)}
        title={review?.action === "approve" ? "Approve credit" : "Reject credit request"}
      >
        {review && (
          <div className={d.modal}>
            <p className={d.modalLead}>
              {review.action === "approve" ? (
                <>Post <strong>{fmtINR(review.req.amount)}</strong> to <strong>{review.req.customer_name}</strong>'s wallet?</>
              ) : (
                <>Reject the <strong>{fmtINR(review.req.amount)}</strong> request for <strong>{review.req.customer_name}</strong>? No credit is posted.</>
              )}
            </p>
            <div className={d.reasonBox}>
              <span className={d.sub}>Support's reason</span>
              <div>{review.req.reason}</div>
            </div>
            <Textarea
              value={note}
              onChange={setNote}
              placeholder={
                review.action === "approve"
                  ? "Approval note (optional)"
                  : "Why is this rejected? The agent has to tell the customer."
              }
              rows={2}
            />
            {/* [FIN-36-4] A rejection needs a reason. Finance can decline goodwill a
                customer was already promised, and the agent who made that promise is the
                one who has to explain it — with nothing to explain it from. The same
                product already refuses a COD variance and a review rejection without a
                reason; this was the outlier. Approval stays optional: approving grants
                what was asked for, and needs no defence. */}
            {review.action === "reject" && !note.trim() && (
              <p className={d.reasonRequired}>A reason is required to reject.</p>
            )}
            <div className={d.modalActions}>
              <Button variant="ghost" size="sm" onClick={() => setReview(null)}>Cancel</Button>
              <Button
                size="sm"
                variant={review.action === "reject" ? "danger" : "primary"}
                onClick={submit}
                state={busy ? "loading" : "default"}
                disabled={busy || (review.action === "reject" && !note.trim())}
              >
                {review.action === "approve" ? "Approve & post credit" : "Reject request"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CreditApprovalsPage;
