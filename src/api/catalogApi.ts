const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.zavestro.in';
export const TOKEN_KEY = 'zavestro_admin_token';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiCategory {
  id: string;
  name: string;
  slug?: string;
}

export interface ApiVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  fabric_name: string;
  available: boolean;
}

export interface ApiMedia {
  id: string;
  url: string;
  is_primary: boolean;
}

export interface ApiProduct {
  id: string;
  name: string;
  short_description: string;
  description: string;
  mode: 'simplified' | 'premium_custom';
  base_price: number;
  category: ApiCategory;
  tags: string[];
  images: ApiMedia[];
  delivery_days_min: number;
  delivery_days_max: number;
  is_made_to_order: boolean;
  status: 'active' | 'draft' | 'archived';
  variants: ApiVariant[];
  created_at: string;
  updated_at: string;
}

export interface ProductsResponse {
  products: ApiProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ProductPayload {
  name: string;
  short_description: string;
  description: string;
  mode: 'simplified' | 'premium_custom';
  base_price: number;
  category_id: string;
  tags: string[];
  delivery_days_min: number;
  delivery_days_max: number;
  is_made_to_order: boolean;
  status: 'active' | 'draft' | 'archived';
}

export interface VariantPayload {
  sku: string;
  size: string;
  color: string;
  price: number;
  fabric_name: string;
  available: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

// ─── Response mappers ─────────────────────────────────────────────────────────

function mapVariant(v: Record<string, unknown>): ApiVariant {
  return {
    id: v.id as string,
    sku: v.sku as string,
    size: v.size as string,
    color: v.color as string,
    price: v.price as number,
    fabric_name: (v.fabric_name ?? v.fabricName ?? '') as string,
    available: (v.is_available ?? v.available ?? true) as boolean,
  };
}

function mapMedia(m: Record<string, unknown>): ApiMedia {
  const imageKey = (m.image_key ?? m.imageKey ?? '') as string;
  return {
    id: m.id as string,
    url: imageKey.startsWith('http') ? imageKey : `https://media.zavestro.in/${imageKey}`,
    is_primary: (m.purpose === 'primary' || m.is_primary === true),
  };
}

function mapProduct(p: Record<string, unknown>): ApiProduct {
  const category = (p.category ?? null) as Record<string, unknown> | null;
  const mediaArr = (p.media ?? p.images ?? []) as Record<string, unknown>[];
  const variantArr = (p.variants ?? []) as Record<string, unknown>[];

  return {
    id: p.id as string,
    name: p.name as string,
    short_description: (p.short_description ?? '') as string,
    description: (p.description ?? '') as string,
    mode: p.mode as 'simplified' | 'premium_custom',
    base_price: p.base_price as number,
    category: category
      ? { id: category.id as string, name: category.name as string, slug: category.slug as string }
      : { id: '', name: '—' },
    tags: (p.tags ?? []) as string[],
    images: mediaArr.map(mapMedia),
    delivery_days_min: (p.delivery_days_min ?? 7) as number,
    delivery_days_max: (p.delivery_days_max ?? 10) as number,
    is_made_to_order: (p.is_made_to_order ?? true) as boolean,
    status: p.is_active === false ? 'archived' : 'active',
    variants: variantArr.map(mapVariant),
    created_at: (p.created_at ?? '') as string,
    updated_at: (p.updated_at ?? '') as string,
  };
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const isFormData = init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.message || body.error?.message || body.error || msg;
    } catch { /* ignore parse error */ }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const catalogApi = {
  login: (email: string, password: string) =>
    request<{ success: boolean; data: { token: string; admin: { id: string; email: string; role: string } } }>(
      '/api/admin/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ).then(res => ({
      token: res.data.token,
      user: res.data.admin,
    })),

