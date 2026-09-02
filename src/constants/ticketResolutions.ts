/**
 * [SUP-32-5] Support-ticket RESOLUTIONS, mirrored from the backend contract
 * (`src/shared/constants/ticket-resolutions.ts`, served at
 * `GET /api/app-config/ticket-resolutions`, and backed by a CHECK constraint).
 *
 * SUP-33-7 gave the CATEGORY one vocabulary — why the customer got in touch. This is the
 * other half: what fixed it. "Resolve Ticket" used to be a bare status change, and
 * `support_tickets` had no outcome column at all, so the console could never answer what
 * a category alone cannot: ten fit complaints answered with an explanation and ten that
 * ended in a remake looked identical in every report.
 *
 * The SLUG is stored; the label is what the agent reads.
 */
export interface TicketResolution {
  slug: string;
  label: string;
  hint: string;
  /** The company gave something up — money, a garment, or labour. */
  costly: boolean;
}

export const TICKET_RESOLUTIONS: TicketResolution[] = [
  {
    slug: 'information_given',
    label: 'Answered — no action needed',
    hint: 'The customer asked something and we told them. Nothing about the order changed.',
    costly: false,
  },
  {
    slug: 'order_updated',
    label: 'Order changed',
    hint: 'We altered the order itself — address, item, or cancelled it before it shipped.',
    costly: false,
  },
  {
    slug: 'alteration_raised',
    label: 'Free alteration raised',
    hint: 'The garment is going back to a tailor. The standard answer to a fit complaint.',
    costly: true,
  },
  {
    slug: 'remeasure_raised',
    label: 'Re-measurement booked',
    hint: 'We are measuring the customer again, because the numbers on file were wrong.',
    costly: true,
  },
  {
    slug: 'remake_made',
    label: 'Garment remade',
    hint: 'We cut and stitched it again from scratch. The most expensive outcome there is.',
    costly: true,
  },
  {
    slug: 'refund_issued',
    label: 'Refunded',
    hint: 'Money went back to the customer, in part or in full.',
    costly: true,
  },
  {
    slug: 'credit_issued',
    label: 'Wallet credit given',
    hint: 'A goodwill or compensation credit, rather than a refund to source.',
    costly: true,
  },
  {
    slug: 'resolved_by_courier',
    label: 'Delivery sorted itself out',
    hint: 'A late or missing parcel arrived, or the courier resolved it. We did not pay.',
    costly: false,
  },
  {
    slug: 'customer_withdrew',
    label: 'Customer dropped it',
    hint: 'They stopped replying, or said never mind. Not the same as us fixing it.',
    costly: false,
  },
  {
    slug: 'duplicate',
    label: 'Duplicate ticket',
    hint: 'The same conversation is already happening on another ticket.',
    costly: false,
  },
];

/** A human label for whatever the column holds; "—" when nothing was recorded. */
export const ticketResolutionLabel = (raw?: string | null): string =>
  TICKET_RESOLUTIONS.find((r) => r.slug === raw)?.label ?? '—';
