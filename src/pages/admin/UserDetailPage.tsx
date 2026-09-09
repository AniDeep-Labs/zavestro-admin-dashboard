import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usersApi, ordersApi, fitProfilesAdminApi, alterationsApi, returnsApi } from "../../api/adminApi";
import type {
  AdminUser,
  AdminOrder,
  AdminFitProfile,
  CreditLedgerEntry,
  RemeasureRequest,
  CustomerNote,
} from "../../api/adminApi";
import { StatusBadge } from "../../components/StatusBadge";
import { MoneyCell, PhoneCell, EmailCell } from "../../components/DataCells";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { useBreadcrumbTitle } from "../../contexts/BreadcrumbContext";
import { Can } from "../../components/Can/Can";
import { PageHeader, DetailShell, NotesPanel } from "../../components";
import { useDialog } from "../../components/Modal/useDialog"; // [DSA-45-2]
import { isDenied, errorMessage } from "../../components/EmptyState/asyncState"; // [SUP-30-4]
import type { NoteEntry } from "../../components";
import styles from "./UserDetailPage.module.css";
import { fmtDate } from "../../utils/date";
import { orderedMeasurementKeys } from "../../utils/measurements";
import {
  UilAngleLeft,
  UilGift,
  UilLock,
  UilTrashAlt,
  UilUserCheck,
  UilUserTimes,
} from "@iconscout/react-unicons";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

// W-5: support's inline credit ceiling — above this, the credit is submitted to
// finance for approval (must match SUPPORT_CREDIT_CAP in the backend handler).
const SUPPORT_CREDIT_CAP = 500;

