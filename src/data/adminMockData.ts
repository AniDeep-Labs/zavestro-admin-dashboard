// ─── Admin Mock Data ────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'admin_ops' | 'admin_finance' | 'admin_catalog' | 'admin_support';
export type OrderMode = 'Simplified' | 'Luxe';
export type LifecycleStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type OrderStage =
  | 'payment_pending' | 'payment_confirmed' | 'fabric_sourced'
  | 'in_tailoring' | 'quality_check' | 'ready_to_dispatch'
  | 'dispatched' | 'delivered' | 'return_requested' | 'returned';

export interface AdminOrder {
  id: string;
  customer: string;
  phone: string;
  mode: OrderMode;
  products: string[];
  stage: OrderStage;
  hub: string;
  created: string;
  total: number;
  status: LifecycleStatus;
  overdue?: boolean;
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
  managerName: string;
  managerPhone: string;
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
  signedUp: string;
  source: string;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export const adminOrders: AdminOrder[] = [
  { id: 'ZAV-20260413-003421', customer: 'Suraj Mehta', phone: '+91 98765 43210', mode: 'Simplified', products: ['Blue Oxford Shirt'], stage: 'in_tailoring', hub: 'Bengaluru Hub 1', created: '13 Apr 2026', total: 1599, status: 'active' },
  { id: 'ZAV-20260412-003410', customer: 'Priya Sharma', phone: '+91 99001 12345', mode: 'Luxe', products: ['Banarasi Silk Lehenga', 'Blouse'], stage: 'quality_check', hub: 'Mumbai Hub 1', created: '12 Apr 2026', total: 42000, status: 'active' },
  { id: 'ZAV-20260411-003398', customer: 'Rahul Verma', phone: '+91 87654 32109', mode: 'Simplified', products: ['Slim Fit Trouser'], stage: 'dispatched', hub: 'Bengaluru Hub 2', created: '11 Apr 2026', total: 999, status: 'active' },
  { id: 'ZAV-20260410-003385', customer: 'Ananya Iyer', phone: '+91 76543 21098', mode: 'Simplified', products: ['Kurta', 'Palazzo'], stage: 'delivered', hub: 'Bengaluru Hub 1', created: '10 Apr 2026', total: 2499, status: 'completed' },
  { id: 'ZAV-20260409-003370', customer: 'Vikram Singh', phone: '+91 65432 10987', mode: 'Luxe', products: ['Sherwani Set'], stage: 'payment_confirmed', hub: 'Delhi Hub 1', created: '9 Apr 2026', total: 28000, status: 'active', overdue: true },
  { id: 'ZAV-20260408-003355', customer: 'Meera Nair', phone: '+91 54321 09876', mode: 'Simplified', products: ['Cotton Kurti'], stage: 'delivered', hub: 'Chennai Hub 1', created: '8 Apr 2026', total: 899, status: 'completed' },
  { id: 'ZAV-20260407-003340', customer: 'Arjun Reddy', phone: '+91 43210 98765', mode: 'Simplified', products: ['Formal Shirt', 'Slim Trouser'], stage: 'fabric_sourced', hub: 'Hyderabad Hub 1', created: '7 Apr 2026', total: 2998, status: 'active' },
  { id: 'ZAV-20260406-003325', customer: 'Kavita Patel', phone: '+91 32109 87654', mode: 'Luxe', products: ['Bridal Lehenga'], stage: 'in_tailoring', hub: 'Mumbai Hub 1', created: '6 Apr 2026', total: 75000, status: 'active' },
  { id: 'ZAV-20260405-003310', customer: 'Deepak Kumar', phone: '+91 21098 76543', mode: 'Simplified', products: ['Linen Shirt'], stage: 'quality_check', hub: 'Bengaluru Hub 1', created: '5 Apr 2026', total: 1299, status: 'active' },
  { id: 'ZAV-20260404-003295', customer: 'Sunita Rao', phone: '+91 10987 65432', mode: 'Simplified', products: ['Kurta Set'], stage: 'delivered', hub: 'Bengaluru Hub 2', created: '4 Apr 2026', total: 1799, status: 'cancelled' },
];

// ─── Users ───────────────────────────────────────────────────────────────────

export const adminUsers: AdminUser[] = [
  { id: 'USR-001', name: 'Suraj Mehta', phone: '+91 98765 43210', email: 'suraj@example.com', city: 'Bengaluru', orders: 5, credits: 150, joined: '14 Apr 2026', status: 'Active' },
  { id: 'USR-002', name: 'Priya Sharma', phone: '+91 99001 12345', email: 'priya@example.com', city: 'Mumbai', orders: 3, credits: 0, joined: '10 Apr 2026', status: 'Active' },
  { id: 'USR-003', name: 'Rahul Verma', phone: '+91 87654 32109', email: 'rahul@example.com', city: 'Delhi', orders: 1, credits: 50, joined: '8 Apr 2026', status: 'Active' },
  { id: 'USR-004', name: 'Ananya Iyer', phone: '+91 76543 21098', email: 'ananya@example.com', city: 'Bengaluru', orders: 8, credits: 300, joined: '1 Mar 2026', status: 'Active' },
  { id: 'USR-005', name: 'Vikram Singh', phone: '+91 65432 10987', email: 'vikram@example.com', city: 'Delhi', orders: 2, credits: 0, joined: '5 Feb 2026', status: 'Active' },
  { id: 'USR-006', name: 'Meera Nair', phone: '+91 54321 09876', email: 'meera@example.com', city: 'Chennai', orders: 4, credits: 200, joined: '14 Jan 2026', status: 'Active' },
  { id: 'USR-007', name: 'Arjun Reddy', phone: '+91 43210 98765', email: 'arjun@example.com', city: 'Hyderabad', orders: 2, credits: 100, joined: '20 Dec 2025', status: 'Active' },
  { id: 'USR-008', name: 'Kavita Patel', phone: '+91 32109 87654', email: 'kavita@example.com', city: 'Mumbai', orders: 1, credits: 0, joined: '5 Apr 2026', status: 'Active' },
  { id: 'USR-009', name: 'Deepak Kumar', phone: '+91 21098 76543', email: 'deepak@example.com', city: 'Bengaluru', orders: 3, credits: 75, joined: '15 Mar 2026', status: 'Deactivated' },
  { id: 'USR-010', name: 'Sunita Rao', phone: '+91 10987 65432', email: 'sunita@example.com', city: 'Bengaluru', orders: 0, credits: 0, joined: '12 Apr 2026', status: 'Active' },
];

// ─── Hubs ────────────────────────────────────────────────────────────────────

export const adminHubs: Hub[] = [
  { id: 'HUB-001', name: 'Bengaluru Hub 1', city: 'Bengaluru', state: 'Karnataka', status: 'Active', activeOrders: 42, capacityUsed: 70, qcPassRate: 96, staffCount: 12, tailorCount: 8, qcCount: 2, address: '14, Industrial Layout, Rajajinagar', pincode: '560010', managerName: 'Priya Menon', managerPhone: '+91 98001 23456' },
  { id: 'HUB-002', name: 'Bengaluru Hub 2', city: 'Bengaluru', state: 'Karnataka', status: 'At Capacity', activeOrders: 60, capacityUsed: 100, qcPassRate: 94, staffCount: 10, tailorCount: 7, qcCount: 2, address: '22, Peenya Industrial Area, Phase 2', pincode: '560058', managerName: 'Ramesh Kumar', managerPhone: '+91 97002 34567' },
  { id: 'HUB-003', name: 'Mumbai Hub 1', city: 'Mumbai', state: 'Maharashtra', status: 'Active', activeOrders: 38, capacityUsed: 63, qcPassRate: 97, staffCount: 14, tailorCount: 10, qcCount: 2, address: '5, Dharavi Industrial Estate', pincode: '400017', managerName: 'Anjali Shah', managerPhone: '+91 96003 45678' },
  { id: 'HUB-004', name: 'Delhi Hub 1', city: 'Delhi', state: 'Delhi', status: 'Active', activeOrders: 25, capacityUsed: 50, qcPassRate: 93, staffCount: 9, tailorCount: 6, qcCount: 2, address: '8, Okhla Industrial Area, Phase 1', pincode: '110020', managerName: 'Manish Gupta', managerPhone: '+91 95004 56789' },
  { id: 'HUB-005', name: 'Chennai Hub 1', city: 'Chennai', state: 'Tamil Nadu', status: 'Active', activeOrders: 18, capacityUsed: 45, qcPassRate: 98, staffCount: 8, tailorCount: 5, qcCount: 2, address: '12, Guindy Industrial Estate', pincode: '600032', managerName: 'Kavitha Rajan', managerPhone: '+91 94005 67890' },
  { id: 'HUB-006', name: 'Hyderabad Hub 1', city: 'Hyderabad', state: 'Telangana', status: 'Inactive', activeOrders: 0, capacityUsed: 0, qcPassRate: 91, staffCount: 7, tailorCount: 5, qcCount: 1, address: '3, IDA Nacharam', pincode: '500076', managerName: 'Suresh Reddy', managerPhone: '+91 93006 78901' },
];

// ─── Products ─────────────────────────────────────────────────────────────────

export const adminProducts: Product[] = [
  { id: 'PRD-001', name: 'Oxford Shirt', sku: 'ZAV-SHT-001', mode: 'Simplified', category: 'Shirt', variants: 6, priceMin: 899, priceMax: 1299, status: 'Active', updated: '10 Apr 2026' },
  { id: 'PRD-002', name: 'Slim Fit Trouser', sku: 'ZAV-TRS-001', mode: 'Simplified', category: 'Trouser', variants: 4, priceMin: 999, priceMax: 1499, status: 'Active', updated: '9 Apr 2026' },
  { id: 'PRD-003', name: 'Straight Kurta', sku: 'ZAV-KRT-001', mode: 'Simplified', category: 'Kurta', variants: 8, priceMin: 699, priceMax: 1199, status: 'Active', updated: '8 Apr 2026' },
  { id: 'PRD-004', name: 'Palazzo Set', sku: 'ZAV-PLZ-001', mode: 'Simplified', category: 'Palazzo', variants: 5, priceMin: 1299, priceMax: 1999, status: 'Active', updated: '7 Apr 2026' },
  { id: 'PRD-005', name: 'Banarasi Silk Saree Blouse', sku: 'ZAV-BLZ-001', mode: 'Luxe', category: 'Blouse', variants: 3, priceMin: 5000, priceMax: 12000, status: 'Active', updated: '6 Apr 2026' },
  { id: 'PRD-006', name: 'Bridal Lehenga', sku: 'ZAV-LHG-001', mode: 'Luxe', category: 'Lehenga', variants: 4, priceMin: 35000, priceMax: 80000, status: 'Active', updated: '5 Apr 2026' },
  { id: 'PRD-007', name: 'Wedding Sherwani', sku: 'ZAV-SHW-001', mode: 'Luxe', category: 'Sherwani', variants: 3, priceMin: 15000, priceMax: 45000, status: 'Active', updated: '4 Apr 2026' },
  { id: 'PRD-008', name: 'Linen Casual Shirt', sku: 'ZAV-SHT-002', mode: 'Simplified', category: 'Shirt', variants: 5, priceMin: 799, priceMax: 1099, status: 'Active', updated: '3 Apr 2026' },
  { id: 'PRD-009', name: 'Anarkali Kurta', sku: 'ZAV-KRT-002', mode: 'Simplified', category: 'Kurta', variants: 6, priceMin: 1099, priceMax: 1799, status: 'Draft', updated: '2 Apr 2026' },
  { id: 'PRD-010', name: 'Classic Bandhgala', sku: 'ZAV-BDG-001', mode: 'Luxe', category: 'Bandhgala', variants: 2, priceMin: 12000, priceMax: 25000, status: 'Active', updated: '1 Apr 2026' },
];

// ─── Support Tickets ──────────────────────────────────────────────────────────

export const supportTickets: SupportTicket[] = [
  { id: 'T-0001234', customer: 'Suraj Mehta', phone: '+91 98765 XXXXX', subject: 'Order not updated after 5 days', category: 'Order & Delivery', priority: 'High', status: 'Open', assignedTo: null, created: '2h ago', lastActivity: '2h ago' },
  { id: 'T-0001233', customer: 'Priya Sharma', phone: '+91 99001 XXXXX', subject: 'Blouse stitching is too tight at shoulders', category: 'Fit & Alterations', priority: 'Medium', status: 'In Progress', assignedTo: 'Aarti S.', created: '5h ago', lastActivity: '1h ago' },
  { id: 'T-0001232', customer: 'Rahul Verma', phone: '+91 87654 XXXXX', subject: 'Payment deducted twice', category: 'Payment & Refund', priority: 'High', status: 'Open', assignedTo: null, created: '8h ago', lastActivity: '8h ago' },
  { id: 'T-0001231', customer: 'Ananya Iyer', phone: '+91 76543 XXXXX', subject: 'Fabric color different from catalog', category: 'Product Quality', priority: 'Medium', status: 'In Progress', assignedTo: 'Rohan K.', created: '1d ago', lastActivity: '3h ago' },
  { id: 'T-0001230', customer: 'Vikram Singh', phone: '+91 65432 XXXXX', subject: 'Return request not processed', category: 'Return & Exchange', priority: 'High', status: 'Open', assignedTo: null, created: '1d ago', lastActivity: '1d ago' },
  { id: 'T-0001229', customer: 'Meera Nair', phone: '+91 54321 XXXXX', subject: 'How do I add family member measurements?', category: 'General', priority: 'Low', status: 'Resolved', assignedTo: 'Aarti S.', created: '2d ago', lastActivity: '1d ago' },
  { id: 'T-0001228', customer: 'Arjun Reddy', phone: '+91 43210 XXXXX', subject: 'Tracking link not working', category: 'Order & Delivery', priority: 'Medium', status: 'Resolved', assignedTo: 'Rohan K.', created: '3d ago', lastActivity: '2d ago' },
];

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog: AuditEntry[] = [
  { id: 'AUD-001', timestamp: '26 Apr 2026, 11:45:22 AM', admin: 'admin@zavestro.com', action: "Order status updated to 'dispatched'", entityType: 'Order', entityId: 'ZAV-20260413-003421', ip: '49.205.XX.XX' },
  { id: 'AUD-002', timestamp: '26 Apr 2026, 10:30:15 AM', admin: 'admin_catalog@zavestro.com', action: "Product 'Oxford Shirt' status changed to Active", entityType: 'Product', entityId: 'PRD-001', ip: '49.205.XX.XX' },
  { id: 'AUD-003', timestamp: '26 Apr 2026, 9:12:08 AM', admin: 'admin@zavestro.com', action: "User 'Deepak Kumar' deactivated — Reason: Duplicate account", entityType: 'User', entityId: 'USR-009', ip: '49.205.XX.XX' },
  { id: 'AUD-004', timestamp: '25 Apr 2026, 5:45:00 PM', admin: 'admin_finance@zavestro.com', action: "Config 'delivery_fee_simplified' changed from ₹79 to ₹49", entityType: 'Config', entityId: 'delivery_fee_simplified', ip: '103.21.XX.XX' },
  { id: 'AUD-005', timestamp: '25 Apr 2026, 4:20:33 PM', admin: 'admin@zavestro.com', action: "Bulk status update: 12 orders moved to 'in_tailoring'", entityType: 'Order', entityId: 'BULK', ip: '49.205.XX.XX' },
  { id: 'AUD-006', timestamp: '25 Apr 2026, 2:10:00 PM', admin: 'admin_support@zavestro.com', action: "Support ticket #T-0001229 resolved", entityType: 'Support', entityId: 'T-0001229', ip: '182.70.XX.XX' },
  { id: 'AUD-007', timestamp: '25 Apr 2026, 11:00:45 AM', admin: 'admin_catalog@zavestro.com', action: "New product 'Anarkali Kurta' created as Draft", entityType: 'Product', entityId: 'PRD-009', ip: '49.205.XX.XX' },
  { id: 'AUD-008', timestamp: '24 Apr 2026, 6:30:12 PM', admin: 'admin@zavestro.com', action: "Promo code 'ZAVEFIT10' created — 10% off, expires 30 Apr 2026", entityType: 'Promo', entityId: 'PROMO-001', ip: '49.205.XX.XX' },
];

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export const waitlistEntries: WaitlistEntry[] = [
  { id: 'WL-001', name: 'Aditi Sharma', email: 'aditi@gmail.com', phone: '+91 98000 00001', city: 'Bengaluru', signedUp: '26 Apr 2026', source: 'Website' },
  { id: 'WL-002', name: 'Karan Mehta', email: 'karan@gmail.com', phone: '+91 97000 00002', city: 'Mumbai', signedUp: '25 Apr 2026', source: 'Referral' },
  { id: 'WL-003', name: 'Sneha Rao', email: 'sneha@gmail.com', phone: '+91 96000 00003', city: 'Delhi', signedUp: '25 Apr 2026', source: 'Website' },
  { id: 'WL-004', name: 'Rohit Agarwal', email: 'rohit@gmail.com', phone: '+91 95000 00004', city: 'Hyderabad', signedUp: '24 Apr 2026', source: 'App' },
  { id: 'WL-005', name: 'Pooja Nair', email: 'pooja@gmail.com', phone: '+91 94000 00005', city: 'Chennai', signedUp: '24 Apr 2026', source: 'Website' },
  { id: 'WL-006', name: 'Siddharth Jain', email: 'siddharth@gmail.com', phone: '+91 93000 00006', city: 'Pune', signedUp: '23 Apr 2026', source: 'Referral' },
  { id: 'WL-007', name: 'Neha Gupta', email: 'neha@gmail.com', phone: '+91 92000 00007', city: 'Bengaluru', signedUp: '23 Apr 2026', source: 'Website' },
  { id: 'WL-008', name: 'Amit Singh', email: 'amit@gmail.com', phone: '+91 91000 00008', city: 'Kolkata', signedUp: '22 Apr 2026', source: 'Website' },
  { id: 'WL-009', name: 'Divya Krishnan', email: 'divya@gmail.com', phone: '+91 90000 00009', city: 'Bengaluru', signedUp: '22 Apr 2026', source: 'App' },
  { id: 'WL-010', name: 'Manish Tiwari', email: 'manish@gmail.com', phone: '+91 89000 00010', city: 'Delhi', signedUp: '21 Apr 2026', source: 'Referral' },
];

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export const dashboardStats = {
  totalOrders: { value: 1247, trend: '+15%', up: true },
  activeOrders: { value: 183, trend: '+8%', up: true },
  gmv: { value: 2840000, trend: '+22%', up: true },
  pendingPayments: { value: 12, trend: '-5%', up: false },
  openTickets: { value: 28, trend: '+3%', up: false },
  newCustomers: { value: 94, trend: '+31%', up: true },
};

export const hubPerformance = [
  { name: 'Bengaluru Hub 1', orders: 42, capacity: 70 },
  { name: 'Bengaluru Hub 2', orders: 60, capacity: 100 },
  { name: 'Mumbai Hub 1', orders: 38, capacity: 63 },
  { name: 'Delhi Hub 1', orders: 25, capacity: 50 },
  { name: 'Chennai Hub 1', orders: 18, capacity: 45 },
];

export const alerts = [
  { level: 'red', text: '3 orders overdue (>2 days past deadline)', link: '/admin/orders?filter=overdue' },
  { level: 'red', text: '2 pending payment retries > 48h', link: '/admin/orders?filter=payment_pending' },
  { level: 'yellow', text: 'Bengaluru Hub 2 at capacity — orders blocked', link: '/admin/hubs' },
  { level: 'yellow', text: '5 support tickets unassigned > 24h', link: '/admin/support?filter=unassigned' },
  { level: 'yellow', text: '3 fabrics at low stock across hubs', link: '/admin/hubs' },
];

export const recentActivity = [
  { icon: '📦', text: "Order #ZAV-20260413-003421 created by Suraj Mehta", time: '2m ago' },
  { icon: '🏷️', text: "Catalog: Product 'Blue Oxford Shirt' updated by admin_catalog@zavestro.com", time: '15m ago' },
  { icon: '💳', text: "Payment confirmed for Order #ZAV-20260412-003410 — ₹42,000", time: '1h ago' },
  { icon: '👤', text: "New customer registered: Pooja Nair (Chennai)", time: '2h ago' },
  { icon: '⚠️', text: "Payment retry failed for Order #ZAV-20260409-003370", time: '3h ago' },
  { icon: '✅', text: "Order #ZAV-20260408-003355 delivered", time: '5h ago' },
];

// ─── Collections ─────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  slug: string;
  mode: 'Simplified' | 'Luxe' | 'Both';
  products: number;
  status: 'Active' | 'Draft' | 'Archived';
  sortOrder: number;
  hasBanner: boolean;
  season: string;
  updated: string;
}

