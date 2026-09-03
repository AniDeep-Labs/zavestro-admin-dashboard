import { getAdminToken, setAdminToken, clearAdminToken } from "./catalogApi";
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

// [SHL-2-2] One definition, defaulting to localhost — see apiBase.ts.
import { API_BASE } from './apiBase';
const BASE = API_BASE;
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

// [PRC-14-4] The whole response envelope, error handling included. `req` below is this
// plus the `data` unwrap — which is what nearly every caller wants, but it also throws away
// any `meta` the server sent, so a page that needs (say) a count's denominator had no way to
// see it without a second round trip.
async function reqEnvelope<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    let details: unknown;
    let code: string | undefined;
    try {
      const b = await res.json();
      msg = b.message || b.error?.message || b.error || msg;
      details = b.error?.details ?? b.details;
      code = b.error?.code ?? b.code;
    } catch {
      /* */
    }
    const err = new Error(msg) as Error & { status: number; details?: unknown; code?: string };
    err.status = res.status;
    err.details = details;
    err.code = code;
    console.error(
      `[adminApi] ${init.method ?? "GET"} ${path} → ${res.status}:`,
      msg,
    );
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const json = await reqEnvelope<unknown>(path, init);
  return (
    json && typeof json === "object" && "data" in json
      ? (json as { data: T }).data
      : json
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

type StatShape = {
  value: number;
  trend: string;
  up: boolean;
  /**
   * [FIN-37-2] What this number MEANS, sent by the server so the label cannot
   * drift from the SQL that produced it. Two finance screens reported revenue
   * 12.8× apart — booked vs collected — and neither stated which it was.
   */
  basis?: 'collected' | 'booked';
  basisLabel?: string;
  /** For averages: what the figure was divided by, and out of how many. */
  denominator?: number;
  denominatorLabel?: string;
  ordersInPeriod?: number;
};

export interface DashboardData {
  stats: Record<string, StatShape>;
  hubPerformance: {
    name: string;
    city?: string;
    activeOrders: number;
    staffCount: number;
    capacity: number;
    /** [SHL-4-2] null = nothing inspected yet. NEVER default this to a number. */
    qcPassRate: number | null;
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
  /** filter by payment method (e.g. 'cod') */
  paymentMethod?: string;
  /** in-flight orders unmoved for 48h+ (the "Stuck" saved view) */
  stuck?: boolean;
  /** T2-17: filter the stuck exception inbox by ownership */
  owner?: "unowned" | "mine" | "all";
  /** T2-33 (F-4): hub + created-at window — the Finance P&L / settlement drill-down. */
  hub_id?: string;
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive of the whole day
  page?: number;
  limit?: number;
}
export interface OrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  totalPages: number;
}

// T2-17: order-exception ownership — claim / assign / release a stuck order so it has a
// single, time-boxed owner and can't be silently double-worked or ignored.
export interface ExceptionClaim {
  claim_id: string;
  order_id: string;
  claimed_by: string;
  claimed_by_name: string | null;
  assigned_by: string | null;
  assigned_by_name: string | null;
  ack_note: string | null;
  ttl_hours: number;
  claimed_at: string;
  resolves_at: string;
  overdue: boolean;
}
export interface AssignableAdmin {
  id: string;
  name: string;
  role: string;
}
export const orderExceptionsApi = {
  assignable: (): Promise<AssignableAdmin[]> =>
    req<AssignableAdmin[]>(`/api/admin/order-exceptions/assignable`),
  active: (orderId: string): Promise<ExceptionClaim | null> =>
    req<ExceptionClaim | null>(`/api/admin/order-exceptions/${orderId}`),
  claim: (
    orderId: string,
    body: { assigned_to?: string; ack_note?: string; ttl_hours?: number } = {},
  ): Promise<ExceptionClaim> =>
    req<ExceptionClaim>(`/api/admin/order-exceptions/${orderId}/claim`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  release: (orderId: string): Promise<{ released: boolean }> =>
    req<{ released: boolean }>(`/api/admin/order-exceptions/${orderId}/resolve`, {
      method: "POST",
    }),
};

/**
 * AG-S3 (scan) — garment tags.
 *
 * The ops app had no scanner and nothing printed a scannable code, so building
 * one would have been a camera pointed at codes that did not exist. This is the
 * printing half. A tag is generated when the order ARRIVES at the hub and
 * travels with the work to delivery — one identity for its whole life.
 *
 * The QR arrives as SVG from the server rather than being generated here, so
 * the tag a hub prints from the ops app and the tag printed from this dashboard
 * are byte-identical. Two generators would eventually disagree about what a
 * code contains, and the only symptom would be a garment nobody can scan.
 */
export interface GarmentTag {
  order_id: string;
  order_number: string;
  reference_id: string;
  customer_name: string | null;
  garment_name: string | null;
  qr_svg: string;
  /** Times this order's tag was printed BEFORE this run. Non-zero = a reprint. */
  previous_prints: number;
}

export interface OrderNeedingTag {
  order_id: string;
  order_number: string;
  reference_id: string;
  stage: string;
  customer_name: string | null;
  created_at: string;
}

export const tagsApi = {
  /**
   * Orders that still need a tag.
   *
   * Comes from the server rather than being filtered here: "which orders need a
   * tag" is answered by whether one has been PRINTED, which only the server
   * knows. Filtering by stage in the client — which an earlier cut of this did —
   * would reprint tags for work already tagged, and two tags in circulation for
   * one order is how a tag reaches the wrong garment.
   */
  pending: async (): Promise<OrderNeedingTag[]> =>
    req<OrderNeedingTag[]>('/api/admin/tags/pending'),

  sheet: async (orderIds: string[]): Promise<GarmentTag[]> =>
    req<GarmentTag[]>('/api/admin/tags/sheet', {
      method: 'POST',
      body: JSON.stringify({ order_ids: orderIds }),
    }),
};

export interface OrdersExportRow {
  id: string;
  reference_id: string | null;
  customer: string | null;
  /** Present only when the export was explicitly a contact export. */
  phone?: string | null;
  email?: string | null;
  stage: string;
  status: string;
  payment_method: string | null;
  hub: string;
  total: string | number;
  created_at: string;
}

export interface OrdersExport {
  orders: OrdersExportRow[];
  with_contact: boolean;
  /** True when the export hit the server's row ceiling and is incomplete. */
  truncated: boolean;
  max_rows: number;
}

export const ordersApi = {
  list: async (params: OrdersParams = {}): Promise<OrdersResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.stage) qs.set("stage", params.stage);
    if (params.mode) qs.set("mode", params.mode);
    if (params.userId) qs.set("user_id", params.userId);
    if (params.paymentMethod) qs.set("payment_method", params.paymentMethod);
    if (params.stuck) qs.set("stuck", "1");
    if (params.owner && params.owner !== "all") qs.set("owner", params.owner);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return req<OrdersResponse>(`/api/admin/orders?${qs}`);
  },

  // [SUP-27-3 / SUP-27-7] One audited request instead of up to 500 unaudited ones.
  //
  // The CSV used to be assembled client-side by paging this same endpoint 500 times, so
  // the server saw an ordinary list and the largest PII egress in the admin left no trace
  // at all. The export is a mode of the same handler now — same filters, no chance of the
  // two drifting — and it writes an `export_orders` audit row with the count, the filters
  // and whether contact details were included.
  //
  // `contact` is opt-in: most exports are a work list and do not need every customer's
  // phone number and email address in a file on somebody's laptop.
  exportAll: async (
    params: OrdersParams = {},
    opts: { contact?: boolean } = {},
  ): Promise<OrdersExport> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.stage) qs.set("stage", params.stage);
    if (params.mode) qs.set("mode", params.mode);
    if (params.userId) qs.set("user_id", params.userId);
    if (params.paymentMethod) qs.set("payment_method", params.paymentMethod);
    if (params.stuck) qs.set("stuck", "1");
    if (params.owner && params.owner !== "all") qs.set("owner", params.owner);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    qs.set("export", "1");
    if (opts.contact) qs.set("contact", "1");
    return req<OrdersExport>(`/api/admin/orders?${qs}`);
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
      // [SUP-28-7] The endpoint sends `o.*`, so payment_method has always been in the
      // payload — but this mapper is an allow-list and dropped it, leaving
      // `order.payment_method` undefined on the detail page. Both branches of the
      // Payment panel test it, so a COD order was told "Nothing has been captured
      // against this order yet" instead of that cash is collected on delivery.
      payment_method: (o.payment_method ?? null) as string | null,
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
      // T1-20: computed fallback for the promised date (created_at + SLA).
      computed_delivery_date: (o.computed_delivery_date ?? null) as string | null,
      delivery_sla_days: (o.delivery_sla_days ?? null) as number | null,
      on_hold_reason: (o.on_hold_reason ?? null) as string | null,
      cancellation_reason: (o.cancellation_reason ?? null) as string | null,
      delivery_address: (o.delivery_address ??
        null) as AdminOrder["delivery_address"],
    };
  },
  // T1-15: support edits the delivery address pre-dispatch (dark-store hub-guarded server-side).
  editAddress: async (
    id: string,
    address: {
      name: string;
      phone: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
    },
  ): Promise<{ delivery_address: AdminOrder["delivery_address"] }> =>
    req(`/api/admin/orders/${id}/address`, {
      method: "PATCH",
      body: JSON.stringify(address),
    }),

  // T2-8: cancel a single item in a multi-item order (+ partial refund of its line).
  cancelItem: async (
    orderId: string,
    itemId: string,
    reason?: string,
  ): Promise<{ order_id: string; item_id: string; line_amount: number; refunded: number }> =>
    req(`/api/admin/orders/${orderId}/items/${itemId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

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
  /** G-97: request unmasked contact PII (the audited CSV export). Masked by default. */
  full?: boolean;
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
    ltv: Math.round(parseFloat(String(u.ltv ?? 0))), // T2-35 (SP-6)
    fit_outcomes: (u.fit_outcomes ?? undefined) as Record<string, number> | undefined,
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
    if (params.full) qs.set("full", "1");
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

  // [SCA-44-2] The export, done once on the server.
  //
  // This used to be `for (let p = 1; p <= 500; p++)` in the page: 500 sequential
  // round trips at 50k customers, each re-running the list query with a growing
  // OFFSET, the whole result set held in the tab before the file was written, and no
  // way to resume. One request now, and the server writes ONE audit row saying
  // exactly what left instead of 500.
  exportCsv: async (params: { search?: string; status?: string } = {}): Promise<void> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    const token = getAdminToken();
    const res = await fetch(`${BASE}/api/admin/users/export?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  get: async (id: string): Promise<AdminUser> => {
    const u = await req<Record<string, unknown>>(`/api/admin/users/${id}`);
    return mapUser(u);
  },

  // [SUP-30-7] `reason` travels with the status change. The deactivation modal demands one
  // before it will enable its button, and this builder used to emit `is_active` alone — so
  // the reason the agent typed was discarded in this function, and the audit row recorded
  // the click without the cause.
  update: async (
    id: string,
    data: Partial<AdminUser>,
    opts: { reason?: string } = {},
  ): Promise<AdminUser> => {
    const body: Record<string, unknown> = {};
    if (data.status !== undefined) body.is_active = data.status === "Active";
    if (opts.reason?.trim()) body.reason = opts.reason.trim();
    const u = await req<Record<string, unknown>>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return mapUser(u);
  },

  // T2-35 (SP-6): DPDP erasure — irreversible PII redaction + measurement purge. Super-only
  // (system:manage); the backend enforces the cap. Returns a summary of what was purged.
  eraseData: (id: string): Promise<Record<string, unknown>> =>
    req<Record<string, unknown>>(`/api/admin/users/${id}/data`, { method: "DELETE" }),

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
    orderId?: string, // T1-21: ties the goodwill to the order + enforces the per-order ₹500 cap
  ): Promise<{ balance: number; order_goodwill_total: number | null }> =>
    req(`/api/admin/users/${id}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount, reason, ...(orderId ? { order_id: orderId } : {}) }),
    }),
  // T1-21b Phase 2: repeat-rescue signal so support isn't blind before issuing.
  rescueSummary: async (id: string): Promise<RescueSummary> =>
    req<RescueSummary>(`/api/admin/users/${id}/rescue-summary`),

  // W-5: submit a credit ABOVE support's inline cap for finance to approve.
  requestCredit: async (id: string, amount: number, reason: string): Promise<void> =>
    req(`/api/admin/users/${id}/credit-requests`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  // G-39: the credit ledger (entries + reason + date + running balance).
  creditsLedger: async (
    id: string,
  ): Promise<{ balance: number; entries: CreditLedgerEntry[] }> =>
    req(`/api/admin/users/${id}/credits`),

  // W-11: the readable internal-notes thread (customer_notes).
  notes: async (id: string): Promise<CustomerNote[]> =>
    req(`/api/admin/users/${id}/notes`),

  addNote: async (id: string, note: string): Promise<CustomerNote> =>
    req(`/api/admin/users/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  // G-37: support records a free re-measure request (ops schedules it in Phase B).
  requestRemeasure: async (
    id: string,
    data: { reason: string; order_id?: string; fit_profile_id?: string },
  ): Promise<{ id: string; status: string; created_at: string }> =>
    req(`/api/admin/users/${id}/request-remeasure`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  remeasureRequests: async (id: string): Promise<RemeasureRequest[]> =>
    req(`/api/admin/users/${id}/remeasure-requests`),
  // T1-21b Phase 3 (E): record whether the re-measure was our fault or customer error.
  setRemeasureOutcome: async (
    requestId: string,
    outcome: "our_fault" | "customer_error" | "pending",
  ): Promise<void> =>
    req(`/api/admin/remeasure-requests/${requestId}/outcome`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    }),
};

export interface CreditLedgerEntry {
  id: string;
  type: "credit" | "debit";
  amount: number;
  reason: string | null;
  reference_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CustomerNote {
  id: string;
  body: string;
  author_name: string | null;
  created_at: string;
}

export interface RemeasureRequest {
  id: string;
  order_id: string | null;
  order_number: string | null;
  fit_profile_id: string | null;
  reason: string;
  status: "open" | "scheduled" | "done" | "cancelled";
  outcome?: "pending" | "our_fault" | "customer_error"; // T1-21b Phase 3 (E)
  redeemed_order_id?: string | null; // T1-21b Phase 3 (F): the visit rides this order
  created_at: string;
  requested_by_name: string | null;
}

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
    // [SHL-4-2] A SECOND hardcoded 100 — the mapper defaulted an absent QC rate
    // to a perfect score. null means "not yet measured"; the UI renders "—".
    qcPassRate: (h.qcPassRate as number | null) ?? null,
    managerName: (h.managerName ?? h.manager_name ?? "") as string,
    managerPhone: (h.managerPhone ?? h.manager_phone ?? "") as string,
    managerStaffId: (h.managerStaffId ?? h.manager_staff_id ?? null) as string | null,
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

export interface HubBlastRadius {
  active_orders: number;
  fabric_meters: number;
  /** Ops LOGIN accounts (`staff`). */
  active_staff: number;
  /**
   * [SHL-6-7] The floor roster (`hub_staff`) — a different table, which measurement
   * provenance points at and which no admin page has ever shown.
   */
  roster_staff: number;
  live_listings: number;
  service_pincodes: number;
}

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

