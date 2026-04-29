import { getAdminToken, clearAdminToken } from './catalogApi';
import type {
  AdminOrder, AdminUser, Hub, SupportTicket, AuditEntry,
  WaitlistEntry, ConfigGroup, OrderStage,
  Collection, LuxeFabric, Consultation, ConsultationSlot, ConsultationStatus,
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
  revenue: { label: string; simplified: number; luxe: number }[];
  ordersByStage: { stage: string; label: string; count: number; overdue: number }[];
  modeSplit: { simplifiedOrders: number; luxeOrders: number; simplifiedRevenue: number; luxeRevenue: number };
  waitlist: { total: number; trend: string; up: boolean };
  urgentTickets: { id: string; customer: string; subject: string; created: string }[];
  overdueOrders: { id: string; customer: string; stage: string; hub: string; created: string }[];
  consultations: { pending: number; unassigned: number };
  sparklines: Record<string, number[]>;
}

export const dashboardApi = {
  get: async (period = 'month', signal?: AbortSignal): Promise<DashboardData> =>
    req<DashboardData>(`/api/admin/analytics/dashboard?period=${period}`, { signal }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrdersParams { search?: string; stage?: string; mode?: string; page?: number; limit?: number; }
export interface OrdersResponse { orders: AdminOrder[]; total: number; page: number; totalPages: number; }

export const ordersApi = {
  list: async (params: OrdersParams = {}): Promise<OrdersResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.stage)  qs.set('stage',  params.stage);
    if (params.mode)   qs.set('mode',   params.mode);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<OrdersResponse>(`/api/admin/orders?${qs}`);
  },

  get: async (id: string): Promise<AdminOrder> =>
    req<AdminOrder>(`/api/admin/orders/${id}`),

  updateStage: async (id: string, stage: OrderStage, reason?: string): Promise<AdminOrder> =>
    req<AdminOrder>(`/api/admin/orders/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage, reason }) }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UsersParams { search?: string; status?: string; city?: string; page?: number; limit?: number; }
export interface UsersResponse { users: AdminUser[]; total: number; page: number; totalPages: number; }

export const usersApi = {
  list: async (params: UsersParams = {}): Promise<UsersResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.page)   qs.set('page',   String(params.page));
    if (params.limit)  qs.set('limit',  String(params.limit));
    return req<UsersResponse>(`/api/admin/users?${qs}`);
  },

  get: async (id: string): Promise<AdminUser> =>
    req<AdminUser>(`/api/admin/users/${id}`),

  update: async (id: string, data: Partial<AdminUser>): Promise<AdminUser> =>
    req<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  issueCredits: async (id: string, amount: number, reason: string): Promise<void> =>
    req(`/api/admin/users/${id}/credits`, { method: 'POST', body: JSON.stringify({ amount, reason }) }),

  addNote: async (id: string, note: string): Promise<void> =>
    req(`/api/admin/users/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),
};

// ─── Hubs ─────────────────────────────────────────────────────────────────────

export interface HubsParams { search?: string; city?: string; status?: string; page?: number; limit?: number; }
export interface HubsResponse { hubs: Hub[]; total: number; }