export const adminCollections: Collection[] = [
  { id: 'COL-001', name: 'Wedding Season 2026', slug: 'wedding-season-2026', mode: 'Both', products: 12, status: 'Active', sortOrder: 1, hasBanner: true, season: 'Wedding Season 2026', updated: '20 Apr 2026' },
  { id: 'COL-002', name: 'Office Essentials', slug: 'office-essentials', mode: 'Simplified', products: 8, status: 'Active', sortOrder: 2, hasBanner: true, season: 'Everyday Wear', updated: '15 Apr 2026' },
  { id: 'COL-003', name: 'Festive Glow', slug: 'festive-glow', mode: 'Both', products: 15, status: 'Active', sortOrder: 3, hasBanner: true, season: 'Festive 2026', updated: '10 Apr 2026' },
  { id: 'COL-004', name: 'Summer Linens', slug: 'summer-linens', mode: 'Simplified', products: 6, status: 'Draft', sortOrder: 4, hasBanner: false, season: 'Summer 2026', updated: '5 Apr 2026' },
  { id: 'COL-005', name: 'The Luxe Edit', slug: 'the-luxe-edit', mode: 'Luxe', products: 5, status: 'Active', sortOrder: 5, hasBanner: true, season: 'Bespoke 2026', updated: '1 Apr 2026' },
];