  // [SHL-6-2] What deactivating this hub would strand. The server measures it; the dialog
  // states it. Previously the confirm asserted "existing orders are unaffected" with
  // nothing behind that claim.
  blastRadius: async (id: string): Promise<HubBlastRadius> =>
    req<HubBlastRadius>(`/api/admin/hubs/${id}/blast-radius`),

  update: async (
    id: string,
    data: Partial<Hub>,
    opts: { force?: boolean } = {},
  ): Promise<Hub> => {
    const { status, managerName, managerPhone, managerStaffId, ...rest } = data;
    const body: Record<string, unknown> = { ...rest };
    if (status !== undefined) body.is_active = status === "Active";
    if (managerName !== undefined) body.manager_name = managerName;
    if (managerPhone !== undefined) body.manager_phone = managerPhone;
    if (managerStaffId !== undefined) body.manager_staff_id = managerStaffId;
    // The server refuses a deactivation that strands work unless this is set — so the
    // operator confirms against measured counts rather than being stopped outright.
    if (opts.force) body.force = true;
    const raw = await req<Record<string, unknown>>(`/api/admin/hubs/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return mapHub(raw);
  },

  // T2-24: HubDetail Recent-orders + Activity tabs.
  recentOrders: (id: string, limit = 20): Promise<HubRecentOrder[]> =>
    req<HubRecentOrder[]>(`/api/admin/hubs/${id}/orders?limit=${limit}`),
  activity: (id: string, limit = 30): Promise<HubActivityItem[]> =>
    req<HubActivityItem[]>(`/api/admin/hubs/${id}/activity?limit=${limit}`),
};

export interface HubRecentOrder {
  id: string;
  uuid: string;
  reference_id: string | null;
  customer: string | null;
  stage: string;
  status: string;
  total: number;
  created_at: string;
  updated_at: string;
}
export interface HubActivityItem {
  kind: "order" | "config";
  created_at: string;
  title: string;
  subtitle: string | null;
  actor: string | null;
  order_uuid?: string | null;
}

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
  // [SUP-32-6] `urgent` maps to itself. It used to collapse to "High", which put the top
  // severity beside genuinely-high tickets with nothing to tell them apart.
  const PRIORITY_MAP: Record<string, SupportTicket["priority"]> = {
    urgent: "Urgent",
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
    user_id: (t.user_id ?? null) as string | null,
    order_id: (t.order_id ?? null) as string | null,
    phone: (t.customer_phone ?? t.phone ?? "") as string,
    subject: (t.subject ?? "") as string,
    category: (t.category ?? "General") as string,
    // [SUP-32-5] Resolution fields ride through the same allow-list mapper as everything
    // else — a column added to the query is dropped here unless it is named.
    resolution: (t.resolution ?? null) as string | null,
    resolutionNote: (t.resolution_note ?? null) as string | null,
    resolvedAt: (t.resolved_at ?? null) as string | null,
    resolvedByName: (t.resolved_by_name ?? null) as string | null,
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
    // T2-30 inbox fields (present only from supportApi.inbox()).
    waitingHours:
      t.waiting_hours != null ? Number(t.waiting_hours) : undefined,
    lastSender: (t.last_sender ?? null) as SupportTicket["lastSender"],
    snoozeUntil: (t.snooze_until ?? null) as string | null, // T3-3 (W-S3)
  };
}

// T2-30 (SP-3): the inbox worklist — three buckets + counts.
export interface SupportInbox {
  needs_reply: SupportTicket[];
  waiting: SupportTicket[];
  resolved: SupportTicket[];
  counts: { needs_reply: number; waiting: number; resolved: number };
}

export interface AssignableAgent {
  id: string;
  name: string;
  role: string;
}

export const supportApi = {
  /**
   * [SUP-32-4] Who this ticket can be handed to.
   *
   * The dropdown used to read the full admin roster (`/admin/auth/users`), which is
   * super_admin-only — so for support, the one role that works this page, it 403'd and
   * rendered empty. This endpoint answers only the picker's question, and the server
   * decides who qualifies from the capability table rather than the client guessing
   * from role names.
   */
  assignableAgents: (): Promise<AssignableAgent[]> =>
    req<AssignableAgent[]>("/api/admin/support/assignable"),

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

  // T2-30 (SP-3): inbox worklist — needs-reply / waiting / resolved buckets.
  inbox: async (): Promise<SupportInbox> => {
    const raw = await req<{
      needs_reply: Record<string, unknown>[];
      waiting: Record<string, unknown>[];
      resolved: Record<string, unknown>[];
      counts: { needs_reply: number; waiting: number; resolved: number };
    }>(`/api/admin/support/inbox`);
    return {
      needs_reply: raw.needs_reply.map(mapTicket),
      waiting: raw.waiting.map(mapTicket),
      resolved: raw.resolved.map(mapTicket),
      counts: raw.counts,
    };
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
    // [SUP-32-6] Round-trips. Without the Urgent entry, saving an urgent ticket wrote
    // "high" over it — a silent downgrade performed by merely editing anything else.
    const PRIORITY_TO_DB: Record<string, string> = {
      Urgent: "urgent",
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

  /**
   * [SUP-32-5] Resolve a ticket WITH the outcome that fixed it.
   *
   * A separate method rather than `update({ status: "Resolved" })` because the two are
   * no longer the same act: the server refuses a resolve that does not say what fixed
   * it, so a caller that only knows how to set a status would just get a 400. Naming it
   * `resolve` makes the requirement visible at the call site instead of at runtime.
   */
  resolve: async (
    id: string,
    resolution: string,
    resolutionNote?: string,
  ): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>(`/api/admin/support/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "resolved",
        resolution,
        resolution_note: resolutionNote?.trim() || null,
      }),
    });
    return mapTicket(raw);
  },

  /**
   * [SUP-32-7] The SHARED canned-reply library.
   *
   * It lived in localStorage, so it was per agent and per browser: lost on a cache
   * clear, invisible to teammates, and impossible to review. This is the text the
   * company says to customers in its own voice — "nobody can see it and nobody can
   * correct it" was a quality problem, not just an inconvenience.
   */
  templates: {
    list: async (): Promise<ReplyTemplate[]> => {
      const r = await req<{ templates: ReplyTemplate[] }>("/api/admin/support/templates");
      return r?.templates ?? [];
    },
    create: (title: string, body: string, category?: string | null) =>
      req<ReplyTemplate>("/api/admin/support/templates", {
        method: "POST",
        body: JSON.stringify({ title, body, category: category ?? null }),
      }),
    update: (id: string, title: string, body: string, category?: string | null) =>
      req<ReplyTemplate>(`/api/admin/support/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, body, category: category ?? null }),
      }),
    // Retire, not delete — one agent tidying up must not destroy the team's library.
    retire: (id: string) =>
      req<{ retired: boolean }>(`/api/admin/support/templates/${id}`, { method: "DELETE" }),
  },

  // T3-3 (W-S3): set a follow-up time (ISO) or clear it (null). Snoozed tickets
  // drop out of "Needs reply" until the time passes.
  setSnooze: async (
    id: string,
    snoozeUntil: string | null,
  ): Promise<SupportTicket> => {
    const raw = await req<Record<string, unknown>>(
      `/api/admin/support/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ snooze_until: snoozeUntil }),
      },
    );
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

  // T1-21: escalate a ticket to finance (records the escalated state + bumps priority).
  escalate: async (id: string, reason: string): Promise<void> =>
    req(`/api/admin/support/${id}/escalate`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  // T1-21b Phase 2: customers whose rescue rate is abnormal (manager review).
  rescueWatchlist: async (): Promise<RescueWatchRow[]> =>
    req<RescueWatchRow[]>(`/api/admin/support/rescue-watchlist`),
};

// T1-21b Phase 2: rescue velocity signal + watchlist row.
export interface RescueSummary {
  user_id: string;
  goodwill_90d: number;
  remeasures_90d: number;
  false_claims_90d: number; // T1-21b Phase 3 (E): customer-error re-measures
  orders_90d: number;
  window_days: number;
  flagged: boolean;
}
export interface RescueWatchRow {
  user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  goodwill_90d: number;
  remeasures_90d: number;
  window_days: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  kpis: { label: string; value: number; trend: string; up: boolean }[];
  revenue: { label: string; simplified: number }[];
  period: string;
}

export interface RetentionData {
  total_customers: number;
  repeat_customers: number;
  repeat_rate: number;
  avg_orders_per_customer: number;
  distribution: { one: number; two: number; three_plus: number };
}

export const analyticsApi = {
  get: async (period = "month"): Promise<AnalyticsData> =>
    req<AnalyticsData>(`/api/admin/analytics?period=${period}`),

  // W-18: repeat-customer retention metrics (all-time).
  retention: async (): Promise<RetentionData> =>
    req<RetentionData>(`/api/admin/analytics/retention`),
};

// ─── App Config ───────────────────────────────────────────────────────────────

function inferConfigType(key: string, value: unknown): ConfigItem["type"] {
  if (typeof value === "boolean") return "boolean";
  // [SHL-7-16] A value that is not a number IS a string, whatever its key looks like. This fell
  // through to "number" for everything non-boolean, and a number input cannot show "Karnataka".
  // Checked before the key patterns deliberately: `company_gstin` contains no numeric hint, but
  // `min_order_note` would have matched /min_/ and been mistyped as currency.
  if (typeof value === "string" && value.trim() !== "" && !Number.isFinite(Number(value))) {
    return "string";
  }
  if (/price|fee|amount|threshold|min_|max_/.test(key)) return "currency";
  if (/percent|rate_target/.test(key)) return "percentage";
  if (/days/.test(key)) return "days";
  if (/hours/.test(key)) return "hours";
  return "number";
}

