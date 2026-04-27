import { getAdminToken, clearAdminToken } from './catalogApi';
import {
  adminOrders, adminUsers, adminHubs, supportTickets,
  auditLog, waitlistEntries, dashboardStats, hubPerformance,
  alerts, recentActivity, appConfig,
  adminCollections, luxeFabrics, adminConsultations, consultationSlots,
} from '../data/adminMockData';
import type {
  AdminOrder, AdminUser, Hub, SupportTicket, AuditEntry,
  WaitlistEntry, ConfigGroup, OrderStage,
  Collection, LuxeFabric, Consultation, ConsultationSlot, ConsultationStatus,
} from '../data/adminMockData';

const BASE = 'https://api.zavestro.in';
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
  if (res.status === 401) { clearAdminToken(); clearAdminUser(); window.location.href = '/admin/login'; throw new Error('Unauthorized'); }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const b = await res.json(); msg = b.message || b.error || msg; } catch { /* */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function isNet(err: unknown) {
  return err instanceof Error && (err.message === 'Failed to fetch' || err.message.includes('NetworkError') || err.message.includes('network'));
}

function paginate<T>(arr: T[], page = 1, limit = 20) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { data: arr.slice((page - 1) * limit, page * limit), total, page, totalPages };
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
  hubPerformance: typeof hubPerformance;
  alerts: typeof alerts;
  recentActivity: typeof recentActivity;
  revenue: { label: string; simplified: number; luxe: number }[];
}

const PERIOD_MULTIPLIER: Record<string, number> = {
  today: 0.03, week: 0.25, last30: 1.05, month: 1, quarter: 3,
};

function scaleStat(stat: StatShape, m: number): StatShape {
  return { value: Math.round(stat.value * m), trend: stat.trend, up: stat.up };
}

export const dashboardApi = {
  get: async (period = 'month'): Promise<DashboardData> => {
    try {
      return await req<DashboardData>(`/api/admin/analytics/dashboard?period=${period}`);
    } catch (err) {
      if (isNet(err)) {
        const m = PERIOD_MULTIPLIER[period] ?? 1;
        const revenue = [65, 80, 72, 90, 85, 95, 88, 100, 92, 78, 95, 110, 98, 115].map((v, i) => ({
          label: `Day ${i + 1}`,
          simplified: Math.round(v * 1800 * m),
          luxe: Math.round(v * 1200 * m),
        }));
        return {
          stats: {
            totalOrders: scaleStat(dashboardStats.totalOrders, m),
            activeOrders: scaleStat(dashboardStats.activeOrders, m),
            gmv: scaleStat(dashboardStats.gmv, m),
            pendingPayments: scaleStat(dashboardStats.pendingPayments, m),
            openTickets: scaleStat(dashboardStats.openTickets, m),
            newCustomers: scaleStat(dashboardStats.newCustomers, m),
          },
          hubPerformance,
          alerts,
          recentActivity,
          revenue,
        };
      }
      throw err;
    }
  },
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrdersParams { search?: string; stage?: string; mode?: string; page?: number; limit?: number; }
export interface OrdersResponse { orders: AdminOrder[]; total: number; page: number; totalPages: number; }

export const ordersApi = {
  list: async (params: OrdersParams = {}): Promise<OrdersResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.stage) qs.set('stage', params.stage);
      if (params.mode) qs.set('mode', params.mode);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      return await req<OrdersResponse>(`/api/admin/orders?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...adminOrders];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(o => o.id.toLowerCase().includes(s) || o.customer.toLowerCase().includes(s)); }
        if (params.stage) filtered = filtered.filter(o => o.stage === params.stage);
        if (params.mode) filtered = filtered.filter(o => o.mode === params.mode);
        const p = paginate(filtered, params.page, params.limit);
        return { orders: p.data, total: p.total, page: p.page, totalPages: p.totalPages };
      }
      throw err;
    }
  },

  get: async (id: string): Promise<AdminOrder> => {
    try { return await req<AdminOrder>(`/api/admin/orders/${id}`); }
    catch (err) {
      if (isNet(err)) return adminOrders.find(o => o.id === id) ?? adminOrders[0];
      throw err;
    }
  },

  updateStage: async (id: string, stage: OrderStage, reason?: string): Promise<AdminOrder> => {
    try { return await req<AdminOrder>(`/api/admin/orders/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage, reason }) }); }
    catch (err) {
      if (isNet(err)) return { ...adminOrders.find(o => o.id === id)!, stage };
      throw err;
    }
  },
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UsersParams { search?: string; status?: string; city?: string; page?: number; limit?: number; }
export interface UsersResponse { users: AdminUser[]; total: number; page: number; totalPages: number; }

