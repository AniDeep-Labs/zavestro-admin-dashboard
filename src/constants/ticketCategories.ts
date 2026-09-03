/**
 * [SUP-33-7] The support-ticket categories, mirrored from the backend contract
 * (`src/shared/constants/ticket-categories.ts`, served at
 * `GET /api/app-config/ticket-categories`).
 *
 * Three lists used to write this one column — the Call Console offered "Fit issue" and the
 * Support list did not, so whether a fit complaint was ever countable depended on which
 * screen the agent opened. The fit signal a made-to-measure brand is built on was leaking
 * into "General".
 *
 * The SLUG is stored; the label is what the agent reads.
 */
export interface TicketCategory {
  slug: string;
  label: string;
  hint: string;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
  {
    slug: 'fit_issue',
    label: 'Fit issue',
    hint: "The garment doesn't fit — too tight, too loose, wrong length. The signal the fit engine learns from.",
  },
  { slug: 'delivery', label: 'Delivery', hint: 'Late, missing, damaged, or a failed delivery attempt.' },
  {
    slug: 'payment_refund',
    label: 'Payment / refund',
    hint: 'Charged wrongly, refund not received, COD or settlement questions.',
  },
  {
    slug: 'order_change',
    label: 'Order change',
    hint: 'Cancel, change an address, change an item — before it ships.',
  },
  { slug: 'technical', label: 'Technical', hint: 'The app or site misbehaved.' },
  { slug: 'general', label: 'General', hint: 'Genuinely none of the above.' },
];

const LEGACY: Record<string, string> = {
  General: 'general',
  general: 'general',
  order_issue: 'order_change',
  'Order Issue': 'order_change',
  refund: 'payment_refund',
  'Return/Refund': 'payment_refund',
  'Payment / refund': 'payment_refund',
  'Technical Support': 'technical',
  'Fit issue': 'fit_issue',
  Delivery: 'delivery',
  'Order change': 'order_change',
};

/** A human label for whatever the column happens to hold, old values included. */
export const ticketCategoryLabel = (raw?: string | null): string => {
  if (!raw) return 'General';
  const slug = TICKET_CATEGORIES.some((c) => c.slug === raw)
    ? raw
    : (LEGACY[raw] ?? LEGACY[raw.trim()]);
  return TICKET_CATEGORIES.find((c) => c.slug === slug)?.label ?? 'General';
};