export const configApi = {
  get: async (): Promise<ConfigGroup[]> => {
    const rows = await req<
      {
        key: string;
        value: unknown;
        description?: string | null;
        min?: number | null;
        max?: number | null;
        dangerous?: boolean;
        enforced?: boolean;
        updated_by_email?: string | null;
        updated_at?: string | null;
      }[]
    >("/api/admin/config");
    if (!rows || rows.length === 0) return [];
    const items: ConfigItem[] = rows.map((r) => ({
      key: r.key,
      label: r.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: r.value as ConfigItem["value"],
      type: inferConfigType(r.key, r.value),
      description: r.description ?? null,
      min: r.min ?? null,
      max: r.max ?? null,
      dangerous: r.dangerous ?? false,
      // [SHL-7-9] Default TRUE: the common case stays quiet and only an explicitly
      // unwired key announces itself.
      enforced: r.enforced ?? true,
      updatedByEmail: r.updated_by_email ?? null,
      updatedAt: r.updated_at ?? null,
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

// ─── System Health (super) ────────────────────────────────────────────────────

export interface SystemHealth {
  checkedAt: string;
  environment: string;
  core: { database: string; redis: string; schemaVersion: number | null };
  worker: { stuckInvoices: number; status: string };
  integrations: {
    razorpay: { configured: boolean; webhook: boolean };
    r2: { configured: boolean };
    firebase: { configured: boolean };
    sendgrid: { configured: boolean };
    twilio: { configured: boolean };
    delivery: { shiprocket: boolean; delhivery: boolean };
  };
}

export const systemHealthApi = {
  get: async (): Promise<SystemHealth> =>
    req<SystemHealth>(`/api/admin/system-health`),
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditFilters {
  /** [SHL-7-13] Comma-separated actions to exclude (e.g. the noisy `update_config`). */
  exclude_action?: string;
  search?: string;
  action?: string;
  // T2-22: actor / entity / date filters
  actor?: string;
  entity_type?: string;
  entity_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const auditApi = {
  list: async (params: AuditFilters = {}): Promise<AuditLogResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.action) qs.set("action", params.action);
    // [SHL-7-13] Comma-separated actions to leave OUT — used to keep config churn from
    // burying the rows an auditor opened the page for.
    if (params.exclude_action) qs.set("exclude_action", params.exclude_action);
    if (params.actor) qs.set("actor", params.actor);
    if (params.entity_type) qs.set("entity_type", params.entity_type);
    if (params.entity_id) qs.set("entity_id", params.entity_id);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
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
        details: e.details,
      })),
    };
  },

  // T2-22: distinct actors + entity types for the filter dropdowns.
  /** [SHL-7-10] `actions` comes from the log itself, so every filter option is real. */
  facets: async (): Promise<{ actors: string[]; entity_types: string[]; actions: string[] }> =>
    req<{ actors: string[]; entity_types: string[]; actions: string[] }>(
      `/api/admin/audit-log/facets`,
    ),
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
    is_featured: (c.is_featured as boolean) ?? false,
    card_layout: (c.card_layout as string) ?? "full_image",
    hero_layout: (c.hero_layout as string) ?? "full_image",
    card_aspect: (c.card_aspect as number) ?? 0.8,
    hero_aspect: (c.hero_aspect as number) ?? 2.4,
    card_focal_x: (c.card_focal_x as number) ?? 50,
    card_focal_y: (c.card_focal_y as number) ?? 50,
    hero_focal_x: (c.hero_focal_x as number) ?? 50,
    hero_focal_y: (c.hero_focal_y as number) ?? 50,
    image_fit: ((c.image_fit as string) ?? "cover") as "cover" | "contain",
    image_zoom: (c.image_zoom as number) ?? 100,
    text_position: ((c.text_position as string) ?? "bottom") as "left" | "center" | "bottom",
    text_color: ((c.text_color as string) ?? "light") as "light" | "dark",
    overlay: (c.overlay as number) ?? 40,
    gradient_angle: (c.gradient_angle as number) ?? 135,
    gradient_solid: (c.gradient_solid as boolean) ?? false,
    logo_key: (c.logo_key as string | null) ?? null,
    cta_text: (c.cta_text as string) ?? "Explore",
    compose_style: (c.compose_style as Record<string, unknown>) ?? {},
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
  /**
   * [CM-22-3] Which hub's customers see this. NULL = everyone. The admin list has always
   * SELECTed it; nothing rendered it, so "who sees this banner?" was unanswerable from the
   * page that manages it — and [CM-22-2] made hub_id decide exactly that on the storefront.
   */
  hub_id?: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  image_only: boolean;
  layout: BannerLayout;
  text_position: BannerTextPosition;
  text_color: BannerTextColor;
  overlay: number;
  badge_text: string | null;
  focal_x: number;
  focal_y: number;
  image_fit: BannerImageFit;
  image_zoom: number;
  mode_mobile: BannerMode;
  mode_web: BannerMode;
  image_mobile: string | null;
  image_web: string | null;
  focal_x_mobile: number;
  focal_y_mobile: number;
  focal_x_web: number;
  focal_y_web: number;
  layout_mobile: BannerLayout;
  layout_web: BannerLayout;
  aspect_mobile: number;
  aspect_web: number;
  logo_key: string | null;
  show_ad: boolean;
  thumb_keys: string[];
  pills: string[];
  gradient_angle: number;
  gradient_solid: boolean;
  cta_style: BannerCtaStyle;
  compose_style: BannerComposeStyle;
  created_at: string;
  updated_at: string;
}

export type BannerCtaStyle = "auto" | "arrow" | "pill" | "none";

export interface BannerComposeStyle {
  free?: boolean;
  font?: "sans" | "serif" | "display";
  scale?: number;
  x?: number;
  y?: number;
  align?: "left" | "center" | "right";
  headlineColor?: string;
  ctaBg?: string;
  ctaColor?: string;
  weight?: number;
  tracking?: number;
  /** Legacy single free-design canvas (shared). Kept as a fallback for old records. */
  canvas?: unknown;
  /** Per-surface free-design canvases (Canva-style). Banner: mobile/web. Collection: card/hero. */
  canvas_mobile?: unknown;
  canvas_web?: unknown;
  canvas_card?: unknown;
  canvas_hero?: unknown;
  /** How this banner enters when it becomes the active carousel slide. */
  transition?: "fade" | "slide" | "zoom";
}

export type BannerMode = "upload" | "compose" | "canvas";

export type BannerLayout =
  | "full_image"
  | "split"
  | "text_cutout"
  | "centered"
  | "offer_badge"
  | "minimal"
  | "image_only"
  | "editorial"
  | "lookbook"
  | "bottom_bar"
  | "card"
  | "story"
  | "diagonal"
  | "framed"
  | "poster"
  | "showcase"
  | "spotlight"
  | "curated"
  | "triptych";

export type BannerTextPosition = "left" | "center" | "bottom";
export type BannerTextColor = "light" | "dark";
export type BannerImageFit = "cover" | "contain";

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

// T1-23: single-source money constants — read from the server so the FE never drifts from
// the backend (cost floor make/overhead, support credit cap, guarantee reserve).
export interface MoneyConfig {
  listing_make_cost: number;
  listing_overhead: number;
  support_credit_cap: number;
  guarantee_reserve_per_order: number;
}
export const fetchMoneyConfig = (): Promise<MoneyConfig> =>
  req<MoneyConfig>(`/api/admin/money-config`);

// ─── QC checklist templates (T1-13b) ──────────────────────────────────────────
export interface QcCheck {
  key: string;
  label: string;
  type: "numeric" | "boolean";
  required: boolean;
  min?: number | null;
  max?: number | null;
  unit?: string;
}
export interface QcTemplate {
  id: string;
  garment_category_id: string;
  category_name: string | null;
  category_slug: string | null;
  name: string | null;
  checks: QcCheck[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /**
   * [CM-20-9] Whether this checklist is doing anything: garments graded by the HOUSE layer
   * for this category, how many of those failed, and when one was last recorded. Without
   * it a CM cannot tell a working QC layer from a decorative one.
   */
  graded?: number;
  failed?: number;
  last_graded_at?: string | null;
}
// A check + the inspector's answer + computed pass flag, stored on a receipt (T1-13b Phase 2).
export interface QcEvaluatedResult {
  key: string;
  label: string;
  type: "numeric" | "boolean";
  value: number | null;
  pass: boolean | null;
  ok: boolean;
  required: boolean;
}
export const qcTemplatesApi = {
  list: (): Promise<QcTemplate[]> => req<QcTemplate[]>(`/api/admin/qc-templates`),
  forCategory: (categoryId: string): Promise<QcTemplate | null> =>
    req<QcTemplate | null>(`/api/admin/qc-templates/category/${categoryId}`),
  upsert: (
    categoryId: string,
    body: { name?: string; checks: QcCheck[] },
  ): Promise<QcTemplate> =>
    req<QcTemplate>(`/api/admin/qc-templates/category/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string): Promise<{ deleted: boolean }> =>
    req<{ deleted: boolean }>(`/api/admin/qc-templates/${id}`, { method: "DELETE" }),
};

// ─── T3-4: brand QC-2 config (a brand's second-layer checks per garment category) ──────────────
export interface BrandQcConfig {
  id?: string;
  brand_id?: string;
  garment_category_id: string;
  category_name?: string;
  checks: QcCheck[];
  is_active?: boolean;
  updated_at?: string;
}
export const brandQcApi = {
  list: (brandId: string): Promise<BrandQcConfig[]> =>
    req<BrandQcConfig[]>(`/api/admin/qc2/brand-qc/${brandId}`),
  forCategory: (brandId: string, categoryId: string): Promise<BrandQcConfig | null> =>
    req<BrandQcConfig | null>(`/api/admin/qc2/brand-qc/${brandId}/category/${categoryId}`),
  upsert: (
    brandId: string,
    categoryId: string,
    body: { checks: QcCheck[] },
  ): Promise<BrandQcConfig> =>
    req<BrandQcConfig>(`/api/admin/qc2/brand-qc/${brandId}/category/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

// ─── T3-4: per-order QC results (house QC-1 + brand QC-2) ──────────────────────────────────────
export interface QcResultRow {
  layer: "house" | "brand";
  answers: Array<{ key: string; value?: number | null; pass?: boolean | null }>;
  verdict: "pass" | "fail";
  note: string | null;
  created_at: string;
}
export interface QcResultContext {
  is_house: boolean;
  brand_id: string;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  house_checks: QcCheck[];
  brand_checks: QcCheck[];
  results: QcResultRow[];
}
export interface QcResultAnswer {
  key: string;
  value?: number | null;
  pass?: boolean | null;
}
export const qcResultsApi = {
  get: (orderItemId: string): Promise<QcResultContext> =>
    req<QcResultContext>(`/api/admin/qc2/qc-results/${orderItemId}`),
  record: (
    orderItemId: string,
    body: { layer: "house" | "brand"; answers: QcResultAnswer[]; note?: string },
  ): Promise<{ verdict: "pass" | "fail"; failed: string[] }> =>
    req<{ verdict: "pass" | "fail"; failed: string[] }>(`/api/admin/qc2/qc-results/${orderItemId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ─── T2-7: per-hub constraint view + festival/leave calendar ───────────────────
export interface HubConstraintRow {
  hub_id: string | null;
  hub_name: string | null;
  stage: string;
  threshold_hours: number | null; // null for the 'alteration' line (no stage SLA) — T2-9
  wip_count: number;
  p50_stage_hours: number | null;
  p90_stage_hours: number | null;
  max_stage_hours: number | null;
  over_sla_count: number;
  p50_order_age_hours: number | null;
}
export interface HubCalendarEvent {
  id: string;
  hub_id: string | null;
  hub_name: string | null;
  event_type: "demand_spike" | "staff_leave";
  label: string;
  starts_on: string;
  ends_on: string;
  magnitude: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
export type HubCalendarInput = {
  hub_id?: string | null;
  event_type: "demand_spike" | "staff_leave";
  label: string;
  starts_on: string;
  ends_on: string;
  magnitude?: number;
  note?: string;
};
// T2-11: per-hub intake surge signal.
export interface HubSurgeRow {
  hub_id: string | null;
  hub_name: string | null;
  wip_total: number;
  over_sla_total: number;
  wip_threshold: number;
  sla_breach_threshold: number;
  is_surging: boolean;
  surge_reason: "wip" | "sla" | "both" | null;
}
export const hubPlanningApi = {
  constraints: (hubId?: string): Promise<HubConstraintRow[]> =>
    req<HubConstraintRow[]>(
      `/api/admin/analytics/hub-constraints${hubId ? `?hub_id=${hubId}` : ""}`,
    ),
  surge: (hubId?: string): Promise<HubSurgeRow[]> =>
    req<HubSurgeRow[]>(`/api/admin/analytics/hub-surge${hubId ? `?hub_id=${hubId}` : ""}`),
  listEvents: (params: { hubId?: string; upcoming?: boolean } = {}): Promise<HubCalendarEvent[]> => {
    const qs = new URLSearchParams();
    if (params.hubId) qs.set("hub_id", params.hubId);
    if (params.upcoming) qs.set("upcoming", "true");
    const s = qs.toString();
    return req<HubCalendarEvent[]>(`/api/admin/hub-calendar${s ? `?${s}` : ""}`);
  },
  createEvent: (body: HubCalendarInput): Promise<HubCalendarEvent> =>
    req<HubCalendarEvent>(`/api/admin/hub-calendar`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEvent: (id: string, body: HubCalendarInput): Promise<HubCalendarEvent> =>
    req<HubCalendarEvent>(`/api/admin/hub-calendar/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  removeEvent: (id: string): Promise<{ deleted: boolean }> =>
    req<{ deleted: boolean }>(`/api/admin/hub-calendar/${id}`, { method: "DELETE" }),
};

// ─── T2-12: garment disposition + write-off (returns / RTO) ────────────────────
export type DispositionKind = "pending" | "donate" | "scrap" | "salvage" | "remake_source";
export interface GarmentDisposition {
  id: string;
  order_id: string;
  source: "return" | "rto";
  disposition: DispositionKind;
  write_off_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
export interface DispositionResponse {
  disposition: GarmentDisposition | null;
  fabric_cost: number;
  make_cost: number;
  suggested_write_off: number;
}
export const dispositionApi = {
  get: (orderId: string): Promise<DispositionResponse> =>
    req<DispositionResponse>(`/api/admin/dispositions/${orderId}`),
  set: (
    orderId: string,
    body: { source: "return" | "rto"; disposition: DispositionKind; write_off_amount?: number; note?: string },
  ): Promise<DispositionResponse> =>
    req<DispositionResponse>(`/api/admin/dispositions/${orderId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

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
  // [SUP-34-2] Nullable in the database: a review can be about a brand, or about
  // neither. Typed honestly so the compiler catches the `.toLowerCase()` sites.
  product_id: string | null;
  product_name: string | null;
  brand_name: string | null;
  /** What the review is about: product name, else brand name, else neither. */
  subject_name: string | null;
  rating: number;
  comment: string | null;
  photo_keys: string[];
  is_approved: boolean;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  // T2-36 (SP-5): verified-purchase compliance artifact + rejection reason.
  verified_purchase?: boolean;
  rejection_reason?: string | null;
}

export interface PendingReviewsResponse {
  reviews: AdminReview[];
  total: number;
  page: number;
  limit: number;
}

/** [SUP-34-6] Which bucket of the moderation queue to show. */
export type ReviewModerationStatus = "pending" | "approved" | "rejected" | "all";

export const reviewsApi = {
  // [SUP-34-6] The path is historical — it now serves the decided buckets too, so a
  // wrong rejection is findable and (by moderating it again) reversible.
  listPending: (
    page = 1,
    limit = 25,
    status: ReviewModerationStatus = "pending",
  ): Promise<PendingReviewsResponse> =>
    req<PendingReviewsResponse>(
      `/api/reviews/pending?page=${page}&limit=${limit}&status=${status}`,
    ),

  // T2-36 (SP-5): a rejection carries a reason (required server-side).
  moderate: (id: string, approve: boolean, reason?: string): Promise<void> =>
    req<void>(`/api/reviews/${id}/moderate`, {
      method: "POST",
      body: JSON.stringify({ approve, ...(reason ? { reason } : {}) }),
    }),

  /**
   * [SUP-34-7] One request, one transaction. The console used to loop `moderate` per id,
   * so a fifty-review sweep was fifty requests and fifty aggregate recomputations with
   * nothing holding them together. All-or-nothing server-side: a partial sweep is worse
   * than a failed one, because the moderator cannot see which half landed.
   */
  moderateBulk: (
    ids: string[],
    approve: boolean,
    reason?: string,
  ): Promise<{ moderated: number; ids: string[] }> =>
    req<{ moderated: number; ids: string[] }>(`/api/reviews/moderate-bulk`, {
      method: "POST",
      body: JSON.stringify({ ids, approve, ...(reason ? { reason } : {}) }),
    }),
};

// ─── Returns ──────────────────────────────────────────────────────────────────

// T2-31 (SP-4): the policy verdict a support agent reads before acting.
export type PolicyTone = "success" | "info" | "danger" | "neutral";
export interface PolicyVerdict {
  outcome: "refund" | "alteration" | "declined" | "manual";
  label: string;
  detail: string;
  tone: PolicyTone;
}
export type ReturnSection = "needs_action" | "pickup" | "refund" | "closed";

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
  payable_amount?: number | string; // order total; pg numeric → string over the wire
  created_at: string;
  updated_at: string;
  // T2-31: worklist bucket + policy verdict (present from list + detail endpoints).
  section?: ReturnSection;
  policy_verdict?: PolicyVerdict;
  // [SUP-31-6] The alteration this return produced, when the policy verdict was
  // "free alteration". Null until one is raised — which, before this, could not be
  // done from here at all.
  linked_alteration?: LinkedAlteration | null;
  // [SUP-31-9] The date finance sees, computed by the same function, so support can
  // answer "when will the money arrive?" without a finance seat they cannot have.
  refund_status?: string | null;
  refund_initiated_at?: string | null;
  expected_settlement_at?: string | null;
  settlement_business_days?: number;
}

/** [SUP-31-6] The alteration a fit return was settled with. */
export interface LinkedAlteration {
  id: string;
  status: string;
  description: string;
  fee_amount: number | string | null;
  fee_status: string | null;
  agent_visit_date: string | null;
  garment_picked_up_at: string | null;
  redelivered_at: string | null;
  created_at: string;
}

export interface ReturnsResponse {
  returns: ReturnRequest[];
  total: number;
  /**
   * [SCA-44-3] Section counts aggregated ON THE SERVER over the whole set. The
   * page loads the newest 100 and buckets them client-side, so a header count
   * derived from the loaded rows says "what loaded", not "what exists" — and at
   * 101 returns the operator cannot tell a quiet day from a truncated one.
   */
  section_counts?: Record<string, number>;
  /** True when more rows exist than this page returned. */
  truncated?: boolean;
  page: number;
  limit: number;
}

export const returnsApi = {
  list: async (
    params: { status?: string; page?: number; limit?: number; search?: string } = {},
  ): Promise<ReturnsResponse> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    // [SUP-31-5] Server-side, so a search reaches past the loaded page — and so it can
    // match customer_phone, which the browser filter never looked at.
    if (params.search) qs.set("search", params.search);
    return req<ReturnsResponse>(`/api/admin/returns?${qs}`);
  },

  get: async (id: string): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns/${id}`),

  /**
   * [SUP-31-6] Settle a fit return the way the policy says: raise the free alteration
   * and close the return, in one server-side transaction. The page used to render the
   * policy chip promising this and offer no verb at all behind it.
   */
  resolveWithAlteration: async (
    id: string,
    data: { description: string; areas?: string[]; note?: string },
  ): Promise<{ return_id: string; alteration_id: string; fee_status: string }> =>
    req<{ return_id: string; alteration_id: string; fee_status: string }>(
      `/api/admin/returns/${id}/resolve-with-alteration`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  review: async (
    id: string,
    data: { status: string; review_note?: string; refund_amount?: number },
  ): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns/${id}/override`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Admin/support raises a return on the customer's behalf (e.g. a phone call).
  // Reuses the customer service: delivered-only, reason routes the outcome,
  // COD refunds need an account, duplicate-per-order blocked. Gated orders:write.
  create: async (data: {
    user_id: string;
    order_id: string;
    reason: string;
    description?: string;
    refund_account_type?: "upi" | "bank";
    refund_account_detail?: string;
  }): Promise<ReturnRequest> =>
    req<ReturnRequest>(`/api/admin/returns`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Approve a return → initiates the refund (money action). Finance only
  // (refunds:approve); the return must already be defect-confirmed.
  approve: async (id: string, note?: string, refundAmount?: number): Promise<{ message: string }> =>
    req<{ message: string }>(`/api/admin/returns/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({
        ...(note ? { note } : {}),
        ...(refundAmount !== undefined ? { refund_amount: refundAmount } : {}),
      }),
    }),
};

// ─── Alterations ──────────────────────────────────────────────────────────────

export interface AlterationRequest {
  // [SUP-31-7] The fee the SERVER computed for this request, from the hub's own
  // `alteration_fee` + `alteration_first_free`. It has always been on the created row
  // (`RETURNING *`) and the client discarded it, then told the customer the alteration was
  // free regardless of what the hub charges.
  fee_amount?: string | number | null;
  fee_status?: 'free' | 'waived' | 'pending' | null;
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
  /**
   * [SUP-31-8] The logistics story. All of it has always been on the row and returned
   * by `GET /alterations/:id` — which no page called — so the two questions a customer
   * actually asks ("when is someone coming for the garment?" and "will I be charged?")
   * were in the API and on no screen. Present only from `alterationsApi.get()`.
   */
  assigned_agent_name?: string | null;
  agent_visit_date?: string | null;
  pickup_failure_reason?: string | null;
  pickup_failed_at?: string | null;
  garment_picked_up_at?: string | null;
  garment_received_at_hub?: string | null;
  assigned_tailor_name?: string | null;
  alteration_completed_at?: string | null;
  alteration_qc_at?: string | null;
  alteration_qc_note?: string | null;
  redelivered_at?: string | null;
  staff_note?: string | null;
  /** [SUP-31-6] Set when this alteration was raised to settle a fit return. */
  return_id?: string | null;
  return_reason?: string | null;
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

  // Admin/support raises an alteration on the customer's behalf (e.g. a phone
  // call). The backend reuses the customer service: order must be delivered &
  // belong to the user, fee policy applies, duplicate-open is blocked.
  create: async (data: {
    user_id: string;
    order_id: string;
    description: string;
    areas?: string[];
  }): Promise<AlterationRequest> =>
    req<AlterationRequest>(`/api/admin/alterations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
    | "rejected"
    | "cancelled";
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
  hub_name: string | null;
  // T2-32 (D-1): give-back — # hubs the CM has this design+fabric live at (0 = not listed yet).
  listed_hub_count: number;
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
  listed_hub_count: number; // T2-32 (D-1): give-back
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
    care_instructions: string[] | null;
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

  // Approve: mark the sample 'reviewed' — satisfies the D13 listing gate.
  review: async (id: string): Promise<SampleJob> =>
    req<SampleJob>(`/api/admin/sample-jobs/${id}/review`, { method: "POST" }),

  // Needs changes: reject with a reason (status='rejected'; can't be listed).
  reject: async (id: string, reason: string): Promise<SampleJob> =>
    req<SampleJob>(`/api/admin/sample-jobs/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  addComment: async (id: string, body: string): Promise<SampleComment> =>
    req<SampleComment>(`/api/admin/sample-jobs/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  // Design requests a sample (design × fabric × hub) → goes to the hub.
  /**
   * [DSG-12-5] What a request would collide with, before spending a garment of cloth.
   * `in_flight` means the POST will 409; `reviewed_at` means it will succeed and probably
   * shouldn't.
   */
  precondition: async (input: {
    design_id: string;
    fabric_id: string;
    hub_id: string;
  }): Promise<{
    in_flight: { id: string; status: string } | null;
    reviewed_at: string | null;
    paired: boolean;
  }> =>
    req(
      `/api/admin/sample-jobs/precondition?design_id=${input.design_id}&fabric_id=${input.fabric_id}&hub_id=${input.hub_id}`,
    ),

  request: async (input: {
    design_id: string;
    fabric_id: string;
    hub_id: string;
  }): Promise<SampleJob> =>
    req<SampleJob>(`/api/admin/sample-jobs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Cancel a still-'requested' sample (design's My Sample Requests).
  cancel: async (id: string): Promise<SampleJob> =>
    req<SampleJob>(`/api/admin/sample-jobs/${id}/cancel`, { method: "POST" }),
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
  design_garment_type?: string | null; // the cut (e.g. "casual shirt")
  garment_slug: string;
  reference_image_keys: string[];
  tags?: string[]; // T3-5 (W-D3)
  fabric_count: number;
  fabric_swatches?: string[];
  cover_key: string | null;
  // G-34 lifecycle
  sample_count?: number;
  has_reviewed_sample?: boolean;
  live_hub_count?: number;
  avg_fit?: number | null;
  created_at?: string;
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
  price_per_meter: string | null;
  hubs: { hub_id?: string; hub_name: string; available_meters: number | string }[];
}
export interface DesignSampleRef {
  id: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  hub_name: string | null;
}
export interface DesignListingRef {
  id: string;
  price: string | number;
  is_active: boolean;
  hub_name: string;
  fabric_name: string | null;
}
export interface DesignFitSummary {
  responded: number;
  good_fit: number;
  ftr: number | null;
  avg_fit: number | null;
  recent: { id: string; overall_fit: number; notes: string | null; created_at: string }[];
}

export interface DesignDetail {
  id: string;
  name: string;
  gender: string | null;
  style: string | null;
  fit_preset: string | null;
  meters_per_garment: string | null;
  meters_by_size?: Record<string, number> | null; // size_label → metres (INVENTORY-FABRIC-MODEL §1)
  status: DesignStatus;
  garment_type: string; // the CATEGORY name (e.g. "Top wear") — display label
  design_garment_type?: string | null; // the specific TYPE the design is (e.g. "formal shirt")
  category_garment_types?: string[] | null; // types this category can produce
  garment_slug: string;
  garment_category_id: string;
  tech_pack: Record<string, unknown> | null;
  capture_set: unknown;
  pain_point_menu: Record<string, unknown> | null;
  reference_image_keys: string[];
  spec_sheet_key?: string | null;
  tags?: string[]; // T3-5 (W-D3)
  template_capture_set: unknown;
  template_pain_point_menu: Record<string, unknown> | null;
  template_fit_presets: string[] | null;
  created_at: string;
  updated_at: string;
  fabrics: DesignFabricRef[];
  // detail tabs (spec §4 DesignDetail)
  samples: DesignSampleRef[];
  listings: DesignListingRef[];
  fit: DesignFitSummary;
  // G-34 lifecycle
  sample_count?: number;
  has_reviewed_sample?: boolean;
  live_hub_count?: number;
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
  garment_type?: string | null;
  gender?: string;
  style?: string | null;
  fit_preset?: string | null;
  meters_per_garment?: number;
  meters_by_size?: Record<string, number>; // size_label → metres (INVENTORY-FABRIC-MODEL §1)
  tech_pack?: Record<string, unknown> | null;
  capture_set?: unknown;
  pain_point_menu?: Record<string, unknown> | null;
  reference_image_keys?: string[];
  spec_sheet_key?: string | null;
  tags?: string[]; // T3-5 (W-D3)
  fabrics?: { fabric_id: string; meters_per_garment?: number | null }[];
}

export interface GarmentCategoryOption {
  id: string;
  name: string;
  slug: string;
  body_region: string | null;
  /** Which block the fit engine drafts this on: mens_upper | womens_upper | lower. [DSG-11-7] */
  drafting_block?: string | null;
  capture_set: unknown;
  pain_point_menu: Record<string, unknown> | null;
  body_shape_menu?: Record<string, Record<string, number>> | null;
  tolerances?: Record<string, number> | null;
  available_fit_presets: string[] | null;
  // Presets the ENGINE can actually run (have a garment_fit_preset row). Derived
  // server-side; use THIS for the engine tester, not the authored column above.
  calibrated_fit_presets?: string[] | null;
  garment_types?: string[] | null;
  used_by_designs?: number;
  /** [DSG-11-13] The other two conditions the server blocks a delete on. */
  used_by_fit_profiles?: number;
  used_by_storefront_categories?: number;
}

export interface CreateGarmentCategoryInput {
  name: string;
  body_region: "upper" | "lower";
  /**
   * Which block the engine drafts this on. Optional for back-compat; an upper garment
   * without it defaults to the men's block, exactly as before. [DSG-11-7]
   */
  drafting_block?: "mens_upper" | "womens_upper" | "lower";
  garment_types?: string[];
  description?: string | null;
}

export interface ChartRow {
  fit_preset: string | null;
  size_label: string;
  measurements: Record<string, number>;
  /**
   * [FIT-76] What the numbers ARE, and what unit they are in.
   *
   * The engine adds the style's ease to a BODY measurement to get a garment; a FINISHED
   * measurement already includes it. Both columns existed in the database and neither was
   * ever asked for, so a centimetre chart was read as inches and a finished chart was eased
   * twice. Optional on the wire: the backend defaults to the inches-and-body every existing
   * row already is.
   */
  unit?: 'in' | 'cm';
  measurement_basis?: 'body' | 'finished';
}
/**
 * The cut-sheet spec (garment_cutting_specs) — the allowances and fabric geometry a
 * garment is actually cut to. Replaces the two design-plane allowance fields, which no
 * downstream consumer ever read. [DSG-11-8]
 */
export interface CuttingSpec {
  fabric_width_cm: number;
  seam_allowance_cm: number;
  hem_allowance_cm: number;
  wastage_factor: number;
  min_fabric_meters: number;
  max_fabric_meters: number;
  cutting_notes: string | null;
}

export interface GarmentTemplate {
  id: string;
  name: string;
  slug: string;
  body_region: string | null;
  capture_set: string[] | null;
  pain_point_menu: Record<string, Record<string, number>> | null;
  body_shape_menu?: Record<string, Record<string, number>> | null;
  tolerances?: Record<string, number> | null;
  /** Which block the fit engine drafts this on: mens_upper | womens_upper | lower. */
  drafting_block?: string | null;
  /** null when this garment type has no spec row — it cannot be cut yet. */
  cutting_spec?: CuttingSpec | null;
  /** Where QC thresholds really live, so the editor can stop implying it owns them. */
  qc_reality?: { has_template: boolean; check_count: number };
  available_fit_presets: string[] | null;
  garment_types?: string[] | null;
  fit_presets?: FitPresetDef[] | null;
  length_bands?: LengthBand[] | null;
  chart: ChartRow[];
  used_by_designs?: number;
  /** [DSG-11-13] The other two conditions the server blocks a delete on. */
  used_by_fit_profiles?: number;
  used_by_storefront_categories?: number;
  used_by_orders?: number;
  /**
   * [DSG-11-9] The newest revision of this recipe. Echo it back on save: if someone else
   * saved while this page was open the numbers no longer match and the save is refused
   * (409) instead of silently winning the whole recipe. 0 = never saved since versioning.
   */
  version?: number;
  version_saved_at?: string | null;
}

/** [DSG-11-9] One named field change between two revisions of a recipe. */
export interface TemplateChange {
  /** e.g. `chart · slim · 32 · chest`. */
  path: string;
  from: unknown;
  to: unknown;
}
export interface TemplateDiff {
  changes: TemplateChange[];
  total: number;
  truncated: boolean;
}
/** A row in the revision history. Carries the diff summary, not the whole snapshot. */
export interface TemplateVersionRow {
  version: number;
  note: string | null;
  /** `baseline` is the automatic record of the state before this type was ever versioned. */
  source: 'save' | 'baseline' | 'restore';
  created_at: string;
  /** null for the baseline row, and for an author whose account was deleted. */
  created_by: { id: string; name: string } | null;
  changed: number;
  changes: TemplateChange[];
  truncated: boolean;
}
export interface TemplateVersionDetail {
  version: number;
  note: string | null;
  source: string;
  created_at: string;
  snapshot: Record<string, unknown>;
  /** What this save changed at the time. */
  diff: TemplateDiff;
  /** What restoring it would change now — the current state moves, this is computed live. */
  diff_vs_current: TemplateDiff;
}

export interface FitPresetDef {
  fit_preset: string;
  /**
   * Ease values, EXCEPT the women's-block silhouette modes (`waist_mode`, `hem_mode`),
   * which are enums. The backend validator accepts exactly those two as strings. [DSG-11-7]
   */
  params: Record<string, number | string>;
}
export interface LengthBand {
  length_field?: string;
  height_min_cm: number;
  length_value: number;
}
export interface GarmentTemplateInput {
  capture_set: string[];
  pain_point_menu: Record<string, Record<string, number>>;
  body_shape_menu?: Record<string, Record<string, number>>;
  tolerances?: Record<string, number>;
  cutting_spec?: Partial<Omit<CuttingSpec, 'cutting_notes'>> & { cutting_notes?: string | null };
  available_fit_presets: string[];
  garment_types?: string[];
  fit_presets?: FitPresetDef[];
  length_bands?: LengthBand[];
  chart: ChartRow[];
  note?: string; // "what changed" one-liner → audit trail
  /** [DSG-11-9] The version this editor loaded. Stale → 409, not a silent overwrite. */
  expected_version?: number;
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

// T2-21 exceptions-first overview types
export interface DesignExceptionRow {
  id: string;
  name: string;
  garment_type: string;
  gender: string | null;
  created_at: string;
  days_published: number;
  live_hub_count: number;
  units_sold: number;
}
export interface DesignExceptions {
  aging_days: number;
  counts: { published_never_listed: number; aging: number };
  published_never_listed: DesignExceptionRow[];
  aging: DesignExceptionRow[];
}
export interface ListingOosRow {
  listing_id: string;
  design_name: string;
  hub_name: string;
  hub_id: string;
  price: number;
  meters_per_garment: number;
  available_meters: number;
  created_at: string;
}
export interface ListingBelowFloorRow {
  listing_id: string;
  design_name: string;
  hub_name: string;
  hub_id: string;
  price: number;
  cost_floor: number;
  created_at: string;
}
export interface ListingExceptions {
  counts: { live_but_oos: number; below_floor: number };
  live_but_oos: ListingOosRow[];
  below_floor: ListingBelowFloorRow[];
}

export const designsApi = {
  list: async (
    params: {
      status?: string;
      garment_category_id?: string;
      gender?: string;
      q?: string;
      tag?: string; // T3-5 (W-D3): filter by tag/drop
      dead?: boolean; // T1-28: published, never listed (server-side, correct across pages)
      sample_pending?: boolean; // T1-28: not archived + no reviewed sample
      limit?: number;
      offset?: number;
      sort?: "newest" | "best_fit";
    } = {},
  ): Promise<DesignSummary[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.garment_category_id)
      qs.set("garment_category_id", params.garment_category_id);
    if (params.gender) qs.set("gender", params.gender);
    if (params.q) qs.set("q", params.q);
    if (params.tag) qs.set("tag", params.tag);
    if (params.dead) qs.set("dead", "true");
    if (params.sample_pending) qs.set("sample_pending", "true");
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    if (params.sort) qs.set("sort", params.sort);
    const q = qs.toString();
    return req<DesignSummary[]>(`/api/admin/designs${q ? `?${q}` : ""}`);
  },

  get: async (id: string): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs/${id}`),

  // T3-5 (W-D3): distinct tags/drops with counts, for the library filter.
  tags: async (): Promise<{ tag: string; count: number }[]> =>
    req<{ tag: string; count: number }[]>(`/api/admin/designs/tags`),

  fabricOptions: async (): Promise<FabricOption[]> =>
    req<FabricOption[]>(`/api/admin/designs/fabric-options`),

  garmentCategories: async (): Promise<GarmentCategoryOption[]> =>
    req<GarmentCategoryOption[]>(`/api/admin/designs/garment-categories`),

  // Step 3: the finished-garment standard chart for a (category, fit) — shown inline in the
  // design editor so the designer sees the sizing/grading the garment will follow.
  fitChart: async (
    categoryId: string,
    fit: string,
  ): Promise<{ slug: string; fit: string; chart: Record<string, number | string>[] }> =>
    req(
      `/api/admin/designs/garment-categories/${categoryId}/fit-chart?fit=${encodeURIComponent(fit)}`,
    ),

  createGarmentCategory: async (
    input: CreateGarmentCategoryInput,
  ): Promise<GarmentCategoryOption> =>
    req<GarmentCategoryOption>(`/api/admin/designs/garment-categories`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteGarmentCategory: async (id: string): Promise<{ deleted: boolean }> =>
    req<{ deleted: boolean }>(`/api/admin/designs/garment-categories/${id}`, {
      method: "DELETE",
    }),

  overview: async (): Promise<DesignOverviewRow[]> =>
    req<DesignOverviewRow[]>(`/api/admin/designs/overview`),

  // T2-21: exceptions-first overview (published-never-listed + aging)
  overviewExceptions: async (
    p: { hub_id?: string; start_date?: string; end_date?: string } = {},
  ): Promise<DesignExceptions> => {
    const qs = new URLSearchParams();
    if (p.hub_id) qs.set('hub_id', p.hub_id);
    if (p.start_date) qs.set('start_date', p.start_date);
    if (p.end_date) qs.set('end_date', p.end_date);
    const s = qs.toString();
    return req<DesignExceptions>(`/api/admin/designs/overview-exceptions${s ? `?${s}` : ''}`);
  },

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

  // [DSG-11-9] The revision spine of a garment type's fit recipe.
  listTemplateVersions: async (categoryId: string): Promise<TemplateVersionRow[]> =>
    req<TemplateVersionRow[]>(
      `/api/admin/designs/garment-categories/${categoryId}/template/versions`,
    ),

  getTemplateVersion: async (
    categoryId: string,
    version: number,
  ): Promise<TemplateVersionDetail> =>
    req<TemplateVersionDetail>(
      `/api/admin/designs/garment-categories/${categoryId}/template/versions/${version}`,
    ),

  restoreTemplateVersion: async (
    categoryId: string,
    version: number,
    note?: string,
  ): Promise<GarmentTemplate> =>
    req<GarmentTemplate>(
      `/api/admin/designs/garment-categories/${categoryId}/template/versions/${version}/restore`,
      { method: "POST", body: JSON.stringify({ note }) },
    ),

  create: async (input: DesignInput): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // T0-5: `acknowledge` opts into re-triggering sampling when the design already has an
  // approved sample / live listing. Without it the server 409s (code DESIGN_LOCKED).
  update: async (id: string, input: DesignInput, acknowledge = false): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs/${id}`, {
      method: "PUT",
      body: JSON.stringify(acknowledge ? { ...input, acknowledge: true } : input),
    }),

  setStatus: async (id: string, status: DesignStatus): Promise<DesignDetail> =>
    req<DesignDetail>(`/api/admin/designs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // G-81: engine preview — run this garment-type's chart+preset(+pain-points) against
  // a sample body and return the finished spec (validate a chart before it ships).
  sizePreview: async (input: SizePreviewInput): Promise<SizePreviewResult> =>
    req<SizePreviewResult>(`/api/admin/designs/size-preview`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // ── Tech-pack import: a brand's own size chart into the engine ──────────────
  //
  // Until this existed, `garment_size_chart` held 7 rows and NOT ONE carried a
  // design_id — every garment was cut to a generic category chart, and the only way
  // to change that was hand-written SQL.

  /** Which designs are still falling back to the generic chart. */
  chartCoverage: async (): Promise<ChartCoverageRow[]> =>
    req<ChartCoverageRow[]>(`/api/admin/designs/chart-coverage`),

  /** What THIS design is sized by right now, and its chart if it has one. */
  chartStatus: async (designId: string): Promise<DesignChartStatus> =>
    req<DesignChartStatus>(`/api/admin/designs/${designId}/chart`),

  /** Parse WITHOUT writing — the preview step, so nothing lands unseen. */
  techPackPreview: async (
    designId: string,
    input: TechPackInput,
  ): Promise<TechPackParseResult> =>
    req<TechPackParseResult>(`/api/admin/designs/${designId}/tech-pack/preview`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** Parse AND write. Replaces this design's chart wholesale. */
  techPackImport: async (
    designId: string,
    input: TechPackInput & { source_note?: string; basis?: MeasurementBasis },
  ): Promise<TechPackImportResult> =>
    req<TechPackImportResult>(`/api/admin/designs/${designId}/tech-pack`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** The measurement keys the engine actually reads off a chart. */
export type EngineChartField = "waist" | "hip" | "thigh" | "knee" | "rise";

/**
 * Whether a chart's numbers are the BODY a size is meant to fit, or the FINISHED garment.
 *
 * There is no safe guess. The engine adds the style's ease to a body measurement to get a
 * garment; a finished measurement already includes it. Get it wrong and every size is out
 * by exactly one ease — a garment two allowances too big, plausible on screen and wrong
 * on the customer.
 */
export type MeasurementBasis = "body" | "finished";

export interface TechPackInput {
  text: string;
  unit?: "in" | "cm";
  /** Source column header → engine field, for a heading the parser did not recognise. */
  overrides?: Record<string, EngineChartField>;
}

export interface TechPackParseResult {
  rows: { size_label: string; measurements: Partial<Record<EngineChartField, number>> }[];
  /** engine field → the source column it came from. */
  mapped: Record<string, string>;
  /** Columns present in the file that mean nothing to the engine. */
  unmapped: string[];
  /** Anything refused, with the reason. Never a bare "invalid". */
  problems: string[];
  unit: "in" | "cm";
  engine_fields: EngineChartField[];
}

export interface TechPackImportResult {
  design_id: string;
  sizes_written: number;
  fields: string[];
  problems: string[];
  replaced: number;
  basis: MeasurementBasis;
  /** Set when the chart cannot be used by the cutting engine that is live today. */
  warning?: string;
}

export interface DesignChartStatus {
  design_id: string;
  design_name: string;
  category: string;
  /** `own` = the brand's DNA is in the engine. `category` = a generic chart is in use. */
  source: "own" | "category" | "none";
  own_sizes: number;
  category_sizes: number;
  basis: MeasurementBasis;
  /** False when the design HAS a chart but the live engine still cannot use it. */
  usable_by_live_engine: boolean;
  chart: { size_label: string; measurements: Record<string, number> }[];
  note: string;
}

export interface ChartCoverageRow {
  design_id: string;
  name: string;
  status: string;
  category: string;
  body_region: string | null;
  own_sizes: number;
}

export interface SizePreviewInput {
  garment_category_slug: string;
  fit_preset: string;
  usual_size?: number;
  height_cm?: number;
  inseam?: number; // desired finished length (preferred over height) for bottoms
  waist?: number;
  hip?: number;
  thigh?: number;
  knee?: number;
  chest?: number;
  shoulder?: number;
  neck?: number;
  sleeve?: number;
  bicep?: number;
  shirt_length?: number;
  bust?: number;
  underbust?: number;
  length?: number;
  adjustments?: Record<string, number>;
  body_shapes?: Record<string, number>; // shape_key → intensity (0..1.5)
  stretch_pct?: number; // fabric: reduces ease
  shrinkage_pct?: number; // fabric: enlarges cut
}
export interface SizePreviewResult {
  garment: string;
  region: string;
  fit_preset: string;
  type: string;
  spec: Record<string, number>;
  /** Per-field authority: where each number came from. Null when the engine did not tag. [DSG-11-19] */
  provenance?: Record<string, string> | null;
  /**
   * [DSG-9-5] Whether the engine is allowed to drive a real cut (`ENGINE_DRIVES_CUTS`).
   *
   * Served, not assumed: the flag is app-config and can be turned on without a deploy, so a
   * client-side constant would be wrong the day it changes. Optional only because an older API
   * may not send it — and an ABSENT answer must be treated as "not live", never as "fine".
   */
  engine_drives_cuts?: boolean;
}

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
  payable_amount?: string | number | null;
  hub_name?: string | null;
  // T2-19: GST snapshot (null until the invoice PDF is generated)
  taxable_value?: string | number | null;
  tax_total?: string | number | null;
  grand_total?: string | number | null;
  is_interstate?: boolean | null;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  total_invoiced?: number;
  total_taxable?: number; // [FIN-35-4] the taxable half of total_invoiced
  total_order_value?: number; // [FIN-35-4] the ORDER-side total, for showing a divergence
  total_gst?: number; // T2-19: GST itemized across the filtered set (CA's monthly figure)
  page: number;
  limit: number;
}

export const invoicesApi = {
  list: async (
    params: {
      orderId?: string;
      status?: string;
      hub_id?: string;
      month?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<InvoicesResponse> => {
    const qs = new URLSearchParams();
    if (params.orderId) qs.set("orderId", params.orderId);
    if (params.status) qs.set("status", params.status);
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    if (params.month) qs.set("month", params.month);
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
  /**
   * [FIN-35-3] What the ORDERS linked to this deposit actually owe, summed from their
   * COD payments. `total_amount` is what the depositor DECLARED; comparing the two is
   * the only thing that catches an under-declaration, which declared-vs-counted
   * cannot see by construction.
   */
  expected_amount?: string | number | null;
  id: string;
  hub_id: string;
  hub_name: string;
  staff_name: string;
  order_count: number;
  total_amount: number;
  confirmed_at: string | null; // ops-side (hub manager) counter-confirm
  confirmed_by_name: string | null;
  // Finance custody confirm (G-28/D19) — cash verified against the bank.
  finance_confirmed_at: string | null;
  finance_confirmed_by_name: string | null;
  counted_amount: number | null;
  variance_reason: string | null;
  variance_resolved_at?: string | null;
  variance_resolved_by_name?: string | null;
  variance_resolution?: string | null;
  created_at: string;
}
export interface CodDepositOrder {
  id: string;
  order_number: string;
  payable_amount: string | number;
  customer_name: string | null;
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

  // Finance confirms a deposit against the bank (G-28/D19). A counted amount that
  // differs from the declared total REQUIRES a variance reason (server-enforced).
  confirm: async (
    depositId: string,
    countedAmount: number,
    varianceReason?: string,
  ): Promise<void> =>
    req(`/api/admin/cod-deposits/${depositId}/confirm`, {
      method: "POST",
      body: JSON.stringify({
        counted_amount: countedAmount,
        ...(varianceReason ? { variance_reason: varianceReason } : {}),
      }),
    }),

  // Close an open variance with a resolution note (spec §398 — persists until resolved).
  resolveVariance: async (depositId: string, resolution: string): Promise<void> =>
    req(`/api/admin/cod-deposits/${depositId}/resolve-variance`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),

  // Orders covered by a deposit (the expandable row list).
  orders: async (depositId: string): Promise<CodDepositOrder[]> =>
    req<CodDepositOrder[]>(`/api/admin/cod-deposits/${depositId}/orders`),

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
export interface SettlementDay {
  day: string;
  orders: number;
  gross_online: number;
  refunded: number;
  net_settled: number;
}
// T2-18: actual Razorpay settlement, ingested (manual / csv / api)
export interface SettlementRow {
  settlement_id: string;
  settled_on: string;
  gross_amount: number;
  refunds_amount: number;
  fees_amount: number;
  tax_amount: number;
  net_deposited: number;
  utr?: string | null;
  status?: string | null;
  source?: string | null;
}
// T2-18: account-level Razorpay-vs-books reconciliation
export interface SettlementReconciliation {
  settlements: number;
  book: { gross_online: number; refunded: number; fees: number; fee_tax: number; expected_deposit: number };
  actual: { gross: number; refunds: number; fees: number; tax: number; net_deposited: number };
  variance: number;
  by_settlement: SettlementRow[];
}
export interface SettlementReport {
  method: string;
  hubs: SettlementHub[];
  by_day?: SettlementDay[];
  variance_tracked?: boolean;
  reconciliation?: SettlementReconciliation;
  totals: { gross_online: number; refunded: number; net_settled: number };
}
export interface PnlHub {
  hub_id: string | null;
  hub_name: string | null;
  orders: number;
  revenue: number;
  fabric_cost: number;
  guarantee_cost: number;
  guarantee_reserve: number; // T1-23: memo provision (not in profit)
  delivery_cost: number;
  payment_fees: number;
  refunds: number;
  profit: number;
}
export interface PnlReport {
  hubs: PnlHub[];
  totals: {
    revenue: number;
    fabric_cost: number;
    guarantee_cost: number;
    delivery_cost: number;
    payment_fees: number;
    refunds: number;
    profit: number;
  };
  // [CHN-39-1] Ordered but not yet EARNED. Revenue used to be booked at order
  // creation, so these orders were counted as revenue while the garment was still
  // uncut and, on COD, before the money existed. They belong here.
  backlog: { orders: number; unearned: number };
  // T1-19: outstanding wallet credits — a current liability, not part of period profit.
  wallet_liability: number;
  // T1-23: fit-promise reserve to hold for the period (memo/provision, not in profit).
  guarantee_reserve: number;
  estimates: {
    payment_fee_rate_pct: number;
    delivery_cost_per_order: number;
    alteration_cost: number;
  };
  // [CHN-39-1] / [FIN-37-2] Every figure names its basis, on the payload and on screen.
  basis: string;
  basis_note: string;
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
  // T2-18: actual Razorpay settlement ingestion (writes need refunds:approve).
  listSettlements: (p: { start_date?: string; end_date?: string } = {}): Promise<SettlementRow[]> =>
    req<SettlementRow[]>(`/api/admin/finance/settlements${financeQs(p)}`),
  recordSettlement: (body: Partial<SettlementRow> & { settlement_id: string; settled_on: string; net_deposited: number }): Promise<{ settlement_id: string; inserted: boolean }> =>
    req(`/api/admin/finance/settlements`, { method: "POST", body: JSON.stringify(body) }),
  deleteSettlement: (id: string): Promise<{ removed: boolean }> =>
    req(`/api/admin/finance/settlements/${encodeURIComponent(id)}`, { method: "DELETE" }),
  syncSettlements: (from: string, to: string): Promise<{ synced: number; inserted: number }> =>
    req(`/api/admin/finance/settlements/sync`, { method: "POST", body: JSON.stringify({ from, to }) }),
  // T2-20: CA journal / Tally export (sales + GST + refunds) as a downloadable CSV or XML file.
  journal: (
    format: "csv" | "xml",
    p: FinanceReportParams = {},
  ): Promise<{ filename: string; mime: string; content: string; voucher_count: number }> => {
    const qs = new URLSearchParams({ format });
    if (p.hub_id) qs.set("hub_id", p.hub_id);
    if (p.start_date) qs.set("start_date", p.start_date);
    if (p.end_date) qs.set("end_date", p.end_date);
    return req(`/api/admin/finance/journal?${qs}`);
  },
};

// ─── Fit feedback (Support console — per-order fit ratings) ───────────────────
export interface FitFeedbackEntry {
  id: string;
  order_id: string;
  user_id: string; // T1-21: for the rescue verbs (credit / re-measure)
  order_number: string | null;
  hub_id: string | null;
  hub_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  overall_fit: number;
  fit_areas: Record<string, number>;
  notes: string | null;
  created_at: string;
}
export const fitFeedbackApi = {
  list: (): Promise<FitFeedbackEntry[]> =>
    req<FitFeedbackEntry[]>("/api/admin/fit-feedback"),
};

// ─── Refunds (Finance console — disburse worklist, G-36/G-27) ─────────────────
export interface RefundEntry {
  id: string; // return_requests.id
  order_id: string;
  order_number: string;
  hub_id: string | null;
  hub_name: string | null;
  /**
   * [FIN-36-1] The APPROVED refund amount — `return_requests.refund_amount`, what
   * the approval actually authorised. This used to be aliased from
   * `orders.payable_amount`, so on a partial refund finance was instructed to pay
   * the full order value (proved: ₹1,899 approved, ₹2,750 shown).
   */
  refund_amount: string | number;
  /** The ORDER's total, so a partial refund is visibly partial. */
  order_payable_amount?: string | number;
  payment_method: string; // 'online' | 'cod'
  customer_name: string | null;
  customer_phone: string | null;
  refund_method: "razorpay" | "manual_transfer" | null;
  refund_account_type: "upi" | "bank" | null;
  refund_account_detail: string | null;
  refund_status: "pending" | "initiated" | "completed" | "failed";
  refund_failure_reason?: string | null;
  refund_initiated_at: string | null;
  refund_completed_at: string | null;
  status: string;
  created_at: string;
  customer_id?: string | null;
  // T3-7 (W-F3): "where's my money?" — the gateway refund ref + when it should land.
  razorpay_refund_id?: string | null;
  expected_settlement_at?: string | null; // initiated + N business days (in-flight only)
  settlement_business_days?: number;
}
export const refundsApi = {
  list: (status?: string): Promise<RefundEntry[]> =>
    req<RefundEntry[]>(
      `/api/admin/refunds${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  // Disburse: marks a manual_transfer refund complete (reuses the existing endpoint,
  // gated refunds:approve via write-POLICY). Money → source/bank, never wallet.
  markComplete: (returnId: string): Promise<void> =>
    req<void>(`/api/admin/returns/${returnId}/mark-refund-complete`, {
      method: "POST",
    }),
};

// ─── Ops staff management (super_admin — G-40) ────────────────────────────────
export type StaffRole =
  | "hub_manager"
  | "cutting_master"
  | "measurement_agent"
  | "tailor"
  | "qc_staff"
  | "dispatch";
export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  phone: string | null;
  hub_id: string | null;
  hub_name: string | null;
  is_active: boolean;
  created_at: string;
}
export interface CreateStaffInput {
  email: string;
  name: string;
  role: StaffRole;
  password: string;
  hub_id?: string | null;
}
export const staffApi = {
  list: (hubId?: string): Promise<StaffMember[]> =>
    req<StaffMember[]>(
      `/api/admin/staff-management${hubId ? `?hub_id=${encodeURIComponent(hubId)}` : ""}`,
    ),
  create: (input: CreateStaffInput): Promise<StaffMember> =>
    req<StaffMember>(`/api/admin/staff-management`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setActive: (id: string, is_active: boolean): Promise<StaffMember> =>
    req<StaffMember>(`/api/admin/staff-management/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),
  // T2-26 (SU-9): issue a time-limited reset token (returned once for the admin to hand over).
  resetPassword: (id: string): Promise<{ token: string; expires_at: string; email: string }> =>
    req<{ token: string; expires_at: string; email: string }>(
      `/api/admin/staff-management/${id}/reset-password`,
      { method: "POST" },
    ),
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

export interface BlastHistoryRow {
  id: string;
  subject: string | null;
  headline: string | null;
  segment: string;
  users_targeted: number;
  cta_text?: string | null;
  cta_url?: string | null;
  sent_at: string;
  sent_by_email: string | null;
}

export const notificationsAdminApi = {
  blast: async (payload: BlastPayload): Promise<{ users_targeted: number }> =>
    req<{ users_targeted: number }>(`/api/admin/notifications/blast`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Recipient count for the pre-send preview.
  audienceCount: async (segment: "opted_in" | "all"): Promise<number> =>
    req<{ count: number }>(`/api/admin/notifications/blast-audience?segment=${segment}`).then(
      (r) => r.count,
    ),
  // T2-26 (SU-7): sent-history of blasts.
  history: async (limit = 30): Promise<BlastHistoryRow[]> =>
    req<BlastHistoryRow[]>(`/api/admin/notifications/blasts?limit=${limit}`),
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
// ─── Nav badge counts / action inbox (FABLE-ADMIN-UIUX §1.2) ──────────────────
// Keys arrive filtered by the caller's capabilities.
export interface NavCounts {
  samples_review?: number;
  restock_pending?: number;
  below_reorder?: number;
  listings_oos?: number;
  refunds_awaiting?: number;
  refund_approvals_pending?: number;
  credit_approvals_pending?: number;
  cod_unconfirmed?: number;
  cod_variances_open?: number;
  tickets_open?: number;
  returns_requested?: number;
  stuck_orders?: number;
  /** T2-15: dead stock flagged for markdown → the CM inbox. Returned all along; the type
   *  simply never declared it, so nothing could read it without a cast. */
  markdown_flagged?: number;
  /** [PRC-15-8] Pushes to a hub still unconfirmed past the stale window. */
  stale_shipments?: number;
}
export const navCountsApi = {
  get: async (): Promise<NavCounts> => req<NavCounts>("/api/admin/nav-counts"),
};

// W-5: the finance credit-approval queue.
export interface CreditRequest {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  customer_name: string;
  customer_phone: string;
  customer_ref: string | null;
  requested_by_name: string | null;
  reviewed_by_name: string | null;
}
export const creditApprovalsApi = {
  list: async (status = "pending"): Promise<CreditRequest[]> => {
    const r = await req<{ requests: CreditRequest[] }>(
      `/api/admin/credit-requests?status=${encodeURIComponent(status)}`,
    );
    return r?.requests ?? [];
  },
  approve: async (id: string, note?: string): Promise<{ message: string }> =>
    req(`/api/admin/credit-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    }),
  reject: async (id: string, note?: string): Promise<{ message: string }> =>
    req(`/api/admin/credit-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    }),
};

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

// T2-37 (SP-7): a single waiting customer (the notify-cohort export row).
export interface PincodeCohortEntry {
  pincode: string;
  phone: string;
  name: string;
  area_name: string | null;
  city: string | null;
  joined_at: string;
  notified_at: string | null;
}

export const pincodeWaitlistApi = {
  list: async (): Promise<PincodeDemand[]> =>
    req<{ waitlist: PincodeDemand[] }>(
      `/api/admin/system/pincode-waitlist`,
    ).then((r) => r.waitlist),

  // T2-37 (SP-7): per-customer cohort for outreach (audited PII export). Optional single
  // pincode (per-row) or unserved-only.
  cohort: async (opts: { pincode?: string; unserved?: boolean } = {}): Promise<PincodeCohortEntry[]> => {
    const qs = new URLSearchParams();
    if (opts.pincode) qs.set("pincode", opts.pincode);
    if (opts.unserved) qs.set("unserved", "1");
    const q = qs.toString();
    return req<{ cohort: PincodeCohortEntry[] }>(
      `/api/admin/system/pincode-waitlist/cohort${q ? `?${q}` : ""}`,
    ).then((r) => r.cohort);
  },
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
  /** [DSG-13-14] The recipe behind the design — where a systematic fit failure is fixed. */
  garment_category_id: string | null;
  garment_name: string | null;
  orders: number;
  units: number;
  fit_issue_orders: number;
  fit_accuracy_pct: number;
}

export interface AnalyticsFilterParams {
  hub_id?: string;
  garment_category_id?: string;
  start_date?: string;
  end_date?: string;
}
const analyticsQs = (f?: AnalyticsFilterParams): string => {
  if (!f) return '';
  const p = new URLSearchParams();
  if (f.hub_id) p.set('hub_id', f.hub_id);
  if (f.garment_category_id) p.set('garment_category_id', f.garment_category_id);
  if (f.start_date) p.set('start_date', f.start_date);
  if (f.end_date) p.set('end_date', f.end_date);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const designAnalyticsApi = {
  fitAccuracy: async (f?: AnalyticsFilterParams): Promise<FitAccuracy> =>
    req<FitAccuracy>(`/api/admin/analytics/fit-accuracy${analyticsQs(f)}`),
  designPerformance: async (f?: AnalyticsFilterParams): Promise<{ designs: DesignPerformanceRow[] }> =>
    req<{ designs: DesignPerformanceRow[] }>(
      `/api/admin/analytics/design-performance${analyticsQs(f)}`,
    ),
};

// W-12 (SOLUTIONS P1): the fit-outcome / FTR master metric.
export interface FitOutcomeSummary {
  delivered: number;
  perfect: number;
  ok: number;
  poor: number;
  altered: number;
  refunded: number;
  no_response: number;
  ftr_pct: number | null;
  alteration_pct: number | null;
  refund_pct: number | null;
  response_pct: number | null;
}
export interface FitOutcomes {
  overall: FitOutcomeSummary;
  by_hub: (FitOutcomeSummary & { hub_id: string | null; hub_name: string | null })[];
  note: string;
}
// T2-10: measuring-agent + tailor attribution slices.
export interface FitFailureAgentRow {
  agent_id: string;
  agent_name: string | null;
  delivered: number;
  responded: number;
  fit_failures: number;
  fit_failure_pct: number | null;
}
export interface ReworkTailorRow {
  tailor_id: string;
  tailor_name: string | null;
  rework_count: number;
  open_count: number;
  completed_count: number;
}
const fitSliceQs = (params: { hub_id?: string; start_date?: string; end_date?: string }): string => {
  const qs = new URLSearchParams();
  if (params.hub_id) qs.set('hub_id', params.hub_id);
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  const q = qs.toString();
  return q ? `?${q}` : '';
};
export const fitOutcomesApi = {
  get: async (params: { hub_id?: string; start_date?: string; end_date?: string } = {}): Promise<FitOutcomes> =>
    req<FitOutcomes>(`/api/admin/analytics/fit-outcomes${fitSliceQs(params)}`),
  byAgent: async (params: { hub_id?: string; start_date?: string; end_date?: string } = {}): Promise<FitFailureAgentRow[]> =>
    req<FitFailureAgentRow[]>(`/api/admin/analytics/fit-failure-by-agent${fitSliceQs(params)}`),
  reworkByTailor: async (params: { hub_id?: string; start_date?: string; end_date?: string } = {}): Promise<ReworkTailorRow[]> =>
    req<ReworkTailorRow[]>(`/api/admin/analytics/rework-by-tailor${fitSliceQs(params)}`),
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
  supplier_city?: string | null;
  supplier_lead_time_days?: number | null;
  supplier_moq_note?: string | null;
  // T3-4 (W-P1) supplier contacts.
  supplier_phone?: string | null;
  supplier_email?: string | null;
  supplier_gstin?: string | null;
  care_instructions: string[];
  image_keys: string[];
  price_per_meter: string | null;
  fabric_type?: string | null;
  stretch_pct?: number | string | null;
  shrinkage_pct?: number | string | null;
  width_cm?: number | string | null; // T0-6: usable width (drives width-aware consumption)
  is_active: boolean;
  created_at: string;
  design_count?: number;
  listing_count?: number;
  // procurement master stock rollup (listFabrics)
  total_available?: number;
  total_reserved?: number;
  low_somewhere?: boolean;
  // [PRC-14-4] Whether ANY hub holding this fabric has a reorder point. A false
  // low_somewhere means "not below threshold"; with this false it means "no threshold",
  // which is a different fact and the far more common one.
  watched_somewhere?: boolean;
  stock_value?: number | null;
  // [PRC-15-9] quarantine_meters is written by the QC hold path and was rendered nowhere.
  stock?: { hub_id: string; hub_name: string; available_meters: number; reserved_meters: number; quarantine_meters?: number; reorder_meters?: number | null }[];
  // [PRC-14-5] The other half of the fabric's position. Its page used to show hub stock
  // only, so a fabric reading "Demo Hub 60m" could have several hundred metres in the
  // warehouse and more in transit, and the page that decides whether to buy more said
  // nothing about either.
  central?: {
    received_meters: number;
    allocated_meters: number;
    /** received − allocated: what procurement can still promise. */
    available_meters: number;
    /** Pushed, not yet received at a hub. Out of the warehouse, still ours. */
    in_transit_meters: number;
  };
}
// T2-28 (PR-1) fabric cockpit — one movement-ledger row (distinct from the request-event
// FabricMovement + the shared FabricStockMovement; this one carries id + hub_name).
export interface FabricLedgerEntry {
  id: string;
  kind: string;
  // [PRC-14-5] null for a central-warehouse event: it happened before any hub had it.
  hub_name: string | null;
  is_central?: boolean;
  delta_meters: number;
  // [PRC-14-5] null for a central event — a per-hub running balance is not a fact about
  // the warehouse, and rendering one as 0 would be an invented number.
  balance_after: number | null;
  note: string | null;
  lot_code: string | null;
  created_at: string;
  // T2-29: order that caused this out-flow (reserve/release/reconcile); null for
  // received/scrap/adjust and un-backfilled historical rows.
  order_id: string | null;
  order_number: string | null;
}
export interface FabricDesignUse {
  id: string;
  name: string;
  garment_type: string;
  status: string;
  live_listings: number;
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
  supplier_city?: string | null;
  supplier_lead_time_days?: number | null;
  supplier_moq_note?: string | null;
  supplier_phone?: string | null; // T3-4 (W-P1)
  supplier_email?: string | null;
  supplier_gstin?: string | null;
  care_instructions?: string[];
  image_keys: string[]; // ≥1 required (swatch)
  price_per_meter?: number | null;
  fabric_type?: string | null;
  stretch_pct?: number | null;
  shrinkage_pct?: number | null;
  width_cm?: number | null; // T0-6
}

// T2-13: per-lot wash-test / pre-shrunk QC + shrink-risk.
export interface FabricLotRow {
  lot_code: string;
  wash_tested: boolean;
  pre_shrunk: boolean;
  measured_shrinkage_pct: number | null;
  note: string | null;
  tested_at: string | null;
  shrink_risk: boolean;
}
export interface FabricLots {
  fabric_shrinkage_pct: number;
  shrink_prone: boolean;
  lots: FabricLotRow[];
}
// T2-15: dead-stock aging + capital ₹.
export interface DeadStockRow {
  hub_id: string | null;
  hub_name: string | null;
  fabric_id: string;
  fabric_code: string | null;
  fabric_name: string | null;
  available_meters: number;
  days_idle: number;
  bucket: "0-30" | "30-60" | "60-90" | "90+";
  last_movement: string | null;
  capital: number;
  markdown_flagged: boolean;
  markdown_note: string | null;
}
export interface DeadStock {
  items: DeadStockRow[];
  capital_by_bucket: Record<string, number>;
  total_capital: number;
  min_days: number;
}
// [PRC-14-6] Which commercial fields the server actually sent. Masked fields are ABSENT,
// not null — so without this a hub merchant cannot tell "this mill has no GSTIN on file"
// from "you may not see this mill's GSTIN", and the mask would just move the lie.
export interface FabricFieldVisibility {
  supplier: boolean;
  price: boolean;
}

export interface ReorderCoverage {
  /** Shelf positions (hub × fabric) with a reorder point set. */
  with_reorder_point: number;
  /** Shelf positions in total, whether or not they have one. */
  total_positions: number;
}

export const fabricsApi = {
  list: async (
    params: { q?: string; active?: boolean; low?: boolean } = {},
  ): Promise<Fabric[]> => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.active !== undefined) qs.set("active", String(params.active));
    if (params.low) qs.set("low", "true");
    const s = qs.toString();
    return req<Fabric[]>(`/api/admin/fabrics${s ? `?${s}` : ""}`);
  },
  // [PRC-14-4] Same call, but keeps `meta.reorder_coverage` — how many shelf positions have
  // a reorder point at all. Without it "Below reorder: 0" is unreadable: it says the same
  // thing whether nothing is low or nothing is watched.
  listWithCoverage: async (
    params: { q?: string; active?: boolean; low?: boolean } = {},
  ): Promise<{
    data: Fabric[];
    meta?: {
      reorder_coverage?: ReorderCoverage;
      fabric_fields_visible?: FabricFieldVisibility;
    };
  }> => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.active !== undefined) qs.set("active", String(params.active));
    if (params.low) qs.set("low", "true");
    const s = qs.toString();
    return reqEnvelope<{
      data: Fabric[];
      meta?: {
        reorder_coverage?: ReorderCoverage;
        fabric_fields_visible?: FabricFieldVisibility;
      };
    }>(`/api/admin/fabrics${s ? `?${s}` : ""}`);
  },
  get: async (id: string): Promise<Fabric> =>
    req<Fabric>(`/api/admin/fabrics/${id}`),
  // T2-28 (PR-1): fabric cockpit — movement ledger + designs-using-this-fabric.
  movements: async (id: string, limit = 50): Promise<FabricLedgerEntry[]> =>
    req<FabricLedgerEntry[]>(`/api/admin/fabrics/${id}/movements?limit=${limit}`),
  designsUsing: async (id: string): Promise<FabricDesignUse[]> =>
    req<FabricDesignUse[]>(`/api/admin/fabrics/${id}/designs`),
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
  remove: async (id: string): Promise<{ deleted: boolean }> =>
    req<{ deleted: boolean }>(`/api/admin/fabrics/${id}`, { method: "DELETE" }),
  setActive: async (id: string, is_active: boolean, force = false): Promise<Fabric> =>
    req<Fabric>(`/api/admin/fabrics/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active, ...(force ? { force } : {}) }),
    }),
  // G-29: reorder point per fabric×hub (null clears).
  setReorderPoint: async (
    hub_id: string,
    fabric_id: string,
    reorder_meters: number | null,
  ): Promise<void> =>
    req(`/api/admin/fabrics/stock/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ hub_id, fabric_id, reorder_meters }),
    }),
  stock: async (params: { hub_id?: string } = {}): Promise<FabricStockRow[]> =>
    req<FabricStockRow[]>(
      `/api/admin/fabrics/stock${params.hub_id ? `?hub_id=${params.hub_id}` : ""}`,
    ),
  atHub: async (hubId: string, fabricId: string): Promise<FabricAtHub> =>
    req<FabricAtHub>(
      `/api/admin/fabrics/at-hub?hub_id=${hubId}&fabric_id=${fabricId}`,
    ),
  // T2-13: per-lot wash-test / pre-shrunk QC.
  lots: async (fabricId: string): Promise<FabricLots> =>
    req<FabricLots>(`/api/admin/fabrics/${fabricId}/lots`),
  setLot: async (
    fabricId: string,
    lotCode: string,
    body: { wash_tested?: boolean; pre_shrunk?: boolean; measured_shrinkage_pct?: number | null; note?: string },
  ): Promise<FabricLots> =>
    req<FabricLots>(`/api/admin/fabrics/${fabricId}/lots/${encodeURIComponent(lotCode)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  // T1-10: count-adjust a hub's shelf to the physical truth (logs a count_adjust movement).
  adjustHubStock: async (input: { hub_id: string; fabric_id: string; counted_meters: number; note: string }): Promise<{ previous: number; counted: number; variance: number; at_hub: FabricAtHub }> =>
    req(`/api/admin/fabrics/hub-stock/adjust`, { method: "POST", body: JSON.stringify(input) }),
  // T2-14: write off unusable-remnant metres as a 'scrap' movement.
  recordScrap: async (input: { hub_id: string; fabric_id: string; meters: number; note: string }): Promise<{ previous: number; scrapped: number; remaining: number; at_hub: FabricAtHub }> =>
    req(`/api/admin/fabrics/hub-stock/scrap`, { method: "POST", body: JSON.stringify(input) }),
  // T2-15: dead-stock aging + markdown flag.
  deadStock: async (hubId?: string): Promise<DeadStock> =>
    req<DeadStock>(`/api/admin/fabrics/dead-stock${hubId ? `?hub_id=${hubId}` : ""}`),
  flagMarkdown: async (input: { hub_id: string; fabric_id: string; flagged: boolean; note?: string }): Promise<{ markdown_flagged: boolean }> =>
    req(`/api/admin/fabrics/hub-stock/markdown`, { method: "POST", body: JSON.stringify(input) }),
  hubStockVariance: async (): Promise<HubStockVariance[]> =>
    req<HubStockVariance[]>(`/api/admin/fabrics/hub-stock/variance`),
  // T1-12: stale-reservation exception view + guarded release.
  staleReservations: async (hubId?: string, days?: number): Promise<StaleReservation[]> => {
    const qs = new URLSearchParams();
    if (hubId) qs.set("hub_id", hubId);
    if (days) qs.set("days", String(days));
    const q = qs.toString();
    return req<StaleReservation[]>(`/api/admin/fabrics/reservations/stale${q ? `?${q}` : ""}`);
  },
  releaseStaleReservation: async (orderId: string, reason: string): Promise<{ released: boolean }> =>
    req(`/api/admin/fabrics/reservations/${orderId}/release`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  // Phase 3 — central procurement pool (received/allocated/available per SKU).
  centralStock: async (): Promise<CentralStockRow[]> =>
    req<CentralStockRow[]>(`/api/admin/fabrics/central`),
  receiveCentral: async (input: { fabric_id: string; meters: number; note?: string; lot_code?: string; shade_note?: string; unit_cost?: number }): Promise<CentralStockRow[]> =>
    req<CentralStockRow[]>(`/api/admin/fabrics/central/receive`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  adjustCentral: async (input: { fabric_id: string; meters: number; note: string }): Promise<CentralStockRow[]> =>
    req<CentralStockRow[]>(`/api/admin/fabrics/central/adjust`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  centralReceipts: async (fabricId: string): Promise<CentralReceipt[]> =>
    req<CentralReceipt[]>(`/api/admin/fabrics/central/receipts?fabric_id=${fabricId}`),
};

export interface CentralReceipt {
  id: string;
  meters: string | number;
  kind: "receive" | "adjust";
  note: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface CentralStockRow {
  fabric_id: string;
  fabric_code: string | null;
  fabric_name: string;
  fabric_image_keys: string[] | null;
  price_per_meter: string | number | null;
  received_meters: string | number;
  allocated_meters: string | number;
  available_meters: string | number;
  updated_at: string;
  unit_cost_wac?: string | number | null; // T1-17: weighted-avg cost-at-receipt
}

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
// True stock-movement ledger (mig 120): every available_meters change with running balance.
export interface FabricStockMovement {
  kind: string; // received | reserved | released | reconciled | in | out | count_adjust
  delta_meters: string | number; // signed
  balance_after: string | number; // running balance
  created_at: string;
  lot_code?: string | null; // T1-9
  note?: string | null; // T1-10 (count_adjust reason)
}
export interface FabricAtHub {
  fabric: Fabric;
  hub_id: string;
  hub_name: string | null;
  stock: {
    available_meters: string;
    reserved_meters: string;
    reorder_meters?: string | number | null;
    updated_at: string | null;
    last_counted_at?: string | null; // T1-10
    quarantine_meters?: string | number | null; // T1-13
  };
  // T1-26: false = a no-movement on-hand balance that the ledger doesn't explain (unreconciled).
  opening_reconciled?: boolean;
  movements: FabricMovement[]; // distribution/restock/listing REQUEST events (context)
  stock_movements?: FabricStockMovement[]; // actual stock in/out with running balance
}

// T1-10: count-variance + monthly-count-due, one row per hub.
export interface HubStockVariance {
  hub_id: string;
  hub_name: string;
  count_adjustments: number;
  total_variance_meters: number;
  last_counted_at: string | null;
  total_skus: number;
  skus_due_for_count: number;
}

// T1-12: a fabric reservation locked on a pre-cutting order that's gone stale.
export interface StaleReservation {
  order_id: string;
  order_number: string;
  hub_id: string;
  hub_name: string | null;
  stage: string;
  reserved_meters: number;
  reserved_at: string;
  age_days: number;
  customer_name: string | null;
  customer_phone: string | null;
}

export interface FabricStockRow {
  hub_id: string;
  hub_name: string;
  // [PRC-17-6] Held by QC — arrived, paid for, on the shelf, not available. The query did
  // not select it, so no cross-hub surface could show it.
  quarantine_meters?: string | number | null;
  // [CM-19-4] Whether this shelf position has reached its reorder point, decided ONCE on
  // the server. Three surfaces used to derive it independently — the CM's page with `<=`,
  // the procurement grid with `<`, the fabrics master via low_somewhere — so a fabric
  // sitting exactly AT its reorder point was low on one screen and healthy on another.
  is_low?: boolean;
  fabric_id: string;
  fabric_code: string;
  fabric_name: string;
  fabric_image_keys: string[] | null;
  available_meters: string | number;
  reserved_meters: string | number;
  /** G-29: per-SKU×hub reorder point (null = unset) */
  reorder_meters: string | number | null;
  /** G-29 P8: suggested reorder point = demand during lead time (null = no demand yet) */
  reorder_suggestion?: string | number | null;
  /** T3-4 (W-P4): metres consumed (reserved + scrapped) in the last 30d — checks the suggestion */
  consumed_30d?: number;
  /** ₹/m from the fabrics master — stock value = available × this */
  price_per_meter: string | number | null;
  updated_at: string;
  /** INV-3: listings this fabric feeds at the hub + garments available per listing (shared stock). */
  listings?: {
    listing_id: string;
    design_name: string;
    is_active: boolean;
    per_garment_meters: number;
    garments_available: number | null;
  }[];
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
  received_meters?: string | number | null;
  variance_reason?: string | null;
  // [PRC-15-6] Why an in-transit push was CANCELLED. Until migration 252 this note was
  // written into variance_reason, so one column answered two unrelated questions.
  cancel_reason?: string | null;
  /** (received − pushed) / pushed, as a percentage. null when there is no denominator. */
  variance_pct?: number | string | null;
  // [PRC-15-13] Who recorded the receipt. Procurement records them on the hub's behalf, so
  // without this a 400% variance is signed by nobody. null on pre-migration-253 receipts.
  received_by?: string | null;
  received_by_name?: string | null;
  // T1-13 inbound QC
  accepted_meters?: string | number | null;
  rejected_meters?: string | number | null;
  held_meters?: string | number | null;
  qc_result?: "pass" | "partial" | "hold" | "reject" | null;
  qc_defects?: string[] | null;
  // T1-13b Phase 2: category resolved from the design + captured per-check QC results.
  garment_category_id?: string | null;
  qc_check_results?: QcEvaluatedResult[] | null;
  created_at: string;
  updated_at: string;
  design_name: string | null;
  fabric_name: string | null;
  fabric_code: string | null;
  fabric_image_keys: string[] | null;
  lot_code?: string | null; // T1-9: dye-lot shipped
  consignment_ref?: string | null; // T3-4 (W-P3): courier docket / LR number
}
export interface PushDistributionInput {
  /** design-scoped push: set. Plain fabric restock: omit (fabric_id then required). */
  design_id?: string | null;
  fabric_id?: string | null;
  hub_id: string;
  sample_qty?: number;
  sellable_qty?: number;
  lot_code?: string; // T1-9: dye-lot being shipped
  consignment_ref?: string; // T3-4 (W-P3): courier docket / LR number
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
  // [PRC-15-5] The server returns fabric_skipped when it converted a design push into a
  // fabric-less one because the hub already stocks the SKU. The page threw that away and
  // toasted "The hub will receive and stock it." either way.
  push: async (
    input: PushDistributionInput,
  ): Promise<Distribution & { fabric_skipped?: boolean }> =>
    req<Distribution & { fabric_skipped?: boolean }>(`/api/admin/distribution`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  receive: async (
    id: string,
    // G-30: record what actually arrived; variance > 5% needs a reason.
    // T1-13: inbound QC — rejected (write-off) / held (quarantine) metres + defects.
    opts: {
      actual_meters?: number;
      variance_reason?: string;
      rejected_meters?: number;
      held_meters?: number;
      qc_notes?: string;
      qc_defects?: string[];
      // T1-13b Phase 2: per-check answers against the category's QC checklist.
      qc_check_results?: { key: string; value?: number | null; pass?: boolean | null }[];
    } = {},
  ): Promise<{ id: string; stocked_meters: number; qc_result: string }> =>
    req(`/api/admin/distribution/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(opts),
    }),
  // T1-13: re-inspect held/quarantined metres from a receipt.
  inspect: async (
    id: string,
    opts: { accept_meters?: number; reject_meters?: number; notes?: string },
  ): Promise<{ id: string; accepted: number; rejected: number; remaining_held: number }> =>
    req(`/api/admin/distribution/${id}/inspect`, {
      method: "POST",
      body: JSON.stringify(opts),
    }),
  cancel: async (id: string, reason?: string): Promise<{ id: string }> =>
    req(`/api/admin/distribution/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
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
  | "rejected"
  | "cancelled";
export interface ListingRequest {
  // [PRC-16-11] Who approved committing this cloth to a hub. Stored on every decided row
  // since the feature shipped and displayed by no screen until now.
  approved_by?: string | null;
  approved_by_name?: string | null;
  id: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  qty: string | number;
  status: ListingRequestStatus;
  note: string | null;
  /** procurement's reason when rejected */
  decision_note?: string | null;
  /**
   * [PRC-16-3] Latest sample outcome for this design AT THIS HUB (null = this hub has
   * seen no sample). Was design+fabric, which could show a green chip for a hub that
   * had never seen one — D13 is a per-hub rule.
   */
  sample_status?: string | null;
  /**
   * [PRC-16-3] Whether D13 is actually satisfied for this design at this hub — a
   * reviewed sample OR an already-live listing there. This, not sample_status, is
   * whether the cloth can be sold once it lands.
   */
  can_list?: boolean;
  created_at: string;
  updated_at?: string;
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
    reason?: string,
    /** [PRC-16-3] Approve although D13 is unmet at the destination hub. Needs a reason. */
    overrideSample?: boolean,
  ): Promise<{ id: string; status: string; stocked_meters: number }> =>
    req(`/api/admin/listing-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        decision,
        ...(reason ? { reason } : {}),
        ...(overrideSample ? { override_sample: true } : {}),
      }),
    }),
  receive: async (
    id: string,
  ): Promise<{ id: string; status: string; stocked_meters: number }> =>
    req(`/api/admin/listing-requests/${id}/receive`, { method: "POST" }),
  cancel: async (id: string): Promise<{ id: string; status: string }> =>
    req(`/api/admin/listing-requests/${id}/cancel`, { method: "POST" }),
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

  // T2-21: exceptions-first overview (live-but-OOS + below-floor)
  overviewExceptions: async (
    p: { hub_id?: string; start_date?: string; end_date?: string } = {},
  ): Promise<ListingExceptions> => {
    const qs = new URLSearchParams();
    if (p.hub_id) qs.set('hub_id', p.hub_id);
    if (p.start_date) qs.set('start_date', p.start_date);
    if (p.end_date) qs.set('end_date', p.end_date);
    const s = qs.toString();
    return req<ListingExceptions>(`/api/admin/listings/overview-exceptions${s ? `?${s}` : ''}`);
  },
};

// ─── Catalog-manager listings management ──────────────────────────────────────

export interface CmListing {
  /**
   * [CM-19-2] Garments the hub can still cut — computed server-side from worst-case metres
   * × fabric width × cutting wastage, the same figure the Fabric Stock page and the publish
   * pre-flight use. Do NOT recompute it from meters_per_garment: that overstates.
   */
  garments_available?: number | null;
  per_garment_meters?: number | null;
  id: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  price: string;
  description: string | null;
  fit_notes: string | null; // T3-6 (W-C2): authored fit guidance
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
  // T3-6 (W-C2): auto-assembled fabric facts (from the paired fabric) — shown read-only in
  // the editor; the PDP renders these so the CM writes the story, not the specs.
  fabric_composition?: string | null;
  fabric_weight_gsm?: number | null;
  fabric_weave?: string | null;
  fabric_care?: string[] | null;
  // G-24: per-fabric shared availability at the listing's hub (derived server-side).
  meters_per_garment?: string | number | null;
  in_stock?: boolean;
  available_meters?: string | number | null;
  // G-26: fabric ₹/m → cost floor = price_per_meter × meters_per_garment + make + overhead.
  price_per_meter?: string | number | null;
  // T1-16: sales signal so the hub merchant doesn't merchandise blind.
  units_sold?: number;
  units_delivered?: number;
  last_ordered_at?: string | null;
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
  fit_notes?: string | null; // T3-6 (W-C2)
  photo_keys?: string[];
  is_active?: boolean;
  allow_below_cost?: boolean; // G-26: confirm an intentional below-cost price
}

/**
 * [CM-18-5] Every publish gate, answered before Publish is pressed.
 *
 * `can_publish` reflects the two HARD gates only — a below-cost price is overridable and
 * no-stock is a warning, so treating either as fatal would make the checklist refuse
 * things the system allows.
 */
export interface ListingPreflight {
  sample: { ok: boolean; detail: string };
  sew_validated: { ok: boolean; detail: string };
  price: { ok: boolean; cost_floor: number; detail: string };
  stock: { ok: boolean; garments_left: number | null; detail: string };
  can_publish: boolean;
}

export const cmListingsApi = {
  list: async (): Promise<CmListing[]> =>
    req<CmListing[]>(`/api/admin/listings`),
  preflight: async (p: {
    design_id: string;
    fabric_id: string;
    hub_id?: string;
    price?: number;
  }): Promise<ListingPreflight> => {
    const qs = new URLSearchParams({ design_id: p.design_id, fabric_id: p.fabric_id });
    if (p.hub_id) qs.set("hub_id", p.hub_id);
    if (p.price != null && p.price > 0) qs.set("price", String(p.price));
    return req<ListingPreflight>(`/api/admin/listings/preflight?${qs}`);
  },
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
      fit_notes?: string | null; // T3-6 (W-C2)
      is_active?: boolean;
      allow_below_cost?: boolean;
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
  // T2-34 (F-5): actual redemptions + total ₹ discount spent (net of cancelled/refunded).
  usage_count?: number;
  /** [PM-26-4] The counter `max_uses` is actually enforced against. Not the same number
   *  as `usage_count`, which is net of reversals — see the usage cell. */
  enforced_uses?: number;
  total_spend?: number;
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
    // Own-profile fields (best-effort server-side; may be null on older backends)
    email?: string | null;
    name?: string | null;
    isActive?: boolean | null;
    lastLoginAt?: string | null;
    hasSecurityQuestion?: boolean | null;
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
  ): Promise<void> => {
    // T1-4: the server hands back a fresh token WITHOUT the must-change gate. Swap it
    // in immediately so a temp-password admin keeps working without re-logging-in.
    const res = await req<{ changed: boolean; token?: string }>(
      "/api/admin/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );
    if (res?.token) setAdminToken(res.token);
  },

  setTempPassword: async (
    adminUserId: string,
    password: string,
  ): Promise<void> =>
    req(`/api/admin/auth/users/${adminUserId}/temp-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
};

// (Craftspeople API removed — G-20: the artisan-brand model is retired; hub staff
// are managed via staffApi, and storytelling moved to the order tracker.)

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

// (Measurement-bookings API removed — G-21: System-2 retired, backend router unmounted.)

// ─── Fit Profiles (self-input / quiz) ─────────────────────────────────────────

export interface AdminFitProfile {
  id: string;
  label: string;
  for_name: string;
  source: "self_input" | "home_visit" | string;
  is_default: boolean;
  measurements: Record<string, number | null>;
  created_at: string;
  // [SUP-30-5] The two sanity checks on a suspicious profile. height also drives
  // `garment_length_by_height` in the engine.
  height_cm: number | null;
  usual_size: string | null;
  /** Set once the retention job has purged the numbers — absent is not the same as gone. */
  measurements_purged_at: string | null;
  flagged_at: string | null;
  flagged_reason: string | null;
}

export const fitProfilesAdminApi = {
  list: async (userId: string): Promise<AdminFitProfile[]> =>
    req<AdminFitProfile[]>(`/api/admin/users/${userId}/fit-profiles`),

  // Support flags a saved fit profile as incorrect (+ optionally fire a re-measure).
  flag: async (
    userId: string,
    profileId: string,
    body: { reason: string; request_remeasure?: boolean },
  ): Promise<{ flagged: boolean; remeasure_created: boolean }> =>
    req(`/api/admin/users/${userId}/fit-profiles/${profileId}/flag`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  unflag: async (userId: string, profileId: string): Promise<{ flagged: boolean }> =>
    req(`/api/admin/users/${userId}/fit-profiles/${profileId}/unflag`, {
      method: "POST",
    }),
};

// ─── Customer Lookup ──────────────────────────────────────────────────────────

/** [SUP-32-7] A shared canned reply. Mirrors `support_reply_templates`. */
export interface ReplyTemplate {
  id: string;
  title: string;
  body: string;
  category: string | null;
  created_by_name?: string | null;
  updated_at?: string;
}

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

export interface CustomerVerifyClaim {
  name?: string;
  phone?: string;
  city?: string;
  email?: string;
}

export const customerLookupApi = {
  // G-93: full PII is released by verify() on a matching caller claim.
  // [SUP-33-1] Masking is now the SERVER's default, not something a caller opts
  // into: `masked` used to be `verify=1`, so dropping one query parameter returned
  // ten full customer records to anyone with `customers:read`, unaudited. The
  // parameter kept here is `full`, which names what it does and is logged.
  search: async (q: string, masked = true): Promise<CustomerLookupResult[]> => {
    const result = await req<{ customers: CustomerLookupResult[] }>(
      `/api/admin/customers/lookup?q=${encodeURIComponent(q)}${masked ? "" : "&full=1"}`,
    );
    return result?.customers ?? [];
  },
  // G-93: server-side caller-identity verification. Returns the full customer record
  // ONLY when the submitted claim matches; otherwise { verified: false }.
  verify: async (
    id: string,
    claim: CustomerVerifyClaim,
  ): Promise<{ verified: boolean; customer?: CustomerLookupResult }> =>
    req<{ verified: boolean; customer?: CustomerLookupResult }>(
      `/api/admin/customers/${id}/verify`,
      { method: "POST", body: JSON.stringify(claim) },
    ),
};

/**
 * [SUP-33-5 / SUP-33-3] A support phone call as a record, not React state.
 *
 * The console kept "this call" in memory, so a refresh emptied it and the wrap-up note read
 * "Actions this call: none" about work already done. The six dispositions were concatenated
 * into a prose sentence in a customer note, "Callback needed" scheduled nothing, and the
 * identity check was audited with nothing linking it to the actions it authorised.
 */
export const CALL_DISPOSITIONS = [
  { key: 'resolved_on_call', label: 'Resolved on call' },
  { key: 'ticket_logged', label: 'Ticket logged for follow-up' },
  { key: 'remeasure_scheduled', label: 'Re-measure scheduled' },
  { key: 'credit_issued', label: 'Credit issued' },
  { key: 'callback_needed', label: 'Callback needed' },
  { key: 'escalated_to_ops', label: 'Escalated to ops' },
] as const;
export type CallDisposition = (typeof CALL_DISPOSITIONS)[number]['key'];

export interface SupportCall {
  id: string;
  admin_user_id: string;
  customer_user_id: string | null;
  started_at: string;
  ended_at: string | null;
  verified_at: string | null;
  disposition: CallDisposition | null;
  summary: string | null;
  actions: { title: string; at: string; tone?: string }[];
  callback_due_at: string | null;
  callback_done_at: string | null;
}

export interface CallbackRow extends SupportCall {
  customer_name: string | null;
  customer_phone: string | null;
  customer_ref: string | null;
  agent_name: string | null;
  overdue: boolean;
}

export const supportCallsApi = {
  start: (customerUserId?: string | null): Promise<SupportCall> =>
    req<SupportCall>(`/api/admin/support/calls`, {
      method: 'POST',
      body: JSON.stringify({ customer_user_id: customerUserId ?? null }),
    }),
  attachCustomer: (callId: string, customerUserId: string, verified: boolean): Promise<SupportCall> =>
    req<SupportCall>(`/api/admin/support/calls/${callId}/customer`, {
      method: 'POST',
      body: JSON.stringify({ customer_user_id: customerUserId, verified }),
    }),
  action: (callId: string, title: string, tone?: string): Promise<SupportCall> =>
    req<SupportCall>(`/api/admin/support/calls/${callId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ title, tone }),
    }),
  end: (
    callId: string,
    body: { disposition: CallDisposition; summary?: string; callback_due_at?: string | null },
  ): Promise<SupportCall> =>
    req<SupportCall>(`/api/admin/support/calls/${callId}/end`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  callbacks: (mine = false): Promise<CallbackRow[]> =>
    req<{ callbacks: CallbackRow[] }>(
      `/api/admin/support/callbacks${mine ? '?mine=1' : ''}`,
    ).then((r) => r.callbacks ?? []),
  completeCallback: (callId: string): Promise<SupportCall> =>
    req<SupportCall>(`/api/admin/support/callbacks/${callId}/done`, { method: 'POST' }),
};

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  mode: string | null;
  gender?: string | null;
  is_active: boolean;
  image_url: string | null;
  parent_id?: string | null;
  garment_category_id?: string | null;
  display_order?: number;
  product_count?: number;
}

export interface CategoryPayload {
  name?: string;
  slug?: string;
  gender?: "men" | "women" | "unisex";
  is_active?: boolean;
  parent_id?: string | null;
  garment_category_id?: string | null;
  display_order?: number;
  image_key?: string;
}

export const categoriesAdminApi = {
  // NOTE: `req` already unwraps the response `{ data }` envelope and returns the inner
  // value, so these must NOT access `.data` again (that double-unwrap is what made the
  // list silently return []). They return the unwrapped value directly.
  list: async (): Promise<ProductCategory[]> => {
    return (await req<ProductCategory[]>("/api/catalog/admin/categories")) ?? [];
  },
  create: async (payload: CategoryPayload & { name: string; slug: string }): Promise<ProductCategory> => {
    return req<ProductCategory>("/api/catalog/admin/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update: async (id: string, payload: CategoryPayload): Promise<ProductCategory> => {
    return req<ProductCategory>(`/api/catalog/admin/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  updateImage: async (id: string, imageKey: string | null): Promise<ProductCategory> => {
    return req<ProductCategory>(`/api/catalog/admin/categories/${id}/image`, {
      method: "PATCH",
      body: JSON.stringify({ image_key: imageKey }),
    });
  },
  // T3-6 (§5.3): atomically renumber display_order from a single ordered id list.
  // Returns the fresh admin category list.
  reorder: async (ids: string[]): Promise<ProductCategory[]> => {
    return (
      (await req<ProductCategory[]>("/api/catalog/admin/categories/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      })) ?? []
    );
  },
};

// T3-2 — brand ledger (finance).
export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  is_house_brand: boolean;
  status: string;
};
export type BrandLedgerEntry = {
  id: string;
  brand_id: string;
  entry_type: string;
  amount: string | number; // signed; string from NUMERIC
  order_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};
export const brandLedgerApi = {
  listBrands: async (): Promise<{ brands: BrandSummary[] }> => req(`/api/admin/brands`),
  ledger: async (
    brandId: string,
    page = 1,
    limit = 50,
  ): Promise<{
    entries: BrandLedgerEntry[];
    balance: number;
    page: number;
    page_size: number;
    total: number;
  }> => req(`/api/admin/brands/${brandId}/ledger?page=${page}&limit=${limit}`),
  recordPayout: async (brandId: string, amount: number, note?: string): Promise<BrandLedgerEntry> =>
    req(`/api/admin/brands/${brandId}/ledger/payout`, {
      method: "POST",
      body: JSON.stringify(note ? { amount, note } : { amount }),
    }),
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
