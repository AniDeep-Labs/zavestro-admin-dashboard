// ─── Admin Types ─────────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'admin_ops' | 'admin_finance' | 'admin_catalog' | 'admin_support';
export type OrderMode = 'Simplified' | 'Luxe';
export type LifecycleStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type OrderStage =
  | 'payment_pending' | 'payment_confirmed' | 'fabric_sourced'
  | 'in_tailoring' | 'quality_check' | 'ready_to_dispatch'
  | 'dispatched' | 'delivered' | 'return_requested' | 'returned';

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
  uuid?: string;
  customer: string;
  phone: string;
  email?: string;
  user_id?: string;
  mode: OrderMode;
  products: string[];
  stage: OrderStage;
  hub: string;
  created: string;
  total: number;
  status: LifecycleStatus;
  overdue?: boolean;
  items?: OrderItem[];
  timeline?: OrderTimelineEntry[];
  payments?: OrderPayment[];
}

export interface AdminUser {
  id: string;
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
  customer: string;
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
  mode: 'Simplified' | 'Both';
  products: number;
  status: 'Active' | 'Draft' | 'Archived';
  sortOrder: number;
  hasBanner: boolean;
  season: string;
  updated: string;
}

export interface LuxeFabric {
  id: string;
  name: string;
  material: string;
  origin: string;
  occasions: string[];
  status: 'Active' | 'Draft' | 'Archived';
  featuredForSwatchKit: boolean;
  updated: string;
}

export interface ConsultationSlot {
  id: string;
  hub_id: string | null;
  slot_date: string;       // YYYY-MM-DD
  time_start: string;      // HH:MM
  time_end: string;        // HH:MM
  mode: 'in_person' | 'video';
  capacity: number;
  booked_count: number;
  created_at: string;
}

export type ConsultationStatus =
  | 'pending' | 'assigned' | 'scheduled' | 'consultation_done'
  | 'awaiting_design_approval' | 'awaiting_advance_payment' | 'design_approved';

export interface Consultation {
  id: string;
  customer: string;
  occasion: string;
  status: ConsultationStatus;
  stylist: string | null;
  hub: string | null;
  bookedSlot: string | null;
  createdAt: string;
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