// T2-35 (SP-6): fit-outcome strip order + labels (from v_fit_outcomes).
const FIT_OUTCOMES: [string, string][] = [
  ["perfect", "Perfect"],
  ["ok", "OK"],
  ["altered", "Altered"],
  ["poor", "Poor"],
  ["refunded", "Refunded"],
  ["no_response", "No feedback"],
];

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [userOrders, setUserOrders] = React.useState<AdminOrder[]>([]);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [showDeactivateModal, setShowDeactivateModal] = React.useState(false);
  const [deactivateReason, setDeactivateReason] = React.useState("");
  const [showCreditsModal, setShowCreditsModal] = React.useState(false);
  const [creditsAmount, setCreditsAmount] = React.useState("");
  const [creditsReason, setCreditsReason] = React.useState("");
  // T2-35 (SP-6): DPDP erasure — super-only, typed-confirm.
  const [showErase, setShowErase] = React.useState(false);
  const [eraseText, setEraseText] = React.useState("");
  const [erasing, setErasing] = React.useState(false);
  const [notes, setNotes] = React.useState<CustomerNote[]>([]);
  // [SUP-30-4] The four errors this page used to discard. A panel that cannot say
  // WHY it is empty will say the wrong thing about a customer.
  const [notesErr, setNotesErr] = React.useState<unknown>(null);
  const [fitProfilesErr, setFitProfilesErr] = React.useState<unknown>(null);
  const [remeasuresErr, setRemeasuresErr] = React.useState<unknown>(null);
  const [ledgerErr, setLedgerErr] = React.useState<unknown>(null);
  const [saving, setSaving] = React.useState(false);
  const [fitProfiles, setFitProfiles] = React.useState<AdminFitProfile[]>([]);
  const [fitProfilesLoading, setFitProfilesLoading] = React.useState(false);
  const [selectedProfileId, setSelectedProfileId] = React.useState<string>("");
  // G-39 ledger + G-37 re-measure
  const [ledger, setLedger] = React.useState<CreditLedgerEntry[] | null>(null);
  const [ledgerBalance, setLedgerBalance] = React.useState<number | null>(null);
  const [remeasures, setRemeasures] = React.useState<RemeasureRequest[]>([]);
  const [showRemeasure, setShowRemeasure] = React.useState(false);
  const [remeasureReason, setRemeasureReason] = React.useState("");
  const [showAlteration, setShowAlteration] = React.useState(false);
  const [altOrderId, setAltOrderId] = React.useState("");
  const [altDesc, setAltDesc] = React.useState("");
  const [requestingAlt, setRequestingAlt] = React.useState(false);
  const [showReturn, setShowReturn] = React.useState(false);
  const [retOrderId, setRetOrderId] = React.useState("");
  const [retReason, setRetReason] = React.useState("defective");
  const [retDesc, setRetDesc] = React.useState("");
  const [requestingRet, setRequestingRet] = React.useState(false);
  const [showFlag, setShowFlag] = React.useState(false);
  const [flagReason, setFlagReason] = React.useState("");
  const [flagRemeasure, setFlagRemeasure] = React.useState(true);
  const [flagging, setFlagging] = React.useState(false);

  const dismissToast = (tid: string) =>
    setToasts((t) => t.filter((x) => x.id !== tid));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(user?.name);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([usersApi.get(id), ordersApi.list({ userId: id, limit: 10 })])
      .then(([u, ordersResp]) => {
        setUser(u);
        setUserOrders(ordersResp.orders);
      })
      .catch((e) =>
        showToast(
          "error",
          "Failed to load user",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
    // [SUP-30-4] KEEP the error. Four `catch(() => {})` here turned a refusal into
    // a statement about the customer: a 403 on fit-profiles rendered "No fit
    // profiles found for this customer."; a failed notes fetch rendered "No notes
    // yet." (so an agent misses a fraud note); a failed re-measure fetch showed no
    // open request (so an agent raises a duplicate); and the credit ledger set
    // itself to [] while the BALANCE fell back to `user.credits` — a figure from a
    // different source sitting above an empty history.
    //
    // The policy behind that 403 is correct and deliberate. The page was hiding
    // its own best decision behind a sentence that is false about the customer.
    setFitProfilesLoading(true);
    fitProfilesAdminApi
      .list(id)
      .then((data) => {
        setFitProfiles(data);
        setFitProfilesErr(null);
        if (data.length > 0) setSelectedProfileId(data[0].id);
      })
      .catch(setFitProfilesErr)
      .finally(() => setFitProfilesLoading(false));
    loadLedger(id);
    usersApi
      .remeasureRequests(id)
      .then((r) => { setRemeasures(r); setRemeasuresErr(null); })
      .catch(setRemeasuresErr);
    usersApi
      .notes(id)
      .then((n) => { setNotes(n); setNotesErr(null); })
      .catch(setNotesErr);
  }, [id]);

  const loadLedger = (uid: string) =>
    usersApi
      .creditsLedger(uid)
      .then((d) => {
        setLedger(d.entries);
        setLedgerBalance(d.balance);
        setLedgerErr(null);
      })
      // [SUP-30-4] NOT `setLedger([])` — an empty ledger under a balance read from
      // somewhere else is the money version of this whole finding.
      .catch(setLedgerErr);

  /**
   * [RC-3] Refresh a panel after a write that has ALREADY SUCCEEDED.
   *
   * All four post-action refreshes on this page used to end `.catch(() => {})`. The write
   * is reported either way, so what the swallow hides is the REFRESH — which leaves the old
   * rows on screen underneath a green "Saved" toast. That is the most confident possible way
   * to show someone the wrong state, and this page is body data: a stale fit profile or
   * re-measure row reads as the current one, and the next decision is made against it.
   *
   * The write is not rolled back and must not be reported as failed. The honest message is
   * that it landed and the view did not follow.
   */
  const refreshAfterWrite = (panel: string, run: () => Promise<unknown>) =>
    run().catch(() =>
      showToast(
        "warning",
        "Saved — but the view is out of date",
        `${panel} could not be refreshed, so what you see below may be stale. Reload the page for the current state.`,
      ),
    );

  // T1-21b Phase 3 (E): record the re-measure outcome (our fault vs customer error).
  const setOutcome = async (
    requestId: string,
    outcome: "our_fault" | "customer_error" | "pending",
  ) => {
    try {
      await usersApi.setRemeasureOutcome(requestId, outcome);
      showToast("success", "Outcome recorded");
      if (id)
        refreshAfterWrite("Re-measure requests", () =>
          usersApi.remeasureRequests(id).then(setRemeasures),
        );
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    }
  };

  const submitRemeasure = async () => {
    if (!id || !remeasureReason.trim()) {
      showToast("error", "Add a reason for the re-measure");
      return;
    }
    setSaving(true);
    try {
      await usersApi.requestRemeasure(id, { reason: remeasureReason.trim() });
      showToast("success", "Re-measure requested", "Ops will schedule a free agent visit.");
      setShowRemeasure(false);
      setRemeasureReason("");
      refreshAfterWrite("Re-measure requests", () =>
        usersApi.remeasureRequests(id).then(setRemeasures),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("already has an open") ? "Already requested" : "Failed",
        msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const reloadProfiles = () => {
    if (!id) return;
    refreshAfterWrite("Fit profiles", () => fitProfilesAdminApi.list(id).then(setFitProfiles));
  };

  const submitFlag = async () => {
    if (!id || !activeProfile || !flagReason.trim()) {
      showToast("error", "Add what's wrong with this profile");
      return;
    }
    setFlagging(true);
    try {
      const r = await fitProfilesAdminApi.flag(id, activeProfile.id, {
        reason: flagReason.trim(),
        request_remeasure: flagRemeasure,
      });
      showToast(
        "success",
        "Profile flagged incorrect",
        flagRemeasure
          ? r.remeasure_created
            ? "A re-measure was requested too."
            : "A re-measure was already open for this customer."
          : undefined,
      );
      setShowFlag(false);
      setFlagReason("");
      reloadProfiles();
      refreshAfterWrite("Re-measure requests", () =>
        usersApi.remeasureRequests(id).then(setRemeasures),
      );
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    } finally {
      setFlagging(false);
    }
  };

  const submitUnflag = async () => {
    if (!id || !activeProfile) return;
    try {
      await fitProfilesAdminApi.unflag(id, activeProfile.id);
      showToast("success", "Flag cleared");
      reloadProfiles();
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    }
  };

  const deliveredOrders = userOrders.filter((o) => o.stage === "delivered");

  const submitAlteration = async () => {
    if (!id || !altOrderId || !altDesc.trim()) {
      showToast("error", "Pick a delivered order and describe the alteration");
      return;
    }
    setRequestingAlt(true);
    try {
      await alterationsApi.create({ user_id: id, order_id: altOrderId, description: altDesc.trim() });
      showToast("success", "Alteration requested", "First alteration on the order is free.");
      setShowAlteration(false);
      setAltOrderId("");
      setAltDesc("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("already exists") ? "An alteration is already open on this order" : "Failed",
        msg,
      );
    } finally {
      setRequestingAlt(false);
    }
  };

  const RETURN_REASONS = [
    { v: "defective", l: "Defective / quality issue → refund" },
    { v: "wrong_item", l: "Wrong item received → refund" },
    { v: "wrong_measurements", l: "Fit / measurements wrong → alteration" },
    { v: "changed_mind", l: "Changed mind → declined" },
    { v: "other", l: "Other → manual review" },
  ];

  const submitReturn = async () => {
    if (!id || !retOrderId) {
      showToast("error", "Pick a delivered order");
      return;
    }
    setRequestingRet(true);
    try {
      await returnsApi.create({
        user_id: id,
        order_id: retOrderId,
        reason: retReason,
        description: retDesc.trim() || undefined,
      });
      showToast("success", "Return started", "Ops will inspect; finance approves any refund.");
      setShowReturn(false);
      setRetOrderId("");
      setRetDesc("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("already exists") ? "A return is already open on this order" : "Failed",
        msg,
      );
    } finally {
      setRequestingRet(false);
    }
  };

  const activeProfile = React.useMemo(
    () => fitProfiles.find((p) => p.id === selectedProfileId) ?? null,
    [fitProfiles, selectedProfileId],
  );

  const handleDeactivate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // [SUP-30-7] The reason this modal insists on now reaches the audit row.
      const updated = await usersApi.update(
        user.id,
        { status: "Deactivated" },
        { reason: deactivateReason },
      );
      setUser(updated);
      setShowDeactivateModal(false);
      setDeactivateReason("");
      showToast("success", "Account deactivated");
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // T2-35 (SP-6): DPDP erasure — irreversible PII redaction + measurement purge. Super-only
  // (backend enforces system:manage); typed "ERASE" gate prevents an accidental destructive click.
  const handleErase = async () => {
    if (!user || eraseText !== "ERASE") return;
    setErasing(true);
    try {
      await usersApi.eraseData(user.id);
      showToast("success", "Customer data erased", "PII redacted and measurements purged (financial records retained).");
      setShowErase(false);
      setEraseText("");
      const fresh = await usersApi.get(user.id);
      setUser(fresh);
    } catch (e) {
      showToast("error", "Erase failed", e instanceof Error ? e.message : undefined);
    } finally {
      setErasing(false);
    }
  };

  const handleReactivate = async () => {
    if (!user) return;
    try {
      const updated = await usersApi.update(user.id, { status: "Active" });
      setUser(updated);
      showToast("success", "Account reactivated");
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    }
  };

  const handleIssueCredits = async () => {
    if (!user || !creditsAmount || !creditsReason) return;
    const amt = Number(creditsAmount);
    setSaving(true);
    try {
      // W-5: over the support cap → submit for finance approval instead of failing.
      if (amt > SUPPORT_CREDIT_CAP) {
        await usersApi.requestCredit(user.id, amt, creditsReason);
        showToast("success", "Sent to finance", `₹${amt} credit submitted for finance approval.`);
      } else {
        await usersApi.issueCredits(user.id, amt, creditsReason);
        showToast("success", "Credits issued", `₹${amt} added to ${user.name}'s account`);
        loadLedger(user.id);
      }
      setShowCreditsModal(false);
      setCreditsAmount("");
      setCreditsReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        msg?.includes("awaiting finance") ? "Already pending" : "Failed",
        msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (text: string) => {
    if (!user) return;
    try {
      const created = await usersApi.addNote(user.id, text);
      setNotes((n) => [created, ...n]); // newest-first, matches the GET order
      showToast("success", "Note saved");
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
      throw e; // let NotesPanel keep the composer text on failure
    }
  };

  const noteEntries: NoteEntry[] = notes.map((n) => ({
    id: n.id,
    author: n.author_name ?? "Admin",
    at: new Date(n.created_at).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    body: n.body,
  }));

  // [DSA-45-2] These seven dialogs are hand-rolled overlays: no Escape handler,
  // no role="dialog", and focus never entered them — measured live on Issue
  // Credits, where focus stayed on the trigger button. They keep their markup
  // and CSS; useDialog supplies the behaviour `<Modal>` already has, from the
  // same implementation. Erase customer data and Deactivate Account are here.
  const deactivateDialog = useDialog(showDeactivateModal, () => setShowDeactivateModal(false), 'Deactivate account');
  const eraseDialog = useDialog(showErase, () => setShowErase(false), 'Erase customer data');
  const creditsDialog = useDialog(showCreditsModal, () => setShowCreditsModal(false), 'Issue credits');
  const remeasureDialog = useDialog(showRemeasure, () => setShowRemeasure(false), 'Request re-measure');
  const flagDialog = useDialog(showFlag, () => setShowFlag(false), 'Flag fit profile');
  const alterationDialog = useDialog(showAlteration, () => setShowAlteration(false), 'Request alteration');
  const returnDialog = useDialog(showReturn, () => setShowReturn(false), 'Start a return');
  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.backBtn}>Loading…</div>
      </div>
    );
  if (!user)
    return (
      <div className={styles.page}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/admin/users")}
        >
          <UilAngleLeft size={15} /> Back
        </button>
        <div>User not found.</div>
      </div>
    );

  // ── Canon header (W-11): customer identity + status/ref-id chips ──
  const header = (
    <PageHeader
      above={
        <button
          className={styles.backBtn}
          onClick={() => navigate("/admin/users")}
        >
          <UilAngleLeft size={15} /> Back to Users
        </button>
      }
      eyebrow="Customer"
      title={user.name}
      /* [KA11-5] The title is a person's name; the subtitle says which record this is and
         since when — so the page identifies itself when the name alone is ambiguous. */
      subtitle={
        <>
          Customer record
          {user.reference_id ? ` · ${user.reference_id}` : ''}
          {user.joined ? ` · joined ${user.joined}` : ''}
        </>
      }
      meta={
        <>
          <StatusBadge
            status={user.status === "Active" ? "active" : "inactive"}
            label={user.status}
          />
          {user.reference_id && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: 500,
                padding: "2px 8px",
                background:
                  "var(--color-primary-faint, rgba(31, 107, 79,0.08))",
                color: "var(--color-primary)",
                borderRadius: 4,
              }}
            >
              {user.reference_id}
            </span>
          )}
        </>
      }
    />
  );

  // ── Canon right rail (W-11 DetailShell aside): contact · actions · notes ──
  const aside = (
    <>
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Contact</h3>
        <div className={styles.contactList}>
          <div>
            <div className={styles.metaLabel}>Phone</div>
            <div className={styles.metaValue}><PhoneCell phone={user.phone} /></div>
          </div>
          <div>
            <div className={styles.metaLabel}>Email</div>
            <div className={styles.metaValue}><EmailCell email={user.email} /></div>
          </div>
          <div>
            <div className={styles.metaLabel}>City</div>
            <div className={styles.metaValue}>{user.city || "—"}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Joined</div>
            <div className={styles.metaValue}>{user.joined}</div>
          </div>
        </div>
      </div>

      {/* T2-35 (SP-6): customer value at a glance — realized LTV + fit-outcome strip. */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Customer value</h3>
        <div className={styles.valueRow}>
          <div>
            <div className={styles.metaLabel}>Lifetime value</div>
            <div className={styles.ltvValue}>₹{(user.ltv ?? 0).toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className={styles.metaLabel}>Orders</div>
            <div className={styles.metaValue}>{user.orders}</div>
          </div>
        </div>
        {user.fit_outcomes && Object.keys(user.fit_outcomes).length > 0 ? (
          <div className={styles.fitStrip}>
            {FIT_OUTCOMES.map(([key, label]) =>
              (user.fit_outcomes?.[key] ?? 0) > 0 ? (
                <span key={key} className={`${styles.fitChip} ${styles[`fit_${key}`] ?? ""}`}>
                  {label}: {user.fit_outcomes?.[key]}
                </span>
              ) : null,
            )}
          </div>
        ) : (
          <p className={styles.fitEmpty}>No delivered-order fit outcomes yet.</p>
        )}
      </div>

      <Can cap="customers:write">
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Account Actions</h3>
          <div className={styles.actionList}>
            <button
              className={styles.creditsBtn}
              onClick={() => setShowCreditsModal(true)}
            >
              <UilGift size={14} /> Issue Credits
            </button>
            {user.status === "Active" ? (
              <button
                className={styles.deactivateBtn}
                onClick={() => setShowDeactivateModal(true)}
              >
                <UilUserTimes size={14} /> Deactivate Account
              </button>
            ) : (
              <button
                className={styles.reactivateBtn}
                onClick={handleReactivate}
              >
                <UilUserCheck size={14} /> Reactivate Account
              </button>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Internal Notes</h3>
          <NotesPanel
            notes={noteEntries}
            onAdd={handleAddNote}
            placeholder="Internal note (not visible to customer)…"
            /* [SUP-30-4] "No notes yet." on a failed fetch hides a fraud note. */
            emptyText={
              notesErr
                ? isDenied(notesErr)
                  ? "You don't have access to this customer's notes."
                  : "Couldn't load notes — this is not the same as there being none."
                : "No notes yet."
            }
          />
        </div>
      </Can>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Support Tickets</h3>
        <div className={styles.ticketRow}>
          <span className={styles.ticketTotal}>
            View all tickets for this user
          </span>
        </div>
        <button
          className={styles.linkBtn}
          onClick={() =>
            navigate(
              // [SUP-30-6] Deep-link by the ZC-ID, never the phone number. A phone
              // in the URL lands in browser history, server logs and — this SPA has
              // Sentry and Datadog wired — two third-party telemetry pipelines.
              // Both target searches already match `u.reference_id`.
              `/admin/support${user.reference_id ? `?search=${encodeURIComponent(user.reference_id)}` : ""}`,
            )
          }
        >
          View All Tickets →
        </button>
      </div>

      {/* T2-35 (SP-6): DPDP erasure SOP — the P11 data-deletion path finally has a UI pointer.
          Note for everyone; the irreversible action itself is super-only (system:manage). */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Data &amp; privacy (DPDP)</h3>
        <p className={styles.dpdpNote}>
          Erasure is <strong>irreversible</strong>: it redacts contact PII and purges saved
          measurements, retaining only financial records required by law. A customer's
          erasure request is a <strong>super-admin action</strong> — support escalates it,
          then confirms the identity before it's run.
        </p>
        <Can cap="system:manage">
          <button className={styles.eraseBtn} onClick={() => setShowErase(true)}>
            <UilTrashAlt size={14} /> Erase customer data
          </button>
        </Can>
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <DetailShell header={header} aside={aside}>
          {/* Orders */}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                Orders ({user.orders} total)
              </h3>
              <div className={styles.sectionHeaderActions}>
                <Can cap="orders:write">
                  <button
                    className={styles.linkBtn}
                    onClick={() => setShowAlteration(true)}
                  >
                    Request alteration
                  </button>
                </Can>
                <Can cap="orders:write">
                  <button
                    className={styles.linkBtn}
                    onClick={() => setShowReturn(true)}
                  >
                    Start a return
                  </button>
                </Can>
                <button
                  className={styles.linkBtn}
                  onClick={() =>
                    navigate(
                      // [SUP-30-6] ZC-ID, not the phone — see the tickets link above.
                      `/admin/orders?search=${encodeURIComponent(user.reference_id ?? user.id)}`,
                    )
                  }
                >
                  View All →
                </button>
              </div>
            </div>
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Mode</th>
                  <th>Stage</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {userOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  userOrders.map((o) => (
                    <tr
                      key={o.id}
                      style={{ cursor: "pointer" }}
                       {...rowActivation(() =>
                        navigate(`/admin/orders/${o.uuid ?? o.id}`))}>
                      <td>{o.id}</td>
                      <td>{o.mode}</td>
                      <td>{o.stage.replace(/_/g, " ")}</td>
                      <td>₹{o.total.toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Fit Profiles & Measurements */}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                Fit Profiles & Measurements
              </h3>
              {/* G-37: support's #1 made-to-fit lever */}
              <Can cap="orders:write">
                <button
                  className={styles.linkBtn}
                  onClick={() => setShowRemeasure(true)}
                >
                  Request re-measure
                </button>
              </Can>
            </div>
            {/* [SUP-30-4] If this fetch failed, the absence of an "open request"
                banner is not evidence there isn't one — and acting on it means
                raising a duplicate the API will 409. */}
            {!!remeasuresErr && (
              <div className={styles.remeasureOpen}>
                <span>
                  {isDenied(remeasuresErr)
                    ? "You don't have access to re-measure requests — check before raising one."
                    : "Couldn't load re-measure requests — there may already be one open."}
                </span>
              </div>
            )}
            {remeasures.filter((r) => r.status === "open").length > 0 && (
              <div className={styles.remeasureOpen}>
                {remeasures
                  .filter((r) => r.status === "open")
                  .map((r) => (
                    <div key={r.id} className={styles.remeasureRow}>
                      <StatusBadge status="open" size="sm" />
                      <span>Re-measure requested — {r.reason}</span>
                      <span className={styles.remeasureMeta}>
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                        {r.requested_by_name ? ` · ${r.requested_by_name}` : ""}
                        {r.redeemed_order_id ? " · redeemed on next order" : ""}
                      </span>
                      {/* T1-21b Phase 3 (E): record the outcome after the visit */}
                      <select
                        className={styles.remeasureMeta}
                        value={r.outcome ?? "pending"}
                        onChange={(e) =>
                          setOutcome(
                            r.id,
                            e.target.value as "our_fault" | "customer_error" | "pending",
                          )
                        }
                        title="Outcome — did the re-measure find our fault or customer error?"
                      >
                        <option value="pending">Outcome: pending</option>
                        <option value="our_fault">Our fault</option>
                        <option value="customer_error">Customer error</option>
                      </select>
                    </div>
                  ))}
              </div>
            )}
            {/* [SUP-30-4] A 403 here used to render "No fit profiles found for this
                customer." — a false statement about a person, standing in for a
                correct and deliberate policy decision. */}
            {fitProfilesLoading ? (
              <div className={styles.profileNote}>Loading…</div>
            ) : fitProfilesErr ? (
              <div className={styles.profileNote}>
                {isDenied(fitProfilesErr)
                  ? "You don't have access to this customer's body data — it is not being shown to you, not absent."
                  : `Couldn't load fit profiles${errorMessage(fitProfilesErr) ? ` — ${errorMessage(fitProfilesErr)}` : "."}`}
              </div>
            ) : fitProfiles.length === 0 ? (
              <div className={styles.profileNote}>
                No fit profiles found for this customer.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  {fitProfiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProfileId(p.id)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        cursor: "pointer",
                        border: "1.5px solid",
                        borderColor:
                          selectedProfileId === p.id
                            ? "var(--color-primary)"
                            : "var(--color-border)",
                        background:
                          selectedProfileId === p.id
                            ? "var(--color-primary)"
                            : "transparent",
                        color:
                          selectedProfileId === p.id
                            ? "#fff"
                            : "var(--color-text-primary)",
                        fontFamily: "inherit",
                        fontWeight: 500,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {activeProfile && (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background:
                            "var(--color-primary-faint, rgba(31, 107, 79,0.08))",
                          color: "var(--color-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {activeProfile.source === "home_visit"
                          ? "Agent Visit"
                          : "Self Input"}
                      </span>
                      {activeProfile.is_default && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "rgba(212, 165, 116,0.12)",
                            color: "#9A6B2E",
                            fontWeight: 500,
                          }}
                        >
                          Default
                        </span>
                      )}
                      {activeProfile.for_name && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "var(--color-border)",
                            color: "var(--color-text-secondary)",
                            fontWeight: 500,
                          }}
                        >
                          For: {activeProfile.for_name}
                        </span>
                      )}
                      {activeProfile.flagged_at && (
                        <span className={styles.flagBadge}>⚠ Flagged incorrect</span>
                      )}
                    </div>
                    {/* [SUP-30-5] When these numbers were taken, and the two sanity
                        checks on them. Without a date an agent cannot tell a three-day-old
                        body from a three-year-old one — and `created_at` was in the payload
                        the whole time. Height and usual size are what you check a
                        suspicious profile against; height also drives
                        garment_length_by_height in the engine. */}
                    <div className={styles.profileMeta}>
                      <span>Measured {fmtDate(activeProfile.created_at)}</span>
                      {activeProfile.height_cm != null && (
                        <span>Height {activeProfile.height_cm} cm</span>
                      )}
                      {activeProfile.usual_size && (
                        <span>Usually wears {activeProfile.usual_size}</span>
                      )}
                    </div>
                    {activeProfile.measurements_purged_at ? (
                      /* Gone is not the same as never recorded — say which. */
                      <div className={styles.profileMeta}>
                        Measurements were purged on{" "}
                        {fmtDate(activeProfile.measurements_purged_at)} under the retention
                        policy.
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "6px 12px",
                      }}
                    >
                      {/* [SUP-30-5] Render every stored measurement, not a fixed list.
                          `measurements` is open JSONB and this panel was a hardcoded
                          14-key allow-list, so anything outside it vanished with no
                          sign it existed. In the live data that was `knee` on 3
                          profiles — which is not decoration, size-engine.ts reads it
                          and knee_ease / hem_vs_knee cut the trouser from it — and
                          `shoulder` on 1, because the list spelled it "shoulders".
                          A list of names is a promise to maintain it; the data is the
                          only thing that can't fall behind itself. */}
                      {orderedMeasurementKeys(activeProfile.measurements).map((field) => {
                        const v = activeProfile.measurements[field];
                        if (v == null) return null;
                        return (
                          <div
                            key={field}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              borderBottom: "1px solid var(--color-border)",
                              paddingBottom: 4,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                color: "var(--color-text-secondary)",
                                textTransform: "capitalize",
                              }}
                            >
                              {field.replace(/_/g, " ")}
                            </span>
                            <span style={{ fontWeight: 600 }}>{v}"</span>
                          </div>
                        );
                      })}
                    </div>
                    <Can cap="orders:write">
                      <div className={styles.profileActions}>
                        {activeProfile.flagged_at ? (
                          <button
                            className={styles.linkBtn}
                            onClick={submitUnflag}
                          >
                            Clear flag
                          </button>
                        ) : (
                          <button
                            className={styles.linkBtn}
                            onClick={() => setShowFlag(true)}
                          >
                            Flag incorrect
                          </button>
                        )}
                      </div>
                    </Can>
                    {activeProfile.flagged_at && activeProfile.flagged_reason && (
                      <div className={styles.flagNote}>
                        Flagged: {activeProfile.flagged_reason}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Credits ledger (G-39) */}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Credits</h3>
              <span className={styles.creditsBalance}>
                ₹{(ledgerBalance ?? user.credits ?? 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className={styles.creditsLedger}>
              {/* [SUP-30-4] An empty ledger under a balance sourced from somewhere
                  else is the money version of this finding: the history said
                  "nothing happened" while the number above it said otherwise. */}
              {ledgerErr ? (
                <div className={styles.ledgerRow}>
                  <span>
                    {isDenied(ledgerErr)
                      ? "You don't have access to the credit history."
                      : "Couldn't load the credit history — the balance above may not match it."}
                  </span>
                </div>
              ) : ledger === null ? (
                <div className={styles.ledgerRow}>
                  <span>Loading…</span>
                </div>
              ) : ledger.length === 0 ? (
                <div className={styles.ledgerRow}>
                  <span>No credit history yet.</span>
                </div>
              ) : (
                ledger.map((e) => (
                  <div key={e.id} className={styles.ledgerEntry}>
                    <span
                      className={e.type === "credit" ? styles.credit : styles.debit}
                    >
                      {e.type === "credit" ? "+" : "−"}
                      <MoneyCell amount={e.amount} />
                    </span>
                    <span className={styles.ledgerReason}>
                      {e.reason ?? "—"}
                    </span>
                    <span className={styles.ledgerDate}>
                      {new Date(e.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
      </DetailShell>

      {/* Deactivate modal */}
      {showDeactivateModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowDeactivateModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...deactivateDialog.dialogProps}>
            <div className={styles.modalIcon}>
              <UilLock size={22} />
            </div>
            <h3 className={styles.modalTitle}>
              Deactivate {user.name}'s account?
            </h3>
            <p className={styles.modalWarning}>
              This customer will not be able to log in or place new orders.
              Existing orders will NOT be cancelled.
            </p>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Reason for deactivation (required)
              </label>
              <select
                className={styles.fieldSelect}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
              >
                <option value="">Select reason…</option>
                <option>Fraud / Suspicious activity</option>
                <option>Customer request (account closure)</option>
                <option>Duplicate account</option>
                <option>Policy violation</option>
                <option>Other</option>
              </select>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowDeactivateModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeactivateBtn}
                disabled={!deactivateReason || saving}
                onClick={handleDeactivate}
              >
                {saving ? "Deactivating…" : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* T2-35 (SP-6): DPDP erase — typed-confirm on an irreversible destructive action. */}
      {showErase && (
        <div className={styles.modalOverlay} onClick={() => setShowErase(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...eraseDialog.dialogProps}>
            <div className={styles.modalIcon}>
              <UilTrashAlt size={22} />
            </div>
            <h3 className={styles.modalTitle}>Erase {user.name}'s data?</h3>
            <p className={styles.modalWarning}>
              This <strong>cannot be undone</strong>. Contact PII is redacted and saved
              measurements are purged; financial records are retained for compliance. Only run
              this against a verified DPDP erasure request.
            </p>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Type <strong>ERASE</strong> to confirm
              </label>
              <input
                className={styles.fieldInput}
                value={eraseText}
                onChange={(e) => setEraseText(e.target.value)}
                placeholder="ERASE"
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => {
                  setShowErase(false);
                  setEraseText("");
                }}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeactivateBtn}
                disabled={eraseText !== "ERASE" || erasing}
                onClick={handleErase}
              >
                {erasing ? "Erasing…" : "Erase data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits modal */}
      {showCreditsModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowCreditsModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...creditsDialog.dialogProps}>
            <h3 className={styles.modalTitle}>Issue Credits to {user.name}</h3>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Amount (₹)</label>
              <input
                type="number"
                className={styles.fieldInput}
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
                placeholder="e.g., 100"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason (required)</label>
              <textarea
                className={styles.fieldTextarea}
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
                placeholder="e.g., Compensation for delayed order"
                rows={2}
              />
            </div>
            {/* W-5 (SoD D19): support's inline issue caps at ₹500; above is submitted to finance */}
            {Number(creditsAmount) > SUPPORT_CREDIT_CAP && (
              <div className={styles.capHint}>
                Over your ₹{SUPPORT_CREDIT_CAP} cap — this will be submitted to finance for approval,
                not posted directly.
              </div>
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowCreditsModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.issueCreditBtn}
                disabled={!creditsAmount || !creditsReason || saving}
                onClick={handleIssueCredits}
              >
                {saving
                  ? "Saving…"
                  : Number(creditsAmount) > SUPPORT_CREDIT_CAP
                    ? "Request finance approval"
                    : "Issue Credits"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-measure request modal (G-37) */}
      {showRemeasure && (
        <div className={styles.modalOverlay} onClick={() => setShowRemeasure(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...remeasureDialog.dialogProps}>
            <h3 className={styles.modalTitle}>Request re-measure for {user.name}</h3>
            <p className={styles.capHint}>
              Records a free re-measure request. The ops team schedules an agent
              visit — no charge to the customer.
            </p>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason (required)</label>
              <textarea
                className={styles.fieldTextarea}
                value={remeasureReason}
                onChange={(e) => setRemeasureReason(e.target.value)}
                placeholder="e.g., Customer reports sleeves too long on last 2 orders"
                rows={3}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowRemeasure(false)}
              >
                Cancel
              </button>
              <button
                className={styles.issueCreditBtn}
                disabled={!remeasureReason.trim() || saving}
                onClick={submitRemeasure}
              >
                {saving ? "Requesting…" : "Request re-measure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag a fit profile as incorrect (+ optional re-measure) */}
      {showFlag && activeProfile && (
        <div className={styles.modalOverlay} onClick={() => setShowFlag(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...flagDialog.dialogProps}>
            <h3 className={styles.modalTitle}>
              Flag "{activeProfile.label}" as incorrect
            </h3>
            <p className={styles.capHint}>
              Marks this saved fit profile as suspect so it isn't trusted blindly.
              Optionally request a free re-measure to correct it.
            </p>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>What's wrong (required)</label>
              <textarea
                className={styles.fieldTextarea}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., Chest reads 42 but the customer's last 3 shirts ran tight — measurements look off"
                rows={3}
              />
            </div>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={flagRemeasure}
                onChange={(e) => setFlagRemeasure(e.target.checked)}
              />
              Also request a re-measure for this profile
            </label>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowFlag(false)}
              >
                Cancel
              </button>
              <button
                className={styles.issueCreditBtn}
                disabled={!flagReason.trim() || flagging}
                onClick={submitFlag}
              >
                {flagging ? "Flagging…" : "Flag incorrect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request alteration — pick one of the customer's delivered orders */}
      {showAlteration && (
        <div className={styles.modalOverlay} onClick={() => setShowAlteration(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...alterationDialog.dialogProps}>
            <h3 className={styles.modalTitle}>Request alteration for {user.name}</h3>
            <p className={styles.capHint}>
              The first alteration on an order is free. Only delivered orders can be altered.
            </p>
            {deliveredOrders.length === 0 ? (
              <p className={styles.capHint}>
                This customer has no delivered orders — an alteration needs one.
              </p>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Delivered order</label>
                  <select
                    className={styles.fieldSelect}
                    value={altOrderId}
                    onChange={(e) => setAltOrderId(e.target.value)}
                  >
                    <option value="">Select an order…</option>
                    {deliveredOrders.map((o) => (
                      <option key={o.uuid ?? o.id} value={o.uuid ?? o.id}>
                        {o.reference_id ?? o.id} · ₹{o.total.toLocaleString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>What needs altering</label>
                  <textarea
                    className={styles.fieldTextarea}
                    value={altDesc}
                    onChange={(e) => setAltDesc(e.target.value)}
                    placeholder="e.g., Take in 1cm at the chest; shorten sleeves by 2cm"
                    rows={3}
                  />
                </div>
              </>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowAlteration(false)}>
                Cancel
              </button>
              <button
                className={styles.issueCreditBtn}
                disabled={!altOrderId || !altDesc.trim() || requestingAlt}
                onClick={submitAlteration}
              >
                {requestingAlt ? "Requesting…" : "Request alteration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start a return — pick one of the customer's delivered orders */}
      {showReturn && (
        <div className={styles.modalOverlay} onClick={() => setShowReturn(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} {...returnDialog.dialogProps}>
            <h3 className={styles.modalTitle}>Start a return for {user.name}</h3>
            <p className={styles.capHint}>
              The reason routes the outcome. Ops inspects; finance approves any refund.
            </p>
            {deliveredOrders.length === 0 ? (
              <p className={styles.capHint}>
                This customer has no delivered orders — a return needs one.
              </p>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Delivered order</label>
                  <select
                    className={styles.fieldSelect}
                    value={retOrderId}
                    onChange={(e) => setRetOrderId(e.target.value)}
                  >
                    <option value="">Select an order…</option>
                    {deliveredOrders.map((o) => (
                      <option key={o.uuid ?? o.id} value={o.uuid ?? o.id}>
                        {o.reference_id ?? o.id} · ₹{o.total.toLocaleString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Reason</label>
                  <select
                    className={styles.fieldSelect}
                    value={retReason}
                    onChange={(e) => setRetReason(e.target.value)}
                  >
                    {RETURN_REASONS.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Details (optional)</label>
                  <textarea
                    className={styles.fieldTextarea}
                    value={retDesc}
                    onChange={(e) => setRetDesc(e.target.value)}
                    placeholder="What did the customer report?"
                    rows={3}
                  />
                </div>
              </>
            )}
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowReturn(false)}>
                Cancel
              </button>
              <button
                className={styles.issueCreditBtn}
                disabled={!retOrderId || requestingRet}
                onClick={submitReturn}
              >
                {requestingRet ? "Starting…" : "Start return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
