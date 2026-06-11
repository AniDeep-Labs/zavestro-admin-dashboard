import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ordersApi,
  invoicesApi,
  customerMeasurementsApi,
} from "../../api/adminApi";
import type {
  AdminOrder,
  OrderStage,
  OrderTimelineEntry,
  CustomerMeasurementsData,
} from "../../api/adminApi";
import { StaffAssignmentDropdown } from "../../components/StaffAssignmentDropdown/StaffAssignmentDropdown";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { useBreadcrumbTitle } from "../../contexts/BreadcrumbContext";
import { Can } from "../../components/Can/Can";
import styles from "./OrderDetailPage.module.css";
import {
  UilAngleLeft,
  UilBox,
  UilCheck,
  UilCheckCircle,
  UilClock,
  UilCommentDots,
  UilExclamationCircle,
  UilFileAlt,
  UilPauseCircle,
  UilProcess,
  UilRuler,
  UilShieldCheck,
  UilTruck,
  UilUserCheck,
} from "@iconscout/react-unicons";

// ── Stage stepper config ─────────────────────────────────────────────────────

const STAGES: { key: OrderStage; label: string }[] = [
  { key: "payment_pending", label: "Payment\nPending" },
  { key: "payment_confirmed", label: "Payment\nConfirmed" },
  { key: "awaiting_measurement", label: "Awaiting\nMeasurement" },
  { key: "measurement_complete", label: "Measurement\nDone" },
  { key: "in_tailoring", label: "In\nTailoring" },
  { key: "quality_check", label: "Quality\nCheck" },
  { key: "ready_to_dispatch", label: "Ready to\nDispatch" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

const STAGE_IDX = Object.fromEntries(
  STAGES.map((s, i) => [s.key, i]),
) as Record<string, number>;

// ── Timeline helpers ─────────────────────────────────────────────────────────

function timelineClass(eventType?: string): string {
  switch (eventType) {
    case "note":
      return styles.timelineNote;
    case "assignment":
      return styles.timelineAssign;
    case "craftsperson_assigned":
    case "qc_staff_assigned":
      return styles.timelineAssign;
    case "measurement_linked":
      return styles.timelineAssign;
    case "hold":
      return styles.timelineHold;
    case "admin_override":
      return styles.timelineAdmin;
    default:
      return "";
  }
}

function timelineIcon(eventType?: string) {
  switch (eventType) {
    case "note":
      return <UilCommentDots size={13} />;
    case "assignment":
    case "craftsperson_assigned":
    case "qc_staff_assigned":
      return <UilUserCheck size={13} />;
    case "measurement_linked":
      return <UilRuler size={13} />;
    case "hold":
      return <UilPauseCircle size={13} />;
    case "admin_override":
      return <UilFileAlt size={13} />;
    default:
      return <UilCheck size={13} />;
  }
}

function timelineText(entry: OrderTimelineEntry): string {
  const et = entry.event_type ?? "stage_change";
  if (et === "note") return entry.note ?? "Note added";
  if (
    et === "assignment" ||
    et === "craftsperson_assigned" ||
    et === "qc_staff_assigned"
  )
    return entry.note ?? "Staff assigned";
  if (et === "measurement_linked")
    return entry.note ?? "Measurement booking linked";
  if (et === "hold")
    return entry.note ? `On hold: ${entry.note}` : "Order placed on hold";
  return `Stage → ${entry.to_stage.replace(/_/g, " ")}${entry.note ? ` — ${entry.note}` : ""}`;
}

// ── Next-step card ────────────────────────────────────────────────────────────

interface NextStepProps {
  order: AdminOrder;
  customerFitProfiles: CustomerMeasurementsData["profiles"];
  profilesLoading: boolean;
  advancingStage: boolean;
  assigningCraft: boolean;
  assigningQC: boolean;
  onAdvance: (stage: OrderStage, note?: string) => Promise<void>;
  onAssignCraft: (staffId: string | null) => Promise<void>;
  onAssignQC: (staffId: string | null) => Promise<void>;
  onUseFitProfile: (profileId: string) => Promise<void>;
}

const NextStepCard: React.FC<NextStepProps> = ({
  order,
  customerFitProfiles,
  profilesLoading,
  advancingStage,
  assigningCraft,
  assigningQC,
  onAdvance,
  onAssignCraft,
  onAssignQC,
  onUseFitProfile,
}) => {
  const [selectedProfileId, setSelectedProfileId] = React.useState("");

  const stage = order.stage;

  // Payment not confirmed yet
  if (stage === "payment_pending") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(168, 162, 158,0.12)",
            color: "var(--color-text-tertiary)",
          }}
        >
          <UilClock size={18} />
        </div>
        <div className={styles.nextStepTitle}>Awaiting Payment</div>
        <div className={styles.nextStepDesc}>
          Payment has not been confirmed yet. Once confirmed, schedule a
          measurement visit.
        </div>
      </div>
    );
  }

  // Payment confirmed — determine measurement path
  if (stage === "payment_confirmed") {
    const hasSavedProfiles = !profilesLoading && customerFitProfiles.length > 0;
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{ background: "rgba(212, 165, 116,0.12)", color: "#9E7340" }}
        >
          <UilRuler size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 1 — Measurements</div>

        {profilesLoading ? (
          <div className={styles.nextStepLoading}>
            Checking saved measurements…
          </div>
        ) : hasSavedProfiles ? (
          <>
            <div
              className={styles.nextStepDesc}
              style={{ color: "var(--color-primary)", fontWeight: 500 }}
            >
              ✓ This customer has saved measurements
            </div>
            <div className={styles.nextStepLabel}>Select fit profile</div>
            <select
              className={styles.nextStepSelect}
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
            >
              <option value="">Choose a profile…</option>
              {customerFitProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.category} —{" "}
                  {new Date(p.created_at).toLocaleDateString("en-IN")}
                </option>
              ))}
            </select>
            <button
              className={styles.nextStepPrimary}
              disabled={!selectedProfileId || advancingStage}
              onClick={() => onUseFitProfile(selectedProfileId)}
            >
              {advancingStage ? "Applying…" : "Use Saved Measurements →"}
            </button>
            <div className={styles.nextStepOr}>or schedule a new visit</div>
          </>
        ) : (
          <div className={styles.nextStepDesc}>
            No saved measurements — a home visit is required.
          </div>
        )}

        {/* Dark-store: measurement is captured by the field agent on the home visit
            (booked at checkout) and recorded via the ops app — no admin booking here. */}
        <div className={styles.nextStepEmpty} style={{ marginTop: 6 }}>
          {order.linked_home_visit_id
            ? "An agent home visit is booked — the agent captures measurements on the visit (via the ops app)."
            : "If there are no saved measurements, an agent home visit captures them after checkout."}
        </div>
      </div>
    );
  }

  // Measurement visit scheduled — waiting for specialist to visit
  if (stage === "awaiting_measurement") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(59,130,246,0.1)",
            color: "var(--color-info)",
          }}
        >
          <UilClock size={18} />
        </div>
        <div className={styles.nextStepTitle}>
          Waiting for Measurement Visit
        </div>
        <div className={styles.nextStepDesc}>
          {order.linked_home_visit_id
            ? "An agent home visit is scheduled. The agent records the measurements via the ops app, which advances this order automatically."
            : "Awaiting measurement. The agent home visit (booked at checkout) captures measurements via the ops app and advances the order automatically."}
        </div>
      </div>
    );
  }

  // Measurements done — assign craftsperson
  if (stage === "measurement_complete") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(31, 107, 79,0.08)",
            color: "var(--color-primary)",
          }}
        >
          <UilProcess size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 2 — Assign Craftsperson</div>
        <div className={styles.nextStepDesc}>
          Measurements are ready. Assign a tailor or cutter to begin stitching.
        </div>
        <div style={{ marginBottom: 10 }}>
          <StaffAssignmentDropdown
            value={order.craftsperson_id ?? null}
            onChange={onAssignCraft}
            hubId={order.hub_id ?? undefined}
            showWorkload
            filterRoles={["tailor", "cutter", "finisher"]}
            disabled={assigningCraft}
            placeholder="Assign craftsperson…"
          />
        </div>
        {order.craftsperson_id && (
          <button
            className={styles.nextStepPrimary}
            disabled={advancingStage}
            onClick={() =>
              onAdvance("in_tailoring", "Garment sent to tailoring")
            }
          >
            {advancingStage ? "Advancing…" : "Start Tailoring →"}
          </button>
        )}
      </div>
    );
  }

  // In tailoring / fabric sourced
  if (stage === "in_tailoring" || stage === "fabric_sourced") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{ background: "rgba(212, 165, 116,0.12)", color: "#9E7340" }}
        >
          <UilProcess size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 3 — In Production</div>
        <div className={styles.nextStepDesc}>
          {order.craftsperson_name
            ? `Assigned to ${order.craftsperson_name}. Mark complete once stitching is done.`
            : "Stitching in progress. Mark complete once done."}
        </div>
        <button
          className={styles.nextStepPrimary}
          disabled={advancingStage}
          onClick={() =>
            onAdvance("quality_check", "Tailoring complete — sent to QC")
          }
        >
          {advancingStage ? "Advancing…" : "Tailoring Complete → QC"}
        </button>
      </div>
    );
  }

  // Quality check
  if (stage === "quality_check") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(59,130,246,0.1)",
            color: "var(--color-info)",
          }}
        >
          <UilShieldCheck size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 4 — Quality Check</div>
        <div className={styles.nextStepDesc}>
          Assign QC staff and review the garment.
        </div>
        <div style={{ marginBottom: 10 }}>
          <StaffAssignmentDropdown
            value={order.qc_staff_id ?? null}
            onChange={onAssignQC}
            hubId={order.hub_id ?? undefined}
            showWorkload
            filterRoles={["quality_checker"]}
            disabled={assigningQC}
            placeholder="Assign QC staff…"
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={styles.nextStepPrimary}
            style={{ flex: 1 }}
            disabled={advancingStage}
            onClick={() => onAdvance("ready_to_dispatch", "QC passed")}
          >
            {advancingStage ? "…" : "✓ QC Pass"}
          </button>
          <button
            className={styles.nextStepDanger}
            style={{ flex: 1 }}
            disabled={advancingStage}
            onClick={() =>
              onAdvance("in_tailoring", "QC failed — returned to tailoring")
            }
          >
            {advancingStage ? "…" : "✗ QC Fail"}
          </button>
        </div>
      </div>
    );
  }

  // Ready to dispatch
  if (stage === "ready_to_dispatch") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(31, 107, 79,0.08)",
            color: "var(--color-primary)",
          }}
        >
          <UilBox size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 5 — Dispatch</div>
        <div className={styles.nextStepDesc}>
          Garment passed QC. Ready to hand off to courier.
        </div>
        <button
          className={styles.nextStepPrimary}
          disabled={advancingStage}
          onClick={() =>
            onAdvance("dispatched", "Order dispatched to customer")
          }
        >
          {advancingStage ? "Advancing…" : "Mark Dispatched →"}
        </button>
      </div>
    );
  }

  // Dispatched
  if (stage === "dispatched") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(59,130,246,0.1)",
            color: "var(--color-info)",
          }}
        >
          <UilTruck size={18} />
        </div>
        <div className={styles.nextStepTitle}>Out for Delivery</div>
        <div className={styles.nextStepDesc}>
          Order is with courier. Confirm once delivered.
        </div>
        <button
          className={styles.nextStepPrimary}
          disabled={advancingStage}
          onClick={() => onAdvance("delivered", "Order delivered to customer")}
        >
          {advancingStage ? "Advancing…" : "Mark Delivered ✓"}
        </button>
      </div>
    );
  }

  // Delivered
  if (stage === "delivered") {
    return (
      <div className={styles.nextStepCard}>
        <div
          className={styles.nextStepIcon}
          style={{
            background: "rgba(31, 107, 79,0.08)",
            color: "var(--color-primary)",
          }}
        >
          <UilCheckCircle size={18} />
        </div>
        <div className={styles.nextStepTitle}>Order Complete</div>
        <div className={styles.nextStepDesc}>
          This order has been delivered successfully.
        </div>
      </div>
    );
  }

  return null;
};

