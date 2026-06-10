import { getAdminToken, clearAdminToken } from "./catalogApi";
import type {
  AdminOrder,
  AdminUser,
  Hub,
  SupportTicket,
  TicketMessage,
  AuditEntry,
  WaitlistEntry,
  ConfigGroup,
  ConfigItem,
  OrderStage,
  Collection,
  OrderItem,
  OrderTimelineEntry,
  OrderPayment,
} from "../data/adminMockData";

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://api.zavestro.in";
export const R2_PUBLIC_URL =
  (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ?? "";
const USER_KEY = "zavestro_admin_user";

// ─── User info helpers ────────────────────────────────────────────────────────

export function setAdminUser(user: { email: string; role: string }) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAdminUser(): { email: string; role: string } | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function clearAdminUser() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CAPS_KEY);
}

// ─── Capabilities (role-based UI gating) ──────────────────────────────────────
const CAPS_KEY = "zavestro_admin_caps";

export function setAdminCapabilities(caps: string[]) {
  localStorage.setItem(CAPS_KEY, JSON.stringify(caps ?? []));
}
export function getAdminCapabilities(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CAPS_KEY) || "[]");
  } catch {
    return [];
  }
}
/** True if the signed-in admin's role grants the capability. */
export function hasCapability(cap: string): boolean {
  return getAdminCapabilities().includes(cap);
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isForm ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) {
      clearAdminToken();
      clearAdminUser();
      const err = new Error(
        "Session expired. Please log in again.",
      ) as Error & { status: number };
      err.status = 401;
      throw err;
    }
    let msg = `Error ${res.status}`;
    try {
      const b = await res.json();
      msg = b.message || b.error?.message || b.error || msg;
    } catch {
      /* */
    }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    console.error(
      `[adminApi] ${init.method ?? "GET"} ${path} → ${res.status}:`,
      msg,
    );
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return (
    json && typeof json === "object" && "data" in json ? json.data : json
  ) as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const adminAuth = {
  logout: async () => {
    try {
      await req("/api/admin/auth/logout", { method: "POST" });
    } catch {
      /* */
    }
    clearAdminToken();
    clearAdminUser();
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

type StatShape = { value: number; trend: string; up: boolean };

export interface DashboardData {
  stats: Record<string, StatShape>;
  hubPerformance: {
    name: string;
    city?: string;
    activeOrders: number;
    staffCount: number;
    capacity: number;
    qcPassRate: number;
  }[];
  alerts: { level: string; text: string; link: string }[];
  recentActivity: { icon: string; text: string; time: string }[];
  revenue: { label: string; simplified: number }[];
  ordersByStage: {
    stage: string;
    label: string;
    count: number;
    overdue: number;
  }[];
  urgentTickets: {
    id: string;
    customer: string;
    subject: string;
    created: string;
  }[];
  overdueOrders: {
    id: string;
    customer: string;
    stage: string;
    hub: string;
    created: string;
  }[];
  sparklines: Record<string, number[]>;
}

export const dashboardApi = {
  get: async (period = "month", signal?: AbortSignal): Promise<DashboardData> =>
    req<DashboardData>(`/api/admin/analytics/dashboard?period=${period}`, {
      signal,
    }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrdersParams {
  search?: string;
  stage?: string;
  mode?: string;
  userId?: string;
  page?: number;
  limit?: number;
}
export interface OrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export const ordersApi = {
  list: async (params: OrdersParams = {}): Promise<OrdersResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.stage) qs.set("stage", params.stage);
    if (params.mode) qs.set("mode", params.mode);
    if (params.userId) qs.set("user_id", params.userId);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<OrdersResponse>(`/api/admin/orders?${qs}`);
  },

  get: async (id: string): Promise<AdminOrder> => {
    type DetailResp = {
      order: Record<string, unknown>;
      items: OrderItem[];
      timeline: OrderTimelineEntry[];
      payments: OrderPayment[];
    };
    const data = await req<DetailResp>(`/api/admin/orders/${id}`);
    const o = data.order;
    return {
      id: (o.order_number ?? o.id) as string,
      uuid: o.id as string,
      reference_id: (o.reference_id ?? undefined) as string | undefined,
      customer: (o.customer_name ?? "") as string,
      customer_ref: (o.customer_ref ?? undefined) as string | undefined,
      phone: (o.customer_phone ?? "") as string,
      email: (o.customer_email ?? "") as string,
      user_id: o.user_id as string,
      mode: "Simplified" as AdminOrder["mode"],
      stage: o.stage as OrderStage,
      status: o.lifecycle_status as AdminOrder["status"],
      hub: (o.hub_name ?? "") as string,
      hub_id: (o.hub_id ?? undefined) as string | undefined,
      total: parseFloat(String(o.total_amount ?? 0)),
      products: (data.items ?? []).map((it) => it.product_name).filter(Boolean),
      created: new Date(o.created_at as string).toLocaleDateString("en-IN"),
      items: data.items ?? [],
      timeline: (data.timeline ?? []).map((t) => ({
        ...t,
        event_type:
          ((t as unknown as Record<string, unknown>).event_type as
            | string
            | undefined) ?? "stage_change",
        changed_by_email: (t as unknown as Record<string, unknown>)
          .changed_by_email as string | null | undefined,
        metadata: (t as unknown as Record<string, unknown>).metadata as
          | Record<string, unknown>
          | null
          | undefined,
      })),
      payments: data.payments ?? [],
      craftsperson_id: (o.craftsperson_id ?? null) as string | null,
      craftsperson_name: (o.craftsperson_name ?? null) as string | null,
      craftsperson_role: (o.craftsperson_role ?? null) as string | null,
      craftsperson_ref: (o.craftsperson_ref ?? null) as string | null,
      qc_staff_id: (o.qc_staff_id ?? null) as string | null,
      qc_staff_name: (o.qc_staff_name ?? null) as string | null,
      qc_staff_role: (o.qc_staff_role ?? null) as string | null,
      qc_staff_ref: (o.qc_staff_ref ?? null) as string | null,
      linked_measurement_booking_id: (o.linked_measurement_booking_id ??
        null) as string | null,
      linked_measurement_booking_ref: (o.linked_measurement_booking_ref ??
        null) as string | null,
      linked_home_visit_id: (o.linked_home_visit_id ?? null) as string | null,
      linked_home_visit_ref: (o.linked_home_visit_ref ?? null) as string | null,
      fit_profile_id: (o.fit_profile_id ?? null) as string | null,
      estimated_delivery_date: (o.estimated_delivery_date ?? null) as
        | string
        | null,
      on_hold_reason: (o.on_hold_reason ?? null) as string | null,
      cancellation_reason: (o.cancellation_reason ?? null) as string | null,
    };
  },

  updateStage: async (
    id: string,
    stage: OrderStage,
    reason?: string,
  ): Promise<Pick<AdminOrder, "stage" | "status">> => {
    const o = await req<Record<string, unknown>>(
      `/api/admin/orders/${id}/stage`,
      { method: "PUT", body: JSON.stringify({ stage, reason }) },
    );
    return {
      stage: o.stage as OrderStage,
      status: o.lifecycle_status as AdminOrder["status"],
    };
  },

  assignCraftsperson: async (
    orderId: string,
    staffId: string | null,
  ): Promise<void> =>
    req(`/api/admin/orders/${orderId}/assign-craftsperson`, {
      method: "PUT",
      body: JSON.stringify({ staff_id: staffId }),
    }),

  assignQCStaff: async (
    orderId: string,
    staffId: string | null,
  ): Promise<void> =>
    req(`/api/admin/orders/${orderId}/assign-qc-staff`, {
      method: "PUT",
      body: JSON.stringify({ staff_id: staffId }),
    }),

  addTimelineNote: async (
    orderId: string,
    note: string,
  ): Promise<OrderTimelineEntry> =>
    req<OrderTimelineEntry>(`/api/admin/orders/${orderId}/timeline`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  updateLifecycle: async (
    orderId: string,
    data: {
      estimated_delivery_date?: string | null;
      on_hold_reason?: string | null;
      linked_measurement_booking_id?: string | null;
      linked_home_visit_id?: string | null;
      fit_profile_id?: string | null;
    },
  ): Promise<void> =>
    req(`/api/admin/orders/${orderId}/lifecycle`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  linkMeasurement: async (
    orderId: string,
    measurementBookingId: string,
  ): Promise<void> =>
    req(`/api/admin/orders/${orderId}/link-measurement`, {
      method: "PUT",
      body: JSON.stringify({ measurement_booking_id: measurementBookingId }),
    }),

  advance: async (
    orderId: string,
    toStage: OrderStage,
    note?: string,
  ): Promise<void> =>
    req(`/api/admin/orders/${orderId}/advance`, {
      method: "PUT",
      body: JSON.stringify({ to_stage: toStage, note }),
    }),

  create: async (data: {
    user_id: string;
    hub_id: string;
    mode: "simplified";
    delivery_address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
    };
    items: {
      variant_id?: string;
      product_name: string;
      unit_price: number;
      quantity: number;
    }[];
    payment_method?: "cod" | "offline_transfer" | "already_paid";
    internal_note?: string;
  }): Promise<{ id: string; order_number: string }> =>
    req<{ id: string; order_number: string }>("/api/admin/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UsersParams {
  search?: string;
  status?: string;
  city?: string;
  page?: number;
  limit?: number;
}
export interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

function mapUser(u: Record<string, unknown>): AdminUser {
  return {
    id: u.id as string,
    reference_id: (u.reference_id ?? undefined) as string | undefined,
    name: (u.name ?? "") as string,
    phone: (u.phone ?? "") as string,
    email: (u.email ?? "") as string,
    city: (u.city ?? "") as string,
    orders: (u.order_count ?? u.orders ?? 0) as number,
    credits: Math.round(parseFloat(String(u.credits ?? u.wallet_balance ?? 0))),
    joined: u.created_at
      ? new Date(u.created_at as string).toLocaleDateString("en-IN")
      : ((u.joined ?? "") as string),
    status: (u.is_active !== undefined
      ? u.is_active
        ? "Active"
        : "Deactivated"
      : (u.status ?? "Active")) as AdminUser["status"],
  };
}

export const usersApi = {
  list: async (params: UsersParams = {}): Promise<UsersResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const raw = await req<{
      users: Record<string, unknown>[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/api/admin/users?${qs}`);
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
    if (data.status !== undefined) body.is_active = data.status === "Active";
    const u = await req<Record<string, unknown>>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return mapUser(u);
  },

  create: async (data: {
    phone: string;
    name?: string;
    email?: string;
    generate_password?: boolean;
  }): Promise<AdminUser & { temp_password?: string }> => {
    const raw = await req<Record<string, unknown>>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return {
      ...mapUser(raw),
      temp_password: raw.temp_password as string | undefined,
    };
  },

  issueCredits: async (
    id: string,
    amount: number,
    reason: string,
  ): Promise<void> =>
    req(`/api/admin/users/${id}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  addNote: async (id: string, note: string): Promise<void> =>
    req(`/api/admin/users/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
};

// ─── Hubs ─────────────────────────────────────────────────────────────────────

export interface HubsParams {
  search?: string;
  city?: string;
  status?: string;
  page?: number;
  limit?: number;
}
export interface HubsResponse {
  hubs: Hub[];
  total: number;
}

function mapHub(h: Record<string, unknown>): Hub {
  const activeOrders = (h.activeOrders ?? h.active_orders ?? 0) as number;
  const staffCount = (h.staffCount ?? h.staff_count ?? 0) as number;
  const tailorCount = (h.tailorCount ?? h.tailor_count ?? 0) as number;
  const qcCount = (h.qcCount ?? h.qc_count ?? 0) as number;
  const capacityUsed =
    staffCount > 0
      ? Math.min(100, Math.round((activeOrders / staffCount) * 20))
      : 0;
  return {
    id: h.id as string,
    reference_id: (h.reference_id ?? undefined) as string | undefined,
    name: (h.name as string) ?? "",
    city: (h.city as string) ?? "",
    state: (h.state as string) ?? "",
    address: (h.address as string) ?? "",
    pincode: (h.pincode as string) ?? "",
    phone: (h.phone as string) ?? "",
    status: (h.status ??
      (h.is_active ? "Active" : "Inactive")) as Hub["status"],
    activeOrders,
    staffCount,
    tailorCount,
    qcCount,
    capacityUsed,
    qcPassRate: (h.qcPassRate as number) ?? 100,
    managerName: (h.managerName ?? h.manager_name ?? "") as string,
    managerPhone: (h.managerPhone ?? h.manager_phone ?? "") as string,
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
    req<{ pincodes: HubPincode[] }>(`/api/admin/hubs/${hubId}/pincodes`).then(
      (r) => r.pincodes ?? [],
    ),

  add: async (
    hubId: string,
    pincodes: { pincode: string; area_name: string }[],
  ): Promise<{ added: HubPincode[] }> =>
    req<{ added: HubPincode[] }>(`/api/admin/hubs/${hubId}/pincodes`, {
      method: "POST",
      body: JSON.stringify({ pincodes }),
    }),

  toggle: async (
    _hubId: string,
    pincodeId: string,
    is_active: boolean,
  ): Promise<HubPincode> =>
    req<HubPincode>(`/api/admin/system/service-pincodes/${pincodeId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),

  remove: async (hubId: string, pincode: string): Promise<void> =>
    req(`/api/admin/hubs/${hubId}/pincodes/${encodeURIComponent(pincode)}`, {
      method: "DELETE",
    }),
};

export const hubsApi = {
  list: async (params: HubsParams = {}): Promise<HubsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.city) qs.set("city", params.city);
    if (params.status) qs.set("status", params.status);
    const raw = await req<{ hubs: Record<string, unknown>[]; total: number }>(
      `/api/admin/hubs?${qs}`,
    );
    return { hubs: (raw.hubs ?? []).map(mapHub), total: raw.total ?? 0 };
  },

  get: async (id: string): Promise<Hub> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/hubs/${id}`);
    return mapHub(raw);
  },

  create: async (data: Partial<Hub>): Promise<Hub> => {
    const { status, managerName, managerPhone, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (status !== undefined) body.is_active = status === "Active";
    if (managerName !== undefined) body.manager_name = managerName;
    if (managerPhone !== undefined) body.manager_phone = managerPhone;
    const raw = await req<Record<string, unknown>>("/api/admin/hubs", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return mapHub(raw);
  },

  update: async (id: string, data: Partial<Hub>): Promise<Hub> => {
    const { status, managerName, managerPhone, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (status !== undefined) body.is_active = status === "Active";
    if (managerName !== undefined) body.manager_name = managerName;
    if (managerPhone !== undefined) body.manager_phone = managerPhone;
    const raw = await req<Record<string, unknown>>(`/api/admin/hubs/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return mapHub(raw);
  },
};

// ─── Support ──────────────────────────────────────────────────────────────────

export interface TicketsParams {
  search?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}
export interface TicketsResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
}

function mapTicket(t: Record<string, unknown>): SupportTicket {
  const STATUS_MAP: Record<string, SupportTicket["status"]> = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  const PRIORITY_MAP: Record<string, SupportTicket["priority"]> = {
    urgent: "High",
    high: "High",
    normal: "Medium",
    medium: "Medium",
    low: "Low",
  };
  return {
    id: t.id as string,
    reference_id: (t.reference_id ?? undefined) as string | undefined,
    customer: (t.customer_name ?? t.customer ?? "") as string,
    customer_ref: (t.customer_ref ?? undefined) as string | undefined,
    phone: (t.customer_phone ?? t.phone ?? "") as string,
    subject: (t.subject ?? "") as string,
    category: (t.category ?? "General") as string,
    priority:
      PRIORITY_MAP[t.priority as string] ??
      (t.priority as SupportTicket["priority"]) ??
      "Medium",
    status:
      STATUS_MAP[t.status as string] ??
      (t.status as SupportTicket["status"]) ??
      "Open",
    assignedTo: (t.assigned_to ?? t.assignedTo ?? null) as string | null,
    created: t.created_at
      ? new Date(t.created_at as string).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : ((t.created as string) ?? ""),
    lastActivity: t.updated_at
      ? new Date(t.updated_at as string).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : ((t.lastActivity as string) ?? ""),
    messages: (t.messages as SupportTicket["messages"]) ?? undefined,
  };
}

export const supportApi = {
  create: async (data: Record<string, any>): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>("/api/admin/support", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return mapTicket(raw);
  },

  list: async (params: TicketsParams = {}): Promise<TicketsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    if (params.priority) qs.set("priority", params.priority);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const raw = await req<{
      tickets: Record<string, unknown>[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/api/admin/support?${qs}`);
    return { ...raw, tickets: raw.tickets.map(mapTicket) };
  },

  get: async (id: string): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/support/${id}`);
    return mapTicket(raw);
  },

  update: async (
    id: string,
    data: Partial<SupportTicket>,
  ): Promise<SupportTicket> => {
    const STATUS_TO_DB: Record<string, string> = {
      Open: "open",
      "In Progress": "in_progress",
      Resolved: "resolved",
      Closed: "closed",
    };
    const PRIORITY_TO_DB: Record<string, string> = {
      High: "high",
      Medium: "normal",
      Low: "low",
    };
    const body: Record<string, unknown> = { ...data };
    if (data.status && STATUS_TO_DB[data.status])
      body.status = STATUS_TO_DB[data.status];
    if (data.priority && PRIORITY_TO_DB[data.priority])
      body.priority = PRIORITY_TO_DB[data.priority];
    const raw = await req<Record<string, unknown>>(`/api/admin/support/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return mapTicket(raw);
  },

  addReply: async (
    id: string,
    message: string,
    internal = false,
  ): Promise<void> =>
    req(`/api/admin/support/${id}/replies`, {
      method: "POST",
      body: JSON.stringify({ body: message, internal }),
    }),

  assign: async (
    id: string,
    assigned_to: string | null,
  ): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>(
      `/api/admin/support/${id}/assign`,
      { method: "PUT", body: JSON.stringify({ assigned_to }) },
    );
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
  get: async (period = "month"): Promise<AnalyticsData> =>
    req<AnalyticsData>(`/api/admin/analytics?period=${period}`),
};

// ─── App Config ───────────────────────────────────────────────────────────────

function inferConfigType(key: string, value: unknown): ConfigItem["type"] {
  if (typeof value === "boolean") return "boolean";
  if (/price|fee|amount|threshold|min_|max_/.test(key)) return "currency";
  if (/percent|rate_target/.test(key)) return "percentage";
  if (/days/.test(key)) return "days";
  if (/hours/.test(key)) return "hours";
  return "number";
}

export const configApi = {
  get: async (): Promise<ConfigGroup[]> => {
    const rows =
      await req<{ key: string; value: unknown; description?: string }[]>(
        "/api/admin/config",
      );
    if (!rows || rows.length === 0) return [];
    const items = rows.map((r) => ({
      key: r.key,
      label: r.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: r.value as ConfigItem["value"],
      type: inferConfigType(r.key, r.value),
      description: r.description,
    }));
    return [{ title: "App Configuration", items }];
  },

  save: async (data: ConfigGroup[]): Promise<void> => {
    const entries = data.flatMap((g) =>
      g.items.map((item) => ({ key: item.key, value: item.value })),
    );
    return req("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify(entries),
    });
  },
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export const auditApi = {
  list: async (
    params: {
      search?: string;
      action?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<AuditLogResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.action) qs.set("action", params.action);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const raw = await req<{
      entries: Record<string, unknown>[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/api/admin/audit-log?${qs}`);
    return {
      ...raw,
      entries: (raw.entries ?? []).map((e) => ({
        id: e.id as string,
        timestamp: e.timestamp
          ? new Date(e.timestamp as string).toLocaleString("en-IN")
          : e.created_at
            ? new Date(e.created_at as string).toLocaleString("en-IN")
            : "",
        admin: (e.admin ?? e.email ?? "") as string,
        action: (e.action ?? "") as string,
        entityType: (e.entityType ?? e.entity_type ?? "") as string,
        entityId: (e.entityId ?? e.entity_id ?? "") as string,
        ip: (e.ip ?? "") as string,
      })),
    };
  },
};

// ─── Collections ─────────────────────────────────────────────────────────────

export interface CollectionDetail extends Collection {
  productIds?: string[];
  description?: string;
  cover_image?: string | null;
}
export interface CollectionsResponse {
  collections: Collection[];
  total: number;
}

function mapCollection(c: Record<string, unknown>): Collection {
  return {
    id: c.id as string,
    name: c.name as string,
    slug: c.slug as string,
    products: (c.product_count as number) ?? (c.products as number) ?? 0,
    status: ((c.status as string) ?? "Draft") as Collection["status"],
    sortOrder: (c.sort_order as number) ?? (c.sortOrder as number) ?? 0,
    hasBanner: !!c.cover_image,
    season: (c.season as string) ?? "",
    updated: c.updated_at
      ? new Date(c.updated_at as string).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—",
    type: ((c.type as string) ?? "standard") as Collection["type"],
    subtitle: (c.subtitle as string) ?? "",
    bg_color_1: (c.bg_color_1 as string) ?? "",
    bg_color_2: (c.bg_color_2 as string) ?? "",
  };
}

function mapCollectionDetail(c: Record<string, unknown>): CollectionDetail {
  const prods = (c.products as { id: string }[] | undefined) ?? [];
  return {
    ...mapCollection(c),
    description: (c.description as string) ?? "",
    productIds: prods.map((p) => p.id),
    cover_image: (c.cover_image as string | null | undefined) ?? null,
  };
}

export const collectionsApi = {
  list: async (
    params: { search?: string; status?: string } = {},
  ): Promise<CollectionsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    const raw = await req<{
      collections: Record<string, unknown>[];
      total: number;
    }>(`/api/admin/catalog/collections?${qs}`);
    return {
      collections: (raw.collections ?? []).map(mapCollection),
      total: raw.total ?? 0,
    };
  },

  get: async (id: string): Promise<CollectionDetail> => {
    const raw = await req<Record<string, unknown>>(
      `/api/admin/catalog/collections/${id}`,
    );
    return mapCollectionDetail(raw);
  },

  create: async (
    data: Partial<CollectionDetail>,
  ): Promise<CollectionDetail> => {
    const raw = await req<Record<string, unknown>>(
      "/api/admin/catalog/collections",
      { method: "POST", body: JSON.stringify(data) },
    );
    return mapCollectionDetail(raw);
  },

  update: async (
    id: string,
    data: Partial<CollectionDetail>,
  ): Promise<CollectionDetail> => {
    const raw = await req<Record<string, unknown>>(
      `/api/admin/catalog/collections/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
    );
    return mapCollectionDetail(raw);
  },

  archive: async (id: string): Promise<void> =>
    req(`/api/admin/catalog/collections/${id}/archive`, { method: "POST" }),

  addProduct: async (
    collectionId: string,
    productId: string,
    sortOrder = 0,
  ): Promise<void> =>
    req(`/api/admin/catalog/collections/${collectionId}/products`, {
      method: "POST",
      body: JSON.stringify({ product_id: productId, sort_order: sortOrder }),
    }),

  removeProduct: async (
    collectionId: string,
    productId: string,
  ): Promise<void> =>
    req(
      `/api/admin/catalog/collections/${collectionId}/products/${productId}`,
      { method: "DELETE" },
    ),
};

// ─── Banners ──────────────────────────────────────────────────────────────────

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  image_key: string;
  cta_text: string;
  cta_link: string;
  bg_color_1: string;
  bg_color_2: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  image_only: boolean;
  created_at: string;
  updated_at: string;
}

export type BannerPayload = Partial<
  Omit<Banner, "id" | "created_at" | "updated_at">
>;

export const bannersApi = {
  list: (): Promise<Banner[]> => req<Banner[]>("/api/admin/catalog/banners"),

  create: (data: BannerPayload): Promise<Banner> =>
    req<Banner>("/api/admin/catalog/banners", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: BannerPayload): Promise<Banner> =>
    req<Banner>(`/api/admin/catalog/banners/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    req(`/api/admin/catalog/banners/${id}`, { method: "DELETE" }),
};

// ─── Home sections (server-driven homepage layout) ────────────────────────────
export type HomeSection = {
  id: string;
  type: "hero" | "occasions" | "new_arrivals" | "collection" | "categories";
  title: string | null;
  collection_slug: string | null;
  item_limit: number;
  sort_order: number;
  is_active: boolean;
};
export type HomeSectionPayload = Partial<Omit<HomeSection, "id">>;

export const homeSectionsApi = {
  list: (): Promise<HomeSection[]> =>
    req<HomeSection[]>("/api/admin/catalog/home-sections"),
  create: (data: HomeSectionPayload): Promise<HomeSection> =>
    req<HomeSection>("/api/admin/catalog/home-sections", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: HomeSectionPayload): Promise<HomeSection> =>
    req<HomeSection>(`/api/admin/catalog/home-sections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string): Promise<void> =>
    req(`/api/admin/catalog/home-sections/${id}`, { method: "DELETE" }),
};

// ─── R2 upload utility ────────────────────────────────────────────────────────

export async function uploadToR2(
  file: File,
  folder = "uploads",
): Promise<string> {
  const { upload_url, object_key } = await req<{
    upload_url: string;
    object_key: string;
  }>("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({
      content_type: file.type || "image/jpeg",
      file_size: file.size,
      folder,
    }),
  });
  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!putRes.ok) throw new Error(`Upload failed (HTTP ${putRes.status})`);
  return object_key;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface AdminReview {
  id: string;
  user_id: string;
  user_name: string;
  order_id: string;
  product_id: string;
  product_name: string;
  rating: number;
  comment: string | null;
  photo_keys: string[];
  is_approved: boolean;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingReviewsResponse {
  reviews: AdminReview[];
  total: number;
  page: number;
  limit: number;
}

export const reviewsApi = {
  listPending: (page = 1, limit = 25): Promise<PendingReviewsResponse> =>
    req<PendingReviewsResponse>(
      `/api/reviews/pending?page=${page}&limit=${limit}`,
    ),

  moderate: (id: string, approve: boolean): Promise<void> =>
    req<void>(`/api/reviews/${id}/moderate`, {
      method: "POST",
      body: JSON.stringify({ approve }),
    }),
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

export interface ReturnsResponse {
  returns: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
}

export const returnsApi = {
  list: async (
    params: { status?: string; page?: number; limit?: number } = {},
  ): Promise<ReturnsResponse> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<ReturnsResponse>(`/api/admin/returns?${qs}`);
  },

  get: async (id: string): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns/${id}`),

  review: async (
    id: string,
    data: { status: string; review_note?: string; refund_amount?: number },
  ): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns/${id}/override`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
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

export interface AlterationsResponse {
  alterations: AlterationRequest[];
  total: number;
  page: number;
  limit: number;
}

export const alterationsApi = {
  list: async (
    params: { status?: string; page?: number; limit?: number } = {},
  ): Promise<AlterationsResponse> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<AlterationsResponse>(`/api/admin/alterations?${qs}`);
  },

  get: async (id: string): Promise<AlterationRequest> =>
    req<AlterationRequest>(`/api/admin/alterations/${id}`),
};

// ─── Sample jobs (design verify gate — P3 item 28) ────────────────────────────

export interface SampleJob {
  id: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  status:
    | "requested"
    | "cutting"
    | "stitching"
    | "design_review"
    | "reviewed"
    | "approved"
    | "rejected";
  assigned_tailor_id: string | null;
  photo_keys: string[];
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  design_name: string;
  fabric_name: string;
  fabric_code: string | null;
  fabric_image_keys: string[] | null;
  tailor_name: string | null;
}

export interface SampleComment {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
}

export interface SampleJobDetail {
  id: string;
  status: SampleJob["status"];
  photo_keys: string[];
  rejection_reason: string | null;
  hub_id: string;
  hub_name: string | null;
  tailor_name: string | null;
  created_at: string;
  updated_at: string;
  comments: SampleComment[];
  design: {
    id: string;
    name: string;
    garment_type: string;
    garment_slug: string;
    gender: string | null;
    style: string | null;
    fit_preset: string | null;
    meters_per_garment: string | null;
    tech_pack: Record<string, unknown> | null;
    reference_image_keys: string[];
    capture_set: unknown;
    pain_point_menu: Record<string, unknown> | null;
    status: string;
  };
  fabric: {
    id: string;
    name: string;
    code: string | null;
    composition: string | null;
    weave: string | null;
    finish: string | null;
    weight_gsm: number | null;
    care_instructions: string | null;
    origin: string | null;
    price_per_meter: string | null;
    image_keys: string[];
  };
}

export const sampleJobsApi = {
  list: async (
    params: { status?: string; hub_id?: string } = {},
  ): Promise<SampleJob[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    const q = qs.toString();
    return req<SampleJob[]>(`/api/admin/sample-jobs${q ? `?${q}` : ""}`);
  },

  get: async (id: string): Promise<SampleJobDetail> =>
    req<SampleJobDetail>(`/api/admin/sample-jobs/${id}`),

  // Advisory review: mark the sample 'reviewed' (non-blocking; no reject).
  review: async (id: string): Promise<SampleJob> =>
    req<SampleJob>(`/api/admin/sample-jobs/${id}/review`, { method: "POST" }),

  addComment: async (id: string, body: string): Promise<SampleComment> =>
    req<SampleComment>(`/api/admin/sample-jobs/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  // Design requests a sample (design × fabric × hub) → goes to the hub.
  request: async (input: {
    design_id: string;
    fabric_id: string;
    hub_id: string;
  }): Promise<SampleJob> =>
    req<SampleJob>(`/api/admin/sample-jobs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

// ─── Designs (central design library — P3 item 28) ────────────────────────────

export type DesignStatus = "draft" | "published" | "archived";

export interface DesignSummary {
  id: string;
  name: string;
  gender: string | null;
  style: string | null;
  fit_preset: string | null;
  meters_per_garment: string | null;
  status: DesignStatus;
  garment_type: string;
  garment_slug: string;
  reference_image_keys: string[];
  fabric_count: number;
  fabric_swatches?: string[];
  cover_key: string | null;
  updated_at: string;
}

export interface DesignFabricRef {
  id: string;
  name: string;
  code: string | null;
  color_name: string | null;
  composition: string | null;
  image_keys: string[];
  meters_per_garment: string | null;
}

export interface DesignDetail {
  id: string;
  name: string;
  gender: string | null;
  style: string | null;
  fit_preset: string | null;
  meters_per_garment: string | null;
  status: DesignStatus;
  garment_type: string;
  garment_slug: string;
  garment_category_id: string;
  tech_pack: Record<string, unknown> | null;
  capture_set: unknown;
  pain_point_menu: Record<string, unknown> | null;
  reference_image_keys: string[];
  template_capture_set: unknown;
  template_pain_point_menu: Record<string, unknown> | null;
  template_fit_presets: string[] | null;
  created_at: string;
  updated_at: string;
  fabrics: DesignFabricRef[];
}

export interface FabricOption {
  id: string;
  name: string;
  code: string | null;
  composition: string | null;
  weave: string | null;
  image_keys: string[];
}

export interface DesignInput {
  name: string;
  garment_category_id: string;
  gender?: string;
  style?: string | null;
  fit_preset?: string | null;
  meters_per_garment?: number;
  tech_pack?: Record<string, unknown> | null;
  capture_set?: unknown;
  pain_point_menu?: Record<string, unknown> | null;
  reference_image_keys?: string[];
  fabrics?: { fabric_id: string; meters_per_garment?: number | null }[];
}

export interface GarmentCategoryOption {
  id: string;
  name: string;
  slug: string;
  body_region: string | null;
  capture_set: unknown;
  pain_point_menu: Record<string, unknown> | null;
  available_fit_presets: string[] | null;
}

export interface ChartRow {
  fit_preset: string | null;
  size_label: string;
  measurements: Record<string, number>;
}
export interface GarmentTemplate {
  id: string;
  name: string;
  slug: string;
  body_region: string | null;
  capture_set: string[] | null;
  pain_point_menu: Record<string, Record<string, number>> | null;
  available_fit_presets: string[] | null;
  chart: ChartRow[];
}
export interface GarmentTemplateInput {
  capture_set: string[];
  pain_point_menu: Record<string, Record<string, number>>;
  available_fit_presets: string[];
  chart: ChartRow[];
}

export interface DesignOverviewRow {
  id: string;
  name: string;
  status: DesignStatus;
  gender: string | null;
  garment_type: string;
  fabrics: string[];
  hubs: string[];
  units_sold: number;
}

export const designsApi = {
  list: async (
    params: {
      status?: string;
      garment_category_id?: string;
      gender?: string;
      q?: string;
    } = {},
  ): Promise<DesignSummary[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.garment_category_id)
      qs.set("garment_category_id", params.garment_category_id);
    if (params.gender) qs.set("gender", params.gender);
    if (params.q) qs.set("q", params.q);
    const q = qs.toString();
    return req<DesignSummary[]>(`/api/admin/designs${q ? `?${q}` : ""}`);
  },

  get: async (id: string): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs/${id}`),

  fabricOptions: async (): Promise<FabricOption[]> =>
    req<FabricOption[]>(`/api/admin/designs/fabric-options`),

  garmentCategories: async (): Promise<GarmentCategoryOption[]> =>
    req<GarmentCategoryOption[]>(`/api/admin/designs/garment-categories`),

  overview: async (): Promise<DesignOverviewRow[]> =>
    req<DesignOverviewRow[]>(`/api/admin/designs/overview`),

  getTemplate: async (categoryId: string): Promise<GarmentTemplate> =>
    req<GarmentTemplate>(
      `/api/admin/designs/garment-categories/${categoryId}/template`,
    ),

  saveTemplate: async (
    categoryId: string,
    input: GarmentTemplateInput,
  ): Promise<GarmentTemplate> =>
    req<GarmentTemplate>(
      `/api/admin/designs/garment-categories/${categoryId}/template`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),

  create: async (input: DesignInput): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: async (id: string, input: DesignInput): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  setStatus: async (id: string, status: DesignStatus): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

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

export interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export const invoicesApi = {
  list: async (
    params: {
      orderId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<InvoicesResponse> => {
    const qs = new URLSearchParams();
    if (params.orderId) qs.set("orderId", params.orderId);
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<InvoicesResponse>(`/api/admin/invoices?${qs}`);
  },

  get: async (id: string): Promise<Invoice> =>
    req<Invoice>(`/api/admin/invoices/${id}`),

  regenerate: async (id: string): Promise<void> =>
    req(`/api/admin/invoices/${id}/regenerate`, { method: "POST" }),

  getDownloadUrl: async (id: string): Promise<{ url: string }> =>
    req<{ url: string }>(`/api/admin/invoices/${id}/download`),

  generateForOrder: async (
    orderId: string,
  ): Promise<{ invoice_id: string; message: string }> =>
    req<{ invoice_id: string; message: string }>(
      `/api/admin/orders/${orderId}/invoice`,
      { method: "POST" },
    ),
};

// ─── COD Finance Reconciliation ─────────────────────────────────────────────────

export interface CodDeposit {
  id: string;
  hub_id: string;
  hub_name: string;
  staff_name: string;
  order_count: number;
  total_amount: number;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  created_at: string;
}

export interface CodReconciliationParams {
  hub_id?: string;
  start_date?: string;
  end_date?: string;
  status?: "pending" | "confirmed";
}

function codReconciliationQs(params: CodReconciliationParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.hub_id) qs.set("hub_id", params.hub_id);
  if (params.start_date) qs.set("start_date", params.start_date);
  if (params.end_date) qs.set("end_date", params.end_date);
  if (params.status) qs.set("status", params.status);
  return qs;
}

export const codReconciliationApi = {
  list: async (params: CodReconciliationParams = {}): Promise<CodDeposit[]> =>
    req<CodDeposit[]>(
      `/api/admin/finance/cod-reconciliation?${codReconciliationQs(params)}`,
    ),

  // Streams a CSV file from the server and triggers a browser download.
  downloadCsv: async (params: CodReconciliationParams = {}): Promise<void> => {
    const qs = codReconciliationQs(params);
    qs.set("format", "csv");
    const token = getAdminToken();
    const res = await fetch(
      `${BASE}/api/admin/finance/cod-reconciliation?${qs}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cod-reconciliation.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── Finance reports (P2e-3 backend; reports:read) ────────────────────────────
export interface FinanceReportParams {
  hub_id?: string;
  start_date?: string;
  end_date?: string;
}
export interface SettlementHub {
  hub_id: string | null;
  hub_name: string | null;
  orders: number;
  gross_online: number;
  refunded: number;
  net_settled: number;
}
export interface SettlementReport {
  method: string;
  hubs: SettlementHub[];
  totals: { gross_online: number; refunded: number; net_settled: number };
}
export interface PnlHub {
  hub_id: string | null;
  hub_name: string | null;
  orders: number;
  revenue: number;
  fabric_cost: number;
  refunds: number;
  profit: number;
}
export interface PnlReport {
  hubs: PnlHub[];
  totals: {
    revenue: number;
    fabric_cost: number;
    refunds: number;
    profit: number;
  };
  note: string;
}

function financeQs(p: FinanceReportParams): string {
  const qs = new URLSearchParams();
  if (p.hub_id) qs.set("hub_id", p.hub_id);
  if (p.start_date) qs.set("start_date", p.start_date);
  if (p.end_date) qs.set("end_date", p.end_date);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const financeApi = {
  settlement: (p: FinanceReportParams = {}): Promise<SettlementReport> =>
    req<SettlementReport>(`/api/admin/finance/settlement${financeQs(p)}`),
  pnl: (p: FinanceReportParams = {}): Promise<PnlReport> =>
    req<PnlReport>(`/api/admin/finance/pnl${financeQs(p)}`),
};

// ─── Notification Blast ──────────────────────────────────────────────────────────

export interface BlastPayload {
  subject: string;
  headline: string;
  body: string;
  pushBody?: string;
  ctaText?: string;
  ctaUrl?: string;
  segment: "all" | "opted_in";
}

export const notificationsAdminApi = {
  blast: async (payload: BlastPayload): Promise<{ users_targeted: number }> =>
    req<{ users_targeted: number }>(`/api/admin/notifications/blast`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── Admin inbox (hand-off notifications) ─────────────────────────────────────

export interface AdminNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  deep_link: string | null;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
}
export const adminInboxApi = {
  list: async (unreadOnly = false): Promise<AdminNotification[]> =>
    req<{ notifications: AdminNotification[]; unread_count: number }>(
      `/api/admin/notifications${unreadOnly ? "?unread=true" : ""}`,
    ).then((r) => r.notifications),
  markRead: async (id: string): Promise<void> => {
    await req(`/api/admin/notifications/${id}/read`, { method: "POST" });
  },
  markAllRead: async (): Promise<void> => {
    await req(`/api/admin/notifications/read-all`, { method: "POST" });
  },
};

// ─── Pincode Demand (waitlist for unserved pincodes) ─────────────────────────────

export interface PincodeDemand {
  pincode: string;
  total_waiting: number;
  notified: number;
  is_served: boolean | null;
  area_name: string | null;
  city: string | null;
  first_signup_at: string;
}

export const pincodeWaitlistApi = {
  list: async (): Promise<PincodeDemand[]> =>
    req<{ waitlist: PincodeDemand[] }>(
      `/api/admin/system/pincode-waitlist`,
    ).then((r) => r.waitlist),
};

// ─── Design analytics (fit accuracy + design performance) ─────────────────────

export interface FitAccuracyTotals {
  delivered: number;
  fit_issues: number;
  fit_accuracy_pct: number;
}
export interface FitAccuracy {
  hubs: {
    hub_id: string | null;
    hub_name: string | null;
    delivered: number;
    fit_issues: number;
    fit_accuracy_pct: number;
  }[];
  totals: FitAccuracyTotals;
  note?: string;
}
export interface DesignPerformanceRow {
  design_id: string;
  design_name: string;
  orders: number;
  units: number;
  fit_issue_orders: number;
  fit_accuracy_pct: number;
}

export const designAnalyticsApi = {
  fitAccuracy: async (): Promise<FitAccuracy> =>
    req<FitAccuracy>(`/api/admin/analytics/fit-accuracy`),
  designPerformance: async (): Promise<{ designs: DesignPerformanceRow[] }> =>
    req<{ designs: DesignPerformanceRow[] }>(
      `/api/admin/analytics/design-performance`,
    ),
};

// ─── Fabrics Master (procurement) ─────────────────────────────────────────────

export interface Fabric {
  id: string;
  code: string;
  name: string;
  color_name: string | null;
  composition: string;
  weight_gsm: number | null;
  weave: string | null;
  finish: string | null;
  origin: string | null;
  supplier: string | null;
  care_instructions: string[];
  image_keys: string[];
  price_per_meter: string | null;
  is_active: boolean;
  created_at: string;
  design_count?: number;
  listing_count?: number;
}
export interface FabricInput {
  name: string;
  color_name?: string | null;
  composition: string;
  weight_gsm?: number | null;
  weave?: string | null;
  finish?: string | null;
  origin?: string | null;
  supplier?: string | null;
  care_instructions?: string[];
  image_keys: string[]; // ≥1 required (swatch)
  price_per_meter?: number | null;
}

export const fabricsApi = {
  list: async (
    params: { q?: string; active?: boolean } = {},
  ): Promise<Fabric[]> => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.active !== undefined) qs.set("active", String(params.active));
    const s = qs.toString();
    return req<Fabric[]>(`/api/admin/fabrics${s ? `?${s}` : ""}`);
  },
  get: async (id: string): Promise<Fabric> =>
    req<Fabric>(`/api/admin/fabrics/${id}`),
  create: async (input: FabricInput): Promise<Fabric> =>
    req<Fabric>(`/api/admin/fabrics`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: async (id: string, input: FabricInput): Promise<Fabric> =>
    req<Fabric>(`/api/admin/fabrics/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  setActive: async (id: string, is_active: boolean): Promise<Fabric> =>
    req<Fabric>(`/api/admin/fabrics/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),
  stock: async (params: { hub_id?: string } = {}): Promise<FabricStockRow[]> =>
    req<FabricStockRow[]>(
      `/api/admin/fabrics/stock${params.hub_id ? `?hub_id=${params.hub_id}` : ""}`,
    ),
  atHub: async (hubId: string, fabricId: string): Promise<FabricAtHub> =>
    req<FabricAtHub>(
      `/api/admin/fabrics/at-hub?hub_id=${hubId}&fabric_id=${fabricId}`,
    ),
};

export interface FabricMovement {
  kind: "distribution" | "restock" | "listing";
  id: string;
  status: string;
  qty: string | number;
  created_at: string;
  updated_at: string;
  design_name: string | null;
  note: string | null;
}
export interface FabricAtHub {
  fabric: Fabric;
  hub_id: string;
  hub_name: string | null;
  stock: {
    available_meters: string;
    reserved_meters: string;
    updated_at: string | null;
  };
  movements: FabricMovement[];
}

export interface FabricStockRow {
  hub_id: string;
  hub_name: string;
  fabric_id: string;
  fabric_code: string;
  fabric_name: string;
  fabric_image_keys: string[] | null;
  available_meters: string | number;
  reserved_meters: string | number;
  updated_at: string;
}

// ─── Distribution (procurement pushes design+fabric → hub) ────────────────────

export interface Distribution {
  id: string;
  design_id: string;
  fabric_id: string | null;
  hub_id: string;
  sample_qty: string | number;
  sellable_qty: string | number;
  status: "pushed" | "received" | "cancelled";
  created_at: string;
  updated_at: string;
  design_name: string;
  fabric_name: string | null;
  fabric_code: string | null;
  fabric_image_keys: string[] | null;
}
export interface PushDistributionInput {
  design_id: string;
  fabric_id?: string | null;
  hub_id: string;
  sample_qty?: number;
  sellable_qty?: number;
}

export const distributionApi = {
  list: async (
    params: { status?: string; hub_id?: string } = {},
  ): Promise<Distribution[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    const s = qs.toString();
    return req<Distribution[]>(`/api/admin/distribution${s ? `?${s}` : ""}`);
  },
  push: async (input: PushDistributionInput): Promise<Distribution> =>
    req<Distribution>(`/api/admin/distribution`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  receive: async (
    id: string,
  ): Promise<{ id: string; stocked_meters: number }> =>
    req(`/api/admin/distribution/${id}/receive`, { method: "POST" }),
};

// ─── Restock (catalog_manager requests; procurement ships/fulfils) ────────────

export type RestockStatus = "requested" | "shipped" | "fulfilled" | "cancelled";
export interface RestockRequest {
  id: string;
  fabric_id: string;
  hub_id: string;
  qty: string | number;
  status: RestockStatus;
  demand_note: string | null;
  created_at: string;
  updated_at: string;
  fabric_name: string;
  fabric_code: string | null;
  fabric_image_keys: string[] | null;
}

export const restockApi = {
  list: async (
    params: { status?: string; hub_id?: string } = {},
  ): Promise<RestockRequest[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    const s = qs.toString();
    return req<RestockRequest[]>(
      `/api/admin/distribution/restock${s ? `?${s}` : ""}`,
    );
  },
  setStatus: async (
    id: string,
    status: "shipped" | "fulfilled" | "cancelled",
  ): Promise<{ id: string; status: string; stocked_meters: number }> =>
    req(`/api/admin/distribution/restock/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  create: async (input: {
    fabric_id: string;
    hub_id: string;
    qty: number;
    demand_note?: string;
  }): Promise<{ id: string }> =>
    req(`/api/admin/distribution/restock`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

// ─── Fabric-for-listing requests (CM → procurement, Stage 5) ──────────────────

export type ListingRequestStatus =
  | "requested"
  | "approved"
  | "received"
  | "rejected";
export interface ListingRequest {
  id: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  qty: string | number;
  status: ListingRequestStatus;
  note: string | null;
  created_at: string;
  design_name: string;
  garment_type: string;
  fabric_name: string;
  fabric_code: string;
  fabric_color: string | null;
  fabric_composition: string | null;
  fabric_image_keys: string[] | null;
  hub_name: string;
}
export interface ListingRequestInput {
  design_id: string;
  fabric_id: string;
  hub_id: string;
  qty: number;
  note?: string;
}

export const listingRequestsApi = {
  list: async (
    params: { status?: string; hub_id?: string } = {},
  ): Promise<ListingRequest[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    const s = qs.toString();
    return req<ListingRequest[]>(
      `/api/admin/listing-requests${s ? `?${s}` : ""}`,
    );
  },
  create: async (input: ListingRequestInput): Promise<{ id: string }> =>
    req(`/api/admin/listing-requests`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  decide: async (
    id: string,
    decision: "approved" | "rejected",
  ): Promise<{ id: string; status: string; stocked_meters: number }> =>
    req(`/api/admin/listing-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    }),
  receive: async (
    id: string,
  ): Promise<{ id: string; status: string; stocked_meters: number }> =>
    req(`/api/admin/listing-requests/${id}/receive`, { method: "POST" }),
};

// ─── Listings (super read-only overview) ──────────────────────────────────────

export interface ListingOverviewRow {
  id: string;
  design_name: string;
  garment_type: string;
  fabric_name: string;
  hub_name: string;
  price: string;
  is_active: boolean;
}

export const listingsAdminApi = {
  overview: async (): Promise<ListingOverviewRow[]> =>
    req<ListingOverviewRow[]>(`/api/admin/listings/overview`),
};

// ─── Catalog-manager listings management ──────────────────────────────────────

export interface CmListing {
  id: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  price: string;
  description: string | null;
  photo_keys: string[];
  is_active: boolean;
  created_at: string;
  design_name: string;
  garment_type: string;
  design_image_keys: string[] | null;
  fabric_name: string;
  fabric_code: string;
  fabric_color: string | null;
  fabric_image_keys: string[] | null;
  hub_name: string;
}
export interface ReadyToListSample {
  sample_id: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  sample_photos: string[] | null;
  design_name: string;
  garment_type: string;
  design_image_keys: string[] | null;
  fabric_name: string;
  fabric_code: string;
  fabric_color: string | null;
  fabric_image_keys: string[] | null;
  hub_name: string;
}
export interface CmListingInput {
  design_id: string;
  fabric_id: string;
  hub_id: string;
  price: number;
  description?: string | null;
  photo_keys?: string[];
  is_active?: boolean;
}

export const cmListingsApi = {
  list: async (): Promise<CmListing[]> =>
    req<CmListing[]>(`/api/admin/listings`),
  ready: async (): Promise<ReadyToListSample[]> =>
    req<ReadyToListSample[]>(`/api/admin/listings/ready`),
  create: async (input: CmListingInput): Promise<{ id: string }> =>
    req(`/api/admin/listings`, { method: "POST", body: JSON.stringify(input) }),
  update: async (
    id: string,
    input: Partial<Omit<CmListingInput, "design_id" | "fabric_id" | "hub_id">>,
  ): Promise<CmListing> =>
    req<CmListing>(`/api/admin/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  fromSample: async (
    sampleId: string,
    input: {
      price: number;
      photo_keys?: string[];
      description?: string;
      is_active?: boolean;
    },
  ): Promise<{ listing_id: string; reused: boolean }> =>
    req(`/api/admin/sample-jobs/${sampleId}/list`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_type: "percent" | "flat";
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

export interface PromosResponse {
  promos: PromoCode[];
}

export const promosApi = {
  list: async (): Promise<PromosResponse> =>
    req<PromosResponse>("/api/admin/promos"),

  create: async (data: {
    code: string;
    description?: string;
    discount_type: "percent" | "flat";
    discount_value: number;
    min_order_amount?: number;
    max_uses?: number;
    uses_per_user?: number;
    valid_until?: string;
  }): Promise<PromoCode> =>
    req<PromoCode>("/api/admin/promos", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: async (id: string, data: Partial<PromoCode>): Promise<PromoCode> =>
    req<PromoCode>(`/api/admin/promos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  toggle: async (
    id: string,
    is_active: boolean,
  ): Promise<{ id: string; code: string; is_active: boolean }> =>
    req<{ id: string; code: string; is_active: boolean }>(
      `/api/admin/promos/${id}/active`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      },
    ),

  delete: async (id: string): Promise<void> =>
    req<void>(`/api/admin/promos/${id}`, { method: "DELETE" }),

  validate: async (
    code: string,
    order_amount: number,
  ): Promise<{
    valid: boolean;
    discount?: number;
    reason?: string;
    promo?: { code: string; discount_type: string; discount_value: number };
  }> =>
    req<{
      valid: boolean;
      discount?: number;
      reason?: string;
      promo?: { code: string; discount_type: string; discount_value: number };
    }>("/api/admin/promos/validate", {
      method: "POST",
      body: JSON.stringify({ code, order_amount }),
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
  list: async (
    params: {
      search?: string;
      city?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<ServicePincodesResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.city) qs.set("city", params.city);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<ServicePincodesResponse>(
      `/api/admin/system/service-pincodes?${qs}`,
    ).then((r) => ({
      ...r,
      pincodes: r.pincodes ?? [],
    }));
  },

  upsert: async (
    data: {
      pincode: string;
      area_name?: string;
      city?: string;
      hub_id?: string | null;
      is_active?: boolean;
    }[],
  ): Promise<{ pincodes: ServicePincode[] }> =>
    req<{ pincodes: ServicePincode[] }>("/api/admin/system/service-pincodes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: async (
    id: string,
    data: Partial<ServicePincode>,
  ): Promise<ServicePincode> =>
    req<ServicePincode>(`/api/admin/system/service-pincodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  remove: async (id: string): Promise<void> =>
    req(`/api/admin/system/service-pincodes/${id}`, { method: "DELETE" }),

  check: async (
    pincode: string,
  ): Promise<{
    serviceable: boolean;
    area_name?: string;
    city?: string;
    hub?: { id: string; name: string } | null;
  }> =>
    req<{
      serviceable: boolean;
      area_name?: string;
      city?: string;
      hub?: { id: string; name: string } | null;
    }>(`/api/pincodes/check?pincode=${encodeURIComponent(pincode)}`),
};

// ─── Admin Auth Extended ──────────────────────────────────────────────────────

export const adminAuthExtApi = {
  /** Current admin identity + capabilities (drives role-based UI gating). */
  me: async (): Promise<{
    id: string;
    role: string;
    hubId?: string | null;
    capabilities: string[];
  }> => req("/api/admin/auth/me"),

  setupSecurityQuestion: async (
    question: string,
    answer: string,
  ): Promise<void> =>
    req("/api/admin/auth/security-question", {
      method: "POST",
      body: JSON.stringify({ question, answer }),
    }),

  getSecurityQuestion: async (email: string): Promise<{ question: string }> =>
    req<{ question: string }>("/api/admin/auth/security-question/get", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetViaQuestion: async (
    email: string,
    answer: string,
    password: string,
  ): Promise<void> =>
    req("/api/admin/auth/security-question/reset", {
      method: "POST",
      body: JSON.stringify({ email, answer, password }),
    }),

  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<void> =>
    req("/api/admin/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  setTempPassword: async (
    adminUserId: string,
    password: string,
  ): Promise<void> =>
    req(`/api/admin/auth/users/${adminUserId}/temp-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
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
  if (!data || typeof data !== "object") return [];

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
    const data = await req<unknown>("/api/admin/craftspeople");
    return normalizeCraftspeople(data);
  },

  updateStory: async (
    id: string,
    data: { bio?: string; years_experience?: number },
  ): Promise<Craftsperson> =>
    req<Craftsperson>(`/api/admin/craftspeople/${id}/story`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ─── Hub Staff ────────────────────────────────────────────────────────────────

export interface HubStaff {
  id: string;
  reference_id?: string;
  hub_id?: string;
  name: string;
  email?: string;
  phone: string;
  role: string;
  joined_at?: string | null;
  is_active: boolean;
  created_at: string;
  active_orders?: number;
  active_bookings?: number;
  active_visits?: number;
}

export const hubStaffApi = {
  list: async (hubId: string): Promise<HubStaff[]> =>
    req<{ staff: HubStaff[] }>(`/api/admin/hubs/${hubId}/staff`).then(
      (r) => r.staff,
    ),

  workload: async (hubId: string): Promise<HubStaff[]> =>
    req<{ staff: HubStaff[] }>(`/api/admin/hubs/${hubId}/staff/workload`).then(
      (r) => r.staff,
    ),

  create: async (
    hubId: string,
    data: {
      name: string;
      phone: string;
      role: string;
      email?: string;
      joined_at?: string;
    },
  ): Promise<HubStaff> =>
    req<HubStaff>(`/api/admin/hubs/${hubId}/staff`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: async (
    hubId: string,
    staffId: string,
    data: Partial<{
      name: string;
      phone: string;
      role: string;
      email: string;
      joined_at: string;
      is_active: boolean;
    }>,
  ): Promise<HubStaff> =>
    req<HubStaff>(`/api/admin/hubs/${hubId}/staff/${staffId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  toggleActive: async (
    hubId: string,
    staffId: string,
    is_active: boolean,
  ): Promise<HubStaff> =>
    req<HubStaff>(`/api/admin/hubs/${hubId}/staff/${staffId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),

  assignments: async (
    staffId: string,
  ): Promise<{
    staff: HubStaff;
    assignments: {
      orders: unknown[];
      measurement_bookings: unknown[];
      home_visits: unknown[];
    };
    counts: {
      orders: number;
      measurement_bookings: number;
      home_visits: number;
    };
  }> => req(`/api/admin/staff/${staffId}/assignments`),
};

// ─── Customer Measurements ────────────────────────────────────────────────────

export interface CustomerMeasurementsData {
  profiles: Array<{
    id: string;
    name: string;
    category: string;
    created_at: string;
  }>;
  measurements: Array<BodyMeasurement & { profile_category: string }>;
}

export const customerMeasurementsApi = {
  get: async (userId: string): Promise<CustomerMeasurementsData> =>
    req<CustomerMeasurementsData>(
      `/api/admin/customers/${userId}/measurements`,
    ),

  save: async (
    userId: string,
    fitProfileId: string,
    data: Partial<
      Omit<
        BodyMeasurement,
        | "id"
        | "fit_profile_id"
        | "measurement_method"
        | "measured_at"
        | "created_at"
      >
    >,
  ): Promise<BodyMeasurement> =>
    req<BodyMeasurement>(`/api/admin/customers/${userId}/measurements`, {
      method: "PUT",
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
    req<{ staff: AllStaffMember[] }>("/api/admin/staff").then((r) => r.staff),
};

// ─── Fit Analytics ────────────────────────────────────────────────────────────

export interface FitAnalyticsData {
  avg_fit_score: number;
  feedback_count: number;
  alteration_rate: number;
  alteration_success_rate: number;
  by_product: {
    id: string;
    name: string;
    avg_fit_score: number;
    feedback_count: number;
  }[];
  hub_performance: {
    id: string;
    name: string;
    avg_fit_score: number;
    feedback_count: number;
    good_fit_count: number;
  }[];
}

export const fitAnalyticsApi = {
  get: async (period = "month"): Promise<FitAnalyticsData> =>
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
  status: "draft" | "published" | "archived";
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
      req<{ items: LookbookItem[] }>("/api/admin/cms/lookbook").then(
        (r) => r.items,
      ),
    create: (data: Partial<LookbookItem>): Promise<LookbookItem> =>
      req<LookbookItem>("/api/admin/cms/lookbook", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<LookbookItem>): Promise<LookbookItem> =>
      req<LookbookItem>(`/api/admin/cms/lookbook/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<void> =>
      req<void>(`/api/admin/cms/lookbook/${id}`, { method: "DELETE" }),
  },

  journal: {
    list: (status?: string): Promise<JournalPost[]> =>
      req<{ posts: JournalPost[] }>(
        `/api/admin/cms/journal${status ? `?status=${status}` : ""}`,
      ).then((r) => r.posts),
    get: (id: string): Promise<JournalPost> =>
      req<JournalPost>(`/api/admin/cms/journal/${id}`),
    create: (data: Partial<JournalPost>): Promise<JournalPost> =>
      req<JournalPost>("/api/admin/cms/journal", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<JournalPost>): Promise<JournalPost> =>
      req<JournalPost>(`/api/admin/cms/journal/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<void> =>
      req<void>(`/api/admin/cms/journal/${id}`, { method: "DELETE" }),
  },

  stories: {
    list: (): Promise<CustomerStory[]> =>
      req<{ stories: CustomerStory[] }>("/api/admin/cms/stories").then(
        (r) => r.stories,
      ),
    create: (data: Partial<CustomerStory>): Promise<CustomerStory> =>
      req<CustomerStory>("/api/admin/cms/stories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: Partial<CustomerStory>,
    ): Promise<CustomerStory> =>
      req<CustomerStory>(`/api/admin/cms/stories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string): Promise<void> =>
      req<void>(`/api/admin/cms/stories/${id}`, { method: "DELETE" }),
  },
};

// ─── Garment Types & Fit Preferences ─────────────────────────────────────────

export interface GarmentType {
  id: string;
  name: string;
  slug: string;
  category: "mens" | "womens" | "unisex";
  required_measurements: string[];
  measurement_labels: Record<string, string>;
  measurement_guide_notes: Record<string, string>;
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
  list: async (includeInactive = false): Promise<GarmentType[]> =>
    req<{ garment_types: GarmentType[] }>(
      `/api/admin/garment-types${includeInactive ? "?include_inactive=true" : ""}`,
    ).then((r) => r.garment_types ?? []),

  get: async (id: string): Promise<GarmentType> =>
    req<GarmentType>(`/api/admin/garment-types/${id}`),

  create: async (data: Partial<GarmentType>): Promise<GarmentType> =>
    req<GarmentType>("/api/admin/garment-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: async (
    id: string,
    data: Partial<GarmentType>,
  ): Promise<GarmentType> =>
    req<GarmentType>(`/api/admin/garment-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  toggleActive: async (id: string, is_active: boolean): Promise<GarmentType> =>
    req<GarmentType>(`/api/admin/garment-types/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),
};

export const fitPreferencesApi = {
  list: async (): Promise<FitPreference[]> =>
    req<{ fit_preferences: FitPreference[] }>(
      "/api/admin/fit-preferences",
    ).then((r) => r.fit_preferences ?? []),
};

// ─── Global Hub Staff ─────────────────────────────────────────────────────────

export interface HubStaffGlobal {
  id: string;
  reference_id?: string;
  name: string;
  role: string;
  phone: string;
  hub_id: string | null;
  hub_name: string | null;
  is_active: boolean;
  active_orders?: number;
  active_bookings?: number;
  active_visits?: number;
}

export const hubStaffGlobalApi = {
  list: async (hub_id?: string): Promise<HubStaffGlobal[]> => {
    const qs = hub_id ? `?hub_id=${encodeURIComponent(hub_id)}` : "";
    return req<{ staff: HubStaffGlobal[] }>(`/api/admin/hub-staff${qs}`).then(
      (r) => r.staff ?? [],
    );
  },
};

// ─── Measurement Bookings ─────────────────────────────────────────────────────

export interface MeasurementBookingItem {
  id: string;
  booking_id: string;
  garment_type_id: string;
  garment_type_name?: string;
  garment_type_slug?: string;
  garment_category?: string;
  required_measurements?: string[];
  measurement_labels?: Record<string, string>;
  measurement_guide_notes?: Record<string, string>;
  variant_label: string | null;
  fit_preference_id: string | null;
  fit_preference_name?: string | null;
  fit_preference_slug?: string | null;
  fit_notes: string | null;
  linked_product_id: string | null;
  measurement_status: "pending" | "in_progress" | "completed" | "skipped";
  sort_order: number;
  // Measurement data from garment_measurements
  measurement_id?: string | null;
  measurements_data?: Record<string, number> | null;
  measurement_notes?: string | null;
  finalized_at?: string | null;
  taken_by_staff_id?: string | null;
  taken_by_staff_name?: string | null;
  // Legacy individual columns (backward compat)
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  shoulders?: number | null;
  sleeve_length?: number | null;
  neck?: number | null;
  inseam?: number | null;
}

export interface MeasurementBookingMeasurement {
  id: string;
  booking_item_id: string;
  taken_by_staff_id: string | null;
  measurements_data: Record<string, number> | null;
  staff_notes: string | null;
  finalized_at: string | null;
  created_at: string;
}

export interface MeasurementBooking {
  id: string;
  reference_id?: string;
  booking_ref: string;
  user_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_ref?: string;
  home_visit_id: string | null;
  source_order_id: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name?: string | null;
  assigned_staff_role?: string | null;
  assigned_staff_phone?: string | null;
  status: "draft" | "confirmed" | "in_progress" | "completed" | "cancelled";
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  admin_notes: string | null;
  items?: MeasurementBookingItem[];
  item_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MeasurementBookingsResponse {
  bookings: MeasurementBooking[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CustomerMeasurementProfile {
  id: string;
  user_id: string;
  garment_type_id: string;
  garment_type_name: string;
  garment_type_slug: string;
  required_measurements: string[];
  measurement_labels: Record<string, string>;
  fit_preference_id: string | null;
  fit_preference_name: string | null;
  measurement_data: Record<string, number>;
  source_booking_item_id: string | null;
  source_booking_ref: string | null;
  source_booking_id: string | null;
  taken_at: string | null;
  taken_by_staff_id: string | null;
  taken_by_staff_name: string | null;
  updated_at: string;
}

export const measurementBookingsApi = {
  list: async (
    params: {
      user_id?: string;
      status?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<MeasurementBookingsResponse> => {
    const qs = new URLSearchParams();
    if (params.user_id) qs.set("user_id", params.user_id);
    if (params.status) qs.set("status", params.status);
    if (params.date_from) qs.set("date_from", params.date_from);
    if (params.date_to) qs.set("date_to", params.date_to);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<MeasurementBookingsResponse>(
      `/api/admin/measurement-bookings?${qs}`,
    );
  },

  get: async (id: string): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}`),

  create: async (data: {
    user_id: string;
    home_visit_id?: string;
    scheduled_at?: string;
    notes?: string;
    admin_notes?: string;
    items: {
      garment_type_id: string;
      variant_label: string;
      fit_preference_id: string;
      fit_notes?: string;
      linked_product_id?: string;
      sort_order?: number;
    }[];
  }): Promise<{
    booking: MeasurementBooking;
    items: MeasurementBookingItem[];
  }> =>
    req<{ booking: MeasurementBooking; items: MeasurementBookingItem[] }>(
      "/api/admin/measurement-bookings",
      { method: "POST", body: JSON.stringify(data) },
    ),

  update: async (
    id: string,
    data: {
      status?: string;
      notes?: string;
      admin_notes?: string;
      scheduled_at?: string;
    },
  ): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: async (
    id: string,
    status: string,
  ): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  addItem: async (
    id: string,
    item: {
      garment_type_id: string;
      variant_label: string;
      fit_preference_id: string;
      fit_notes?: string;
      linked_product_id?: string;
    },
  ): Promise<MeasurementBookingItem> =>
    req<MeasurementBookingItem>(`/api/admin/measurement-bookings/${id}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    }),

  updateItem: async (
    id: string,
    itemId: string,
    data: Partial<
      Pick<
        MeasurementBookingItem,
        | "measurement_status"
        | "fit_preference_id"
        | "fit_notes"
        | "variant_label"
      >
    >,
  ): Promise<MeasurementBookingItem> =>
    req<MeasurementBookingItem>(
      `/api/admin/measurement-bookings/${id}/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  deleteItem: async (id: string, itemId: string): Promise<void> =>
    req<void>(`/api/admin/measurement-bookings/${id}/items/${itemId}`, {
      method: "DELETE",
    }),

  saveMeasurements: async (
    id: string,
    itemId: string,
    measurements: Record<string, number>,
    taken_by_staff_id?: string,
    staff_notes?: string,
  ): Promise<MeasurementBookingMeasurement> =>
    req<MeasurementBookingMeasurement>(
      `/api/admin/measurement-bookings/${id}/items/${itemId}/measurements`,
      {
        method: "POST",
        body: JSON.stringify({ measurements, taken_by_staff_id, staff_notes }),
      },
    ),

  finalizeItem: async (
    id: string,
    itemId: string,
  ): Promise<{ finalized: boolean }> =>
    req<{ finalized: boolean }>(
      `/api/admin/measurement-bookings/${id}/items/${itemId}/finalize`,
      { method: "POST" },
    ),

  assignStaff: async (
    id: string,
    staff_id: string | null,
  ): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(
      `/api/admin/measurement-bookings/${id}/assign-staff`,
      { method: "POST", body: JSON.stringify({ staff_id }) },
    ),

  complete: async (id: string): Promise<MeasurementBooking> =>
    req<MeasurementBooking>(`/api/admin/measurement-bookings/${id}/complete`, {
      method: "POST",
    }),
};

export const customerMeasurementProfilesApi = {
  get: async (
    userId: string,
  ): Promise<{ profiles: CustomerMeasurementProfile[]; history: unknown[] }> =>
    req<{ profiles: CustomerMeasurementProfile[]; history: unknown[] }>(
      `/api/admin/users/${userId}/measurement-profiles`,
    ),
};

// ─── Fit Profiles (self-input / quiz) ─────────────────────────────────────────

export interface AdminFitProfile {
  id: string;
  label: string;
  for_name: string;
  source: "self_input" | "home_visit" | string;
  is_default: boolean;
  measurements: Record<string, number | null>;
  created_at: string;
}

export const fitProfilesAdminApi = {
  list: async (userId: string): Promise<AdminFitProfile[]> =>
    req<AdminFitProfile[]>(`/api/admin/users/${userId}/fit-profiles`),
};

// ─── Customer Lookup ──────────────────────────────────────────────────────────

export interface CustomerLookupResult {
  id: string;
  reference_id: string | null;
  name: string;
  phone: string;
  email: string;
  city: string;
  order_count: number;
  is_active: boolean;
}

export const customerLookupApi = {
  search: async (q: string): Promise<CustomerLookupResult[]> => {
    const result = await req<{ customers: CustomerLookupResult[] }>(
      `/api/admin/customers/lookup?q=${encodeURIComponent(q)}`,
    );
    return result?.customers ?? [];
  },
};

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  mode: string | null;
  is_active: boolean;
  image_url: string | null;
}

export const categoriesAdminApi = {
  list: async (): Promise<ProductCategory[]> => {
    const result = await req<{ data: ProductCategory[] }>(
      "/api/catalog/admin/categories",
    );
    return result?.data ?? [];
  },
  updateImage: async (
    id: string,
    imageKey: string | null,
  ): Promise<ProductCategory> => {
    const result = await req<{ data: ProductCategory }>(
      `/api/catalog/admin/categories/${id}/image`,
      {
        method: "PATCH",
        body: JSON.stringify({ image_key: imageKey }),
      },
    );
    return result.data;
  },
};

export type {
  AdminOrder,
  AdminUser,
  Hub,
  SupportTicket,
  TicketMessage,
  AuditEntry,
  WaitlistEntry,
  ConfigGroup,
  OrderStage,
  Collection,
  OrderItem,
  OrderTimelineEntry,
  OrderPayment,
};
