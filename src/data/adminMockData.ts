// ─── Admin Types ─────────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'admin_ops' | 'admin_finance' | 'admin_catalog' | 'admin_support';
export type OrderMode = 'Simplified';
export type LifecycleStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type OrderStage =
  | 'payment_pending' | 'payment_confirmed'
  | 'awaiting_measurement' | 'measurement_complete'
  | 'fabric_sourced' | 'in_tailoring' | 'quality_check'
  | 'ready_to_dispatch' | 'dispatched' | 'delivered'
  | 'return_requested' | 'returned';

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
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
  total: number;
  status: LifecycleStatus;
  overdue?: boolean;
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
  on_hold_reason?: string | null;
  cancellation_reason?: string | null;
}

export interface AdminUser {
  id: string;
  reference_id?: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  orders: number;
  credits: number;
  joined: string;
  status: 'Active' | 'Deactivated';
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
  qcPassRate: number;
  staffCount: number;
  tailorCount: number;
  qcCount: number;
  address: string;
  pincode: string;
  phone?: string;
  managerName: string;
  managerPhone: string;
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
  phone: string;
  subject: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo: string | null;
  created: string;
  lastActivity: string;
  messages?: TicketMessage[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  entityType: string;
  entityId: string;
  ip: string;
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
}


export interface ConfigItem {
  key: string;
  label: string;
  value: number | boolean | string;
  type: 'currency' | 'percentage' | 'days' | 'boolean' | 'hours' | 'number';
}

export interface ConfigGroup {
  title: string;
  items: ConfigItem[];
}