  getProducts: (params: {
    category?: string;
    mode?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<ProductsResponse> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('q', params.search);
    if (params.category) qs.set('category_id', params.category);
    if (params.mode) qs.set('mode', params.mode);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{ success: boolean; data: Record<string, unknown>[]; meta: { total: number; page: number; limit: number } }>(
      `/api/catalog/products${q ? `?${q}` : ''}`
    ).then(res => ({
      products: res.data.map(mapProduct),
      total: res.meta.total,
      page: res.meta.page,
      totalPages: Math.ceil(res.meta.total / (res.meta.limit || 20)),
    }));
  },

  getProduct: (id: string): Promise<ApiProduct> =>
    request<{ success: boolean; data: Record<string, unknown> }>(`/api/catalog/products/${id}`)
      .then(res => mapProduct(res.data)),

  createProduct: (data: ProductPayload): Promise<ApiProduct> =>
    request<{ success: boolean; data: Record<string, unknown> }>('/api/catalog/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        short_description: data.short_description,
        description: data.description,
        mode: data.mode,
        base_price: data.base_price,
        ...(data.category_id ? { category_id: data.category_id } : {}),
        tags: data.tags,
        delivery_days_min: data.delivery_days_min,
        delivery_days_max: data.delivery_days_max,
        is_made_to_order: data.is_made_to_order,
      }),
    }).then(res => mapProduct(res.data)),

  updateProduct: (id: string, data: Partial<ProductPayload>): Promise<ApiProduct> =>
    request<{ success: boolean; data: Record<string, unknown> }>(`/api/catalog/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.short_description !== undefined && { short_description: data.short_description }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.mode !== undefined && { mode: data.mode }),
        ...(data.base_price !== undefined && { base_price: data.base_price }),
        ...(data.category_id !== undefined && { category_id: data.category_id }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.delivery_days_min !== undefined && { delivery_days_min: data.delivery_days_min }),
        ...(data.delivery_days_max !== undefined && { delivery_days_max: data.delivery_days_max }),
        ...(data.is_made_to_order !== undefined && { is_made_to_order: data.is_made_to_order }),
        ...(data.status !== undefined && { is_active: data.status === 'active' }),
      }),
    }).then(res => mapProduct(res.data)),

  getCategories: (): Promise<ApiCategory[]> =>
    request<{ success: boolean; data: Record<string, unknown>[] }>('/api/catalog/categories')
      .then(res => res.data.map(c => ({ id: c.id as string, name: c.name as string, slug: c.slug as string }))),

  createCategory: (name: string): Promise<ApiCategory> =>
    request<{ success: boolean; data: Record<string, unknown> }>('/api/catalog/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, slug: name.toLowerCase().replace(/\s+/g, '-') }),
    }).then(res => ({ id: res.data.id as string, name: res.data.name as string })),

  addVariant: (productId: string, variant: VariantPayload): Promise<ApiVariant> =>
    request<{ success: boolean; data: Record<string, unknown> }>(`/api/catalog/admin/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify({
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        price: variant.price,
        additional_price: 0,
        fabric_name: variant.fabric_name,
        is_available: variant.available,
      }),
    }).then(res => mapVariant(res.data)),

  updateVariant: (productId: string, variantId: string, variant: Partial<VariantPayload>): Promise<ApiVariant> =>
    request<{ success: boolean; data: Record<string, unknown> }>(`/api/catalog/admin/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(variant.sku !== undefined && { sku: variant.sku }),
        ...(variant.size !== undefined && { size: variant.size }),
        ...(variant.color !== undefined && { color: variant.color }),
        ...(variant.price !== undefined && { price: variant.price }),
        ...(variant.fabric_name !== undefined && { fabric_name: variant.fabric_name }),
        ...(variant.available !== undefined && { is_available: variant.available }),
      }),
    }).then(res => mapVariant(res.data)),

  uploadMedia: async (productId: string, file: File): Promise<ApiMedia> => {
    const token = getAdminToken();
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Step 1: get presigned upload URL
    const urlRes = await fetch(`${BASE_URL}/api/media/upload-url`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: file.type }),
    });
    if (urlRes.status === 401) { clearAdminToken(); window.location.href = '/admin/login'; throw new Error('Unauthorized'); }
    if (!urlRes.ok) throw new Error('Failed to get upload URL');
    const { data: { upload_url, object_key } } = await urlRes.json() as { data: { upload_url: string; object_key: string; public_url: string } };

    // Step 2: PUT file directly to R2
    const putRes = await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    if (!putRes.ok) throw new Error('File upload to storage failed');

    // Step 3: attach key to product
    const attachRes = await fetch(`${BASE_URL}/api/catalog/admin/products/${productId}/media`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_key: object_key, purpose: 'gallery', sort_order: 0 }),
    });
    if (!attachRes.ok) throw new Error('Failed to attach image to product');
    const attachData = await attachRes.json() as { success: boolean; data: Record<string, unknown> };
    return mapMedia(attachData.data);
  },

  deleteMedia: (mediaId: string): Promise<void> =>
    request<void>(`/api/catalog/admin/media/${mediaId}`, { method: 'DELETE' }),

  setAttributes: (productId: string, attributes: Record<string, unknown>): Promise<void> =>
    request<void>(`/api/catalog/admin/products/${productId}/attributes`, {
      method: 'PUT',
      body: JSON.stringify({ attributes }),
    }),

  // ─── Admin user management ────────────────────────────────────────────────

  registerAdmin: (data: { name: string; email: string; password: string }): Promise<AdminUser> =>
    request<{ success: boolean; data: AdminUser }>('/api/admin/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(res => res.data),

  listAdminUsers: (): Promise<AdminUser[]> =>
    request<{ success: boolean; data: AdminUser[] }>('/api/admin/auth/users')
      .then(res => res.data),

  setAdminActive: (id: string, isActive: boolean): Promise<AdminUser> =>
    request<{ success: boolean; data: AdminUser }>(`/api/admin/auth/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }).then(res => res.data),

  forgotPassword: (email: string): Promise<{ requested: boolean; token?: string }> =>
    request<{ success: boolean; data: { requested: boolean; token?: string } }>('/api/admin/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }).then(res => res.data),

  resetPassword: (token: string, password: string): Promise<{ reset: boolean }> =>
    request<{ success: boolean; data: { reset: boolean } }>('/api/admin/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }).then(res => res.data),

  createAdmin: (data: { name: string; email: string; password: string; role?: 'admin' | 'super_admin' }): Promise<AdminUser> =>
    request<{ success: boolean; data: AdminUser }>('/api/admin/auth/create-admin', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(res => res.data),
};
