/**
 * [SEA-42-5] What the CUSTOMER is currently being told, mirrored from the backend contract
 * (`src/shared/constants/order-stages.ts`, served at `GET /api/app-config/order-stages`).
 *
 * The customer app deliberately collapses seven internal stages into **"In Production"** —
 * a good decision that creates a translation gap this console never closed. An agent
 * reading `quality_check` on the order page had no way to know the caller is looking at the
 * words "In Production", or that `shipped` reads to them as "Dispatched". SUP-L3 asks that
 * support and the customer share a vocabulary; on a phone call, not sharing one means the
 * agent and the customer describe the same order in two different languages and each
 * assumes the other is confused.
 *
 * This is the STAFF-facing console, so the staff wording in `StatusBadge/vocab.ts` stays
 * exactly as it is. This is a second line beside it, not a replacement.
 *
 * Mirrored rather than fetched, matching `ticketCategories.ts` — and kept honest by
 * `scripts/check-stage-labels.mjs`, which diffs this against the backend contract whenever
 * a backend checkout is present.
 */
export const CUSTOMER_STAGE_LABEL: Record<string, string> = {
  pending_payment: 'Order Confirmed',
  payment_confirmed: 'Order Confirmed',
  awaiting_measurement: 'Agent Visit Scheduled',
  measurement_complete: 'Agent Visit Complete',
  fabric_sourcing: 'In Production',
  fabric_sourced: 'In Production',
  cutting: 'In Production',
  in_tailoring: 'In Production',
  quality_check: 'In Production',
  rework: 'In Production',
  ready_for_dispatch: 'In Production',
  shipped: 'Dispatched',
  delivery_failed: 'Delivery Failed',
  delivered: 'Delivered',
  rto: 'Returned',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * The customer's wording for a stage, or `null` when the contract does not define one.
 *
 * Null rather than a fallback to the slug or to the staff label: the point of the line is
 * to tell an agent something they could not otherwise know, and a guess would be worse
 * than silence — it would be read as fact during a call.
 */
export function customerStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return CUSTOMER_STAGE_LABEL[stage] ?? null;
}