// ─── Luxe Fabrics ─────────────────────────────────────────────────────────────

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

export const luxeFabrics: LuxeFabric[] = [
  { id: 'LXF-001', name: 'Banarasi Silk — Ivory', material: 'Banarasi', origin: 'Varanasi, UP', occasions: ['Wedding', 'Festive'], status: 'Active', featuredForSwatchKit: true, updated: '20 Apr 2026' },
  { id: 'LXF-002', name: 'Organza — Blush Pink', material: 'Organza', origin: 'Surat, Gujarat', occasions: ['Wedding', 'Celebration'], status: 'Active', featuredForSwatchKit: true, updated: '18 Apr 2026' },
  { id: 'LXF-003', name: 'Handloom Cotton — Indigo', material: 'Handloom', origin: 'Pochampally, Telangana', occasions: ['Formal', 'Festive'], status: 'Active', featuredForSwatchKit: false, updated: '15 Apr 2026' },
  { id: 'LXF-004', name: 'Raw Silk — Champagne', material: 'Silk', origin: 'Mysore, Karnataka', occasions: ['Wedding', 'Festive', 'Celebration'], status: 'Active', featuredForSwatchKit: true, updated: '12 Apr 2026' },
  { id: 'LXF-005', name: 'Velvet — Deep Burgundy', material: 'Velvet', origin: 'Surat, Gujarat', occasions: ['Festive', 'Celebration'], status: 'Active', featuredForSwatchKit: false, updated: '10 Apr 2026' },
  { id: 'LXF-006', name: 'Chanderi Silk — Mint', material: 'Silk', origin: 'Chanderi, MP', occasions: ['Formal', 'Festive'], status: 'Draft', featuredForSwatchKit: false, updated: '5 Apr 2026' },
  { id: 'LXF-007', name: 'Georgette — Navy', material: 'Georgette', origin: 'Surat, Gujarat', occasions: ['Formal', 'Wedding'], status: 'Active', featuredForSwatchKit: false, updated: '1 Apr 2026' },
];

