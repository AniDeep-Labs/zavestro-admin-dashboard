// ─── Admin Types ─────────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'admin_ops' | 'admin_finance' | 'admin_catalog' | 'admin_support';
export type OrderMode = 'Simplified';
export type LifecycleStatus = 'pending' | 'active' | 'completed' | 'cancelled';
// Canonical stages per backend shared/constants/order-transitions.ts, plus the
// legacy aliases still present in old rows (payment_pending, ready_to_dispatch,
// dispatched, return_requested, returned). StatusBadge maps both sets.
export type OrderStage =
  | 'pending_payment' | 'payment_pending' | 'payment_confirmed'
  | 'awaiting_measurement' | 'measurement_complete'
  | 'fabric_sourcing' | 'fabric_sourced' | 'cutting'
  | 'in_tailoring' | 'quality_check' | 'rework'
  | 'ready_for_dispatch' | 'ready_to_dispatch' | 'shipped' | 'dispatched'
  | 'delivered' | 'delivery_failed' | 'rto'
  | 'cancelled' | 'refunded' | 'return_requested' | 'returned';

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cancelled_at?: string | null; // T2-8: item-level cancel
  cancel_reason?: string | null;
}

export interface OrderTimelineEntry {
  id: string;
  to_stage: string;
  note: string | null;
  event_type?: string;
  changed_by_email?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface OrderPayment {
  id: string;
  payment_method: string | null;
  payment_gateway_id: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  reference_id?: string;
  uuid?: string;
  customer: string;
  customer_ref?: string;
  phone: string;
  email?: string;
  user_id?: string;
  mode: OrderMode;
  products: string[];
  stage: OrderStage;
  hub: string;
  hub_id?: string;
  created: string;
  /** ISO timestamp of the last update — drives the age-in-stage column */
  updated_at?: string | null;
  payment_method?: string | null;
  total: number;
  status: LifecycleStatus;
  overdue?: boolean;
  // T2-17 exception ownership (populated in the stuck view; null when unowned/elsewhere)
  stuck_hours?: number | null;
  exception_owner?: string | null;
  exception_owner_id?: string | null;
  exception_claimed_at?: string | null;
  exception_resolves_at?: string | null;
  items?: OrderItem[];
  timeline?: OrderTimelineEntry[];
  payments?: OrderPayment[];
  craftsperson_id?: string | null;
  craftsperson_name?: string | null;
  craftsperson_role?: string | null;
  craftsperson_ref?: string | null;
  qc_staff_id?: string | null;
  qc_staff_name?: string | null;
  qc_staff_role?: string | null;
  qc_staff_ref?: string | null;
  linked_measurement_booking_id?: string | null;
  linked_measurement_booking_ref?: string | null;
  linked_home_visit_id?: string | null;
  linked_home_visit_ref?: string | null;
  fit_profile_id?: string | null;
  estimated_delivery_date?: string | null;
  // T1-20: computed fallback (created_at + SLA) shown when no manual date is set.
  computed_delivery_date?: string | null;
  delivery_sla_days?: number | null;
  on_hold_reason?: string | null;
  cancellation_reason?: string | null;
  // T1-15: delivery address (support-editable pre-dispatch)
  delivery_address?: {
    name?: string;
    phone?: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
}

export interface AdminUser {
  id: string;
  reference_id?: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  orders: number;
  ltv: number; // T2-35 (SP-6): realized lifetime value (₹, excl. cancelled/refunded)
  credits: number;
  joined: string;
  status: 'Active' | 'Deactivated';
  // T2-35 (SP-6): fit-outcome counts for delivered orders (detail endpoint only).
  fit_outcomes?: Record<string, number>;
}

export interface Hub {
  id: string;
  reference_id?: string;
  name: string;
  city: string;
  state: string;
  status: 'Active' | 'Inactive' | 'At Capacity' | 'Critical';
  activeOrders: number;
  capacityUsed: number;
  /** [SHL-4-2] null = not yet measured. Never default to a number. */
  qcPassRate: number | null;
  staffCount: number;
  tailorCount: number;
  qcCount: number;
  address: string;
  pincode: string;
  phone?: string;
  managerName: string;
  managerPhone: string;
  managerStaffId?: string | null; // T2-24: hub manager as a real staff relation
  dailyOrderLimit?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  mode: OrderMode;
  category: string;
  variants: number;
  priceMin: number;
  priceMax: number;
  status: 'Active' | 'Draft' | 'Archived';
  updated: string;
}

export interface TicketMessage {
  id: string;
  sender_type: 'customer' | 'staff' | 'system';
  sender_id: string | null;
  body: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  reference_id?: string;
  customer: string;
  customer_ref?: string;
  user_id?: string | null;
  order_id?: string | null;
  phone: string;
  subject: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo: string | null;
  created: string;
  lastActivity: string;
  messages?: TicketMessage[];
  // T2-30 (SP-3) inbox worklist fields — present only from supportApi.inbox().
  waitingHours?: number; // hours since the last customer message (drives the SLA chip)
  lastSender?: "customer" | "staff" | null;
  snoozeUntil?: string | null; // T3-3 (W-S3): follow-up / snooze time
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  entityType: string;
  entityId: string;
  ip: string;
  details?: unknown; // T2-22: the audit row's jsonb detail (reason, before/after, etc.)
}

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  signedUp?: string;
  created_at?: string;
  source: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  products: number;
  status: 'Active' | 'Draft' | 'Archived';
  sortOrder: number;
  hasBanner: boolean;
  season: string;
  updated: string;
  type?: 'standard' | 'new_arrivals' | 'occasion' | 'featured';
  subtitle?: string;
  bg_color_1?: string;
  bg_color_2?: string;
  is_featured?: boolean;
  // Collection studio — design the card + landing hero.
  card_layout?: string;
  hero_layout?: string;
  card_aspect?: number;
  hero_aspect?: number;
  card_focal_x?: number;
  card_focal_y?: number;
  hero_focal_x?: number;
  hero_focal_y?: number;
  image_fit?: 'cover' | 'contain';
  image_zoom?: number;
  text_position?: 'left' | 'center' | 'bottom';
  text_color?: 'light' | 'dark';
  overlay?: number;
  gradient_angle?: number;
  gradient_solid?: boolean;
  logo_key?: string | null;
  cta_text?: string;
  compose_style?: Record<string, unknown>;
}


export interface ConfigItem {
  key: string;
  label: string;
  value: number | boolean | string;
  type: 'currency' | 'percentage' | 'days' | 'boolean' | 'hours' | 'number';
  // T2-25: registry metadata + last-changed
  description?: string | null;
  min?: number | null;
  max?: number | null;
  dangerous?: boolean;
  updatedByEmail?: string | null;
  updatedAt?: string | null;
}

export interface ConfigGroup {
  title: string;
  items: ConfigItem[];
}
