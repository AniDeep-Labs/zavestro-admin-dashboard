import React from "react";
import { useNavigate } from "react-router-dom";
import { usersApi, ordersApi, supportApi, alterationsApi, returnsApi } from "../../api/adminApi";
import type {
  CustomerLookupResult,
  AdminUser,
  AdminOrder,
  SupportTicket,
  RemeasureRequest,
} from "../../api/adminApi";
import { CustomerQuickLookup } from "../../components/CustomerQuickLookup/CustomerQuickLookup";
import { PageHeader, DetailShell, StatusBadge, EmptyState, ActivityLog } from "../../components";
import type { ActivityEntry } from "../../components";
import { Can } from "../../components/Can/Can";
import { Button } from "../../components/Button/Button";
import { Textarea } from "../../components/Textarea/Textarea";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import styles from "./CallConsolePage.module.css";
import {
  UilPhone,
  UilLock,
  UilCheckCircle,
  UilShoppingBag,
  UilCommentAlt,
  UilRulerCombined,
  UilWallet,
  UilExternalLinkAlt,
  UilSearchAlt,
  UilHistory,
  UilClipboardNotes,
  UilProcess,
} from "@iconscout/react-unicons";

const CATEGORIES = ["Fit issue", "Delivery", "Payment / refund", "Order change", "General"];
const PRIORITIES = ["Low", "Medium", "High"];
// W-5: above this, a wallet credit is submitted to finance (matches the backend cap).
const SUPPORT_CREDIT_CAP = 500;

// ── PII masking (DPDP): nothing sensitive is shown until the caller is verified ──
const maskPhone = (p?: string | null) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `••• ••• ${d.slice(-4)}` : "••••";
};
const maskEmail = (e?: string | null) => {
  if (!e || !e.includes("@")) return "•••";
  const [u, domain] = e.split("@");
  return `${u.slice(0, 1)}•••@${domain}`;
};

interface Detail {
  user: AdminUser | null;
  orders: AdminOrder[];
  tickets: SupportTicket[];
  remeasures: RemeasureRequest[];
  balance: number;
}