// ─── Consultation Slots ───────────────────────────────────────────────────────

export interface ConsultationSlot {
  id: string;
  date: string;
  time: string;
  dayOfWeek: string;
  maxBookings: number;
  booked: number;
}

export const consultationSlots: ConsultationSlot[] = [
  { id: 'SLT-001', date: '28 Apr 2026', time: '10:00 AM', dayOfWeek: 'Tue', maxBookings: 2, booked: 1 },
  { id: 'SLT-002', date: '28 Apr 2026', time: '11:00 AM', dayOfWeek: 'Tue', maxBookings: 2, booked: 2 },
  { id: 'SLT-003', date: '28 Apr 2026', time: '2:00 PM', dayOfWeek: 'Tue', maxBookings: 2, booked: 0 },
  { id: 'SLT-004', date: '29 Apr 2026', time: '10:00 AM', dayOfWeek: 'Wed', maxBookings: 2, booked: 0 },
  { id: 'SLT-005', date: '29 Apr 2026', time: '11:00 AM', dayOfWeek: 'Wed', maxBookings: 2, booked: 1 },
  { id: 'SLT-006', date: '30 Apr 2026', time: '10:00 AM', dayOfWeek: 'Thu', maxBookings: 2, booked: 2 },
  { id: 'SLT-007', date: '30 Apr 2026', time: '3:00 PM', dayOfWeek: 'Thu', maxBookings: 2, booked: 0 },
  { id: 'SLT-008', date: '2 May 2026', time: '10:00 AM', dayOfWeek: 'Sat', maxBookings: 3, booked: 1 },
  { id: 'SLT-009', date: '2 May 2026', time: '11:00 AM', dayOfWeek: 'Sat', maxBookings: 3, booked: 2 },
  { id: 'SLT-010', date: '2 May 2026', time: '2:00 PM', dayOfWeek: 'Sat', maxBookings: 3, booked: 0 },
  { id: 'SLT-011', date: '3 May 2026', time: '10:00 AM', dayOfWeek: 'Sun', maxBookings: 3, booked: 0 },
  { id: 'SLT-012', date: '3 May 2026', time: '11:00 AM', dayOfWeek: 'Sun', maxBookings: 3, booked: 1 },
];