// ── Main component ────────────────────────────────────────────────────────────

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = React.useState<AdminOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Customer measurement bookings (for linking)

  // Customer fit profiles (for "Use Saved Measurements" path)
  const [customerFitProfiles, setCustomerFitProfiles] = React.useState<
    CustomerMeasurementsData["profiles"]
  >([]);
  const [profilesLoading, setProfilesLoading] = React.useState(false);

  // Action states
  const [advancingStage, setAdvancingStage] = React.useState(false);
  const [assigningCraft, setAssigningCraft] = React.useState(false);
  const [assigningQC, setAssigningQC] = React.useState(false);

  // Override modal
  const [showOverrideModal, setShowOverrideModal] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [overrideStage, setOverrideStage] = React.useState("");
  const [overrideChecks, setOverrideChecks] = React.useState([false, false]);
  const [overriding, setOverriding] = React.useState(false);

  // Invoice
  const [invoiceLoading, setInvoiceLoading] = React.useState(false);
  const [invoiceGenerating, setInvoiceGenerating] = React.useState(false);

  // Note entry
  const [noteText, setNoteText] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);

  // Delivery date inline edit
  const [editingDelivery, setEditingDelivery] = React.useState(false);
  const [deliveryDate, setDeliveryDate] = React.useState("");
  const [savingDelivery, setSavingDelivery] = React.useState(false);

  // Hold reason inline edit
  const [editingHold, setEditingHold] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState("");
  const [savingHold, setSavingHold] = React.useState(false);

  const dismissToast = (tid: string) =>
    setToasts((t) => t.filter((x) => x.id !== tid));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(
    order ? `Order ${order.reference_id ?? order.id}` : undefined,
  );

  const reload = React.useCallback(() => {
    if (!id) return;
    ordersApi
      .get(id)
      .then((o) => {
        setOrder(o);
        setDeliveryDate(o.estimated_delivery_date ?? "");
        setHoldReason(o.on_hold_reason ?? "");
      })
      .catch(() => {});
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    ordersApi
      .get(id)
      .then((o) => {
        setOrder(o);
        setDeliveryDate(o.estimated_delivery_date ?? "");
        setHoldReason(o.on_hold_reason ?? "");
      })
      .catch((e) =>
        showToast(
          "error",
          "Failed to load order",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  // Load customer fit profiles at payment_confirmed (for the "use saved measurements" path)
  React.useEffect(() => {
    if (!order?.user_id || order.stage !== "payment_confirmed") return;
    setProfilesLoading(true);
    customerMeasurementsApi
      .get(order.user_id)
      .then((d) => setCustomerFitProfiles(d.profiles ?? []))
      .catch(() => setCustomerFitProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, [order?.user_id, order?.stage]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUseFitProfile = async (profileId: string) => {
    if (!order) return;
    setAdvancingStage(true);
    try {
      await ordersApi.updateLifecycle(order.uuid ?? order.id, {
        fit_profile_id: profileId,
      });
      await ordersApi.advance(
        order.uuid ?? order.id,
        "measurement_complete",
        "Using saved fit profile — skipped home visit",
      );
      showToast(
        "success",
        "Saved measurements applied",
        "Order advanced to Measurement Done",
      );
      reload();
    } catch (e) {
      showToast(
        "error",
        "Failed to apply measurements",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setAdvancingStage(false);
    }
  };

  const handleAdvance = async (toStage: OrderStage, note?: string) => {
    if (!order) return;
    setAdvancingStage(true);
    try {
      await ordersApi.advance(order.uuid ?? order.id, toStage, note);
      showToast("success", `Advanced to ${toStage.replace(/_/g, " ")}`);
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("MEASUREMENT_INCOMPLETE")) {
        showToast(
          "error",
          "Measurements not ready",
          "The linked booking is not completed. Wait for the ops app upload.",
        );
      } else if (msg.includes("CRAFTSPERSON_REQUIRED")) {
        showToast(
          "error",
          "Assign craftsperson first",
          "A craftsperson must be assigned before starting tailoring.",
        );
      } else {
        showToast("error", "Failed to advance", msg);
      }
    } finally {
      setAdvancingStage(false);
    }
  };

  const handleAssignCraft = async (staffId: string | null) => {
    if (!order) return;
    setAssigningCraft(true);
    try {
      await ordersApi.assignCraftsperson(order.uuid ?? order.id, staffId);
      showToast(
        "success",
        staffId ? "Craftsperson assigned" : "Craftsperson unassigned",
      );
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      showToast(
        "error",
        "Assignment failed",
        msg?.includes("MEASUREMENT_REQUIRED")
          ? "Measurements must be completed before assigning a craftsperson."
          : msg,
      );
    } finally {
      setAssigningCraft(false);
    }
  };

  const handleAssignQC = async (staffId: string | null) => {
    if (!order) return;
    setAssigningQC(true);
    try {
      await ordersApi.assignQCStaff(order.uuid ?? order.id, staffId);
      showToast(
        "success",
        staffId ? "QC staff assigned" : "QC staff unassigned",
      );
      reload();
    } catch (e) {
      showToast(
        "error",
        "Assignment failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setAssigningQC(false);
    }
  };

  const handleOverride = async () => {
    if (!order || !overrideStage) return;
    setOverriding(true);
    try {
      const { stage, status } = await ordersApi.updateStage(
        order.uuid ?? order.id,
        overrideStage as OrderStage,
        overrideReason,
      );
      setOrder((prev) => (prev ? { ...prev, stage, status } : prev));
      setShowOverrideModal(false);
      setOverrideReason("");
      setOverrideStage("");
      setOverrideChecks([false, false]);
      showToast(
        "success",
        "Stage updated",
        `Order moved to ${overrideStage.replace(/_/g, " ")}`,
      );
    } catch (e) {
      showToast(
        "error",
        "Override failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setOverriding(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!order) return;
    setInvoiceGenerating(true);
    try {
      await invoicesApi.generateForOrder(order.uuid ?? order.id);
      showToast("success", "Invoice queued");
    } catch (e) {
      showToast(
        "error",
        "Invoice error",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setInvoiceGenerating(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setInvoiceLoading(true);
    try {
      const { invoices } = await invoicesApi.list({
        orderId: order.uuid ?? order.id,
        limit: 1,
      });
      if (invoices.length === 0 || invoices[0].status !== "generated") {
        showToast("info", "No invoice ready", 'Use "Generate Invoice" first.');
      } else {
        const { url } = await invoicesApi.getDownloadUrl(invoices[0].id);
        window.open(url, "_blank");
      }
    } catch (e) {
      showToast(
        "error",
        "Invoice error",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!order || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const entry = await ordersApi.addTimelineNote(
        order.uuid ?? order.id,
        noteText.trim(),
      );
      setOrder((prev) =>
        prev ? { ...prev, timeline: [entry, ...(prev.timeline ?? [])] } : prev,
      );
      setNoteText("");
      showToast("success", "Note added");
    } catch (e) {
      showToast(
        "error",
        "Failed to add note",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setAddingNote(false);
    }
  };

  const handleSaveDelivery = async () => {
    if (!order) return;
    setSavingDelivery(true);
    try {
      await ordersApi.updateLifecycle(order.uuid ?? order.id, {
        estimated_delivery_date: deliveryDate || null,
      });
      setOrder((prev) =>
        prev
          ? { ...prev, estimated_delivery_date: deliveryDate || null }
          : prev,
      );
      setEditingDelivery(false);
      showToast("success", "Delivery date updated");
    } catch (e) {
      showToast(
        "error",
        "Update failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleSaveHold = async () => {
    if (!order) return;
    setSavingHold(true);
    try {
      await ordersApi.updateLifecycle(order.uuid ?? order.id, {
        on_hold_reason: holdReason || null,
      });
      setOrder((prev) =>
        prev ? { ...prev, on_hold_reason: holdReason || null } : prev,
      );
      setEditingHold(false);
      showToast("success", holdReason ? "Hold reason saved" : "Hold cleared");
    } catch (e) {
      showToast(
        "error",
        "Update failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setSavingHold(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.loadingMsg}>Loading order…</div>
      </div>
    );
  if (!order)
    return (
      <div className={styles.page}>
        <div className={styles.loadingMsg}>Order not found.</div>
      </div>
    );

  const currentIdx = STAGE_IDX[order.stage] ?? -1;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button
        className={styles.backBtn}
        onClick={() => navigate("/admin/orders")}
      >
        <UilAngleLeft size={15} /> Back to Orders
      </button>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.orderHeader}>
          <div>
            <div className={styles.orderId}>
              {order.id}
              {order.reference_id && (
                <span className={styles.refBadge}>{order.reference_id}</span>
              )}
            </div>
            <div className={styles.orderMeta}>
              Created {order.created}
              {order.customer_ref && (
                <span
                  style={{
                    marginLeft: 8,
                    fontFamily: "monospace",
                    fontSize: 11,
                    background: "var(--color-bg-secondary)",
                    padding: "1px 5px",
                    borderRadius: 3,
                  }}
                >
                  {order.customer_ref}
                </span>
              )}
            </div>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.pill} ${styles.pillGreen}`}>
              {order.mode}
            </span>
            <span
              className={`${styles.statusPill} ${styles[`status-${order.status}`]}`}
            >
              {order.status}
            </span>
            {order.on_hold_reason && (
              <span
                style={{
                  fontSize: 12,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "rgba(212, 165, 116,0.15)",
                  color: "#9E7340",
                  fontWeight: 600,
                }}
              >
                ⏸ On Hold
              </span>
            )}
          </div>
        </div>
        <div className={styles.customerRow}>
          <span className={styles.customerLabel}>Customer</span>
          <span className={styles.customerName}>{order.customer}</span>
          <span className={styles.customerPhone}>{order.phone}</span>
          {order.user_id && (
            <button
              className={styles.linkBtn}
              onClick={() => navigate(`/admin/users/${order.user_id}`)}
            >
              View Profile →
            </button>
          )}
          <span className={styles.customerLabel} style={{ marginLeft: 8 }}>
            Hub
          </span>
          <span className={styles.customerName}>{order.hub}</span>
        </div>
      </div>

      {/* ── Stage stepper ────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Order Journey</h3>
        <div className={styles.stepper}>
          {STAGES.map((s, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            return (
              <div
                key={s.key}
                className={`${styles.stepperItem} ${done ? styles.stepDone : ""} ${current ? styles.stepCurrent : ""}`}
              >
                <div className={styles.stepCircle}>
                  {done ? <UilCheck size={13} /> : <span>{i + 1}</span>}
                </div>
                <div className={styles.stepLabel}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.main}>
          {/* ── Items ──────────────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Items</h3>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).length > 0
                  ? (order.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td>{it.product_name}</td>
                        <td>{it.quantity}</td>
                        <td>₹{it.unit_price.toLocaleString("en-IN")}</td>
                        <td>
                          ₹
                          {(it.quantity * it.unit_price).toLocaleString(
                            "en-IN",
                          )}
                        </td>
                      </tr>
                    ))
                  : order.products.map((p, i) => (
                      <tr key={i}>
                        <td>{p}</td>
                        <td>1</td>
                        <td>—</td>
                        <td>—</td>
                      </tr>
                    ))}
              </tbody>
            </table>
            <div
              style={{
                paddingTop: 12,
                borderTop: "1px solid var(--color-border-light)",
                marginTop: 4,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <div>
                <span className={styles.metaLabel} style={{ marginRight: 8 }}>
                  Total
                </span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  ₹{order.total.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* ── Measurement + Staff assignments ────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Production Assignments</h3>

            {/* Measurement (dark-store: fit on file or agent home visit — recorded via the ops app) */}
            <div
              style={{
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid var(--color-border-light)",
              }}
            >
              <div className={styles.assignLabel}>
                <UilRuler
                  size={11}
                  style={{ display: "inline", marginRight: 4 }}
                />
                Measurement
              </div>
              {order.fit_profile_id ? (
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--color-primary)",
                    fontWeight: 500,
                  }}
                >
                  ✓ Measurements on file — used for production
                </span>
              ) : order.linked_home_visit_id ? (
                <span style={{ fontSize: 13, color: "var(--color-info)" }}>
                  Agent home visit
                  {order.linked_home_visit_ref
                    ? ` · ${order.linked_home_visit_ref}`
                    : ""}{" "}
                  — captured via the ops app
                </span>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UilExclamationCircle
                    size={13}
                    style={{ color: "#9E7340" }}
                  />
                  <span style={{ fontSize: 13, color: "#9E7340" }}>
                    No measurements yet — an agent home visit will capture them
                  </span>
                </div>
              )}
            </div>

            {/* Craftsperson + QC */}
            <div className={styles.assignRow}>
              <div>
                <div className={styles.assignLabel}>
                  <UilProcess
                    size={11}
                    style={{ display: "inline", marginRight: 4 }}
                  />
                  Craftsperson
                </div>
                {order.stage === "measurement_complete" ||
                STAGE_IDX[order.stage] > STAGE_IDX["measurement_complete"] ? (
                  <>
                    <StaffAssignmentDropdown
                      value={order.craftsperson_id ?? null}
                      onChange={handleAssignCraft}
                      hubId={order.hub_id ?? undefined}
                      showWorkload
                      filterRoles={["tailor", "cutter", "finisher"]}
                      disabled={assigningCraft}
                    />
                    {order.craftsperson_name && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-tertiary)",
                          marginTop: 4,
                        }}
                      >
                        {order.craftsperson_role}
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-tertiary)",
                      fontStyle: "italic",
                    }}
                  >
                    Available after measurements
                  </div>
                )}
              </div>
              <div>
                <div className={styles.assignLabel}>
                  <UilShieldCheck
                    size={11}
                    style={{ display: "inline", marginRight: 4 }}
                  />
                  QC Staff
                </div>
                {STAGE_IDX[order.stage] >= STAGE_IDX["quality_check"] ? (
                  <>
                    <StaffAssignmentDropdown
                      value={order.qc_staff_id ?? null}
                      onChange={handleAssignQC}
                      hubId={order.hub_id ?? undefined}
                      showWorkload
                      filterRoles={["quality_checker"]}
                      disabled={assigningQC}
                    />
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-tertiary)",
                      fontStyle: "italic",
                    }}
                  >
                    Available at QC stage
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Activity Timeline ─────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Activity Log</h3>
            <div className={styles.timeline}>
              {(order.timeline ?? []).length > 0 ? (
                (order.timeline ?? []).map((entry, i) => (
                  <div
                    key={entry.id ?? i}
                    className={`${styles.timelineEntry} ${timelineClass(entry.event_type)}`}
                  >
                    <div className={styles.timelineDot}>
                      {timelineIcon(entry.event_type)}
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineText}>
                        {timelineText(entry)}
                      </div>
                      <div className={styles.timelineMeta}>
                        {new Date(entry.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {entry.changed_by_email && (
                          <span className={styles.timelineBy}>
                            {" "}
                            · {entry.changed_by_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{ color: "var(--color-text-tertiary)", fontSize: 13 }}
                >
                  No activity yet.
                </div>
              )}
            </div>
            <div className={styles.noteForm}>
              <input
                className={styles.noteInput}
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button
                className={styles.noteSubmit}
                disabled={!noteText.trim() || addingNote}
                onClick={handleAddNote}
              >
                {addingNote ? "…" : "Add Note"}
              </button>
            </div>
          </div>

          {/* ── Payment ───────────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Payment</h3>
            {(order.payments ?? []).length === 0 ? (
              <div className={styles.paymentGrid}>
                <div>
                  <div className={styles.metaLabel}>Amount</div>
                  <div className={styles.metaValue}>
                    ₹{order.total.toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className={styles.metaLabel}>Status</div>
                  <div className={styles.metaValue}>
                    <span className={styles.captured}>pending</span>
                  </div>
                </div>
              </div>
            ) : (
              (order.payments ?? []).map((p, i) => (
                <div key={p.id ?? i} className={styles.paymentGrid}>
                  <div>
                    <div className={styles.metaLabel}>Method</div>
                    <div className={styles.metaValue}>
                      {p.payment_method ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.metaLabel}>Amount</div>
                    <div className={styles.metaValue}>
                      ₹{parseFloat(String(p.amount)).toLocaleString("en-IN")}
                    </div>
                  </div>
                  {p.payment_gateway_id && (
                    <div>
                      <div className={styles.metaLabel}>Payment ID</div>
                      <div className={styles.metaValue}>
                        {p.payment_gateway_id}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className={styles.metaLabel}>Status</div>
                    <div className={styles.metaValue}>
                      <span className={styles.captured}>{p.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <div className={styles.sidebar}>
          {/* NEXT STEP — the ops-FLOOR action card (advance stage, assign tailor/QC).
              G-23: these belong to the Ops app (Phase B); until then they're gated to
              super_admin (system:manage) as break-glass. Support is CX-only and no
              longer sees this. */}
          <Can cap="system:manage">
            <NextStepCard
              order={order}
              customerFitProfiles={customerFitProfiles}
              profilesLoading={profilesLoading}
              advancingStage={advancingStage}
              assigningCraft={assigningCraft}
              assigningQC={assigningQC}
              onAdvance={handleAdvance}
              onAssignCraft={handleAssignCraft}
              onAssignQC={handleAssignQC}
              onUseFitProfile={handleUseFitProfile}
            />
          </Can>

          {/* Delivery date + hold reason — support CX (orders:write) */}
          <Can cap="orders:write">
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>Delivery</h3>
              <div style={{ marginBottom: 10 }}>
                <div className={styles.metaLabel}>Est. Delivery Date</div>
                {editingDelivery ? (
                  <div className={styles.inlineEdit}>
                    <input
                      type="date"
                      className={styles.inlineInput}
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                    <button
                      className={styles.inlineSave}
                      disabled={savingDelivery}
                      onClick={handleSaveDelivery}
                    >
                      {savingDelivery ? "…" : "Save"}
                    </button>
                    <button
                      className={styles.actionBtnSecondary}
                      style={{ height: 34, padding: "0 10px", fontSize: 12 }}
                      onClick={() => {
                        setEditingDelivery(false);
                        setDeliveryDate(order.estimated_delivery_date ?? "");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className={styles.inlineEdit}>
                    <span className={styles.metaValue}>
                      {order.estimated_delivery_date ?? "—"}
                    </span>
                    <button
                      className={styles.linkBtn}
                      onClick={() => setEditingDelivery(true)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div>
                <div className={styles.metaLabel}>On Hold Reason</div>
                {editingHold ? (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <textarea
                      className={styles.fieldTextarea}
                      rows={2}
                      placeholder="Leave empty to clear hold…"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className={styles.inlineSave}
                        disabled={savingHold}
                        onClick={handleSaveHold}
                      >
                        {savingHold ? "…" : "Save"}
                      </button>
                      <button
                        className={styles.actionBtnSecondary}
                        style={{ height: 34, padding: "0 10px", fontSize: 12 }}
                        onClick={() => {
                          setEditingHold(false);
                          setHoldReason(order.on_hold_reason ?? "");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.inlineEdit}>
                    <span
                      className={styles.metaValue}
                      style={{
                        color: order.on_hold_reason
                          ? "#9E7340"
                          : "var(--color-text-tertiary)",
                        fontSize: 13,
                      }}
                    >
                      {order.on_hold_reason ?? "Not on hold"}
                    </span>
                    <button
                      className={styles.linkBtn}
                      onClick={() => setEditingHold(true)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Can>

          {/* Admin actions — Override is super-only break-glass (G-23); invoice +
              cancel stay available to support (orders:write) / finance. */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Admin Actions</h3>
            <div className={styles.actionList}>
              <Can cap="system:manage">
                <button
                  className={styles.overrideBtn}
                  onClick={() => setShowOverrideModal(true)}
                >
                  Override Stage
                </button>
              </Can>
              <button
                className={styles.actionBtnSecondary}
                disabled={invoiceGenerating}
                onClick={handleGenerateInvoice}
              >
                {invoiceGenerating ? "Queuing…" : "Generate Invoice"}
              </button>
              <button
                className={styles.actionBtnSecondary}
                disabled={invoiceLoading}
                onClick={handleDownloadInvoice}
              >
                {invoiceLoading ? "Loading…" : "Download Invoice"}
              </button>
              <Can cap="orders:write">
                <button className={styles.cancelBtn}>Cancel Order</button>
              </Can>
            </div>
          </div>

          {order.cancellation_reason && (
            <div className={styles.card}>
              <h3
                className={styles.sectionTitle}
                style={{ color: "var(--color-error)" }}
              >
                Cancellation
              </h3>
              <div
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                {order.cancellation_reason}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Override modal ────────────────────────────────────────────────────── */}
      {showOverrideModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowOverrideModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Override Order Stage</h3>
            <div className={styles.warningBanner}>
              ⚠ Manual overrides bypass normal validation. They are logged in
              the audit trail.
            </div>
            <div className={styles.currentStatus}>
              <span>
                Current Stage: <strong>{order.stage.replace(/_/g, " ")}</strong>
              </span>
              <span>
                Lifecycle: <strong>{order.status}</strong>
              </span>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Override to</label>
              <select
                className={styles.fieldSelect}
                value={overrideStage}
                onChange={(e) => setOverrideStage(e.target.value)}
              >
                <option value="">Select stage…</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label.replace("\n", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason (min 20 chars)</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="e.g., Courier confirmed delivery but webhook failed to update status."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.checkList}>
              {[
                "I understand this action will be logged",
                `I have verified this is the correct order (${order.id})`,
              ].map((label, i) => (
                <label key={i} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={overrideChecks[i]}
                    onChange={(e) => {
                      const next = [...overrideChecks];
                      next[i] = e.target.checked;
                      setOverrideChecks(next);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowOverrideModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.applyBtn}
                disabled={
                  !overrideStage ||
                  overrideReason.length < 20 ||
                  !overrideChecks.every(Boolean) ||
                  overriding
                }
                onClick={handleOverride}
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
