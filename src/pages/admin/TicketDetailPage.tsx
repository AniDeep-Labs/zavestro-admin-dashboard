import React from "react";
import { PhoneCell } from "../../components/DataCells"; // ACP-3 [KA11-3]
import { useNavigate, useParams } from "react-router-dom";
import {
  supportApi,
  ordersApi,
  usersApi,
  alterationsApi,
  returnsApi,
  fetchMoneyConfig,
} from "../../api/adminApi";
import type {
  SupportTicket,
  TicketMessage,
  AdminOrder,
  RescueSummary,
} from "../../api/adminApi";
import { catalogApi } from "../../api/catalogApi";
import type { AdminUser } from "../../api/catalogApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { StatusBadge, PageHeader, DetailShell, PolicyCard } from "../../components";
import { useBreadcrumbTitle } from "../../contexts/BreadcrumbContext";
import { useDialog } from "../../components/Modal/useDialog"; // [DSA-45-2]
import styles from "./TicketDetailPage.module.css";
import {
  UilAngleDown,
  UilAngleLeft,
  UilAngleUp,
  UilBox,
  UilCommentAlt,
  UilMessage,
  UilNotes,
  UilSearch,
  UilTimes,
  UilClock,
  UilUserCheck,
} from "@iconscout/react-unicons";