// ─── Consultations ────────────────────────────────────────────────────────────

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

export const adminConsultations: Consultation[] = [
  { id: 'CONS-001', customer: 'Kavita Patel', occasion: 'Wedding', status: 'assigned', stylist: 'Priya — Bengaluru Hub 1', hub: 'Bengaluru Hub 1', bookedSlot: '2 May 2026, 11:00 AM', createdAt: '20 Apr 2026' },
  { id: 'CONS-002', customer: 'Priya Sharma', occasion: 'Wedding', status: 'consultation_done', stylist: 'Anjali — Mumbai Hub 1', hub: 'Mumbai Hub 1', bookedSlot: '25 Apr 2026, 2:00 PM', createdAt: '18 Apr 2026' },
  { id: 'CONS-003', customer: 'Vikram Singh', occasion: 'Festive', status: 'pending', stylist: null, hub: null, bookedSlot: null, createdAt: '24 Apr 2026' },
  { id: 'CONS-004', customer: 'Ananya Iyer', occasion: 'Wedding', status: 'pending', stylist: null, hub: null, bookedSlot: null, createdAt: '23 Apr 2026' },
  { id: 'CONS-005', customer: 'Deepak Kumar', occasion: 'Formal', status: 'design_approved', stylist: 'Rajan — Chennai Hub 1', hub: 'Chennai Hub 1', bookedSlot: '15 Apr 2026, 10:00 AM', createdAt: '10 Apr 2026' },
  { id: 'CONS-006', customer: 'Sunita Rao', occasion: 'Celebration', status: 'awaiting_design_approval', stylist: 'Priya — Bengaluru Hub 1', hub: 'Bengaluru Hub 1', bookedSlot: '22 Apr 2026, 3:00 PM', createdAt: '15 Apr 2026' },
];