export const CallConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const toast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  // Caller + verification
  const [customer, setCustomer] = React.useState<CustomerLookupResult | null>(null);
  const [checks, setChecks] = React.useState({ name: false, phone: false, place: false });
  const [verified, setVerified] = React.useState(false);

  // 360 context (loaded after verification)
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Problem capture
  const [problemOrderId, setProblemOrderId] = React.useState<string>("");
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState(CATEGORIES[0]);
  const [priority, setPriority] = React.useState("Medium");
  const [message, setMessage] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Quick actions
  const [remeasureReason, setRemeasureReason] = React.useState("");
  const [creditAmount, setCreditAmount] = React.useState("");
  const [creditReason, setCreditReason] = React.useState("");
  const [alterationDesc, setAlterationDesc] = React.useState("");
  const [returnReason, setReturnReason] = React.useState("defective");
  const [returnDesc, setReturnDesc] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  // "This call" running log + wrap-up
  const [callLog, setCallLog] = React.useState<ActivityEntry[]>([]);
  const [disposition, setDisposition] = React.useState("");
  const [wrapSummary, setWrapSummary] = React.useState("");
  const [wrapping, setWrapping] = React.useState(false);

  const nowTime = () =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const logActivity = (title: string, tone: ActivityEntry["tone"] = "neutral") =>
    setCallLog((l) => [
      ...l,
      { id: `${Date.now()}-${l.length}`, at: nowTime(), title, tone },
    ]);

  const resetCall = () => {
    setCustomer(null);
    setChecks({ name: false, phone: false, place: false });
    setVerified(false);
    setDetail(null);
    setProblemOrderId("");
    setSubject("");
    setCategory(CATEGORIES[0]);
    setPriority("Medium");
    setMessage("");
    setRemeasureReason("");
    setCreditAmount("");
    setCreditReason("");
    setAlterationDesc("");
    setReturnReason("defective");
    setReturnDesc("");
    setCallLog([]);
    setDisposition("");
    setWrapSummary("");
  };

  const onSelectCustomer = (c: CustomerLookupResult) => {
    setCustomer(c);
    setChecks({ name: false, phone: false, place: false });
    setVerified(false);
    setDetail(null);
    setCallLog([]);
    setDisposition("");
    setWrapSummary("");
  };

  const canVerify = checks.name && (checks.phone || checks.place);

  const verify = async () => {
    if (!customer || !canVerify) return;
    setVerified(true);
    logActivity("Identity verified (agent-confirmed)", "done");
    // Log the verification for audit (best-effort; failure shouldn't block the call).
    usersApi
      .addNote(customer.id, "Identity verified on inbound call (agent-confirmed).")
      .catch(() => {});
    setLoadingDetail(true);
    try {
      const [user, ordersRes, ticketsRes, remeasures, credits] = await Promise.all([
        usersApi.get(customer.id).catch(() => null),
        ordersApi.list({ userId: customer.id, limit: 8 }).catch(() => ({ orders: [] as AdminOrder[] })),
        supportApi.list({ search: customer.phone }).catch(() => ({ tickets: [] as SupportTicket[] })),
        usersApi.remeasureRequests(customer.id).catch(() => [] as RemeasureRequest[]),
        usersApi.creditsLedger(customer.id).catch(() => ({ balance: 0, entries: [] })),
      ]);
      setDetail({
        user,
        orders: ordersRes.orders ?? [],
        tickets: (ticketsRes.tickets ?? []).filter(
          (t) => t.status !== "Closed" && t.status !== "Resolved",
        ),
        remeasures,
        balance: credits.balance ?? 0,
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const createTicket = async () => {
    if (!customer || !subject.trim() || !message.trim()) {
      toast("error", "Add a subject and what the caller reported");
      return;
    }
    setCreating(true);
    try {
      const t = await supportApi.create({
        user_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        subject: subject.trim(),
        category,
        priority,
        order_id: problemOrderId || undefined,
        messages: [
          { sender: "admin", body: message.trim(), timestamp: new Date().toISOString() },
        ],
      });
      toast("success", "Ticket logged", `#${t.reference_id ?? t.id} created from the call.`);
      logActivity(`Ticket #${t.reference_id ?? t.id.slice(0, 8)} created`, "transit");
      setSubject("");
      setMessage("");
    } catch (e) {
      toast("error", "Couldn't create ticket", e instanceof Error ? e.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const doRemeasure = async () => {
    if (!customer || !remeasureReason.trim()) {
      toast("error", "Add a reason for the re-measure");
      return;
    }
    setBusy("remeasure");
    try {
      await usersApi.requestRemeasure(customer.id, {
        reason: remeasureReason.trim(),
        ...(problemOrderId ? { order_id: problemOrderId } : {}),
      });
      toast("success", "Re-measure requested", "Ops will schedule a free agent visit.");
      logActivity("Re-measure requested (free visit)", "fit");
      setRemeasureReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      toast("error", msg?.includes("already has an open") ? "Already requested" : "Failed", msg);
    } finally {
      setBusy(null);
    }
  };

  const doCredit = async () => {
    const amt = Number(creditAmount);
    if (!customer || !amt || amt <= 0 || !creditReason.trim()) {
      toast("error", "Enter an amount and a reason for the credit");
      return;
    }
    setBusy("credit");
    try {
      // W-5: over the support cap → submit to finance instead of failing.
      if (amt > SUPPORT_CREDIT_CAP) {
        await usersApi.requestCredit(customer.id, amt, creditReason.trim());
        toast("success", "Sent to finance", `₹${amt} credit submitted for finance approval.`);
        logActivity(`Credit ₹${amt} requested (finance approval)`, "pending");
      } else {
        await usersApi.issueCredits(customer.id, amt, creditReason.trim());
        toast("success", "Wallet credit issued", `₹${amt} added to the customer's wallet.`);
        logActivity(`Wallet credit issued (₹${amt})`, "done");
        if (detail) setDetail({ ...detail, balance: detail.balance + amt });
      }
      setCreditAmount("");
      setCreditReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      toast("error", msg?.includes("awaiting finance") ? "Already pending" : "Couldn't process credit", msg);
    } finally {
      setBusy(null);
    }
  };

  const doAlteration = async () => {
    if (!customer || !problemOrderId) {
      toast("error", "Pick the delivered order in Recent orders first");
      return;
    }
    if (!alterationDesc.trim()) {
      toast("error", "Describe the alteration needed");
      return;
    }
    setBusy("alteration");
    try {
      await alterationsApi.create({
        user_id: customer.id,
        order_id: problemOrderId,
        description: alterationDesc.trim(),
      });
      toast("success", "Alteration requested", "First alteration on the order is free.");
      logActivity("Alteration requested", "making");
      setAlterationDesc("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      toast(
        "error",
        msg?.includes("already exists")
          ? "An alteration is already open on this order"
          : msg?.includes("delivered")
            ? "Only delivered orders can be altered"
            : "Couldn't request alteration",
        msg,
      );
    } finally {
      setBusy(null);
    }
  };

  const doReturn = async () => {
    if (!customer || !problemOrderId) {
      toast("error", "Pick the delivered order in Recent orders first");
      return;
    }
    setBusy("return");
    try {
      const r = await returnsApi.create({
        user_id: customer.id,
        order_id: problemOrderId,
        reason: returnReason,
        description: returnDesc.trim() || undefined,
      });
      const outcome = (r as { outcome?: string }).outcome;
      toast(
        "success",
        "Return started",
        outcome === "declined"
          ? "Logged — change-of-mind returns aren't accepted."
          : "Ops will inspect; finance approves the refund.",
      );
      logActivity(`Return started (${returnReason.replace(/_/g, " ")})`, "transit");
      setReturnDesc("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      toast(
        "error",
        msg?.includes("already exists")
          ? "A return is already open on this order"
          : msg?.includes("delivered")
            ? "Only delivered orders can be returned"
            : "Couldn't start return",
        msg,
      );
    } finally {
      setBusy(null);
    }
  };

  const RETURN_REASONS = [
    { v: "defective", l: "Defective / quality issue → refund" },
    { v: "wrong_item", l: "Wrong item received → refund" },
    { v: "wrong_measurements", l: "Fit / measurements wrong → alteration" },
    { v: "changed_mind", l: "Changed mind → declined" },
    { v: "other", l: "Other → manual review" },
  ];

  const endCall = async () => {
    if (!customer || !disposition) {
      toast("error", "Pick a call outcome before ending");
      return;
    }
    setWrapping(true);
    const actions = callLog.map((e) => e.title).join("; ") || "none";
    const note =
      `[Call] Outcome: ${disposition}.` +
      (wrapSummary.trim() ? ` ${wrapSummary.trim()}` : "") +
      ` Actions this call: ${actions}.`;
    try {
      await usersApi.addNote(customer.id, note);
      toast("success", "Call logged", "Outcome saved to the customer record.");
      resetCall();
    } catch (e) {
      toast("error", "Couldn't log the call", e instanceof Error ? e.message : undefined);
    } finally {
      setWrapping(false);
    }
  };

  const DISPOSITIONS = [
    "Resolved on call",
    "Ticket logged for follow-up",
    "Re-measure scheduled",
    "Credit issued",
    "Callback needed",
    "Escalated to ops",
  ];

  // ─────────────────────────────────────────────────────────────────────────
  const header = (
    <PageHeader
      eyebrow="Phone support"
      title="Call console"
      subtitle="Search the caller, verify who they are, then resolve — order history and contact details unlock only after verification."
      actions={
        customer ? (
          <Button variant="ghost" size="sm" onClick={resetCall}>
            <UilSearchAlt size={15} /> New call
          </Button>
        ) : undefined
      }
    />
  );

  // 1 ── No caller yet: search-first
  if (!customer) {
    return (
      <div className={styles.page}>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        {header}
        <div className={styles.searchPanel}>
          <div className={styles.searchInner}>
            <div className={styles.searchIcon}>
              <UilPhone size={26} />
            </div>
            <h2 className={styles.searchTitle}>Who's calling?</h2>
            <p className={styles.searchHint}>
              Search by the number they're calling from, their ZC-ID, name or email.
            </p>
            <CustomerQuickLookup onSelect={onSelectCustomer} autoFocus />
          </div>
        </div>
      </div>
    );
  }

  const u = detail?.user;
  // Alteration & return need a DELIVERED order — gate the actions on the selected
  // order's stage so we never enable a button that the backend will reject.
  const selectedOrder = detail?.orders.find((o) => (o.uuid ?? o.id) === problemOrderId);
  const selDelivered = selectedOrder?.stage === "delivered";
  const orderPicked = Boolean(problemOrderId);

  // Caller card — masked until verified
  const callerCard = (
    <div className={styles.card}>
      <div className={styles.callerTop}>
        <div className={styles.avatar}>{(customer.name || "?").charAt(0).toUpperCase()}</div>
        <div className={styles.callerName}>
          <div className={styles.name}>{customer.name || "Unknown caller"}</div>
          <div className={styles.sub}>
            {customer.reference_id ?? "—"} · {customer.order_count} order
            {customer.order_count === 1 ? "" : "s"}
          </div>
        </div>
        {verified ? (
          <span className={styles.verifiedTag}>
            <UilCheckCircle size={14} /> Verified
          </span>
        ) : (
          <span className={styles.maskedTag}>
            <UilLock size={13} /> Unverified
          </span>
        )}
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Phone</dt>
          <dd>{verified ? customer.phone : maskPhone(customer.phone)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{verified ? customer.email || "—" : maskEmail(customer.email)}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{verified ? customer.city || "—" : `${(customer.city || "•").charAt(0)}•••`}</dd>
        </div>
        {verified && u && (
          <div>
            <dt>Wallet</dt>
            <dd>₹{(detail?.balance ?? 0).toLocaleString("en-IN")}</dd>
          </div>
        )}
      </dl>
      {verified && (
        <button
          className={styles.linkBtn}
          onClick={() => navigate(`/admin/users/${customer.id}`)}
        >
          <UilExternalLinkAlt size={13} /> Open full profile
        </button>
      )}
    </div>
  );

  // Verification checklist (pre-verify) or quick actions (post-verify) in the aside
  const aside = (
    <>
      {callerCard}

      {!verified ? (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Verify the caller</h3>
          <p className={styles.cardHint}>
            Confirm at least their name and one more detail before opening their record.
          </p>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={checks.name}
              onChange={(e) => setChecks((c) => ({ ...c, name: e.target.checked }))}
            />
            Stated their full name correctly
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={checks.phone}
              onChange={(e) => setChecks((c) => ({ ...c, phone: e.target.checked }))}
            />
            Confirmed the registered phone (last 4: {maskPhone(customer.phone).slice(-4)})
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={checks.place}
              onChange={(e) => setChecks((c) => ({ ...c, place: e.target.checked }))}
            />
            Confirmed city or a recent order
          </label>
          <Button fullWidth onClick={verify} disabled={!canVerify}>
            <UilCheckCircle size={15} /> Mark identity verified
          </Button>
        </div>
      ) : (
        <>
          <Can cap="orders:write">
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <UilRulerCombined size={15} /> Request re-measure
              </h3>
              <p className={styles.cardHint}>Free agent visit for a fit complaint.</p>
              <Textarea
                value={remeasureReason}
                onChange={setRemeasureReason}
                placeholder="e.g. Kurta tight across the chest"
                rows={2}
              />
              <Button
                size="sm"
                onClick={doRemeasure}
                disabled={!remeasureReason.trim() || busy === "remeasure"}
                state={busy === "remeasure" ? "loading" : "default"}
              >
                Request re-measure
              </Button>
            </div>
          </Can>

          <Can cap="orders:write">
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <UilProcess size={15} /> Request alteration
              </h3>
              <p className={styles.cardHint}>
                {!orderPicked
                  ? "Select an order in Recent orders first."
                  : !selDelivered
                    ? "The selected order isn't delivered — alterations need a delivered order."
                    : "For the selected order — first alteration is free."}
              </p>
              <Textarea
                value={alterationDesc}
                onChange={setAlterationDesc}
                placeholder="e.g. Take in 1cm at the chest"
                rows={2}
              />
              <Button
                size="sm"
                onClick={doAlteration}
                disabled={!selDelivered || !alterationDesc.trim() || busy === "alteration"}
                state={busy === "alteration" ? "loading" : "default"}
              >
                Request alteration
              </Button>
            </div>
          </Can>

          <Can cap="orders:write">
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <UilHistory size={15} /> Start a return
              </h3>
              <p className={styles.cardHint}>
                {!orderPicked
                  ? "Select an order in Recent orders first."
                  : !selDelivered
                    ? "The selected order isn't delivered — returns need a delivered order."
                    : "For the selected order — ops inspects, finance approves any refund."}
              </p>
              <select
                className={styles.select}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.l}
                  </option>
                ))}
              </select>
              <Textarea
                value={returnDesc}
                onChange={setReturnDesc}
                placeholder="What did the caller report? (optional)"
                rows={2}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={doReturn}
                disabled={!selDelivered || busy === "return"}
                state={busy === "return" ? "loading" : "default"}
              >
                Start return
              </Button>
            </div>
          </Can>

          <Can cap="customers:write">
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <UilWallet size={15} /> Issue wallet credit
              </h3>
              <div className={styles.creditRow}>
                <input
                  className={styles.amountInput}
                  type="number"
                  min={1}
                  placeholder="₹ amount"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                />
              </div>
              <Textarea
                value={creditReason}
                onChange={setCreditReason}
                placeholder="Reason (shown in the wallet ledger)"
                rows={2}
              />
              {Number(creditAmount) > SUPPORT_CREDIT_CAP && (
                <p className={styles.cardHint}>
                  Over the ₹{SUPPORT_CREDIT_CAP} cap — goes to finance for approval.
                </p>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={doCredit}
                disabled={!creditAmount || !creditReason.trim() || busy === "credit"}
                state={busy === "credit" ? "loading" : "default"}
              >
                {Number(creditAmount) > SUPPORT_CREDIT_CAP ? "Request finance approval" : "Issue credit"}
              </Button>
            </div>
          </Can>
        </>
      )}
    </>
  );

  // Main column
  const main = !verified ? (
    <div className={styles.gate}>
      <UilLock size={30} />
      <h2 className={styles.gateTitle}>Verify before you proceed</h2>
      <p className={styles.gateText}>
        Confirm the caller's identity using the checklist on the right. Their orders,
        measurements and contact details stay hidden until you do — this protects the
        customer's data on an unverified call.
      </p>
    </div>
  ) : (
    <>
      {/* Open tickets */}
      {detail && detail.tickets.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <UilCommentAlt size={15} /> Open tickets ({detail.tickets.length})
          </h3>
          <div className={styles.rows}>
            {detail.tickets.map((t) => (
              <button
                key={t.id}
                className={styles.row}
                onClick={() => navigate(`/admin/support/${t.id}`)}
              >
                <span className={styles.rowMain}>{t.subject}</span>
                <StatusBadge
                  status={t.status.toLowerCase().replace(/ /g, "_")}
                  label={t.status}
                  size="sm"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders — pick the one the call is about */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <UilShoppingBag size={15} /> Recent orders
        </h3>
        {loadingDetail ? (
          <p className={styles.cardHint}>Loading…</p>
        ) : !detail || detail.orders.length === 0 ? (
          <EmptyState title="No orders yet" body="This customer hasn't placed an order." size="compact" />
        ) : (
          <div className={styles.rows}>
            {detail.orders.map((o) => {
              const active = problemOrderId === (o.uuid ?? o.id);
              return (
                <button
                  key={o.id}
                  className={`${styles.orderRow} ${active ? styles.orderRowActive : ""}`}
                  onClick={() => setProblemOrderId(active ? "" : (o.uuid ?? o.id))}
                >
                  <span className={styles.orderRef}>{o.reference_id ?? o.id.slice(0, 8)}</span>
                  <StatusBadge status={o.stage} size="sm" />
                  <span className={styles.orderTotal}>₹{o.total.toLocaleString("en-IN")}</span>
                  <span className={styles.orderDate}>{o.created}</span>
                  {active && <span className={styles.pickedTag}>this call</span>}
                </button>
              );
            })}
          </div>
        )}
        {problemOrderId && (
          <button
            className={styles.linkBtn}
            onClick={() => navigate(`/admin/orders/${problemOrderId}`)}
          >
            <UilExternalLinkAlt size={13} /> Open full order page (tracking, refund approval, edits)
          </button>
        )}
      </div>

      {/* Log the problem → ticket */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <UilCommentAlt size={15} /> Log the problem
        </h3>
        <p className={styles.cardHint}>
          Creates a support ticket linked to {customer.name || "this customer"}
          {problemOrderId ? " and the selected order" : ""}.
        </p>
        <input
          className={styles.field}
          placeholder="Short subject (e.g. Kurta too tight at chest)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div className={styles.selectRow}>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} priority
              </option>
            ))}
          </select>
        </div>
        <Textarea
          value={message}
          onChange={setMessage}
          placeholder="What did the caller report? (this becomes the first message on the ticket)"
          rows={4}
        />
        <div className={styles.actions}>
          <Button
            onClick={createTicket}
            disabled={!subject.trim() || !message.trim() || creating}
            state={creating ? "loading" : "default"}
          >
            Create ticket from call
          </Button>
        </div>
      </div>

      {/* This call — running activity (dogfoods ActivityLog) */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <UilHistory size={15} /> This call
        </h3>
        <ActivityLog entries={callLog} emptyText="No actions yet — anything you do shows here." />
      </div>

      {/* Wrap up — record the outcome, then reset for the next caller */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <UilClipboardNotes size={15} /> Wrap up the call
        </h3>
        <p className={styles.cardHint}>
          Record the outcome — it's saved to the customer record with everything done this call.
        </p>
        <select
          className={styles.select}
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
        >
          <option value="">Select an outcome…</option>
          {DISPOSITIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Textarea
          value={wrapSummary}
          onChange={setWrapSummary}
          placeholder="Optional summary of the call"
          rows={2}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={endCall}
            disabled={!disposition || wrapping}
            state={wrapping ? "loading" : "default"}
          >
            End &amp; log call
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <DetailShell header={header} aside={aside}>
        {main}
      </DetailShell>
    </div>
  );
};

export default CallConsolePage;