// T3-3 (W-S4): canned responses are now the agent's OWN, editable + persisted (localStorage),
// seeded with these defaults. No more four hardcoded strings you can't change.
const DEFAULT_TEMPLATES = [
  "Thank you for reaching out to Zavestro support.",
  "We've reviewed your order and are looking into this.",
  "Your refund has been processed and will reflect in 3–5 days.",
  "I'll escalate this to our operations team right away.",
];
const TEMPLATES_KEY = "zavestro_support_templates";
const loadTemplates = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "null");
    return Array.isArray(saved) ? saved : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
};
const saveTemplates = (t: string[]) => localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t));

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = React.useState<SupportTicket | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [reply, setReply] = React.useState("");
  const [showTemplates, setShowTemplates] = React.useState(false);
  // T3-3 (W-S4): the agent's own editable canned responses.
  const [templates, setTemplates] = React.useState<string[]>(loadTemplates);
  const addTemplate = () => {
    const v = reply.trim();
    if (!v || templates.includes(v)) return;
    const next = [...templates, v];
    setTemplates(next);
    saveTemplates(next);
  };
  const removeTemplate = (i: number) => {
    const next = templates.filter((_, j) => j !== i);
    setTemplates(next);
    saveTemplates(next);
  };
  const [resolveOnReply, setResolveOnReply] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"reply" | "notes">("reply");
  const [internalNote, setInternalNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [adminUsers, setAdminUsers] = React.useState<AdminUser[]>([]);
  const [selectedAssignee, setSelectedAssignee] = React.useState<string>("");
  const [assigning, setAssigning] = React.useState(false);

  // Order lookup
  const [orderQuery, setOrderQuery] = React.useState("");
  const [orderResults, setOrderResults] = React.useState<AdminOrder[]>([]);
  const [orderSearching, setOrderSearching] = React.useState(false);

  // G-37 re-measure quick-action (Fit-Promise lever on the ticket)
  const [showRemeasure, setShowRemeasure] = React.useState(false);
  const [remeasureReason, setRemeasureReason] = React.useState("");
  const [requestingRemeasure, setRequestingRemeasure] = React.useState(false);

  // T1-23: the support credit cap is single-sourced from the server (not hardcoded 500).
  const [creditCap, setCreditCap] = React.useState(500);
  React.useEffect(() => {
    fetchMoneyConfig()
      .then((c) => setCreditCap(c.support_credit_cap))
      .catch(() => {});
  }, []);

  // T1-21b Phase 2: repeat-rescue signal so support isn't blind before issuing.
  const [rescueSig, setRescueSig] = React.useState<RescueSummary | null>(null);
  React.useEffect(() => {
    if (ticket?.user_id)
      usersApi
        .rescueSummary(ticket.user_id)
        .then(setRescueSig)
        .catch(() => {});
  }, [ticket?.user_id]);

  // T1-21: inline goodwill credit (≤₹500, per-order capped server-side)
  const [showCredit, setShowCredit] = React.useState(false);
  const [creditAmount, setCreditAmount] = React.useState("");
  const [creditReason, setCreditReason] = React.useState("");
  const [issuingCredit, setIssuingCredit] = React.useState(false);
  const submitCredit = async () => {
    const amt = Number(creditAmount);
    if (!ticket?.user_id || !(amt > 0))
      return showToast("error", "Enter a credit amount");
    if (amt > creditCap)
      return showToast(
        "error",
        `Support credits are capped at ₹${creditCap} — escalate to finance for more`,
      );
    if (!creditReason.trim()) return showToast("error", "A reason is required");
    setIssuingCredit(true);
    try {
      const res = await usersApi.issueCredits(
        ticket.user_id,
        amt,
        creditReason.trim(),
        ticket.order_id ?? undefined,
      );
      showToast(
        "success",
        `₹${amt} credit issued`,
        res.order_goodwill_total != null
          ? `₹${res.order_goodwill_total} goodwill on this order so far.`
          : undefined,
      );
      setShowCredit(false);
      setCreditAmount("");
      setCreditReason("");
    } catch (e) {
      showToast(
        "error",
        "Couldn't issue credit",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setIssuingCredit(false);
    }
  };

  // T1-21: escalate to finance
  const [showEscalate, setShowEscalate] = React.useState(false);
  const [escalateReason, setEscalateReason] = React.useState("");
  const [escalating, setEscalating] = React.useState(false);
  const submitEscalate = async () => {
    if (!ticket || !escalateReason.trim())
      return showToast("error", "Add a reason for finance");
    setEscalating(true);
    try {
      await supportApi.escalate(ticket.id, escalateReason.trim());
      showToast(
        "success",
        "Escalated to finance",
        "Finance has been notified; priority raised to high.",
      );
      setShowEscalate(false);
      setEscalateReason("");
      supportApi
        .get(ticket.id)
        .then(setTicket)
        .catch(() => {});
    } catch (e) {
      showToast(
        "error",
        "Couldn't escalate",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setEscalating(false);
    }
  };

  const submitRemeasure = async () => {
    if (!ticket?.user_id || !remeasureReason.trim()) {
      showToast("error", "Add a reason for the re-measure");
      return;
    }
    setRequestingRemeasure(true);
    try {
      await usersApi.requestRemeasure(ticket.user_id, {
        reason: remeasureReason.trim(),
        ...(ticket.order_id ? { order_id: ticket.order_id } : {}),
      });
      showToast(
        "success",
        "Re-measure requested",
        "Ops will schedule a free agent visit.",
      );
      setShowRemeasure(false);
      setRemeasureReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("already has an open") ? "Already requested" : "Failed",
        msg,
      );
    } finally {
      setRequestingRemeasure(false);
    }
  };

  // Request alteration — the sibling fit-fix to re-measure. Needs the ticket's
  // linked (delivered) order; the backend enforces delivered-only + first-free.
  const [showAlteration, setShowAlteration] = React.useState(false);
  const [alterationDesc, setAlterationDesc] = React.useState("");
  const [requestingAlteration, setRequestingAlteration] = React.useState(false);

  const submitAlteration = async () => {
    if (!ticket?.user_id || !ticket.order_id || !alterationDesc.trim()) {
      showToast("error", "Describe the alteration needed");
      return;
    }
    setRequestingAlteration(true);
    try {
      await alterationsApi.create({
        user_id: ticket.user_id,
        order_id: ticket.order_id,
        description: alterationDesc.trim(),
      });
      showToast(
        "success",
        "Alteration requested",
        "First alteration on the order is free.",
      );
      setShowAlteration(false);
      setAlterationDesc("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("already exists")
          ? "An alteration is already open on this order"
          : msg?.includes("delivered")
            ? "Only delivered orders can be altered"
            : "Failed",
        msg,
      );
    } finally {
      setRequestingAlteration(false);
    }
  };

  // Start a return on the ticket's linked order (sibling to alteration).
  const RETURN_REASONS = [
    { v: "defective", l: "Defective / quality issue → refund" },
    { v: "wrong_item", l: "Wrong item received → refund" },
    { v: "wrong_measurements", l: "Fit / measurements wrong → alteration" },
    { v: "changed_mind", l: "Changed mind → declined" },
    { v: "other", l: "Other → manual review" },
  ];
  const [showReturn, setShowReturn] = React.useState(false);
  const [returnReason, setReturnReason] = React.useState("defective");
  const [returnDesc, setReturnDesc] = React.useState("");
  const [requestingReturn, setRequestingReturn] = React.useState(false);

  const submitReturn = async () => {
    if (!ticket?.user_id || !ticket.order_id) {
      showToast("error", "This ticket has no linked order");
      return;
    }
    setRequestingReturn(true);
    try {
      await returnsApi.create({
        user_id: ticket.user_id,
        order_id: ticket.order_id,
        reason: returnReason,
        description: returnDesc.trim() || undefined,
      });
      showToast(
        "success",
        "Return started",
        "Ops will inspect; finance approves any refund.",
      );
      setShowReturn(false);
      setReturnDesc("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("already exists")
          ? "A return is already open on this order"
          : msg?.includes("delivered")
            ? "Only delivered orders can be returned"
            : "Failed",
        msg,
      );
    } finally {
      setRequestingReturn(false);
    }
  };

  const dismissToast = (tid: string) =>
    setToasts((t) => t.filter((x) => x.id !== tid));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(ticket?.subject);

  React.useEffect(() => {
    catalogApi
      .listAdminUsers()
      .then(setAdminUsers)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    supportApi
      .get(id)
      .then((t) => {
        setTicket(t);
        setSelectedAssignee(t.assignedTo ?? "");
        if (t.phone) setOrderQuery(t.phone);
      })
      .catch((e) =>
        showToast(
          "error",
          "Failed to load ticket",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    if (orderQuery.trim().length < 3) {
      setOrderResults([]);
      return;
    }
    const t = setTimeout(() => {
      setOrderSearching(true);
      ordersApi
        .list({ search: orderQuery.trim(), limit: 6 })
        .then((r) => setOrderResults(r.orders))
        .catch(() => setOrderResults([]))
        .finally(() => setOrderSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [orderQuery]);

  const handleAssign = async () => {
    if (!ticket) return;
    setAssigning(true);
    try {
      // [KA7-21] `__unassign__` is the explicit removal choice; the empty value is
      // now only the unsubmittable placeholder.
      const updated = await supportApi.assign(
        ticket.id,
        selectedAssignee === '__unassign__' ? null : selectedAssignee || null,
      );
      setTicket(updated);
      setSelectedAssignee(updated.assignedTo ?? "");
      showToast(
        "success",
        selectedAssignee && selectedAssignee !== '__unassign__'
          ? "Ticket assigned"
          : "Assignment removed",
      );
    } catch (e) {
      showToast(
        "error",
        "Failed to assign",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleSendReply = async () => {
    if (!ticket || !reply.trim()) return;
    setSending(true);
    try {
      await supportApi.addReply(ticket.id, reply.trim(), false);
      if (resolveOnReply) {
        const updated = await supportApi.update(ticket.id, {
          status: "Resolved",
        });
        setTicket(updated);
      }
      setReply("");
      showToast("success", "Reply sent");
    } catch (e) {
      showToast(
        "error",
        "Failed to send",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!ticket || !internalNote.trim()) return;
    setSending(true);
    try {
      await supportApi.addReply(ticket.id, internalNote.trim(), true);
      setInternalNote("");
      showToast("success", "Note added");
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: SupportTicket["status"]) => {
    if (!ticket) return;
    try {
      const updated = await supportApi.update(ticket.id, { status });
      setTicket(updated);
      showToast("success", `Ticket ${status.toLowerCase()}`);
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    }
  };

  // T3-3 (W-S3): snooze the ticket to a follow-up time (or clear it). Snoozed
  // tickets leave "Needs reply" until the time passes.
  const [savingSnooze, setSavingSnooze] = React.useState(false);

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const remeasureDialog = useDialog(
    !!(showRemeasure && ticket),
    () => setShowRemeasure(false),
    'Request re-measure',
  );
  const creditDialog = useDialog(showCredit, () => setShowCredit(false), 'Issue goodwill credit');
  const escalateDialog = useDialog(
    showEscalate,
    () => setShowEscalate(false),
    'Escalate to finance',
  );
  const alterationDialog = useDialog(
    !!(showAlteration && ticket),
    () => setShowAlteration(false),
    'Request alteration',
  );
  const returnDialog = useDialog(
    !!(showReturn && ticket),
    () => setShowReturn(false),
    'Start a return',
  );
  const handleSnooze = async (value: string | null) => {
    if (!ticket) return;
    setSavingSnooze(true);
    try {
      // datetime-local gives a local wall-clock string; send it as an ISO instant.
      const iso = value ? new Date(value).toISOString() : null;
      const updated = await supportApi.setSnooze(ticket.id, iso);
      setTicket(updated);
      showToast(
        "success",
        iso ? "Follow-up set" : "Follow-up cleared",
      );
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingSnooze(false);
    }
  };

  if (loading)
    return (
      <div className={styles.page}>
        <div>Loading ticket…</div>
      </div>
    );
  if (!ticket)
    return (
      <div className={styles.page}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/admin/support")}
        >
          <UilAngleLeft size={15} /> Back
        </button>
        <div>Ticket not found.</div>
      </div>
    );

  // ── Canon header (W-11): id + subject + status/priority/category chips ──
  const header = (
    <PageHeader
      above={
        <button
          className={styles.backBtn}
          onClick={() => navigate("/admin/support")}
        >
          <UilAngleLeft size={15} /> Back to Tickets
        </button>
      }
      eyebrow={ticket.reference_id ? `#${ticket.reference_id}` : "Ticket"}
      title={ticket.subject}
      meta={
        <>
          <StatusBadge
            status={ticket.status.toLowerCase().replace(/ /g, "_")}
            label={ticket.status}
          />
          <span
            className={`${styles.priorityPill} ${styles[`priority${ticket.priority}`]}`}
          >
            {ticket.priority}
          </span>
          <span className={styles.categoryTag}>{ticket.category}</span>
        </>
      }
    />
  );

  // ── Canon right rail (W-11 DetailShell aside): context + actions ──
  const aside = (
    <>
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Ticket Info</h3>
        <div className={styles.infoGrid}>
          <div>
            <div className={styles.metaLabel}>Created</div>
            <div className={styles.metaValue}>{ticket.created}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Last Activity</div>
            <div className={styles.metaValue}>{ticket.lastActivity}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Assigned to</div>
            <div
              className={styles.assignedRow}
              style={{
                flexDirection: "column",
                alignItems: "stretch",
                gap: 6,
              }}
            >
              {(() => {
                const current = adminUsers.find(
                  (u) => u.id === ticket.assignedTo,
                );
                return (
                  <span
                    className={current ? styles.metaValue : styles.unassigned}
                    style={{ marginBottom: 4 }}
                  >
                    {current ? current.name : "Unassigned"}
                  </span>
                );
              })()}
              <select
                className={styles.fieldSelect}
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
              >
                {/* [KA7-21] The default option was "— Unassign —" on a ticket that
                    already read ASSIGNED TO *Unassigned*, under a filled button
                    labelled Assign — three controls disagreeing about one fact,
                    where accepting the default and pressing Assign would have
                    unassigned an already-unassigned ticket.
                    The placeholder now describes the state and cannot be submitted;
                    removing an assignment stays available, but only as a DELIBERATE
                    choice and only when there is one to remove. */}
                <option value="" disabled>
                  {ticket?.assignedTo ? "Reassign to…" : "Choose a person…"}
                </option>
                {ticket?.assignedTo && (
                  <option value="__unassign__">— Remove assignment —</option>
                )}
                {adminUsers
                  // G-43: only support-capable roles are offered (a ticket
                  // shouldn't land with design/procurement/finance). A current
                  // out-of-scope assignee is still shown so it isn't dropped.
                  .filter(
                    (u) =>
                      u.is_active &&
                      (["support", "admin", "super_admin"].includes(u.role) ||
                        u.id === selectedAssignee),
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {!["support", "admin", "super_admin"].includes(u.role)
                        ? " (current)"
                        : ""}
                    </option>
                  ))}
              </select>
              <button
                className={styles.assignSelfBtn}
                // [KA7-21] Nothing chosen → nothing to do.
                disabled={assigning || !selectedAssignee}
                onClick={handleAssign}
                style={{ marginTop: 2 }}
              >
                <UilUserCheck
                  size={14}
                  style={{ marginRight: 6, verticalAlign: "middle" }}
                />
                {assigning
                  ? "Saving…"
                  : selectedAssignee === '__unassign__'
                    ? "Remove"
                    : "Assign"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* T3-3 (W-S3): snooze / follow-up. Waiting on the customer or a callback?
          park the ticket to a time so it leaves "Needs reply" until then. */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>
          <UilClock
            size={15}
            style={{ marginRight: 6, verticalAlign: "-2px" }}
          />
          Follow-up
        </h3>
        {ticket.snoozeUntil ? (
          <div className={styles.metaValue} style={{ marginBottom: 8 }}>
            {new Date(ticket.snoozeUntil).getTime() > Date.now()
              ? "Snoozed until "
              : "Was due "}
            {new Date(ticket.snoozeUntil).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        ) : (
          <div className={styles.metaLabel} style={{ marginBottom: 8 }}>
            No follow-up set — stays in the active queue.
          </div>
        )}
        <input
          type="datetime-local"
          className={styles.fieldSelect}
          disabled={savingSnooze}
          value={
            ticket.snoozeUntil
              ? // to a local datetime-local value (drops seconds/zone)
                new Date(
                  new Date(ticket.snoozeUntil).getTime() -
                    new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ""
          }
          onChange={(e) => handleSnooze(e.target.value || null)}
        />
        {ticket.snoozeUntil && (
          <button
            className={styles.linkBtn}
            disabled={savingSnooze}
            onClick={() => handleSnooze(null)}
          >
            Clear follow-up
          </button>
        )}
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Customer</h3>
        <div className={styles.infoGrid}>
          <div>
            <div className={styles.metaLabel}>Name</div>
            <div className={styles.metaValue}>{ticket.customer}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Phone</div>
            <div className={styles.metaValue}><PhoneCell phone={ticket.phone} /></div>
          </div>
        </div>
        <button
          className={styles.linkBtn}
          onClick={() =>
            navigate(
              `/admin/users${ticket.phone ? `?search=${encodeURIComponent(ticket.phone)}` : ""}`,
            )
          }
        >
          View Full Profile →
        </button>
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Ticket Actions</h3>
        <div className={styles.actionList}>
          {/* Fit-Promise levers (G-37): the right moves for a fit complaint */}
          {ticket.user_id && (
            <button
              className={styles.assignSelfBtn}
              onClick={() => setShowRemeasure(true)}
            >
              Request re-measure
            </button>
          )}
          {/* T1-21: the two money verbs — inline goodwill (≤₹500) + escalate to finance */}
          {ticket.user_id && (
            <button
              className={styles.assignSelfBtn}
              onClick={() => setShowCredit(true)}
            >
              Issue credit (≤₹{creditCap})
            </button>
          )}
          {ticket.user_id && (
            <button
              className={styles.assignSelfBtn}
              onClick={() => setShowEscalate(true)}
            >
              Escalate to finance
            </button>
          )}
          {/* Alteration & return need a delivered linked order; backend enforces it. */}
          {ticket.user_id && ticket.order_id && (
            <button
              className={styles.assignSelfBtn}
              onClick={() => setShowAlteration(true)}
            >
              Request alteration
            </button>
          )}
          {ticket.user_id && ticket.order_id && (
            <button
              className={styles.assignSelfBtn}
              onClick={() => setShowReturn(true)}
            >
              Start a return
            </button>
          )}
          {ticket.status !== "Resolved" && (
            <button
              className={styles.resolveBtn}
              onClick={() => handleStatusChange("Resolved")}
            >
              Resolve Ticket
            </button>
          )}
          {ticket.status !== "Closed" && (
            <button
              className={styles.closeBtn}
              onClick={() => handleStatusChange("Closed")}
            >
              Close Ticket
            </button>
          )}
          {ticket.status === "Closed" || ticket.status === "Resolved" ? (
            <button
              className={styles.assignSelfBtn}
              onClick={() => handleStatusChange("Open")}
            >
              Reopen Ticket
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Order Lookup ─────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Order Lookup</h3>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <UilSearch
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-tertiary)",
              pointerEvents: "none",
            }}
          />
          <input
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: 36,
              paddingLeft: 30,
              paddingRight: 10,
              border: "1.5px solid var(--color-border)",
              borderRadius: 6,
              background: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              fontFamily: "inherit",
              fontSize: 13,
              outline: "none",
            }}
            placeholder="ZO-##### · ZC-##### · phone…"
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
          />
        </div>
        {orderSearching && (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-tertiary)",
              marginBottom: 8,
            }}
          >
            Searching…
          </div>
        )}
        {!orderSearching &&
          orderQuery.length >= 3 &&
          orderResults.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
              No orders found.
            </div>
          )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {orderResults.map((o) => (
            <div
              key={o.id}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--color-border-light)",
                borderRadius: 6,
                background: "var(--color-bg-secondary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <UilBox
                  size={12}
                  style={{
                    color: "var(--color-text-tertiary)",
                    flexShrink: 0,
                  }}
                />
                {o.reference_id ? (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--color-primary)",
                    }}
                  >
                    {o.reference_id}
                  </span>
                ) : (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {o.id}
                  </span>
                )}
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 10,
                    fontWeight: 600,
                    background: "var(--color-bg-primary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {o.stage.replace(/_/g, " ")}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  marginBottom: 4,
                }}
              >
                {o.customer} · ₹{o.total.toLocaleString("en-IN")} · {o.created}
              </div>
              <button
                className={styles.linkBtn}
                onClick={() => navigate(`/admin/orders/${o.uuid ?? o.id}`)}
              >
                View Order →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* T3-3 (W-S5): the policy written where the agent works. */}
      <PolicyCard />
    </>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <DetailShell header={header} aside={aside}>
        {/* Left: chat thread + reply composer (kept bespoke - better than a
            generic timeline for a back-and-forth ticket conversation). */}
        <div className={styles.card}>
          <div className={styles.thread}>
            {(ticket.messages ?? []).length === 0 ? (
              <div className={styles.systemMsg}>No messages yet.</div>
            ) : (
              (ticket.messages ?? []).map((msg: TicketMessage) => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${styles[`msg${msg.sender_type}`]}`}
                >
                  {msg.sender_type === "system" ? (
                    <div className={styles.systemMsg}>
                      {msg.body}
                      <span className={styles.msgTime}>
                        {" "}
                        ·{" "}
                        {new Date(msg.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ) : (
                    <div className={styles.bubble}>
                      {/* [SUP-32-2] Say which messages the customer cannot see.
                          The composer promises "only visible to admin team"; until
                          migration 217 that promise was kept only by the absence of
                          a customer-facing reader, and nothing on this screen
                          distinguished a private note from a sent reply. */}
                      {msg.is_internal && (
                        <div className={styles.internalTag}>Internal note — not visible to the customer</div>
                      )}
                      <div className={styles.bubbleText}>{msg.body}</div>
                      <div className={styles.bubbleTime}>
                        {new Date(msg.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Reply box */}
          <div className={styles.replyBox}>
            <div className={styles.replyTabs}>
              <button
                className={`${styles.replyTab} ${activeTab === "reply" ? styles.replyTabActive : ""}`}
                onClick={() => setActiveTab("reply")}
              >
                <UilCommentAlt size={13} /> Reply
              </button>
              <button
                className={`${styles.replyTab} ${activeTab === "notes" ? styles.replyTabActive : ""}`}
                onClick={() => setActiveTab("notes")}
              >
                <UilNotes size={13} /> Internal Notes
              </button>
            </div>
            {activeTab === "reply" ? (
              <>
                <div className={styles.templateRow}>
                  <button
                    className={styles.templateBtn}
                    onClick={() => setShowTemplates((s) => !s)}
                  >
                    Use Template{" "}
                    {showTemplates ? (
                      <UilAngleUp size={12} />
                    ) : (
                      <UilAngleDown size={12} />
                    )}
                  </button>
                  {showTemplates && (
                    <div className={styles.templateDropdown}>
                      {templates.map((t, i) => (
                        <div key={i} className={styles.templateRow}>
                          <button
                            className={styles.templateItem}
                            onClick={() => {
                              setReply(t);
                              setShowTemplates(false);
                            }}
                          >
                            {t}
                          </button>
                          <button
                            className={styles.templateDelete}
                            title="Remove this canned response"
                            onClick={(e) => { e.stopPropagation(); removeTemplate(i); }}
                          >
                            <UilTimes size={13} />
                          </button>
                        </div>
                      ))}
                      {/* T3-3 (W-S4): save the current reply as a reusable canned response. */}
                      <button
                        className={styles.templateAdd}
                        disabled={!reply.trim()}
                        onClick={() => addTemplate()}
                      >
                        + Save current reply as a template
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  className={styles.replyTextarea}
                  rows={4}
                  placeholder="Type your reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className={styles.replyFooter}>
                  <label className={styles.resolveCheck}>
                    <input
                      type="checkbox"
                      checked={resolveOnReply}
                      onChange={(e) => setResolveOnReply(e.target.checked)}
                    />
                    Also change status to: Resolved
                  </label>
                  <button
                    className={styles.sendBtn}
                    disabled={!reply.trim() || sending}
                    onClick={handleSendReply}
                  >
                    <UilMessage size={14} />{" "}
                    {sending ? "Sending…" : "Send Reply"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  className={styles.replyTextarea}
                  rows={4}
                  placeholder="Internal note (only visible to admin team)…"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
                <div className={styles.replyFooter}>
                  <div />
                  <button
                    className={styles.noteBtn}
                    disabled={!internalNote.trim() || sending}
                    onClick={handleAddNote}
                  >
                    {sending ? "Saving…" : "Add Note"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </DetailShell>

      {/* Re-measure quick-action modal (G-37) */}
      {showRemeasure && ticket && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowRemeasure(false)}
        >
          <div className={styles.modal} {...remeasureDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              Request re-measure for {ticket.customer}
            </h3>
            <p className={styles.fieldLabel}>
              Records a free re-measure request
              {ticket.order_id ? " for the linked order" : ""}. Ops schedules
              the agent visit — no charge.
            </p>
            <textarea
              className={styles.fieldTextarea}
              rows={3}
              value={remeasureReason}
              onChange={(e) => setRemeasureReason(e.target.value)}
              placeholder="e.g., Customer reports the kurta was tight across the chest"
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowRemeasure(false)}
              >
                Cancel
              </button>
              <button
                className={styles.assignSelfBtn}
                disabled={!remeasureReason.trim() || requestingRemeasure}
                onClick={submitRemeasure}
              >
                {requestingRemeasure ? "Requesting…" : "Request re-measure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* T1-21: issue goodwill credit (≤₹500, per-order capped) */}
      {showCredit && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowCredit(false)}
        >
          <div className={styles.modal} {...creditDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              Issue credit for {ticket.customer}
            </h3>
            <p className={styles.fieldLabel}>
              Goodwill wallet credit, capped at ₹{creditCap} per order
              {ticket.order_id ? " (tied to the linked order)" : ""}. More than
              that must be escalated to finance.
            </p>
            {rescueSig && (
              <p
                className={`${styles.fieldLabel} ${rescueSig.flagged ? styles.rescueFlag : ""}`}
              >
                {rescueSig.flagged ? "⚠ " : ""}This customer: ₹
                {rescueSig.goodwill_90d} goodwill · {rescueSig.remeasures_90d}{" "}
                re-measures
                {rescueSig.false_claims_90d > 0
                  ? ` (${rescueSig.false_claims_90d} customer-error)`
                  : ""}{" "}
                in {rescueSig.window_days}d
                {rescueSig.flagged
                  ? " — abnormal rescue rate, consider escalating instead."
                  : ""}
              </p>
            )}
            <input
              className={styles.fieldTextarea}
              type="number"
              min={1}
              max={creditCap}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder={`Amount (₹, max ${creditCap})`}
            />
            <textarea
              className={styles.fieldTextarea}
              rows={2}
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="Reason (e.g., goodwill for a fit issue)"
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowCredit(false)}
              >
                Cancel
              </button>
              <button
                className={styles.assignSelfBtn}
                disabled={
                  !creditAmount || !creditReason.trim() || issuingCredit
                }
                onClick={submitCredit}
              >
                {issuingCredit ? "Issuing…" : "Issue credit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* T1-21: escalate to finance */}
      {showEscalate && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowEscalate(false)}
        >
          <div className={styles.modal} {...escalateDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Escalate to finance</h3>
            <p className={styles.fieldLabel}>
              For a money decision beyond support's ₹500 cap (a refund or larger
              credit). Finance is notified and the ticket priority is raised to
              high.
            </p>
            <textarea
              className={styles.fieldTextarea}
              rows={3}
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="e.g., Customer wants a full refund — needs finance approval"
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowEscalate(false)}
              >
                Cancel
              </button>
              <button
                className={styles.assignSelfBtn}
                disabled={!escalateReason.trim() || escalating}
                onClick={submitEscalate}
              >
                {escalating ? "Escalating…" : "Escalate to finance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alteration quick-action modal — sibling to re-measure */}
      {showAlteration && ticket && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAlteration(false)}
        >
          <div className={styles.modal} {...alterationDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              Request alteration for {ticket.customer}
            </h3>
            <p className={styles.fieldLabel}>
              Raises an alteration on the ticket's linked order. The first
              alteration on an order is free; the order must already be
              delivered.
            </p>
            <textarea
              className={styles.fieldTextarea}
              rows={3}
              value={alterationDesc}
              onChange={(e) => setAlterationDesc(e.target.value)}
              placeholder="e.g., Take in 1cm at the chest; shorten sleeves by 2cm"
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowAlteration(false)}
              >
                Cancel
              </button>
              <button
                className={styles.assignSelfBtn}
                disabled={!alterationDesc.trim() || requestingAlteration}
                onClick={submitAlteration}
              >
                {requestingAlteration ? "Requesting…" : "Request alteration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return quick-action modal */}
      {showReturn && ticket && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowReturn(false)}
        >
          <div className={styles.modal} {...returnDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              Start a return for {ticket.customer}
            </h3>
            <p className={styles.fieldLabel}>
              Raises a return on the linked order. The reason routes the
              outcome; the order must be delivered. Ops inspects, finance
              approves any refund.
            </p>
            <select
              className={styles.fieldSelect}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            >
              {RETURN_REASONS.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.l}
                </option>
              ))}
            </select>
            <textarea
              className={styles.fieldTextarea}
              rows={3}
              value={returnDesc}
              onChange={(e) => setReturnDesc(e.target.value)}
              placeholder="What did the customer report? (optional)"
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowReturn(false)}
              >
                Cancel
              </button>
              <button
                className={styles.assignSelfBtn}
                disabled={requestingReturn}
                onClick={submitReturn}
              >
                {requestingReturn ? "Starting…" : "Start return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