// ─── App Config ───────────────────────────────────────────────────────────────

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

export const appConfig: ConfigGroup[] = [
  {
    title: 'Delivery Fees',
    items: [
      { key: 'delivery_fee_simplified', label: 'Simplified Delivery Fee', value: 79, type: 'currency' },
      { key: 'delivery_fee_free_threshold_simplified', label: 'Free Delivery Threshold (Simplified)', value: 999, type: 'currency' },
      { key: 'delivery_fee_luxe', label: 'Luxe Delivery Fee', value: 0, type: 'currency' },
    ],
  },
  {
    title: 'Feature Flags',
    items: [
      { key: 'home_visit_enabled', label: 'Home Visit Booking', value: true, type: 'boolean' },
      { key: 'luxe_prime_enabled', label: 'Luxe Prime Mode', value: true, type: 'boolean' },
      { key: 'referral_program_enabled', label: 'Referral Program', value: true, type: 'boolean' },
      { key: 'credits_enabled', label: 'Credits System', value: true, type: 'boolean' },
      { key: 'swatch_kit_enabled', label: 'Swatch Kit Ordering', value: false, type: 'boolean' },
      { key: 'fit_quiz_ml_enabled', label: 'ML-Powered Fit Quiz', value: false, type: 'boolean' },
    ],
  },
  {
    title: 'Production Thresholds',
    items: [
      { key: 'simplified_production_days_target', label: 'Simplified Target (Days)', value: 8, type: 'days' },
      { key: 'luxe_production_days_min', label: 'Luxe Minimum Days', value: 15, type: 'days' },
      { key: 'luxe_production_days_max', label: 'Luxe Maximum Days', value: 25, type: 'days' },
      { key: 'fabric_low_stock_threshold_meters', label: 'Fabric Low Stock Threshold (m)', value: 5, type: 'number' },
    ],
  },
  {
    title: 'Payment',
    items: [
      { key: 'emi_min_order_value', label: 'EMI Minimum Order Value', value: 3000, type: 'currency' },
      { key: 'luxe_advance_payment_percentage', label: 'Luxe Advance Payment', value: 50, type: 'percentage' },
      { key: 'swatch_deposit_amount', label: 'Swatch Deposit Amount', value: 299, type: 'currency' },
      { key: 'swatch_deposit_validity_days', label: 'Swatch Deposit Validity', value: 15, type: 'days' },
    ],
  },
  {
    title: 'Credits',
    items: [
      { key: 'credits_fit_feedback_amount', label: 'Fit Feedback Reward', value: 50, type: 'currency' },
      { key: 'credits_referral_referrer_amount', label: 'Referrer Reward', value: 100, type: 'currency' },
      { key: 'credits_referral_referee_amount', label: 'Referee Reward', value: 50, type: 'currency' },
      { key: 'credits_expiry_days', label: 'Credits Expiry', value: 365, type: 'days' },
    ],
  },
  {
    title: 'Support',
    items: [
      { key: 'support_response_sla_hours', label: 'Response SLA', value: 24, type: 'hours' },
      { key: 'fit_feedback_prompt_delay_hours', label: 'Fit Feedback Prompt Delay', value: 2, type: 'hours' },
    ],
  },
];
