import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ordersApi,
  invoicesApi,
  customerMeasurementsApi,
  usersApi,
  alterationsApi,
  returnsApi,
} from "../../api/adminApi";
import type {
  AdminOrder,
  OrderStage,
  OrderTimelineEntry,
  CustomerMeasurementsData,
} from "../../api/adminApi";
import { CopyId } from "../../components/DataCells";
import { StaffAssignmentDropdown } from "../../components/StaffAssignmentDropdown/StaffAssignmentDropdown";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { useBreadcrumbTitle } from "../../contexts/BreadcrumbContext";
import { useLiveRefresh, freshnessLabel } from "../../hooks/useLiveRefresh";
import { Can } from "../../components/Can/Can";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DispositionPanel } from "../../components/DispositionPanel/DispositionPanel";
import { StatusBadge, statusLabel } from "../../components/StatusBadge";
import { PageHeader, DetailShell } from "../../components";
import { useDialog } from "../../components/Modal/useDialog"; // [DSA-45-2]
import styles from "./OrderDetailPage.module.css";
import { money } from "../../utils/money"; // ACP-2 [KA7-8]: one shape, everywhere
import { PhoneCell } from "../../components/DataCells"; // ACP-3 [KA11-3]
import { fmtDate, toDateInput } from "../../utils/date"; // ACP-6 [KA7-7]: one shape, named timezone
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
  UilCalendarAlt,
  UilProcess,
  UilRuler,
  UilShieldCheck,
  UilTruck,
  UilUserCheck,
} from "@iconscout/react-unicons";

// ── Stage stepper config ─────────────────────────────────────────────────────
// Canonical stages per the backend state machine (order-transitions.ts). Legacy
// rows may still carry old names — normalizeStage maps them so the stepper,
// the next-step card and the override dropdown all speak the real machine.

const STAGE_ALIAS: Record<string, string> = {
  payment_pending: "pending_payment",
  ready_to_dispatch: "ready_for_dispatch",
  dispatched: "shipped",
};
const normalizeStage = (s: string): string => STAGE_ALIAS[s] ?? s;

