/**
 * THE status vocabulary — one source for hue AND wording (FABLE-ADMIN-UIUX §2.1).
 * Plain module (no components) so react-refresh stays happy; StatusBadge renders it.
 */
export type StatusTone =
  | 'pending'
  | 'fit'
  | 'making'
  | 'qc'
  | 'transit'
  | 'done'
  | 'blocked'
  | 'neutral';

interface VocabEntry {
  label: string;
  tone: StatusTone;
}

export const STATUS_VOCAB: Record<string, VocabEntry> = {
  // ── Order stages (canonical — shared/constants/order-transitions.ts) ──
  pending_payment: { label: 'Pending payment', tone: 'pending' },
  awaiting_measurement: { label: 'Awaiting measurement', tone: 'pending' },
  measurement_complete: { label: 'Measurement done', tone: 'fit' },
  payment_confirmed: { label: 'Payment confirmed', tone: 'neutral' },
  fabric_sourcing: { label: 'Fabric sourcing', tone: 'making' },
  fabric_sourced: { label: 'Fabric sourced', tone: 'making' },
  cutting: { label: 'Cutting', tone: 'making' },
  in_tailoring: { label: 'In tailoring', tone: 'making' },
  quality_check: { label: 'Quality check', tone: 'qc' },
  rework: { label: 'Rework', tone: 'qc' },
  ready_for_dispatch: { label: 'Ready for dispatch', tone: 'transit' },
  shipped: { label: 'Shipped', tone: 'transit' },
  delivered: { label: 'Delivered', tone: 'done' },
  delivery_failed: { label: 'Delivery failed', tone: 'blocked' },
  cancelled: { label: 'Cancelled', tone: 'blocked' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  // Legacy aliases still present in old rows/types
  payment_pending: { label: 'Pending payment', tone: 'pending' },
  ready_to_dispatch: { label: 'Ready for dispatch', tone: 'transit' },
  dispatched: { label: 'Shipped', tone: 'transit' },
  return_requested: { label: 'Return requested', tone: 'blocked' },
  returned: { label: 'Returned', tone: 'neutral' },

  // ── Sample jobs ──
  requested: { label: 'Requested', tone: 'pending' },
  stitching: { label: 'Stitching', tone: 'making' },
  design_review: { label: 'Awaiting review', tone: 'qc' },
  reviewed: { label: 'Reviewed', tone: 'done' },
  approved: { label: 'Approved', tone: 'done' },
  rejected: { label: 'Rejected', tone: 'blocked' },

  // ── Returns / refunds ──
  pickup_scheduled: { label: 'Pickup scheduled', tone: 'transit' },
  picked_up: { label: 'Picked up', tone: 'transit' },
  inspected: { label: 'Inspected', tone: 'qc' },
  refund_initiated: { label: 'Refund initiated', tone: 'pending' },
  refund_completed: { label: 'Refund completed', tone: 'done' },
  initiated: { label: 'Initiated', tone: 'pending' },
  completed: { label: 'Completed', tone: 'done' },
  // Return lifecycle (ops → finance): inspect → confirm → approve → refund
  agent_visit_scheduled: { label: 'Agent visit scheduled', tone: 'transit' },
  garment_picked_up: { label: 'Picked up', tone: 'transit' },
  defect_under_review: { label: 'Defect under review', tone: 'qc' },
  defect_confirmed: { label: 'Defect confirmed — awaiting refund', tone: 'pending' },
  defect_rejected: { label: 'Defect rejected', tone: 'blocked' },

  // ── Distribution / stock movement ──
  pushed: { label: 'In transit', tone: 'transit' },
  in_transit: { label: 'In transit', tone: 'transit' },
  received: { label: 'Received', tone: 'done' },

  // ── Tickets / generic lifecycle ──
  open: { label: 'Open', tone: 'pending' },
  in_progress: { label: 'In progress', tone: 'making' },
  waiting_customer: { label: 'Waiting on customer', tone: 'pending' },
  resolved: { label: 'Resolved', tone: 'done' },
  closed: { label: 'Closed', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'pending' },
  confirmed: { label: 'Confirmed', tone: 'done' },
  failed: { label: 'Failed', tone: 'blocked' },
  active: { label: 'Active', tone: 'done' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  draft: { label: 'Draft', tone: 'neutral' },
  live: { label: 'Live', tone: 'done' },

  // ── Invoices ──
  generated: { label: 'Generated', tone: 'done' },
  pending_generation: { label: 'Pending generation', tone: 'pending' },
  // ── Returns (extra) ──
  under_review: { label: 'Under review', tone: 'qc' },
  // ── Design library lifecycle ──
  published: { label: 'Published', tone: 'done' },
  archived: { label: 'Archived', tone: 'neutral' },
  // ── Catalog / generic on/off (boolean-backed pills) ──
  served: { label: 'Served', tone: 'done' },
  waiting: { label: 'Waiting', tone: 'pending' },
  configured: { label: 'Configured', tone: 'done' },
  incomplete: { label: 'Incomplete', tone: 'pending' },
};

/** Human label for a status key — single source for dropdowns, CSV exports, pills. */
export function statusLabel(status: string): string {
  return (
    STATUS_VOCAB[status]?.label ??
    status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