export const usersApi = {
  list: async (params: UsersParams = {}): Promise<UsersResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.status) qs.set('status', params.status);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      return await req<UsersResponse>(`/api/admin/users?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...adminUsers];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(u => u.name.toLowerCase().includes(s) || u.phone.includes(params.search!) || u.email.toLowerCase().includes(s)); }
        if (params.status) filtered = filtered.filter(u => u.status === params.status);
        const p = paginate(filtered, params.page, params.limit);
        return { users: p.data, total: p.total, page: p.page, totalPages: p.totalPages };
      }
      throw err;
    }
  },

  get: async (id: string): Promise<AdminUser> => {
    try { return await req<AdminUser>(`/api/admin/users/${id}`); }
    catch (err) {
      if (isNet(err)) return adminUsers.find(u => u.id === id) ?? adminUsers[0];
      throw err;
    }
  },

  update: async (id: string, data: Partial<AdminUser>): Promise<AdminUser> => {
    try { return await req<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { ...adminUsers.find(u => u.id === id)!, ...data } as AdminUser;
      throw err;
    }
  },

  issueCredits: async (id: string, amount: number, reason: string): Promise<void> => {
    try { return await req(`/api/admin/users/${id}/credits`, { method: 'POST', body: JSON.stringify({ amount, reason }) }); }
    catch (err) { if (!isNet(err)) throw err; }
  },

  addNote: async (id: string, note: string): Promise<void> => {
    try { return await req(`/api/admin/users/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }); }
    catch (err) { if (!isNet(err)) throw err; }
  },
};

// ─── Hubs ─────────────────────────────────────────────────────────────────────

export interface HubsParams { search?: string; city?: string; status?: string; page?: number; limit?: number; }
export interface HubsResponse { hubs: Hub[]; total: number; }

export const hubsApi = {
  list: async (params: HubsParams = {}): Promise<HubsResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.city) qs.set('city', params.city);
      if (params.status) qs.set('status', params.status);
      return await req<HubsResponse>(`/api/admin/hubs?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...adminHubs];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(h => h.name.toLowerCase().includes(s) || h.city.toLowerCase().includes(s)); }
        if (params.city) filtered = filtered.filter(h => h.city === params.city);
        if (params.status) filtered = filtered.filter(h => h.status === params.status);
        return { hubs: filtered, total: filtered.length };
      }
      throw err;
    }
  },

  get: async (id: string): Promise<Hub> => {
    try { return await req<Hub>(`/api/admin/hubs/${id}`); }
    catch (err) {
      if (isNet(err)) return adminHubs.find(h => h.id === id) ?? adminHubs[0];
      throw err;
    }
  },

  create: async (data: Partial<Hub>): Promise<Hub> => {
    try { return await req<Hub>('/api/admin/hubs', { method: 'POST', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { id: `hub-${Date.now()}`, ...data } as Hub;
      throw err;
    }
  },

  update: async (id: string, data: Partial<Hub>): Promise<Hub> => {
    try { return await req<Hub>(`/api/admin/hubs/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { ...adminHubs.find(h => h.id === id)!, ...data } as Hub;
      throw err;
    }
  },
};

// ─── Support ──────────────────────────────────────────────────────────────────

export interface TicketsParams { search?: string; status?: string; priority?: string; page?: number; limit?: number; }
export interface TicketsResponse { tickets: SupportTicket[]; total: number; page: number; totalPages: number; }

