import { getAdminToken, clearAdminToken } from './catalogApi';
import type {
  AdminOrder, AdminUser, Hub, SupportTicket, TicketMessage, AuditEntry,
  WaitlistEntry, ConfigGroup, ConfigItem, OrderStage,
  Collection,
  OrderItem, OrderTimelineEntry, OrderPayment,
} from '../data/adminMockData';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.zavestro.in';
const USER_KEY = 'zavestro_admin_user';

// ─── User info helpers ────────────────────────────────────────────────────────

export function setAdminUser(user: { email: string; role: string }) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAdminUser(): { email: string; role: string } | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

export function clearAdminUser() {
  localStorage.removeItem(USER_KEY);
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isForm ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) {
      clearAdminToken();
      clearAdminUser();
      const err = new Error('Session expired. Please log in again.') as Error & { status: number };
      err.status = 401;
      throw err;
    }
    let msg = `Error ${res.status}`;
    try { const b = await res.json(); msg = b.message || b.error?.message || b.error || msg; } catch { /* */ }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    console.error(`[adminApi] ${init.method ?? 'GET'} ${path} → ${res.status}:`, msg);
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const adminAuth = {
  logout: async () => {
    try { await req('/api/admin/auth/logout', { method: 'POST' }); } catch { /* */ }
    clearAdminToken();
    clearAdminUser();
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

type StatShape = { value: number; trend: string; up: boolean };

export interface DashboardData {
  stats: Record<string, StatShape>;
  hubPerformance: { name: string; orders: number; capacity: number; qcPassRate: number }[];
  alerts: { level: string; text: string; link: string }[];
  recentActivity: { icon: string; text: string; time: string }[];
  revenue: { label: string; simplified: number }[];
  ordersByStage: { stage: string; label: string; count: number; overdue: number }[];
  waitlist: { total: number; trend: string; up: boolean };
  urgentTickets: { id: string; customer: string; subject: string; created: string }[];
  overdueOrders: { id: string; customer: string; stage: string; hub: string; created: string }[];
  sparklines: Record<string, number[]>;
}

export const dashboardApi = {
  get: async (period = 'month', signal?: AbortSignal): Promise<DashboardData> =>
    req<DashboardData>(`/api/admin/analytics/dashboard?period=${period}`, { signal }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrdersParams { search?: string; stage?: string; mode?: string; userId?: string; page?: number; limit?: number; }
export interface OrdersResponse { orders: AdminOrder[]; total: number; page: number; totalPages: number; }

export const ordersApi = {
  list: async (params: OrdersParams = {}): Promise<OrdersResponse> => {
    const qs = new URLSearchParams();
    if (params.search)  qs.set('search',  params.search);
    if (params.stage)   qs.set('stage',   params.stage);
    if (params.mode)    qs.set('mode',    params.mode);
    if (params.userId)  qs.set('user_id', params.userId);
    if (params.page)    qs.set('page',    String(params.page));
    if (params.limit)   qs.set('limit',   String(params.limit));
    return req<OrdersResponse>(`/api/admin/orders?${qs}`);
  },

  get: async (id: string): Promise<AdminOrder> => {
    type DetailResp = { order: Record<string, unknown>; items: OrderItem[]; timeline: OrderTimelineEntry[]; payments: OrderPayment[] };
    const data = await req<DetailResp>(`/api/admin/orders/${id}`);
    const o = data.order;
    return {
      id: (o.order_number ?? o.id) as string,
      uuid: o.id as string,
      customer: (o.customer_name ?? '') as string,
      phone: (o.customer_phone ?? '') as string,
      email: (o.customer_email ?? '') as string,
      user_id: o.user_id as string,
      mode: 'Simplified' as AdminOrder['mode'],
      stage: o.stage as OrderStage,
      status: o.lifecycle_status as AdminOrder['status'],
      hub: (o.hub_name ?? '') as string,
      total: parseFloat(String(o.total_amount ?? 0)),
      products: (data.items ?? []).map(it => it.product_name).filter(Boolean),
      created: new Date(o.created_at as string).toLocaleDateString('en-IN'),
      items: data.items ?? [],
      timeline: data.timeline ?? [],
      payments: data.payments ?? [],
    };
  },

  updateStage: async (id: string, stage: OrderStage, reason?: string): Promise<Pick<AdminOrder, 'stage' | 'status'>> => {
    const o = await req<Record<string, unknown>>(`/api/admin/orders/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage, reason }) });
    return { stage: o.stage as OrderStage, status: o.lifecycle_status as AdminOrder['status'] };
  },

  create: async (data: {
    user_id: string;
    hub_id: string;
    mode: 'simplified';
    delivery_address: { line1: string; line2?: string; city: string; state: string; pincode: string };
    items: { variant_id?: string; product_name: string; unit_price: number; quantity: number }[];
    payment_method?: 'cod' | 'offline_transfer' | 'already_paid';
    internal_note?: string;
  }): Promise<{ id: string; order_number: string }> =>
    req<{ id: string; order_number: string }>('/api/admin/orders', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UsersParams { search?: string; status?: string; city?: string; page?: number; limit?: number; }
export interface UsersResponse { users: AdminUser[]; total: number; page: number; totalPages: number; }

function mapUser(u: Record<string, unknown>): AdminUser {
  return {
    id: u.id as string,
    name: (u.name ?? '') as string,
    phone: (u.phone ?? '') as string,
    email: (u.email ?? '') as string,
    city: (u.city ?? '') as string,
    orders: (u.order_count ?? u.orders ?? 0) as number,
    credits: Math.round(parseFloat(String(u.credits ?? u.wallet_balance ?? 0))),
    joined: u.created_at ? new Date(u.created_at as string).toLocaleDateString('en-IN') : ((u.joined ?? '') as string),
    status: (u.is_active !== undefined ? (u.is_active ? 'Active' : 'Deactivated') : (u.status ?? 'Active')) as AdminUser['status'],
  };
}

export const usersApi = {
  list: async (params: UsersParams = {}): Promise<UsersResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    const raw = await req<{ users: Record<string, unknown>[]; total: number; page: number; totalPages: number }>(`/api/admin/users?${qs}`);
    return {
      users: (raw.users ?? []).map(mapUser),
      total: raw.total,
      page: raw.page,
      totalPages: raw.totalPages,
    };
  },

  get: async (id: string): Promise<AdminUser> => {
    const u = await req<Record<string, unknown>>(`/api/admin/users/${id}`);
    return mapUser(u);
  },

  update: async (id: string, data: Partial<AdminUser>): Promise<AdminUser> => {
    const body: Record<string, unknown> = {};
    if (data.status !== undefined) body.is_active = data.status === 'Active';
    const u = await req<Record<string, unknown>>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return mapUser(u);
  },

  create: async (data: { phone: string; name?: string; email?: string; generate_password?: boolean }): Promise<AdminUser & { temp_password?: string }> => {
    const raw = await req<Record<string, unknown>>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
    return { ...mapUser(raw), temp_password: raw.temp_password as string | undefined };
  },

  issueCredits: async (id: string, amount: number, reason: string): Promise<void> =>
    req(`/api/admin/users/${id}/credits`, { method: 'POST', body: JSON.stringify({ amount, reason }) }),

  addNote: async (id: string, note: string): Promise<void> =>
    req(`/api/admin/users/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),
};

// ─── Hubs ─────────────────────────────────────────────────────────────────────

export interface HubsParams { search?: string; city?: string; status?: string; page?: number; limit?: number; }
export interface HubsResponse { hubs: Hub[]; total: number; }

function mapHub(h: Record<string, unknown>): Hub {
  const activeOrders = (h.activeOrders ?? h.active_orders ?? 0) as number;
  const staffCount   = (h.staffCount   ?? h.staff_count   ?? 0) as number;
  const tailorCount  = (h.tailorCount  ?? h.tailor_count  ?? 0) as number;
  const qcCount      = (h.qcCount      ?? h.qc_count      ?? 0) as number;
  const capacityUsed = staffCount > 0 ? Math.min(100, Math.round((activeOrders / staffCount) * 20)) : 0;
  return {
    id:           h.id as string,
    name:         (h.name as string) ?? '',
    city:         (h.city as string) ?? '',
    state:        (h.state as string) ?? '',
    address:      (h.address as string) ?? '',
    pincode:      (h.pincode as string) ?? '',
    phone:        (h.phone as string) ?? '',
    status:       ((h.status ?? (h.is_active ? 'Active' : 'Inactive')) as Hub['status']),
    activeOrders,
    staffCount,
    tailorCount,
    qcCount,
    capacityUsed,
    qcPassRate:   (h.qcPassRate as number) ?? 100,
    managerName:  (h.managerName ?? h.manager_name ?? '') as string,
    managerPhone: (h.managerPhone ?? h.manager_phone ?? '') as string,
  };
}

export interface HubPincode {
  id: string;
  pincode: string;
  area_name: string;
  city?: string;
  is_active: boolean;
  created_at: string;
}

export const hubPincodesApi = {
  list: async (hubId: string): Promise<HubPincode[]> =>
    req<{ pincodes: HubPincode[] }>(`/api/admin/hubs/${hubId}/pincodes`).then(r => r.pincodes ?? []),

  add: async (hubId: string, pincodes: { pincode: string; area_name: string }[]): Promise<{ added: HubPincode[] }> =>
    req<{ added: HubPincode[] }>(`/api/admin/hubs/${hubId}/pincodes`, { method: 'POST', body: JSON.stringify({ pincodes }) }),

  toggle: async (hubId: string, pincodeId: string, is_active: boolean): Promise<HubPincode> =>
    req<HubPincode>(`/api/admin/system/service-pincodes/${pincodeId}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),

  remove: async (hubId: string, pincode: string): Promise<void> =>
    req(`/api/admin/hubs/${hubId}/pincodes/${encodeURIComponent(pincode)}`, { method: 'DELETE' }),
};

export const hubsApi = {
  list: async (params: HubsParams = {}): Promise<HubsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.city)   qs.set('city',   params.city);
    if (params.status) qs.set('status', params.status);
    const raw = await req<{ hubs: Record<string, unknown>[]; total: number }>(`/api/admin/hubs?${qs}`);
    return { hubs: (raw.hubs ?? []).map(mapHub), total: raw.total ?? 0 };
  },

  get: async (id: string): Promise<Hub> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/hubs/${id}`);
    return mapHub(raw);
  },

  create: async (data: Partial<Hub>): Promise<Hub> => {
    const { status, managerName, managerPhone, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (status !== undefined) body.is_active = status === 'Active';
    if (managerName !== undefined) body.manager_name = managerName;
    if (managerPhone !== undefined) body.manager_phone = managerPhone;
    const raw = await req<Record<string, unknown>>('/api/admin/hubs', { method: 'POST', body: JSON.stringify(body) });
    return mapHub(raw);
  },

  update: async (id: string, data: Partial<Hub>): Promise<Hub> => {
    const { status, managerName, managerPhone, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (status !== undefined) body.is_active = status === 'Active';
    if (managerName !== undefined) body.manager_name = managerName;
    if (managerPhone !== undefined) body.manager_phone = managerPhone;
    const raw = await req<Record<string, unknown>>(`/api/admin/hubs/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    return mapHub(raw);
  },
};

// ─── Support ──────────────────────────────────────────────────────────────────

export interface TicketsParams { search?: string; status?: string; priority?: string; page?: number; limit?: number; }
export interface TicketsResponse { tickets: SupportTicket[]; total: number; page: number; totalPages: number; }

function mapTicket(t: Record<string, unknown>): SupportTicket {
  const STATUS_MAP: Record<string, SupportTicket['status']> = {
    open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
  };
  const PRIORITY_MAP: Record<string, SupportTicket['priority']> = {
    urgent: 'High', high: 'High', normal: 'Medium', medium: 'Medium', low: 'Low',
  };
  return {
    id: t.id as string,
    customer: (t.customer_name ?? t.customer ?? '') as string,
    phone: (t.customer_phone ?? t.phone ?? '') as string,
    subject: (t.subject ?? '') as string,
    category: (t.category ?? 'General') as string,
    priority: (PRIORITY_MAP[t.priority as string] ?? (t.priority as SupportTicket['priority']) ?? 'Medium'),
    status: (STATUS_MAP[t.status as string] ?? (t.status as SupportTicket['status']) ?? 'Open'),
    assignedTo: (t.assigned_to ?? t.assignedTo ?? null) as string | null,
    created: t.created_at ? new Date(t.created_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : (t.created as string) ?? '',
    lastActivity: t.updated_at ? new Date(t.updated_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : (t.lastActivity as string) ?? '',
    messages: (t.messages as SupportTicket['messages']) ?? undefined,
  };
}

export const supportApi = {
  create: async (data: Record<string, any>): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>('/api/admin/support', { method: 'POST', body: JSON.stringify(data) });
    return mapTicket(raw);
  },

  list: async (params: TicketsParams = {}): Promise<TicketsResponse> => {
    const qs = new URLSearchParams();
    if (params.search)   qs.set('search',   params.search);
    if (params.status)   qs.set('status',   params.status);
    if (params.priority) qs.set('priority', params.priority);
    if (params.page)     qs.set('page',     String(params.page));
    if (params.limit)    qs.set('limit',    String(params.limit));
    const raw = await req<{ tickets: Record<string, unknown>[]; total: number; page: number; totalPages: number }>(`/api/admin/support?${qs}`);
    return { ...raw, tickets: raw.tickets.map(mapTicket) };
  },

  get: async (id: string): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/support/${id}`);
    return mapTicket(raw);
  },

  update: async (id: string, data: Partial<SupportTicket>): Promise<SupportTicket> => {
    const STATUS_TO_DB: Record<string, string> = { 'Open': 'open', 'In Progress': 'in_progress', 'Resolved': 'resolved', 'Closed': 'closed' };
    const PRIORITY_TO_DB: Record<string, string> = { 'High': 'high', 'Medium': 'normal', 'Low': 'low' };
    const body: Record<string, unknown> = { ...data };
    if (data.status && STATUS_TO_DB[data.status]) body.status = STATUS_TO_DB[data.status];
    if (data.priority && PRIORITY_TO_DB[data.priority]) body.priority = PRIORITY_TO_DB[data.priority];
    const raw = await req<Record<string, unknown>>(`/api/admin/support/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return mapTicket(raw);
  },

  addReply: async (id: string, message: string, internal = false): Promise<void> =>
    req(`/api/admin/support/${id}/replies`, { method: 'POST', body: JSON.stringify({ body: message, internal }) }),

  assign: async (id: string, assigned_to: string | null): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/support/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assigned_to }) });
    return mapTicket(raw);
  },
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  kpis: { label: string; value: number; trend: string; up: boolean }[];
  revenue: { label: string; simplified: number }[];
  period: string;
}

export const analyticsApi = {
  get: async (period = 'month'): Promise<AnalyticsData> =>
    req<AnalyticsData>(`/api/admin/analytics?period=${period}`),
};

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export interface WaitlistResponse { entries: WaitlistEntry[]; total: number; page: number; totalPages: number; }

export const waitlistApi = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<WaitlistResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<WaitlistResponse>(`/api/admin/waitlist?${qs}`);
  },

  remove: async (id: string): Promise<void> =>
    req(`/api/admin/waitlist/${id}`, { method: 'DELETE' }),

  notify: async (subject: string, message: string): Promise<void> =>
    req('/api/admin/waitlist/notify', { method: 'POST', body: JSON.stringify({ subject, message }) }),
};

// ─── App Config ───────────────────────────────────────────────────────────────

function inferConfigType(key: string, value: unknown): ConfigItem['type'] {
  if (typeof value === 'boolean') return 'boolean';
  if (/price|fee|amount|threshold|min_|max_/.test(key)) return 'currency';
  if (/percent|rate_target/.test(key)) return 'percentage';
  if (/days/.test(key)) return 'days';
  if (/hours/.test(key)) return 'hours';
  return 'number';
}

export const configApi = {
  get: async (): Promise<ConfigGroup[]> => {
    const rows = await req<{ key: string; value: unknown; description?: string }[]>('/api/admin/config');
    if (!rows || rows.length === 0) return [];
    const items = rows.map(r => ({
      key: r.key,
      label: r.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: r.value as ConfigItem['value'],
      type: inferConfigType(r.key, r.value),
      description: r.description,
    }));
    return [{ title: 'App Configuration', items }];
  },

  save: async (data: ConfigGroup[]): Promise<void> => {
    const entries = data.flatMap(g => g.items.map(item => ({ key: item.key, value: item.value })));
    return req('/api/admin/config', { method: 'PUT', body: JSON.stringify(entries) });
  },
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogResponse { entries: AuditEntry[]; total: number; page: number; totalPages: number; }

export const auditApi = {
  list: async (params: { search?: string; action?: string; page?: number; limit?: number } = {}): Promise<AuditLogResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.action) qs.set('action', params.action);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    const raw = await req<{ entries: Record<string, unknown>[]; total: number; page: number; totalPages: number }>(`/api/admin/audit-log?${qs}`);
    return {
      ...raw,
      entries: (raw.entries ?? []).map(e => ({
        id: e.id as string,
        timestamp: e.timestamp ? new Date(e.timestamp as string).toLocaleString('en-IN') : (e.created_at ? new Date(e.created_at as string).toLocaleString('en-IN') : ''),
        admin: (e.admin ?? e.email ?? '') as string,
        action: (e.action ?? '') as string,
        entityType: (e.entityType ?? e.entity_type ?? '') as string,
        entityId: (e.entityId ?? e.entity_id ?? '') as string,
        ip: (e.ip ?? '') as string,
      })),
    };
  },
};

// ─── Collections ─────────────────────────────────────────────────────────────

export interface CollectionDetail extends Collection { productIds?: string[]; description?: string; }
export interface CollectionsResponse { collections: Collection[]; total: number; }

function mapCollection(c: Record<string, unknown>): Collection {
  return {
    id: c.id as string,
    name: c.name as string,
    slug: c.slug as string,
    products: (c.product_count as number) ?? (c.products as number) ?? 0,
    status: ((c.status as string) ?? 'Draft') as Collection['status'],
    sortOrder: (c.sort_order as number) ?? (c.sortOrder as number) ?? 0,
    hasBanner: !!(c.cover_image),
    season: (c.season as string) ?? '',
    updated: c.updated_at
      ? new Date(c.updated_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
  };
}

function mapCollectionDetail(c: Record<string, unknown>): CollectionDetail {
  const prods = (c.products as { id: string }[] | undefined) ?? [];
  return {
    ...mapCollection(c),
    description: (c.description as string) ?? '',
    productIds: prods.map(p => p.id),
  };
}

export const collectionsApi = {
  list: async (params: { search?: string; status?: string } = {}): Promise<CollectionsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    const raw = await req<{ collections: Record<string, unknown>[]; total: number }>(`/api/admin/catalog/collections?${qs}`);
    return { collections: (raw.collections ?? []).map(mapCollection), total: raw.total ?? 0 };
  },

  get: async (id: string): Promise<CollectionDetail> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/catalog/collections/${id}`);
    return mapCollectionDetail(raw);
  },

  create: async (data: Partial<CollectionDetail>): Promise<CollectionDetail> => {
    const raw = await req<Record<string, unknown>>('/api/admin/catalog/collections', { method: 'POST', body: JSON.stringify(data) });
    return mapCollectionDetail(raw);
  },

  update: async (id: string, data: Partial<CollectionDetail>): Promise<CollectionDetail> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/catalog/collections/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return mapCollectionDetail(raw);
  },

  archive: async (id: string): Promise<void> =>
    req(`/api/admin/catalog/collections/${id}/archive`, { method: 'POST' }),
};

// ─── Returns ──────────────────────────────────────────────────────────────────

export interface ReturnRequest {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  reason: string;
  review_note?: string;
  refund_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface ReturnsResponse { returns: ReturnRequest[]; total: number; page: number; limit: number; }

export const returnsApi = {
  list: async (params: { status?: string; page?: number; limit?: number } = {}): Promise<ReturnsResponse> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<ReturnsResponse>(`/api/admin/returns?${qs}`);
  },

  get: async (id: string): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns/${id}`),

  review: async (id: string, data: { status: string; review_note?: string; refund_amount?: number }): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns/${id}/override`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Alterations ──────────────────────────────────────────────────────────────

export interface AlterationRequest {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface AlterationsResponse { alterations: AlterationRequest[]; total: number; page: number; limit: number; }

export const alterationsApi = {
  list: async (params: { status?: string; page?: number; limit?: number } = {}): Promise<AlterationsResponse> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<AlterationsResponse>(`/api/admin/alterations?${qs}`);
  },

  get: async (id: string): Promise<AlterationRequest> =>
    req<AlterationRequest>(`/api/admin/alterations/${id}`),
};

// ─── Home Visits ──────────────────────────────────────────────────────────────

export interface HomeVisit {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_id?: string;
  assigned_staff_id?: string | null;
  assigned_staff_name: string | null;
  hub_id?: string | null;
  hub_name?: string | null;
  fit_profile_id?: string | null;
  status: string;
  scheduled_at: string;
  completed_at?: string | null;
  address: Record<string, string>;
  city: string;
  state?: string;
  pincode?: string;
  address_line1?: string;
  address_line2?: string;
  address_name?: string;
  address_phone?: string;
  notes?: string;
  created_at: string;
}

export interface HomeVisitsResponse { visits: HomeVisit[]; total: number; page: number; limit: number; }

export interface BodyMeasurement {
  id: string;
  fit_profile_id: string;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  shoulders: number | null;
  sleeve_length: number | null;
  neck: number | null;
  inseam: number | null;
  thigh: number | null;
  calf: number | null;
  bicep: number | null;
  wrist: number | null;
  shirt_length: number | null;
  kurta_length: number | null;
  trouser_length: number | null;
  measurement_method: string;
  measured_at: string;
  created_at: string;
}

export const homeVisitsApi = {
  list: async (params: { status?: string; date?: string; hub_id?: string; page?: number; limit?: number } = {}): Promise<HomeVisitsResponse> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.date)   qs.set('date',   params.date);
    if (params.hub_id) qs.set('hub_id', params.hub_id);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<HomeVisitsResponse>(`/api/admin/home-visits?${qs}`);
  },

  get: async (id: string): Promise<HomeVisit> =>
    req<HomeVisit>(`/api/admin/home-visits/${id}`),

  updateStatus: async (id: string, status: string): Promise<HomeVisit> =>
    req<HomeVisit>(`/api/admin/home-visits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  assignHub: async (id: string, hub_id: string): Promise<HomeVisit> =>
    req<HomeVisit>(`/api/admin/home-visits/${id}/hub`, { method: 'PATCH', body: JSON.stringify({ hub_id }) }),

  assign: async (id: string, staff_id: string): Promise<HomeVisit> =>
    req<HomeVisit>(`/api/admin/home-visits/${id}/assign`, { method: 'POST', body: JSON.stringify({ staff_id }) }),

  reschedule: async (id: string, scheduled_at: string): Promise<{ id: string; scheduled_at: string }> =>
    req<{ id: string; scheduled_at: string }>(`/api/admin/home-visits/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify({ scheduled_at }) }),

  getMeasurements: async (id: string): Promise<BodyMeasurement[]> =>
    req<{ measurements: BodyMeasurement[] }>(`/api/admin/home-visits/${id}/measurements`).then(r => r.measurements),

  recordMeasurements: async (id: string, data: Partial<Record<string, number>>): Promise<BodyMeasurement> =>
    req<BodyMeasurement>(`/api/admin/home-visits/${id}/measurements`, { method: 'POST', body: JSON.stringify(data) }),

  create: async (data: {
    user_id?: string;
    customer_name?: string;
    customer_phone?: string;
    scheduled_at: string;
    hub_id?: string;
    notes?: string;
    address_name?: string;
    address_phone?: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    pincode?: string;
  }): Promise<HomeVisit> =>
    req<HomeVisit>('/api/admin/home-visits', { method: 'POST', body: JSON.stringify(data) }),

  searchUsers: async (q: string): Promise<{ id: string; name: string; phone: string; email: string }[]> =>
    req<{ users: { id: string; name: string; phone: string; email: string }[] }>(
      `/api/admin/home-visits/user-search?q=${encodeURIComponent(q)}`
    ).then(r => r.users),
};

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  order_id: string;
  order_number: string;
  invoice_number: string;
  customer_name: string;
  status: string;
  pdf_key: string | null;
  created_at: string;
}

export interface InvoicesResponse { invoices: Invoice[]; total: number; page: number; limit: number; }

export const invoicesApi = {
  list: async (params: { orderId?: string; status?: string; page?: number; limit?: number } = {}): Promise<InvoicesResponse> => {
    const qs = new URLSearchParams();
    if (params.orderId) qs.set('orderId', params.orderId);
    if (params.status)  qs.set('status',  params.status);
    if (params.page)    qs.set('page',    String(params.page));
    if (params.limit)   qs.set('limit',   String(params.limit));
    return req<InvoicesResponse>(`/api/admin/invoices?${qs}`);
  },

  get: async (id: string): Promise<Invoice> =>
    req<Invoice>(`/api/admin/invoices/${id}`),

  regenerate: async (id: string): Promise<void> =>
    req(`/api/admin/invoices/${id}/regenerate`, { method: 'POST' }),

  getDownloadUrl: async (id: string): Promise<{ url: string }> =>
    req<{ url: string }>(`/api/admin/invoices/${id}/download`),

  generateForOrder: async (orderId: string): Promise<{ invoice_id: string; message: string }> =>
    req<{ invoice_id: string; message: string }>(`/api/admin/orders/${orderId}/invoice`, { method: 'POST' }),
};

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_amount: number;
  max_discount?: number;
  max_uses?: number;
  uses_per_user: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export interface PromosResponse { promos: PromoCode[]; }

export const promosApi = {
  list: async (): Promise<PromosResponse> =>
    req<PromosResponse>('/api/admin/promos'),

  create: async (data: {
    code: string;
    description?: string;
    discount_type: 'percent' | 'flat';
    discount_value: number;
    min_order_amount?: number;
    max_uses?: number;
    uses_per_user?: number;
    valid_until?: string;
  }): Promise<PromoCode> =>
    req<PromoCode>('/api/admin/promos', { method: 'POST', body: JSON.stringify(data) }),

  update: async (id: string, data: Partial<PromoCode>): Promise<PromoCode> =>
    req<PromoCode>(`/api/admin/promos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  toggle: async (id: string, is_active: boolean): Promise<{ id: string; code: string; is_active: boolean }> =>
    req<{ id: string; code: string; is_active: boolean }>(`/api/admin/promos/${id}/active`, {
      method: 'PATCH', body: JSON.stringify({ is_active }),
    }),

  delete: async (id: string): Promise<void> =>
    req<void>(`/api/admin/promos/${id}`, { method: 'DELETE' }),

  validate: async (code: string, order_amount: number): Promise<{ valid: boolean; discount?: number; reason?: string; promo?: { code: string; discount_type: string; discount_value: number } }> =>
    req<{ valid: boolean; discount?: number; reason?: string; promo?: { code: string; discount_type: string; discount_value: number } }>('/api/admin/promos/validate', {
      method: 'POST', body: JSON.stringify({ code, order_amount }),
    }),
};

// ─── Service Pincodes ─────────────────────────────────────────────────────────

export interface ServicePincode {
  id: string;
  pincode: string;
  area_name: string;
  city: string;
  hub_id: string | null;
  hub_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServicePincodesResponse {
  pincodes: ServicePincode[];
  total: number;
  page: number;
  totalPages: number;
}

export const serviceAreasApi = {
  list: async (params: { search?: string; city?: string; page?: number; limit?: number } = {}): Promise<ServicePincodesResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.city)   qs.set('city',   params.city);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<ServicePincodesResponse>(`/api/admin/system/service-pincodes?${qs}`).then(r => ({
      ...r,
      pincodes: r.pincodes ?? [],
    }));
  },

  upsert: async (data: { pincode: string; area_name?: string; city?: string; hub_id?: string | null; is_active?: boolean }[]): Promise<{ pincodes: ServicePincode[] }> =>
    req<{ pincodes: ServicePincode[] }>('/api/admin/system/service-pincodes', { method: 'POST', body: JSON.stringify(data) }),

  update: async (id: string, data: Partial<ServicePincode>): Promise<ServicePincode> =>
    req<ServicePincode>(`/api/admin/system/service-pincodes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: async (id: string): Promise<void> =>
    req(`/api/admin/system/service-pincodes/${id}`, { method: 'DELETE' }),

  check: async (pincode: string): Promise<{ serviceable: boolean; area_name?: string; city?: string; hub?: { id: string; name: string } | null }> =>
    req<{ serviceable: boolean; area_name?: string; city?: string; hub?: { id: string; name: string } | null }>(`/api/pincodes/check?pincode=${encodeURIComponent(pincode)}`),
};

// ─── Admin Auth Extended ──────────────────────────────────────────────────────

export const adminAuthExtApi = {
  setupSecurityQuestion: async (question: string, answer: string): Promise<void> =>
    req('/api/admin/auth/security-question', { method: 'POST', body: JSON.stringify({ question, answer }) }),

  getSecurityQuestion: async (email: string): Promise<{ question: string }> =>
    req<{ question: string }>('/api/admin/auth/security-question/get', { method: 'POST', body: JSON.stringify({ email }) }),

  resetViaQuestion: async (email: string, answer: string, password: string): Promise<void> =>
    req('/api/admin/auth/security-question/reset', { method: 'POST', body: JSON.stringify({ email, answer, password }) }),

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> =>
    req('/api/admin/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  setTempPassword: async (adminUserId: string, password: string): Promise<void> =>
    req(`/api/admin/auth/users/${adminUserId}/temp-password`, { method: 'POST', body: JSON.stringify({ password }) }),
};

// ─── Craftspeople ─────────────────────────────────────────────────────────────

export interface Craftsperson {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_key: string | null;
  public_photo_url: string | null;
  years_experience: number | null;
}

const normalizeCraftspeople = (data: unknown): Craftsperson[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  const response = data as {
    craftspeople?: unknown;
    items?: unknown;
    results?: unknown;
    data?: unknown;
  };

  if (Array.isArray(response.craftspeople)) return response.craftspeople;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.data)) return response.data;

  return [];
};

export const craftspeopleApi = {
  list: async (): Promise<Craftsperson[]> => {
    const data = await req<unknown>('/api/admin/craftspeople');
    return normalizeCraftspeople(data);
  },

  updateStory: async (id: string, data: { bio?: string; years_experience?: number }): Promise<Craftsperson> =>
    req<Craftsperson>(`/api/admin/craftspeople/${id}/story`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
};

// ─── Hub Staff ────────────────────────────────────────────────────────────────

export interface HubStaff {
  id: string;
  hub_id?: string;
  name: string;
  email?: string;
  phone: string;
  role: string;
  joined_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export const hubStaffApi = {
  list: async (hubId: string): Promise<HubStaff[]> =>
    req<{ staff: HubStaff[] }>(`/api/admin/hubs/${hubId}/staff`).then(r => r.staff),

  create: async (hubId: string, data: { name: string; phone: string; role: string; email?: string; joined_at?: string }): Promise<HubStaff> =>
    req<HubStaff>(`/api/admin/hubs/${hubId}/staff`, { method: 'POST', body: JSON.stringify(data) }),

  update: async (hubId: string, staffId: string, data: Partial<{ name: string; phone: string; role: string; email: string; joined_at: string; is_active: boolean }>): Promise<HubStaff> =>
    req<HubStaff>(`/api/admin/hubs/${hubId}/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(data) }),

  toggleActive: async (hubId: string, staffId: string, is_active: boolean): Promise<HubStaff> =>
    req<HubStaff>(`/api/admin/hubs/${hubId}/staff/${staffId}/active`, {
      method: 'PATCH', body: JSON.stringify({ is_active }),
    }),
};

// ─── Customer Measurements ────────────────────────────────────────────────────

export interface CustomerMeasurementsData {
  profiles: Array<{ id: string; name: string; category: string; created_at: string }>;
  measurements: Array<BodyMeasurement & { profile_category: string }>;
}

export const customerMeasurementsApi = {
  get: async (userId: string): Promise<CustomerMeasurementsData> =>
    req<CustomerMeasurementsData>(`/api/admin/customers/${userId}/measurements`),

  save: async (userId: string, fitProfileId: string, data: Partial<Omit<BodyMeasurement, 'id' | 'fit_profile_id' | 'measurement_method' | 'measured_at' | 'created_at'>>): Promise<BodyMeasurement> =>
    req<BodyMeasurement>(`/api/admin/customers/${userId}/measurements`, {
      method: 'PUT',
      body: JSON.stringify({ fit_profile_id: fitProfileId, ...data }),
    }),
};

// ─── All Staff (cross-hub, for consultation assignment) ───────────────────────

export interface AllStaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  hub_id: string;
  hub_name: string;
}

export const allStaffApi = {
  list: async (): Promise<AllStaffMember[]> =>
    req<{ staff: AllStaffMember[] }>('/api/admin/staff').then(r => r.staff),
};

// ─── Fit Analytics ────────────────────────────────────────────────────────────

export interface FitAnalyticsData {
  avg_fit_score: number;
  feedback_count: number;
  alteration_rate: number;
  alteration_success_rate: number;
  by_product: { id: string; name: string; avg_fit_score: number; feedback_count: number }[];
  hub_performance: { id: string; name: string; avg_fit_score: number; feedback_count: number; good_fit_count: number }[];
}

export const fitAnalyticsApi = {
  get: async (period = 'month'): Promise<FitAnalyticsData> =>
    req<FitAnalyticsData>(`/api/admin/analytics/fit?period=${period}`),
};

// ─── CMS ──────────────────────────────────────────────────────────────────────

export interface LookbookItem {
  id: string;
  title: string;
  description: string | null;
  image_key: string | null;
  tags: string[];
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JournalPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  cover_image_key: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerStory {
  id: string;
  customer_name: string;
  location: string | null;
  story_text: string;
  product_name: string | null;
  rating: number | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export const cmsApi = {
  lookbook: {
    list: (): Promise<LookbookItem[]> =>
      req<{ items: LookbookItem[] }>('/api/admin/cms/lookbook').then(r => r.items),
    create: (data: Partial<LookbookItem>): Promise<LookbookItem> =>
      req<LookbookItem>('/api/admin/cms/lookbook', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<LookbookItem>): Promise<LookbookItem> =>
      req<LookbookItem>(`/api/admin/cms/lookbook/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      req<void>(`/api/admin/cms/lookbook/${id}`, { method: 'DELETE' }),
  },

  journal: {
    list: (status?: string): Promise<JournalPost[]> =>
      req<{ posts: JournalPost[] }>(`/api/admin/cms/journal${status ? `?status=${status}` : ''}`).then(r => r.posts),
    get: (id: string): Promise<JournalPost> =>
      req<JournalPost>(`/api/admin/cms/journal/${id}`),
    create: (data: Partial<JournalPost>): Promise<JournalPost> =>
      req<JournalPost>('/api/admin/cms/journal', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<JournalPost>): Promise<JournalPost> =>
      req<JournalPost>(`/api/admin/cms/journal/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      req<void>(`/api/admin/cms/journal/${id}`, { method: 'DELETE' }),
  },

  stories: {
    list: (): Promise<CustomerStory[]> =>
      req<{ stories: CustomerStory[] }>('/api/admin/cms/stories').then(r => r.stories),
    create: (data: Partial<CustomerStory>): Promise<CustomerStory> =>
      req<CustomerStory>('/api/admin/cms/stories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CustomerStory>): Promise<CustomerStory> =>
      req<CustomerStory>(`/api/admin/cms/stories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      req<void>(`/api/admin/cms/stories/${id}`, { method: 'DELETE' }),
  },
};

// ─── Garment Types & Fit Preferences ─────────────────────────────────────────

export interface GarmentType {
  id: string;
  name: string;
  slug: string;
  required_measurements: string[];
  is_active: boolean;
  sort_order: number;
}

export interface FitPreference {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export const garmentTypesApi = {
  list: async (): Promise<GarmentType[]> =>
    req<{ garment_types: GarmentType[] }>('/api/admin/garment-types').then(r => r.garment_types ?? []),
};

export const fitPreferencesApi = {
  list: async (): Promise<FitPreference[]> =>
    req<{ fit_preferences: FitPreference[] }>('/api/admin/fit-preferences').then(r => r.fit_preferences ?? []),
};

// ─── Measurement Bookings ─────────────────────────────────────────────────────

export interface MeasurementBookingItem {
  id: string;
  booking_id: string;
  garment_type_id: string;
  garment_type_name?: string;
  garment_type_slug?: string;
  required_measurements?: string[];
  variant_label: string | null;
  fit_preference_id: string | null;
  fit_preference_name?: string | null;
  fit_notes: string | null;
  linked_product_id: string | null;
  measurement_status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  sort_order: number;
  measurements?: MeasurementBookingMeasurement | null;
}

export interface MeasurementBookingMeasurement {
  id: string;
  booking_item_id: string;
  taken_by_staff_id: string | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  shoulders: number | null;
  sleeve_length: number | null;
  neck: number | null;
  inseam: number | null;
  thigh: number | null;
  calf: number | null;
  bicep: number | null;
  wrist: number | null;
  shirt_length: number | null;
  kurta_length: number | null;
  trouser_length: number | null;
  notes: string | null;
  finalized_at: string | null;
  created_at: string;
}

export interface MeasurementBooking {
  id: string;
  booking_ref: string;
  user_id: string;
  customer_name?: string;
  customer_phone?: string;
  home_visit_id: string | null;
  source_order_id: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name?: string | null;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  items?: MeasurementBookingItem[];
  created_at: string;
  updated_at: string;
}

export interface MeasurementBookingsResponse {
  bookings: MeasurementBooking[];
  total: number;
  page: number;
  totalPages: number;
}

export const measurementBookingsApi = {
  list: async (params: { user_id?: string; status?: string; page?: number; limit?: number } = {}): Promise<MeasurementBookingsResponse> => {
    const qs = new URLSearchParams();
    if (params.user_id) qs.set('user_id', params.user_id);
    if (params.status)  qs.set('status',  params.status);
    if (params.page)    qs.set('page',    String(params.page));
    if (params.limit)   qs.set('limit',   String(params.limit));
    return req<MeasurementBookingsResponse>(`/api/admin/measurement-bookings?${qs}`);
  },

  get: async (id: string): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}`),

  create: async (data: {
    user_id: string;
    home_visit_id?: string;
    scheduled_at?: string;
    notes?: string;
    items: { garment_type_id: string; variant_label?: string; fit_preference_id?: string; fit_notes?: string }[];
  }): Promise<MeasurementBooking> =>
    req<MeasurementBooking>('/api/admin/measurement-bookings', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: async (id: string, status: string): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  addItem: async (id: string, item: { garment_type_id: string; variant_label?: string; fit_preference_id?: string; fit_notes?: string }): Promise<MeasurementBookingItem> =>
    req<MeasurementBookingItem>(`/api/admin/measurement-bookings/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),

  updateItem: async (id: string, itemId: string, data: Partial<Pick<MeasurementBookingItem, 'measurement_status' | 'fit_preference_id' | 'fit_notes'>>): Promise<MeasurementBookingItem> =>
    req<MeasurementBookingItem>(`/api/admin/measurement-bookings/${id}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  saveMeasurements: async (id: string, booking_item_id: string, measurements: Record<string, number>, taken_by_staff_id?: string): Promise<MeasurementBookingMeasurement> =>
    req<MeasurementBookingMeasurement>(`/api/admin/measurement-bookings/${id}/measurements`, { method: 'POST', body: JSON.stringify({ booking_item_id, measurements, taken_by_staff_id }) }),

  assignStaff: async (id: string, staff_id: string): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}/assign-staff`, { method: 'POST', body: JSON.stringify({ staff_id }) }),

  complete: async (id: string): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}/complete`, { method: 'POST' }),
};

export type { AdminOrder, AdminUser, Hub, SupportTicket, TicketMessage, AuditEntry, WaitlistEntry, ConfigGroup, OrderStage, Collection, OrderItem, OrderTimelineEntry, OrderPayment };