export const hubsApi = {
  list: async (params: HubsParams = {}): Promise<HubsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.city)   qs.set('city',   params.city);
    if (params.status) qs.set('status', params.status);
    return req<HubsResponse>(`/api/admin/hubs?${qs}`);
  },

  get: async (id: string): Promise<Hub> =>
    req<Hub>(`/api/admin/hubs/${id}`),

  create: async (data: Partial<Hub>): Promise<Hub> =>
    req<Hub>('/api/admin/hubs', { method: 'POST', body: JSON.stringify(data) }),

  update: async (id: string, data: Partial<Hub>): Promise<Hub> =>
    req<Hub>(`/api/admin/hubs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Support ──────────────────────────────────────────────────────────────────

export interface TicketsParams { search?: string; status?: string; priority?: string; page?: number; limit?: number; }
export interface TicketsResponse { tickets: SupportTicket[]; total: number; page: number; totalPages: number; }

export const supportApi = {
  list: async (params: TicketsParams = {}): Promise<TicketsResponse> => {
    const qs = new URLSearchParams();
    if (params.search)   qs.set('search',   params.search);
    if (params.status)   qs.set('status',   params.status);
    if (params.priority) qs.set('priority', params.priority);
    if (params.page)     qs.set('page',     String(params.page));
    if (params.limit)    qs.set('limit',    String(params.limit));
    return req<TicketsResponse>(`/api/admin/support?${qs}`);
  },

  get: async (id: string): Promise<SupportTicket> =>
    req<SupportTicket>(`/api/admin/support/${id}`),

  update: async (id: string, data: Partial<SupportTicket>): Promise<SupportTicket> =>
    req<SupportTicket>(`/api/admin/support/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  addReply: async (id: string, message: string, internal = false): Promise<void> =>
    req(`/api/admin/support/${id}/replies`, { method: 'POST', body: JSON.stringify({ message, internal }) }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  kpis: { label: string; value: number; trend: string; up: boolean }[];
  revenue: { label: string; simplified: number; luxe: number }[];
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

export const configApi = {
  get: async (): Promise<ConfigGroup[]> =>
    req<ConfigGroup[]>('/api/admin/config'),

  save: async (data: ConfigGroup[]): Promise<void> =>
    req('/api/admin/config', { method: 'PUT', body: JSON.stringify(data) }),
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
    return req<AuditLogResponse>(`/api/admin/audit-log?${qs}`);
  },
};

// ─── Collections ─────────────────────────────────────────────────────────────

export interface CollectionDetail extends Collection { productIds?: string[]; }
export interface CollectionsResponse { collections: Collection[]; total: number; }

export const collectionsApi = {
  list: async (params: { search?: string; mode?: string; status?: string } = {}): Promise<CollectionsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.mode)   qs.set('mode',   params.mode);
    if (params.status) qs.set('status', params.status);
    return req<CollectionsResponse>(`/api/admin/catalog/collections?${qs}`);
  },

  get: async (id: string): Promise<CollectionDetail> =>
    req<CollectionDetail>(`/api/admin/catalog/collections/${id}`),

  create: async (data: Partial<CollectionDetail>): Promise<CollectionDetail> =>
    req<CollectionDetail>('/api/admin/catalog/collections', { method: 'POST', body: JSON.stringify(data) }),

  update: async (id: string, data: Partial<CollectionDetail>): Promise<CollectionDetail> =>
    req<CollectionDetail>(`/api/admin/catalog/collections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  archive: async (id: string): Promise<void> =>
    req(`/api/admin/catalog/collections/${id}/archive`, { method: 'POST' }),
};

// ─── Luxe Fabrics ─────────────────────────────────────────────────────────────

export interface LuxeFabricsResponse { fabrics: LuxeFabric[]; total: number; }

export const luxeFabricsApi = {
  list: async (params: { search?: string; material?: string; occasion?: string; status?: string } = {}): Promise<LuxeFabricsResponse> => {
    const qs = new URLSearchParams();
    if (params.search)   qs.set('search',   params.search);
    if (params.material) qs.set('material', params.material);
    if (params.occasion) qs.set('occasion', params.occasion);
    if (params.status)   qs.set('status',   params.status);
    return req<LuxeFabricsResponse>(`/api/admin/catalog/luxe-fabrics?${qs}`);
  },

  get: async (id: string): Promise<LuxeFabric> =>
    req<LuxeFabric>(`/api/admin/catalog/luxe-fabrics/${id}`),

  create: async (data: Partial<LuxeFabric>): Promise<LuxeFabric> =>
    req<LuxeFabric>('/api/admin/catalog/luxe-fabrics', { method: 'POST', body: JSON.stringify(data) }),

  update: async (id: string, data: Partial<LuxeFabric>): Promise<LuxeFabric> =>
    req<LuxeFabric>(`/api/admin/catalog/luxe-fabrics/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Consultations ────────────────────────────────────────────────────────────

export interface ConsultationsResponse { consultations: Consultation[]; total: number; }

export const consultationsApi = {
  list: async (params: { status?: string; occasion?: string; assigned?: string } = {}): Promise<ConsultationsResponse> => {
    const qs = new URLSearchParams();
    if (params.status)   qs.set('status',   params.status);
    if (params.occasion) qs.set('occasion', params.occasion);
    if (params.assigned) qs.set('assigned', params.assigned);
    return req<ConsultationsResponse>(`/api/admin/consultations?${qs}`);
  },

  update: async (id: string, data: Partial<Consultation>): Promise<Consultation> =>
    req<Consultation>(`/api/admin/consultations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Consultation Slots ───────────────────────────────────────────────────────

export interface ConsultationSlotsResponse { slots: ConsultationSlot[]; total: number; }

export const consultationSlotsApi = {
  list: async (): Promise<ConsultationSlotsResponse> =>
    req<ConsultationSlotsResponse>('/api/admin/consultation-slots'),

  create: async (data: Omit<ConsultationSlot, 'id'>): Promise<ConsultationSlot> =>
    req<ConsultationSlot>('/api/admin/consultation-slots', { method: 'POST', body: JSON.stringify(data) }),

  delete: async (id: string): Promise<void> =>
    req(`/api/admin/consultation-slots/${id}`, { method: 'DELETE' }),
};

export type { AdminOrder, AdminUser, Hub, SupportTicket, AuditEntry, WaitlistEntry, ConfigGroup, OrderStage, Collection, LuxeFabric, Consultation, ConsultationSlot, ConsultationStatus };