export const supportApi = {
  list: async (params: TicketsParams = {}): Promise<TicketsResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.status) qs.set('status', params.status);
      if (params.priority) qs.set('priority', params.priority);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      return await req<TicketsResponse>(`/api/admin/support?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...supportTickets];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(t => t.id.toLowerCase().includes(s) || t.customer.toLowerCase().includes(s) || t.subject.toLowerCase().includes(s)); }
        if (params.status) filtered = filtered.filter(t => t.status === params.status);
        if (params.priority) filtered = filtered.filter(t => t.priority === params.priority);
        const p = paginate(filtered, params.page, params.limit);
        return { tickets: p.data, total: p.total, page: p.page, totalPages: p.totalPages };
      }
      throw err;
    }
  },

  get: async (id: string): Promise<SupportTicket> => {
    try { return await req<SupportTicket>(`/api/admin/support/${id}`); }
    catch (err) {
      if (isNet(err)) return supportTickets.find(t => t.id === id) ?? supportTickets[0];
      throw err;
    }
  },

  update: async (id: string, data: Partial<SupportTicket>): Promise<SupportTicket> => {
    try { return await req<SupportTicket>(`/api/admin/support/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { ...supportTickets.find(t => t.id === id)!, ...data } as SupportTicket;
      throw err;
    }
  },

  addReply: async (id: string, message: string, internal = false): Promise<void> => {
    try { return await req(`/api/admin/support/${id}/replies`, { method: 'POST', body: JSON.stringify({ message, internal }) }); }
    catch (err) { if (!isNet(err)) throw err; }
  },
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  kpis: { label: string; value: number; trend: string; up: boolean }[];
  revenue: { label: string; simplified: number; luxe: number }[];
  period: string;
}

export const analyticsApi = {
  get: async (period = 'month'): Promise<AnalyticsData> => {
    try { return await req<AnalyticsData>(`/api/admin/analytics?period=${period}`); }
    catch (err) {
      if (isNet(err)) {
        const multiplier = period === 'today' ? 0.03 : period === 'week' ? 0.25 : period === 'last30' ? 1.05 : 1;
        return {
          period,
          kpis: [
            { label: 'GMV', value: Math.round(dashboardStats.gmv.value * multiplier), trend: dashboardStats.gmv.trend, up: dashboardStats.gmv.up },
            { label: 'Orders', value: Math.round(dashboardStats.totalOrders.value * multiplier), trend: dashboardStats.totalOrders.trend, up: dashboardStats.totalOrders.up },
            { label: 'Customers', value: Math.round(dashboardStats.newCustomers.value * multiplier), trend: dashboardStats.newCustomers.trend, up: dashboardStats.newCustomers.up },
            { label: 'Avg Order Value', value: Math.round(2400 * multiplier), trend: '+5%', up: true },
          ],
          revenue: [65, 80, 72, 90, 85, 95, 88, 100, 92, 78, 95, 110, 98, 115].map((v, i) => ({
            label: `Day ${i + 1}`, simplified: Math.round(v * 1800 * multiplier), luxe: Math.round(v * 1200 * multiplier),
          })),
        };
      }
      throw err;
    }
  },
};

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export interface WaitlistResponse { entries: WaitlistEntry[]; total: number; page: number; totalPages: number; }

