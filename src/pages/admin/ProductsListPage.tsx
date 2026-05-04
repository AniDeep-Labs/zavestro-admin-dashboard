import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogApi } from '../../api/catalogApi';
import type { ApiProduct, ApiCategory } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ProductsListPage.module.css';

const LIMIT = 20;

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

export const ProductsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [products, setProducts] = React.useState<ApiProduct[]>([]);
  const [categories, setCategories] = React.useState<ApiCategory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    catalogApi.getCategories()
      .then(res => {
        const list = Array.isArray(res) ? res : (res as { categories: ApiCategory[] }).categories;
        setCategories(list);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    setLoading(true);
    setError('');
    catalogApi.getProducts({
      search: debouncedSearch || undefined,
      mode: modeFilter || undefined,
      category: categoryFilter || undefined,
      page,
      limit: LIMIT,
    })
      .then(res => {
        setProducts(res.products ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'Failed to load products';
        setError(msg);
        showToast('error', 'Load failed', msg);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, modeFilter, categoryFilter, page]);

  const clearFilters = () => {
    setSearch('');
    setModeFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const handleArchive = async (e: React.MouseEvent, product: ApiProduct) => {
    e.stopPropagation();
    if (!confirm(`Archive "${product.name}"? It will no longer appear in the catalog.`)) return;
    try {
      await catalogApi.updateProduct(product.id, { status: 'archived' });
      setProducts(prev => prev.filter(p => p.id !== product.id));
      setTotal(t => t - 1);
      showToast('success', 'Product archived', product.name);
    } catch (err) {
      showToast('error', 'Archive failed', err instanceof Error ? err.message : undefined);
    }
  };

  const modeLabel = (mode: string) =>
    mode === 'simplified' ? 'Simplified' : mode === 'premium_custom' ? 'Premium Custom' : mode;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Products</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/catalog/products/new')}>
          <Plus size={15}/> Add Product
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search products…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={modeFilter}
          onChange={e => { setModeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Modes</option>
          <option value="simplified">Simplified</option>
        </select>
        <select
          className={styles.filterSelect}
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className={styles.clearBtn} onClick={clearFilters}><X size={14}/> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Mode</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Variants</th>
              <th>Delivery</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  <div>{error}</div>
                  <button
                    className={styles.retryBtn}
                    onClick={() => { setPage(1); setError(''); }}
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>No products found.</td></tr>
            ) : (
              products.map(product => (
                <tr
                  key={product.id}
                  className={styles.row}
                  onClick={() => navigate(`/admin/catalog/products/${product.id}`)}
                >
                  <td className={styles.productName}>{product.name}</td>
                  <td>
                    <span className={`${styles.pill} ${product.mode === 'simplified' ? styles.pillGreen : styles.pillGold}`}>
                      {modeLabel(product.mode)}
                    </span>
                  </td>
                  <td>
                    {typeof product.category === 'object'
                      ? product.category?.name
                      : product.category ?? '—'}
                  </td>
                  <td>₹{product.base_price?.toLocaleString('en-IN') ?? '—'}</td>
                  <td>{product.variants?.length ?? 0}</td>
                  <td className={styles.date}>
                    {product.delivery_days_min}–{product.delivery_days_max} days
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${
                      product.status === 'active' ? styles.statusActive
                        : product.status === 'draft' ? styles.statusDraft
                        : styles.statusArchived
                    }`}>
                      {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                    </span>
                  </td>
                  <td className={styles.date}>
                    {product.updated_at
                      ? new Date(product.updated_at).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => navigate(`/admin/catalog/products/${product.id}`)}
                      >
                        Edit
                      </button>
                      {product.status !== 'archived' && (
                        <button
                          className={`${styles.actionBtn} ${styles.archiveBtn}`}
                          onClick={e => handleArchive(e, product)}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>
          {loading ? 'Loading…' : `${total} product${total !== 1 ? 's' : ''} total`}
        </span>
        <div className={styles.pageButtons}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={15}/> Prev
          </button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next <ChevronRight size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
};
