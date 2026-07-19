// T3-2 (W-U1): per-console in-product help. The "Job-to-be-done" descriptions are lifted from
// FABLE-ADMIN-UIUX §3A-§8A (already written) so a new hire's day one isn't a founder walkthrough.

export interface ConsoleHelp {
  console: string; // display name
  summary: string; // who owns this console + daily loop + the bar we hold it to
  see: string[];
  control: string[];
  handle: string[];
}

// One entry per role/console. `see`/`control`/`handle` split the spec's SEE/CONTROL/HANDLE
// bullets into readable lines (the "NOT:" clause is kept — knowing what you DON'T own matters).
export const CONSOLE_HELP: Record<string, ConsoleHelp> = {
  super: {
    console: 'Oversight (Owner)',
    summary:
      'The founder/overseer. Daily loop: is anything stuck, leaking money, or off-model? — then staff/hub/system administration. Bar: Shopify admin’s Home + staff/audit surfaces.',
    see: [
      'The company pulse: stuck orders, COD float, refund-queue depth, hub utilization.',
      'Every overview (designs / listings / supply), hubs, staff, audit trail, system health.',
      'NOT the role-owned operating consoles — they’re blocked on purpose (fixing from super is how RBAC dies).',
    ],
    control: [
      'Staff + admin-user lifecycle, hubs, app config, service areas, notification blasts.',
      'Break-glass order overrides — with a reason.',
      'NOT listings, pricing, or refund disbursal (separation of duties — those are finance’s / CM’s).',
    ],
    handle: ['Incidents (break-glass), onboarding staff, opening hubs, config changes.'],
  },
  design: {
    console: 'Design',
    summary:
      'The design team authors what customers buy: designs, fabric pairings, garment-type charts (the fit engine’s source), the sample loop, fit analytics. Daily loop: author → sample → review → watch fit data. Bar: a PIM fused with a simple PLM sample tracker.',
    see: [
      'The library with lifecycle truth (sampled? listed? selling? fitting?).',
      'Sample-queue ages, fit-calibration KPIs (you own fit), fabric availability (read-only).',
    ],
    control: [
      'Design CRUD + publish; garment-type templates (charts / capture-sets / pain-point deltas).',
      'Sample requests + review verdicts; design analytics.',
      'NOT pricing (CM’s) or stock (procurement’s).',
    ],
    handle: [
      'The new-design pipeline end-to-end until a "reviewed sample" hands off to CM — your verdict is the gate for the first listing.',
    ],
  },
  procurement: {
    console: 'Procurement / Supply',
    summary:
      'The supply manager keeps every hub stocked with the right fabric at the lowest capital. Daily loop: what’s low → what’s in transit → what arrived → what’s requested. Bar: Blinkit’s supply console — leads with stockout risk, never with lists.',
    see: [
      'Stock per SKU×hub vs reorder point; capital tied in stock (₹).',
      'In-transit distributions with age; pending requests (restock + fabric-for-listing).',
      'Supplier / lead-time per fabric; dead-stock age.',
    ],
    control: [
      'Fabric-master CRUD; distributions (push / cancel / receive-with-actuals).',
      'Restock + listing-request fulfillment; reorder thresholds.',
      'NOT listing/pricing (CM) or PO finance (the sheet owns POs until hub #3).',
    ],
    handle: ['New-fabric onboarding → hub stocking → replenishment loop → request queues.'],
  },
  catalog_manager: {
    console: 'Catalog Manager',
    summary:
      'The hub’s merchant: decides what’s sellable, at what price, presented how. Daily loop: what’s out of stock → what’s ready to list → price/publish → storefront freshness. Bar: Shopify product admin fused with Blinkit’s per-store catalog tool.',
    see: [
      'Your hub’s listings with stock truth; what’s ready-to-list (reviewed samples).',
      'Cost floor + margin per listing; the storefront layout as customers see it.',
      'NOT other hubs — the hub-lock is enforced backend-side; keep to yours.',
    ],
    control: [
      'Listing CRUD + publish; price (above the floor); photos.',
      'Storefront CMS (collections / banners / categories / home); restock + fabric requests.',
      'NOT the fabric master, design content, or refunds.',
    ],
    handle: [
      'Sample→listing handoff (in), out-of-stock→restock (out to procurement), price/margin discipline (out to finance’s P&L).',
    ],
  },
  finance: {
    console: 'Finance',
    summary:
      'Finance closes the money loop: every rupee in (settlements, COD) and out (refunds) reconciled, margins visible, leakage caught. Daily loop: refunds to disburse → COD to confirm → settlement variance → margin watch. Bar: Stripe Dashboard’s balance/payouts + worklist discipline.',
    see: [
      'Refunds awaiting action; the COD chain (collected → deposited → confirmed).',
      'Settlement vs Razorpay; per-hub P&L; invoices; promo spend; fabric spend + listing margins.',
      'NOT customer PII beyond order context, or floor controls.',
    ],
    control: [
      'Refund disbursal (yours alone — SoD); COD deposit confirmation (finance owns it).',
      'Invoice generate/regenerate; promo lifecycle.',
      'NOT creating credits (support creates, finance approves > ₹500) or pricing listings.',
    ],
    handle: [
      'Support refund escalation → disburse; COD dispatch deposits → HM records → finance confirms; month-close numbers out to the founder/CA.',
    ],
  },
  support: {
    console: 'Support',
    summary:
      'Support is the brand’s voice after purchase: tickets, order context, returns/alterations intake, fit-failure rescue. Daily loop: open tickets → new returns/fit issues → aging breaches. Bar: Intercom/Zendesk inbox discipline + Shopify’s customer 360. You are CX-only — the floor belongs to ops.',
    see: [
      'Ticket queue with SLA ages; full customer 360 (orders, fit profiles, credit ledger, tickets).',
      'Order truth incl. stage + timeline; returns/alterations state; reviews + fit feedback.',
      'NOT floor actions, refund disbursal (finance’s), or other-role consoles.',
    ],
    control: [
      'Tickets (assign / status / reply); order CX verbs (note, hold, cancel-allowed-stages, link fit profile, invoice).',
      'Return review → route per policy; request re-measure; goodwill credits ≤ ₹500 (> ₹500 → finance).',
      'Review moderation.',
    ],
    handle: [
      'WhatsApp/call intake → ticket → resolution; fit failure → free alteration / re-measure; defect → return → finance refund handoff.',
    ],
  },
};

// Which console a role sees. Legacy full-access 'admin' → the oversight view.
export const ROLE_CONSOLE: Record<string, string> = {
  super_admin: 'super',
  admin: 'super',
  design: 'design',
  procurement: 'procurement',
  catalog_manager: 'catalog_manager',
  finance: 'finance',
  support: 'support',
};