export const waitlistApi = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<WaitlistResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      return await req<WaitlistResponse>(`/api/admin/waitlist?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...waitlistEntries];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(e => e.name?.toLowerCase().includes(s) || e.email.toLowerCase().includes(s)); }
        const p = paginate(filtered, params.page, params.limit);
        return { entries: p.data, total: p.total, page: p.page, totalPages: p.totalPages };
      }
      throw err;
    }
  },

  remove: async (id: string): Promise<void> => {
    try { return await req(`/api/admin/waitlist/${id}`, { method: 'DELETE' }); }
    catch (err) { if (!isNet(err)) throw err; }
  },

  notify: async (subject: string, message: string): Promise<void> => {
    try { return await req('/api/admin/waitlist/notify', { method: 'POST', body: JSON.stringify({ subject, message }) }); }
    catch (err) { if (!isNet(err)) throw err; }
  },
};

// ─── App Config ───────────────────────────────────────────────────────────────

const CONFIG_LS_KEY = 'zavestro_app_config';

export const configApi = {
  get: async (): Promise<ConfigGroup[]> => {
    try { return await req<ConfigGroup[]>('/api/admin/config'); }
    catch (err) {
      if (isNet(err)) {
        const saved = localStorage.getItem(CONFIG_LS_KEY);
        return saved ? JSON.parse(saved) : appConfig;
      }
      throw err;
    }
  },

  save: async (data: ConfigGroup[]): Promise<void> => {
    try { return await req('/api/admin/config', { method: 'PUT', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) { localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(data)); return; }
      throw err;
    }
  },
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogResponse { entries: AuditEntry[]; total: number; page: number; totalPages: number; }

export const auditApi = {
  list: async (params: { search?: string; action?: string; page?: number; limit?: number } = {}): Promise<AuditLogResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.action) qs.set('action', params.action);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      return await req<AuditLogResponse>(`/api/admin/audit-log?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...auditLog];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(e => e.action?.toLowerCase().includes(s) || (e as unknown as Record<string, unknown>).admin?.toString().toLowerCase().includes(s)); }
        const p = paginate(filtered, params.page, params.limit);
        return { entries: p.data, total: p.total, page: p.page, totalPages: p.totalPages };
      }
      throw err;
    }
  },
};

// ─── Collections ─────────────────────────────────────────────────────────────

export interface CollectionDetail extends Collection { productIds?: string[]; }
export interface CollectionsResponse { collections: Collection[]; total: number; }

export const collectionsApi = {
  list: async (params: { search?: string; mode?: string; status?: string } = {}): Promise<CollectionsResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.mode) qs.set('mode', params.mode);
      if (params.status) qs.set('status', params.status);
      return await req<CollectionsResponse>(`/api/admin/catalog/collections?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...adminCollections];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(c => c.name.toLowerCase().includes(s)); }
        if (params.mode && params.mode !== 'All') filtered = filtered.filter(c => c.mode === params.mode);
        if (params.status && params.status !== 'All') filtered = filtered.filter(c => c.status === params.status);
        return { collections: filtered, total: filtered.length };
      }
      throw err;
    }
  },

  get: async (id: string): Promise<CollectionDetail> => {
    try { return await req<CollectionDetail>(`/api/admin/catalog/collections/${id}`); }
    catch (err) {
      if (isNet(err)) return { ...(adminCollections.find(c => c.id === id) ?? adminCollections[0]), productIds: [] };
      throw err;
    }
  },

  create: async (data: Partial<CollectionDetail>): Promise<CollectionDetail> => {
    try { return await req<CollectionDetail>('/api/admin/catalog/collections', { method: 'POST', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { id: `COL-${Date.now()}`, products: 0, sortOrder: 99, hasBanner: false, updated: new Date().toLocaleDateString('en-IN'), ...data } as CollectionDetail;
      throw err;
    }
  },

  update: async (id: string, data: Partial<CollectionDetail>): Promise<CollectionDetail> => {
    try { return await req<CollectionDetail>(`/api/admin/catalog/collections/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { ...(adminCollections.find(c => c.id === id) ?? adminCollections[0]), ...data } as CollectionDetail;
      throw err;
    }
  },

  archive: async (id: string): Promise<void> => {
    try { return await req(`/api/admin/catalog/collections/${id}/archive`, { method: 'POST' }); }
    catch (err) { if (!isNet(err)) throw err; }
  },
};

// ─── Luxe Fabrics ─────────────────────────────────────────────────────────────

export interface LuxeFabricsResponse { fabrics: LuxeFabric[]; total: number; }

