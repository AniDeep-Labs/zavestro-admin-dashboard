const BASE_URL = 'https://api.zavestro.in';
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

  if (res.status === 401) {
    clearAdminToken();
    window.location.href = '/admin/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.message || body.error || msg;
    } catch { /* ignore parse error */ }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const catalogApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      '/api/admin/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  getProducts: (params: {
    category?: string;
    mode?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.category) qs.set('category', params.category);
    if (params.mode) qs.set('mode', params.mode);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<ProductsResponse>(`/api/catalog/products${q ? `?${q}` : ''}`);
  },

  getProduct: (id: string) =>
    request<ApiProduct>(`/api/catalog/products/${id}`),

  createProduct: (data: ProductPayload) =>
    request<ApiProduct>('/api/catalog/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: string, data: Partial<ProductPayload>) =>
    request<ApiProduct>(`/api/catalog/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getCategories: () =>
    request<{ categories: ApiCategory[] } | ApiCategory[]>('/api/catalog/categories'),

  createCategory: (name: string) =>
    request<ApiCategory>('/api/catalog/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  addVariant: (productId: string, variant: VariantPayload) =>
    request<ApiVariant>(`/api/catalog/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(variant),
    }),

  uploadMedia: async (productId: string, file: File): Promise<ApiMedia> => {
    const token = getAdminToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/catalog/products/${productId}/media`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (res.status === 401) {
      clearAdminToken();
      window.location.href = '/admin/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Image upload failed');
    return res.json() as Promise<ApiMedia>;
  },

  deleteMedia: (mediaId: string) =>
    request<void>(`/api/catalog/media/${mediaId}`, { method: 'DELETE' }),

  setAttributes: (productId: string, attributes: Record<string, unknown>) =>
    request<void>(`/api/catalog/products/${productId}/attributes`, {
      method: 'POST',
      body: JSON.stringify(attributes),
    }),
};