// The happy path, in order (rework / delivery_failed / cancelled / refunded are
// off-path and render as a banner above the stepper instead).
const STAGES: { key: string; label: string }[] = [
  { key: "pending_payment", label: "Payment\nPending" },
  { key: "payment_confirmed", label: "Payment\nConfirmed" },
  { key: "awaiting_measurement", label: "Awaiting\nMeasurement" },
  { key: "measurement_complete", label: "Measurement\nDone" },
  { key: "cutting", label: "Cutting" },
  { key: "in_tailoring", label: "In\nTailoring" },
  { key: "quality_check", label: "Quality\nCheck" },
  { key: "ready_for_dispatch", label: "Ready for\nDispatch" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

const STAGE_IDX = Object.fromEntries(
  STAGES.map((s, i) => [s.key, i]),
) as Record<string, number>;

// Where an off-path stage rejoins the happy path (for stepper progress display).
const OFFPATH_NEAR: Record<string, string> = {
  rework: "quality_check",
  delivery_failed: "shipped",
  fabric_sourcing: "measurement_complete",
  fabric_sourced: "measurement_complete",
};

// Every stage the break-glass override may target = the state machine's keys.
const OVERRIDE_STAGES: string[] = [
  "pending_payment", "payment_confirmed", "awaiting_measurement", "measurement_complete",
  "fabric_sourcing", "fabric_sourced", "cutting", "in_tailoring",
  "quality_check", "rework", "ready_for_dispatch", "shipped",
  "delivered", "delivery_failed", "cancelled", "refunded",
];

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
    // [SUP-29-4] The promised delivery date moving is a customer-facing change, not
    // an ordinary step — it reads on the timeline as one.
    case "promise_changed":
      return styles.timelinePromise;
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
    case "promise_changed":
      return <UilCalendarAlt size={13} />;
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

  // Normalized: legacy stage names map onto the canonical machine.
  const stage = normalizeStage(order.stage);

  // Payment not confirmed yet
  if (stage === "pending_payment") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconMuted}`}>
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
        <div className={`${styles.nextStepIcon} ${styles.stepIconGold}`}>
          <UilRuler size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 1 — Measurements</div>

        {profilesLoading ? (
          <div className={styles.nextStepLoading}>
            Checking saved measurements…
          </div>
        ) : hasSavedProfiles ? (
          <>
            <div className={`${styles.nextStepDesc} ${styles.nextStepGood}`}>
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
        <div className={`${styles.nextStepEmpty} ${styles.nextStepEmptyGap}`}>
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
        <div className={`${styles.nextStepIcon} ${styles.stepIconBlue}`}>
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
        <div className={`${styles.nextStepIcon} ${styles.stepIconGreen}`}>
          <UilProcess size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 2 — Assign Craftsperson</div>
        <div className={styles.nextStepDesc}>
          Measurements are ready. Assign a tailor or cutter to begin stitching.
        </div>
        <div className={styles.nextStepField}>
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

  // Cutting (dark-store: the engine→physical bridge; ops floor owns it — this
  // card is the super break-glass view)
  if (stage === "cutting") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconGold}`}>
          <UilProcess size={18} />
        </div>
        <div className={styles.nextStepTitle}>Cutting</div>
        <div className={styles.nextStepDesc}>
          Fabric is being cut on the hub floor. The ops app advances this order;
          advance manually only if the floor can't.
        </div>
        <button
          className={styles.nextStepPrimary}
          disabled={advancingStage}
          onClick={() => onAdvance("in_tailoring", "Cut complete — sent to tailoring")}
        >
          {advancingStage ? "Advancing…" : "Cut Complete → Tailoring"}
        </button>
      </div>
    );
  }

  // In tailoring / fabric sourced
  if (stage === "in_tailoring" || stage === "fabric_sourced" || stage === "fabric_sourcing") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconGold}`}>
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
        <div className={`${styles.nextStepIcon} ${styles.stepIconBlue}`}>
          <UilShieldCheck size={18} />
        </div>
        <div className={styles.nextStepTitle}>Step 4 — Quality Check</div>
        <div className={styles.nextStepDesc}>
          Assign QC staff and review the garment.
        </div>
        <div className={styles.nextStepField}>
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
        <div className={styles.qcBtnRow}>
          <button
            className={`${styles.nextStepPrimary} ${styles.qcBtn}`}
            disabled={advancingStage}
            onClick={() => onAdvance("ready_for_dispatch", "QC passed")}
          >
            {advancingStage ? "…" : "✓ QC Pass"}
          </button>
          <button
            className={`${styles.nextStepDanger} ${styles.qcBtn}`}
            disabled={advancingStage}
            onClick={() =>
              onAdvance("rework", "QC failed — sent for rework")
            }
          >
            {advancingStage ? "…" : "✗ QC Fail"}
          </button>
        </div>
      </div>
    );
  }

  // Ready for dispatch
  if (stage === "ready_for_dispatch") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconGreen}`}>
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
            onAdvance("shipped", "Order dispatched to customer")
          }
        >
          {advancingStage ? "Advancing…" : "Mark Dispatched →"}
        </button>
      </div>
    );
  }

  // Shipped
  if (stage === "shipped") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconBlue}`}>
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

  // Rework (off-path: QC failed, garment back with the tailor)
  if (stage === "rework") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconGold}`}>
          <UilProcess size={18} />
        </div>
        <div className={styles.nextStepTitle}>In Rework</div>
        <div className={styles.nextStepDesc}>
          QC failed — the garment is back with the tailor. It returns to
          Quality Check when fixed.
        </div>
        <button
          className={styles.nextStepPrimary}
          disabled={advancingStage}
          onClick={() => onAdvance("quality_check", "Rework complete — back to QC")}
        >
          {advancingStage ? "Advancing…" : "Rework Done → QC"}
        </button>
      </div>
    );
  }

  // Delivery failed (off-path)
  if (stage === "delivery_failed") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconBlue}`}>
          <UilTruck size={18} />
        </div>
        <div className={styles.nextStepTitle}>Delivery Failed</div>
        <div className={styles.nextStepDesc}>
          The last delivery attempt failed. Re-ship when the customer confirms
          availability.
        </div>
        <button
          className={styles.nextStepPrimary}
          disabled={advancingStage}
          onClick={() => onAdvance("shipped", "Re-shipped after failed delivery")}
        >
          {advancingStage ? "Advancing…" : "Re-ship →"}
        </button>
      </div>
    );
  }

  // Delivered
  if (stage === "delivered") {
    return (
      <div className={styles.nextStepCard}>
        <div className={`${styles.nextStepIcon} ${styles.stepIconGreen}`}>
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
  // T2-8: item-level cancel (+ partial refund) target + reason.
  const [cancelItem, setCancelItem] = React.useState<{ id: string; name: string } | null>(null);
  const [cancelItemReason, setCancelItemReason] = React.useState("");
  const [cancellingItem, setCancellingItem] = React.useState(false);

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
  // G-37 re-measure (with this order as context)
  const [showRemeasure, setShowRemeasure] = React.useState(false);
  const [remeasureReason, setRemeasureReason] = React.useState("");
  const [showAlteration, setShowAlteration] = React.useState(false);
  const [alterationDesc, setAlterationDesc] = React.useState("");
  const [requestingAlteration, setRequestingAlteration] = React.useState(false);
  const [showReturn, setShowReturn] = React.useState(false);
  const [returnReason, setReturnReason] = React.useState("defective");
  const [returnDesc, setReturnDesc] = React.useState("");
  const [requestingReturn, setRequestingReturn] = React.useState(false);
  const [requestingRemeasure, setRequestingRemeasure] = React.useState(false);
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

  // Delivery address inline edit (T1-15 — support, pre-dispatch, dark-store hub-guarded)
  const emptyAddr = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };
  const [editingAddress, setEditingAddress] = React.useState(false);
  const [addrForm, setAddrForm] = React.useState(emptyAddr);
  const [savingAddress, setSavingAddress] = React.useState(false);
  const ADDRESS_LOCKED = ["shipped", "delivered", "delivery_failed", "rto"];

  // Hold reason inline edit
  const [editingHold, setEditingHold] = React.useState(false);
  const [holdReason, setHoldReason] = React.useState("");
  const [savingHold, setSavingHold] = React.useState(false);

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const overrideDialog = useDialog(
    showOverrideModal,
    () => setShowOverrideModal(false),
    'Override order stage',
  );
  const remeasureDialog = useDialog(
    showRemeasure,
    () => setShowRemeasure(false),
    'Request re-measure',
  );
  const alterationDialog = useDialog(
    showAlteration,
    () => setShowAlteration(false),
    'Request alteration',
  );
  const returnDialog = useDialog(showReturn, () => setShowReturn(false), 'Start a return');

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
        setDeliveryDate(toDateInput(o.estimated_delivery_date));
        setHoldReason(o.on_hold_reason ?? "");
      })
      .catch(() => {});
  }, [id]);

  // T2-8: cancel one item in a multi-item order (+ partial refund of its line).
  const doCancelItem = async () => {
    if (!order || !cancelItem) return;
    setCancellingItem(true);
    try {
      const res = await ordersApi.cancelItem(
        order.uuid ?? order.id,
        cancelItem.id,
        cancelItemReason.trim() || undefined,
      );
      showToast(
        "success",
        "Item cancelled",
        res.refunded > 0
          ? `${money(res.refunded)} refunded to source.`
          : "Order total reduced.",
      );
      setCancelItem(null);
      setCancelItemReason("");
      reload();
    } catch (e) {
      showToast("error", "Could not cancel item", e instanceof Error ? e.message : undefined);
    } finally {
      setCancellingItem(false);
    }
  };
  const ITEM_CANCEL_LOCKED = ["delivered", "shipped", "cancelled", "refunded", "rto", "delivery_failed"];
  const activeItemCount = (order?.items ?? []).filter((it) => !it.cancelled_at).length;
  const canCancelItems = !!order && !ITEM_CANCEL_LOCKED.includes(order.stage) && activeItemCount >= 2;

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    ordersApi
      .get(id)
      .then((o) => {
        setOrder(o);
        setDeliveryDate(toDateInput(o.estimated_delivery_date));
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

  // [SUP-28-3] The page used to load once and re-fetch only after its OWN actions, so
  // while an agent was on a call the ops floor could advance the stage, QC could fail
  // the garment and a payment could settle with nothing on screen to say so. Re-reads
  // the record on a timer while the tab is visible, and the header says how old what
  // you are looking at actually is. Deliberately does NOT overwrite the two editable
  // fields — clobbering a half-typed delivery date or hold reason mid-refresh would
  // trade one silent lie for another.
  const refetchOrder = React.useCallback(async () => {
    if (!id) return;
    setOrder(await ordersApi.get(id));
  }, [id]);
  const { lastUpdatedAt, refreshing, lastError, refreshNow } = useLiveRefresh(refetchOrder, {
    enabled: !!id,
  });
  // Re-render the "as of" label as it ages, so it cannot itself go stale on screen.
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

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

  const submitRemeasure = async () => {
    if (!order || !remeasureReason.trim()) {
      showToast("error", "Add a reason for the re-measure");
      return;
    }
    if (!order.user_id) {
      showToast("error", "This order has no linked customer");
      return;
    }
    setRequestingRemeasure(true);
    try {
      await usersApi.requestRemeasure(order.user_id, {
        reason: remeasureReason.trim(),
        order_id: order.uuid ?? order.id,
        ...(order.fit_profile_id ? { fit_profile_id: order.fit_profile_id } : {}),
      });
      showToast("success", "Re-measure requested", "Ops will schedule a free agent visit.");
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

  const submitAlteration = async () => {
    if (!order?.user_id) {
      showToast("error", "This order has no linked customer");
      return;
    }
    if (!alterationDesc.trim()) {
      showToast("error", "Describe the alteration needed");
      return;
    }
    setRequestingAlteration(true);
    try {
      await alterationsApi.create({
        user_id: order.user_id,
        order_id: order.uuid ?? order.id,
        description: alterationDesc.trim(),
      });
      showToast("success", "Alteration requested", "First alteration on the order is free.");
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

  const RETURN_REASONS = [
    { v: "defective", l: "Defective / quality issue → refund" },
    { v: "wrong_item", l: "Wrong item received → refund" },
    { v: "wrong_measurements", l: "Fit / measurements wrong → alteration" },
    { v: "changed_mind", l: "Changed mind → declined" },
    { v: "other", l: "Other → manual review" },
  ];

  const submitReturn = async () => {
    if (!order?.user_id) {
      showToast("error", "This order has no linked customer");
      return;
    }
    setRequestingReturn(true);
    try {
      await returnsApi.create({
        user_id: order.user_id,
        order_id: order.uuid ?? order.id,
        reason: returnReason,
        description: returnDesc.trim() || undefined,
      });
      showToast("success", "Return started", "Ops will inspect; finance approves any refund.");
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

  const openEditAddress = () => {
    const a = order?.delivery_address;
    setAddrForm({
      name: a?.name ?? order?.customer ?? "",
      phone: a?.phone ?? order?.phone ?? "",
      line1: a?.line1 ?? "",
      line2: a?.line2 ?? "",
      city: a?.city ?? "",
      state: a?.state ?? "",
      pincode: a?.pincode ?? "",
    });
    setEditingAddress(true);
  };

  const handleSaveAddress = async () => {
    if (!order) return;
    const f = addrForm;
    if (!f.name.trim() || !f.phone.trim() || !f.line1.trim() || !f.city.trim() || !f.state.trim()) {
      showToast("error", "Name, phone, line 1, city and state are required");
      return;
    }
    if (!/^\d{6}$/.test(f.pincode.trim())) {
      showToast("error", "Pincode must be 6 digits");
      return;
    }
    setSavingAddress(true);
    try {
      const res = await ordersApi.editAddress(order.uuid ?? order.id, {
        name: f.name.trim(),
        phone: f.phone.trim(),
        line1: f.line1.trim(),
        line2: f.line2.trim() || undefined,
        city: f.city.trim(),
        state: f.state.trim(),
        pincode: f.pincode.trim(),
      });
      setOrder((prev) => (prev ? { ...prev, delivery_address: res.delivery_address } : prev));
      setEditingAddress(false);
      showToast("success", "Delivery address updated");
    } catch (e) {
      // Server enforces the dark-store hub guard — surface its message (cross-hub, unserviceable, locked).
      showToast("error", "Couldn't update address", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingAddress(false);
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

  const normStage = normalizeStage(order.stage);
  const offPath = !(normStage in STAGE_IDX);
  const currentIdx = STAGE_IDX[normStage] ?? STAGE_IDX[OFFPATH_NEAR[normStage]] ?? -1;

  // ── Canon header (W-11): order identity + status/mode chips; the customer/hub
  //    strip and the stage stepper stay full-width in the header slot (which
  //    spans both DetailShell columns). The SSE-fed timeline stays bespoke. ──
  const header = (
    <>
      <PageHeader
        above={
          <button
            className={styles.backBtn}
            onClick={() => navigate("/admin/orders")}
          >
            <UilAngleLeft size={15} /> Back to Orders
          </button>
        }
        eyebrow="Order"
        title={
          <>
            {order.id}
            {order.reference_id && (
              <span className={styles.refBadge}>{order.reference_id}</span>
            )}
          </>
        }
        subtitle={`Created ${order.created}`}
        meta={
          <>
            <span className={`${styles.pill} ${styles.pillGreen}`}>
              {order.mode}
            </span>
            <StatusBadge status={order.status} />
            {order.on_hold_reason && (
              <span className={styles.holdPill}>⏸ On Hold</span>
            )}
            {order.customer_ref && (
              <span className={styles.refChip}>{order.customer_ref}</span>
            )}
            {/* [SUP-28-3] How old the story on this screen is. An agent reading a stage
                out loud on a call needs to know whether it is current — the page has no
                other way of admitting that the floor moved while they were talking. */}
            <button
              type="button"
              className={styles.freshness}
              onClick={refreshNow}
              disabled={refreshing}
              title={
                lastError
                  ? "The last refresh failed, so this may be out of date by more than the time shown. Click to try again."
                  : "This page re-reads itself every 15 seconds while the tab is open. Click to refresh now."
              }
            >
              {refreshing
                ? "Refreshing…"
                : lastError
                  ? `Updated ${freshnessLabel(lastUpdatedAt, nowTick)} · not refreshing`
                  : `Updated ${freshnessLabel(lastUpdatedAt, nowTick)} · refresh`}
            </button>
          </>
        }
      />

      <div className={styles.headerExtras}>
        <div className={styles.card}>
          <div className={styles.customerRow}>
          <span className={styles.customerLabel}>Customer</span>
          <span className={styles.customerName}>{order.customer}</span>
          <span className={styles.customerPhone}><PhoneCell phone={order.phone} /></span>
          {order.user_id && (
            <button
              className={styles.linkBtn}
              onClick={() => navigate(`/admin/users/${order.user_id}`)}
            >
              View Profile →
            </button>
          )}
          <span className={`${styles.customerLabel} ${styles.customerLabelGap}`}>
            Hub
          </span>
          <span className={styles.customerName}>{order.hub}</span>
        </div>
      </div>

      {/* ── Stage stepper ──────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.journeyHeader}>
          <h3 className={styles.sectionTitle}>Order Journey</h3>
          <StatusBadge status={order.stage} />
        </div>
        {offPath && (
          <div className={styles.offPathBanner}>
            This order is off the happy path: <strong>{statusLabel(order.stage)}</strong>
            {OFFPATH_NEAR[normStage] ? ` — returns at ${statusLabel(OFFPATH_NEAR[normStage])}.` : '.'}
          </div>
        )}
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
      </div>
    </>
  );

  // ── Canon right rail (W-11 DetailShell aside): ops break-glass · delivery ·
  //    admin actions · cancellation — relocated verbatim from the old sidebar. ──
  const aside = (
    <>
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
          <div className={styles.deliveryBlock}>
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
                  className={`${styles.actionBtnSecondary} ${styles.inlineCancel}`}
                  onClick={() => {
                    setEditingDelivery(false);
                    setDeliveryDate(toDateInput(order.estimated_delivery_date));
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className={styles.inlineEdit}>
                <span className={styles.metaValue}>
                  {order.estimated_delivery_date ? (
                    /* [KA7-7] Was rendered RAW — `2026-08-02T18:30:00.000Z` on screen,
                       directly beneath a correctly formatted `Created 28/7/2026`. And that
                       string carries the timezone bug in plain sight: 18:30Z IS 00:00 IST
                       the next day, so the date the operator read to the customer was a
                       day behind the one the customer was promised. fmtDate names IST. */
                    fmtDate(order.estimated_delivery_date)
                  ) : order.computed_delivery_date ? (
                    /* T1-20: computed fallback when no human set a date — an estimate, not a guess */
                    <>
                      {/* Same formatter as the line above: two shapes in one card is how
                          a reader stops trusting either. This one also gains the IST
                          timezone it never named. */}
                      {fmtDate(order.computed_delivery_date)}
                      <span className={styles.estHint}> · estimated (created + {order.delivery_sla_days ?? 7}d)</span>
                    </>
                  ) : (
                    "—"
                  )}
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
          <div className={styles.deliveryBlock}>
            <div className={styles.metaLabel}>Delivery Address</div>
            {editingAddress ? (
              <div className={styles.holdEditCol}>
                {([
                  ["name", "Name"],
                  ["phone", "Phone"],
                  ["line1", "Address line 1"],
                  ["line2", "Address line 2 (optional)"],
                  ["city", "City"],
                  ["state", "State"],
                  ["pincode", "Pincode (6 digits)"],
                ] as const).map(([key, ph]) => (
                  <input
                    key={key}
                    className={styles.inlineInput}
                    placeholder={ph}
                    value={addrForm[key]}
                    onChange={(e) => setAddrForm({ ...addrForm, [key]: e.target.value })}
                  />
                ))}
                <div className={styles.inlineEdit}>
                  <button className={styles.inlineSave} disabled={savingAddress} onClick={handleSaveAddress}>
                    {savingAddress ? "…" : "Save"}
                  </button>
                  <button
                    className={`${styles.actionBtnSecondary} ${styles.inlineCancel}`}
                    onClick={() => setEditingAddress(false)}
                  >
                    Cancel
                  </button>
                </div>
                <span className={styles.addrHint}>
                  A pincode outside this order's hub can't be set — cancel + re-order to deliver elsewhere.
                </span>
              </div>
            ) : (
              <div className={styles.inlineEdit}>
                <span className={styles.metaValue}>
                  {order.delivery_address
                    ? `${order.delivery_address.line1}${order.delivery_address.line2 ? `, ${order.delivery_address.line2}` : ""}, ${order.delivery_address.city}, ${order.delivery_address.state} ${order.delivery_address.pincode}`
                    : "—"}
                </span>
                {ADDRESS_LOCKED.includes(order.stage) ? (
                  <span className={styles.addrHint}>locked (shipped)</span>
                ) : (
                  <button className={styles.linkBtn} onClick={openEditAddress}>
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <div className={styles.metaLabel}>On Hold Reason</div>
            {editingHold ? (
              <div className={styles.holdEditCol}>
                <textarea
                  className={styles.fieldTextarea}
                  rows={2}
                  placeholder="Leave empty to clear hold…"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                />
                <div className={styles.holdEditRow}>
                  <button
                    className={styles.inlineSave}
                    disabled={savingHold}
                    onClick={handleSaveHold}
                  >
                    {savingHold ? "…" : "Save"}
                  </button>
                  <button
                    className={`${styles.actionBtnSecondary} ${styles.inlineCancel}`}
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
                  className={`${styles.metaValue} ${order.on_hold_reason ? styles.holdValue : styles.holdValueNone}`}
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
          {/* G-37: support's re-measure lever, with this order as context */}
          <Can cap="orders:write">
            <button
              className={styles.actionBtnSecondary}
              onClick={() => setShowRemeasure(true)}
            >
              Request re-measure
            </button>
          </Can>
          {/* Alteration & return — only on a delivered order (backend enforces it too) */}
          {order.stage === "delivered" && (
            <Can cap="orders:write">
              <button
                className={styles.actionBtnSecondary}
                onClick={() => setShowAlteration(true)}
              >
                Request alteration
              </button>
            </Can>
          )}
          {order.stage === "delivered" && (
            <Can cap="orders:write">
              <button
                className={styles.actionBtnSecondary}
                onClick={() => setShowReturn(true)}
              >
                Start a return
              </button>
            </Can>
          )}
          {/* Cancel Order removed: the button was dead (no handler). The real
              cancel flow (allowed-stage check + fabric release + refund
              linkage) ships later. */}
        </div>
      </div>

      {order.cancellation_reason && (
        <div className={styles.card}>
          <h3 className={`${styles.sectionTitle} ${styles.sectionTitleError}`}>
            Cancellation
          </h3>
          <div className={styles.cancelReasonText}>
            {order.cancellation_reason}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* T2-8: cancel one item (+ partial refund of its line) */}
      <ConfirmDialog
        open={!!cancelItem}
        title="Cancel this item?"
        message={
          <>
            Cancel <strong>{cancelItem?.name}</strong> and refund its line to the customer's
            original payment method (COD orders just pay less). The rest of the order continues.
            <input
              className={styles.reasonInput}
              value={cancelItemReason}
              onChange={(e) => setCancelItemReason(e.target.value)}
              placeholder="Reason (optional) — e.g. fabric defect on this item"
            />
          </>
        }
        confirmLabel="Cancel item + refund"
        loading={cancellingItem}
        onConfirm={doCancelItem}
        onCancel={() => {
          setCancelItem(null);
          setCancelItemReason("");
        }}
      />
      <DetailShell header={header} aside={aside}>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).length > 0
                  ? (order.items ?? []).map((it) => {
                      const cancelled = !!it.cancelled_at;
                      return (
                        <tr key={it.id} className={cancelled ? styles.itemRowCancelled : undefined}>
                          <td className={cancelled ? styles.itemStrike : undefined}>
                            {it.product_name}
                            {cancelled && (
                              <span className={styles.metaLabel}> · cancelled</span>
                            )}
                          </td>
                          <td>{it.quantity}</td>
                          <td>{money(it.unit_price)}</td>
                          <td>
                            {money(it.quantity * it.unit_price)}
                          </td>
                          <td>
                            {/* [SUP-27-1] Recording a QC verdict is a FLOOR verb —
                                for a third-party garment it is what releases the
                                garment for dispatch. It was `orders:write`, i.e.
                                support. Now `qc:write` (super_admin break-glass,
                                same footing as advance/assign) until the ops app
                                ships its QC-2 screen. */}
                            {!cancelled && (
                              <Can cap="qc:write">
                                <button
                                  className={styles.linkBtn}
                                  onClick={() => navigate(`/admin/orders/qc/${it.id}`)}
                                >
                                  Record QC
                                </button>
                              </Can>
                            )}
                            {!cancelled && canCancelItems && (
                              <Can cap="refunds:approve">
                                <button
                                  className={styles.linkBtnDanger}
                                  onClick={() =>
                                    setCancelItem({ id: it.id, name: it.product_name })
                                  }
                                >
                                  Cancel item
                                </button>
                              </Can>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  : order.products.map((p, i) => (
                      <tr key={i}>
                        <td>{p}</td>
                        <td>1</td>
                        <td>—</td>
                        <td>—</td>
                        <td />
                      </tr>
                    ))}
              </tbody>
            </table>
            <div className={styles.itemsTotalRow}>
              <div>
                <span className={`${styles.metaLabel} ${styles.totalLabel}`}>Total</span>
                <span className={styles.totalValue}>
                  {money(order.total)}
                </span>
              </div>
            </div>
          </div>

          {/* T2-12: an RTO'd made-for-one garment came home — record disposition + write-off */}
          {order.stage === "rto" && (
            <div className={styles.card}>
              <DispositionPanel orderId={order.uuid ?? order.id} source="rto" />
            </div>
          )}

          {/* ── Measurement + Staff assignments ────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Production Assignments</h3>

            {/* Measurement (dark-store: fit on file or agent home visit — recorded via the ops app) */}
            <div className={styles.measureBlock}>
              <div className={styles.assignLabel}>
                <UilRuler size={11} className={styles.assignLabelIcon} />
                Measurement
              </div>
              {order.fit_profile_id ? (
                <>
                  <span className={styles.measureOnFile}>
                    ✓ Measurements on file — used for production
                  </span>
                  {/* [SUP-28-4] What the garment was actually cut to.
                      The server has always sent `items[].measurement_snapshot`; nothing
                      rendered it, so the single most common conversation on a
                      made-to-measure order — "it doesn't fit" — was answered with a tick.
                      The one fact that settles it (what we cut to, versus what the
                      customer says they are) was one field away and invisible, and an
                      agent could not sanity-check a suspicious value before ordering a
                      re-measure. */}
                  {(order.items ?? []).some(it => it.measurement_snapshot && Object.keys(it.measurement_snapshot).length > 0) && (
                    <div className={styles.cutToBlock}>
                      {(order.items ?? []).map(it =>
                        it.measurement_snapshot && Object.keys(it.measurement_snapshot).length > 0 ? (
                          <div key={it.id} className={styles.cutToItem}>
                            <div className={styles.cutToLabel}>
                              Cut to{(order.items ?? []).length > 1 ? ` · ${it.product_name}` : ""}
                            </div>
                            <div className={styles.cutToValues}>
                              {Object.entries(it.measurement_snapshot).map(([k, v]) => (
                                <span key={k} className={styles.cutToChip}>
                                  {k.replace(/_/g, " ")} <strong>{String(v)}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
                </>
              ) : order.linked_home_visit_id ? (
                <span className={styles.measureVisit}>
                  Agent home visit
                  {order.linked_home_visit_ref
                    ? ` · ${order.linked_home_visit_ref}`
                    : ""}{" "}
                  — captured via the ops app
                </span>
              ) : (
                <div className={styles.measureMissing}>
                  <UilExclamationCircle size={13} />
                  <span>
                    No measurements yet — an agent home visit will capture them
                  </span>
                </div>
              )}
            </div>

            {/* Craftsperson + QC.
                [SUP-29-1] These two rows sit OUTSIDE the <Can cap="system:manage">
                that wraps NextStepCard, so support — which cannot call
                assign-craftsperson / assign-qc-staff (both system:manage
                break-glass, G-23) — was offered a live "Assign staff…" control
                that 403s on submit. Everyone still SEES who is assigned; only
                break-glass gets to change it. */}
            <div className={styles.assignRow}>
              <div>
                <div className={styles.assignLabel}>
                  <UilProcess size={11} className={styles.assignLabelIcon} />
                  Craftsperson
                </div>
                {normStage === "measurement_complete" ||
                currentIdx > STAGE_IDX["measurement_complete"] ? (
                  <>
                    <Can
                      cap="system:manage"
                      fallback={
                        <div className={styles.assignHint}>
                          {order.craftsperson_name ?? "Not yet assigned"}
                        </div>
                      }
                    >
                      <StaffAssignmentDropdown
                        value={order.craftsperson_id ?? null}
                        onChange={handleAssignCraft}
                        hubId={order.hub_id ?? undefined}
                        showWorkload
                        filterRoles={["tailor", "cutter", "finisher"]}
                        disabled={assigningCraft}
                      />
                    </Can>
                    {order.craftsperson_name && (
                      <div className={styles.assignRole}>{order.craftsperson_role}</div>
                    )}
                  </>
                ) : (
                  <div className={styles.assignHint}>Available after measurements</div>
                )}
              </div>
              <div>
                <div className={styles.assignLabel}>
                  <UilShieldCheck size={11} className={styles.assignLabelIcon} />
                  QC Staff
                </div>
                {currentIdx >= STAGE_IDX["quality_check"] ? (
                  <Can
                    cap="system:manage"
                    fallback={
                      <div className={styles.assignHint}>
                        {order.qc_staff_name ?? "Not yet assigned"}
                      </div>
                    }
                  >
                    <StaffAssignmentDropdown
                      value={order.qc_staff_id ?? null}
                      onChange={handleAssignQC}
                      hubId={order.hub_id ?? undefined}
                      showWorkload
                      filterRoles={["quality_checker"]}
                      disabled={assigningQC}
                    />
                  </Can>
                ) : (
                  <div className={styles.assignHint}>Available at QC stage</div>
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
                <div className={styles.assignHint}>
                  {/* [KA7-10] Absence of LOGGING is not absence of HISTORY. This
                      read "No activity yet." on a garment at stage 6 of 10 — one
                      that has, by definition, moved five times. The admin path
                      writes no timeline entries, so the page was reporting our
                      gap as the order's. */}
                  No entries — stage changes made in this console are not yet recorded here.
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
            {/* [SUP-28-1] No payment row means NO PAYMENT RECORDED — it does not
                mean "pending". The detail endpoint never returned a `payments` key
                at all, so this branch fired on EVERY order and every one of them
                told the agent the payment was pending — including a delivered
                order paid online. On the one screen where a refund conversation
                starts, the payment status was a constant. The endpoint now returns
                the rows; when there genuinely are none, say exactly that. */}
            {(order.payments ?? []).length === 0 ? (
              <div className={styles.paymentGrid}>
                <div>
                  <div className={styles.metaLabel}>Amount</div>
                  <div className={styles.metaValue}>
                    {money(order.total)}
                  </div>
                </div>
                <div>
                  <div className={styles.metaLabel}>Status</div>
                  <div className={styles.metaValue}>
                    <span className={styles.pendingPay}>No payment recorded</span>
                    <div className={styles.paymentNote}>
                      {order.payment_method === "cod"
                        ? "COD — cash is collected on delivery and recorded by the ops app."
                        : "Nothing has been captured against this order yet."}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* [SUP-28-7] Method reads the ORDER, not the payment row — `payments`
                 has no method column, so `p.payment_method` was undefined and this
                 rendered "—" on every captured payment. The gateway reference is
                 `razorpay_payment_id`; the old `p.payment_gateway_id &&` guard named
                 a field that does not exist, so the Payment ID block never rendered
                 at all — and that id is what support has to quote to trace a refund. */
              (order.payments ?? []).map((p, i) => (
                <div key={p.id ?? i} className={styles.paymentGrid}>
                  <div>
                    <div className={styles.metaLabel}>Method</div>
                    <div className={styles.metaValue}>
                      {order.payment_method
                        ? order.payment_method === "cod"
                          ? "COD"
                          : order.payment_method
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.metaLabel}>Amount</div>
                    <div className={styles.metaValue}>
                      {money(p.amount)}
                    </div>
                  </div>
                  {p.razorpay_payment_id ? (
                    <div>
                      <div className={styles.metaLabel}>Payment ID</div>
                      <div className={styles.metaValue}>
                        <CopyId value={p.razorpay_payment_id} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className={styles.metaLabel}>Payment ID</div>
                      <div className={styles.metaValue}>
                        <span className={styles.paymentNote}>
                          {order.payment_method === "cod"
                            ? "COD — no gateway reference"
                            : "Not yet issued by the gateway"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className={styles.metaLabel}>Status</div>
                    <div className={styles.metaValue}>
                      <span className={styles.captured}>{p.status}</span>
                      {(p.captured_at ?? p.cod_collected_at) && (
                        <div className={styles.paymentNote}>
                          {p.cod_collected_at ? "Collected " : "Captured "}
                          {new Date(
                            (p.cod_collected_at ?? p.captured_at) as string,
                          ).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
      </DetailShell>

      {/* ── Override modal ────────────────────────────────────────────────────── */}
      {showOverrideModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowOverrideModal(false)}
        >
          <div className={styles.modal} {...overrideDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Override Order Stage</h3>
            <div className={styles.warningBanner}>
              ⚠ Manual overrides bypass normal validation. They are logged in
              the audit trail.
            </div>
            <div className={styles.currentStatus}>
              <span>
                Current Stage: <strong>{statusLabel(order.stage)}</strong>
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
                {OVERRIDE_STAGES.map((key) => (
                  <option key={key} value={key}>
                    {statusLabel(key)}
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

      {/* Re-measure request modal (G-37) */}
      {showRemeasure && (
        <div className={styles.modalOverlay} onClick={() => setShowRemeasure(false)}>
          <div className={styles.modal} {...remeasureDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Request re-measure</h3>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Reason (free agent visit; ops schedules it)
              </label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="e.g., Customer reports the fit was tight at the waist on this order"
                value={remeasureReason}
                onChange={(e) => setRemeasureReason(e.target.value)}
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
                className={styles.applyBtn}
                disabled={!remeasureReason.trim() || requestingRemeasure}
                onClick={submitRemeasure}
              >
                {requestingRemeasure ? "Requesting…" : "Request re-measure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request alteration on this (delivered) order */}
      {showAlteration && (
        <div className={styles.modalOverlay} onClick={() => setShowAlteration(false)}>
          <div className={styles.modal} {...alterationDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Request alteration</h3>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                What needs altering (first alteration on the order is free)
              </label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="e.g., Take in 1cm at the chest; shorten sleeves by 2cm"
                value={alterationDesc}
                onChange={(e) => setAlterationDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowAlteration(false)}
              >
                Cancel
              </button>
              <button
                className={styles.applyBtn}
                disabled={!alterationDesc.trim() || requestingAlteration}
                onClick={submitAlteration}
              >
                {requestingAlteration ? "Requesting…" : "Request alteration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start a return on this (delivered) order */}
      {showReturn && (
        <div className={styles.modalOverlay} onClick={() => setShowReturn(false)}>
          <div className={styles.modal} {...returnDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Start a return</h3>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason (routes the outcome)</label>
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
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Details (optional)</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="What did the customer report?"
                value={returnDesc}
                onChange={(e) => setReturnDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowReturn(false)}
              >
                Cancel
              </button>
              <button
                className={styles.applyBtn}
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