export const luxeFabricsApi = {
  list: async (params: { search?: string; material?: string; occasion?: string; status?: string } = {}): Promise<LuxeFabricsResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.material) qs.set('material', params.material);
      if (params.occasion) qs.set('occasion', params.occasion);
      if (params.status) qs.set('status', params.status);
      return await req<LuxeFabricsResponse>(`/api/admin/catalog/luxe-fabrics?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...luxeFabrics];
        if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter(f => f.name.toLowerCase().includes(s)); }
        if (params.material && params.material !== 'All') filtered = filtered.filter(f => f.material === params.material);
        if (params.occasion && params.occasion !== 'All') filtered = filtered.filter(f => f.occasions.includes(params.occasion!));
        if (params.status && params.status !== 'All') filtered = filtered.filter(f => f.status === params.status);
        return { fabrics: filtered, total: filtered.length };
      }
      throw err;
    }
  },

  get: async (id: string): Promise<LuxeFabric> => {
    try { return await req<LuxeFabric>(`/api/admin/catalog/luxe-fabrics/${id}`); }
    catch (err) {
      if (isNet(err)) return luxeFabrics.find(f => f.id === id) ?? luxeFabrics[0];
      throw err;
    }
  },

  create: async (data: Partial<LuxeFabric>): Promise<LuxeFabric> => {
    try { return await req<LuxeFabric>('/api/admin/catalog/luxe-fabrics', { method: 'POST', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { id: `LXF-${Date.now()}`, occasions: [], featuredForSwatchKit: false, updated: new Date().toLocaleDateString('en-IN'), ...data } as LuxeFabric;
      throw err;
    }
  },

  update: async (id: string, data: Partial<LuxeFabric>): Promise<LuxeFabric> => {
    try { return await req<LuxeFabric>(`/api/admin/catalog/luxe-fabrics/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { ...(luxeFabrics.find(f => f.id === id) ?? luxeFabrics[0]), ...data } as LuxeFabric;
      throw err;
    }
  },
};

// ─── Consultations ────────────────────────────────────────────────────────────

export interface ConsultationsResponse { consultations: Consultation[]; total: number; }

export const consultationsApi = {
  list: async (params: { status?: string; occasion?: string; assigned?: string } = {}): Promise<ConsultationsResponse> => {
    try {
      const qs = new URLSearchParams();
      if (params.status) qs.set('status', params.status);
      if (params.occasion) qs.set('occasion', params.occasion);
      if (params.assigned) qs.set('assigned', params.assigned);
      return await req<ConsultationsResponse>(`/api/admin/consultations?${qs}`);
    } catch (err) {
      if (isNet(err)) {
        let filtered = [...adminConsultations];
        if (params.status && params.status !== 'All') filtered = filtered.filter(c => c.status === params.status);
        if (params.occasion && params.occasion !== 'All') filtered = filtered.filter(c => c.occasion === params.occasion);
        if (params.assigned === 'Assigned') filtered = filtered.filter(c => c.stylist !== null);
        if (params.assigned === 'Unassigned') filtered = filtered.filter(c => c.stylist === null);
        return { consultations: filtered, total: filtered.length };
      }
      throw err;
    }
  },

  update: async (id: string, data: Partial<Consultation>): Promise<Consultation> => {
    try { return await req<Consultation>(`/api/admin/consultations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { ...(adminConsultations.find(c => c.id === id) ?? adminConsultations[0]), ...data } as Consultation;
      throw err;
    }
  },
};

// ─── Consultation Slots ───────────────────────────────────────────────────────

export interface ConsultationSlotsResponse { slots: ConsultationSlot[]; total: number; }

export const consultationSlotsApi = {
  list: async (): Promise<ConsultationSlotsResponse> => {
    try { return await req<ConsultationSlotsResponse>('/api/admin/consultation-slots'); }
    catch (err) {
      if (isNet(err)) return { slots: [...consultationSlots], total: consultationSlots.length };
      throw err;
    }
  },

  create: async (data: Omit<ConsultationSlot, 'id'>): Promise<ConsultationSlot> => {
    try { return await req<ConsultationSlot>('/api/admin/consultation-slots', { method: 'POST', body: JSON.stringify(data) }); }
    catch (err) {
      if (isNet(err)) return { id: `SLT-${Date.now()}`, ...data };
      throw err;
    }
  },

  delete: async (id: string): Promise<void> => {
    try { return await req(`/api/admin/consultation-slots/${id}`, { method: 'DELETE' }); }
    catch (err) { if (!isNet(err)) throw err; }
  },
};

export type { AdminOrder, AdminUser, Hub, SupportTicket, AuditEntry, WaitlistEntry, ConfigGroup, OrderStage, Collection, LuxeFabric, Consultation, ConsultationSlot, ConsultationStatus };
