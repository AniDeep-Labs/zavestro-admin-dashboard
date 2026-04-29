import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Image } from 'lucide-react';
import { collectionsApi } from '../../api/adminApi';
import { catalogApi } from '../../api/catalogApi';
import type { ApiProduct } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './CollectionEditPage.module.css';

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

export const CollectionEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [mode, setMode] = React.useState<'Simplified' | 'Luxe' | 'Both'>('Both');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [featured, setFeatured] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState('');
  const [season, setSeason] = React.useState('');
  const [productSearch, setProductSearch] = React.useState('');
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<ApiProduct[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const debouncedProductSearch = useDebounce(productSearch, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    if (isNew) return;
    collectionsApi.get(id!)
      .then(col => {
        setName(col.name);
        setSlug(col.slug);
        setMode(col.mode);
        setStatus(col.status);
        setSortOrder(String(col.sortOrder));
        setSeason(col.season);
        setSelectedProductIds(col.productIds ?? []);
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load collection'));
  }, [id, isNew]);

  React.useEffect(() => {
    if (debouncedProductSearch.length < 2) { setSearchResults([]); return; }
    catalogApi.getProducts({ search: debouncedProductSearch, limit: 10 })
      .then(res => setSearchResults((res.products ?? []).filter(p => !selectedProductIds.includes(p.id))))
      .catch(() => setSearchResults([]));
  }, [debouncedProductSearch, selectedProductIds]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (isNew) setSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const addProduct = (p: ApiProduct) => {
    setSelectedProductIds(prev => [...prev, p.id]);
    setProductSearch('');
    setSearchResults([]);
  };

  const removeProduct = (pid: string) =>
    setSelectedProductIds(prev => prev.filter(p => p !== pid));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name, slug, mode, description, status, featured,
        sortOrder: Number(sortOrder) || 1, season,
        productIds: selectedProductIds,
      };
      if (isNew) {
        await collectionsApi.create(payload);
        showToast('success', 'Collection created', name);
      } else {
        await collectionsApi.update(id!, payload);
        showToast('success', 'Collection saved', name);
      }
      setTimeout(() => navigate('/admin/catalog/collections'), 600);
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/collections')}><ChevronLeft size={15}/> Back to Collections</button>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/collections')}>
        <ChevronLeft size={15}/> Back to Collections
      </button>
      <h1 className={styles.title}>{isNew ? 'Create Collection' : `Edit: ${name}`}</h1>

      <div className={styles.twoCol}>
        <div className={styles.main}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Collection Details</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Collection Name *</label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Wedding Season 2026"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Slug</label>
                <div className={styles.slugRow}>
                  <span className={styles.slugPrefix}>/collections/</span>
                  <input className={styles.input} value={slug} onChange={e => setSlug(e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Mode *</label>
                  <select className={styles.select} value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
                    <option>Simplified</option>
                    <option>Luxe</option>
                    <option>Both</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select className={styles.select} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
                    <option>Draft</option>
                    <option>Active</option>
                    <option>Archived</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short description shown on collection page…"
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Sort Order</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Season / Campaign Tag</label>
                  <input
                    className={styles.input}
                    value={season}
                    onChange={e => setSeason(e.target.value)}
                    placeholder="e.g., Wedding Season 2026"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Banner Image</label>
                <div className={styles.uploadArea}>
                  <span className={styles.uploadIcon}><Image size={22}/></span>
                  <span className={styles.uploadText}>Upload banner (1200 × 400px recommended)</span>
                  <button className={styles.uploadBtn} type="button">Choose File</button>
                </div>
              </div>
              <div className={styles.toggleRow}>
                <label className={styles.toggleLabel}>
                  <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} />
                  Featured Collection (appears on home screen)
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              Products in this collection ({selectedProductIds.length})
            </h3>
            <div className={styles.productSearch}>
              <input
                className={styles.input}
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search to add products…"
              />
              {searchResults.length > 0 && (
                <div className={styles.searchDropdown}>
                  {searchResults.map(p => (
                    <button key={p.id} className={styles.searchResult} onClick={() => addProduct(p)}>
                      <span>{p.name}</span>
                      <span className={styles.resultMeta}>
                        {p.mode} · {typeof p.category === 'object' ? p.category?.name : (p.category ?? '—')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.productList}>
              {selectedProductIds.length === 0 ? (
                <p className={styles.emptyProducts}>No products added yet. Search above to add.</p>
              ) : (
                selectedProductIds.map(pid => (
                  <div key={pid} className={styles.productItem}>
                    <div className={styles.productInfo}>
                      <span className={styles.productName}>{pid}</span>
                    </div>
                    <button className={styles.removeBtn} onClick={() => removeProduct(pid)}>×</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.saveBar}>
        <button className={styles.cancelBtn} onClick={() => navigate('/admin/catalog/collections')}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !name}>
          {saving ? 'Saving…' : isNew ? 'Create Collection' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
