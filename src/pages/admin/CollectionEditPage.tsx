import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Image } from 'lucide-react';
import { collectionsApi } from '../../api/adminApi';
import { catalogApi } from '../../api/catalogApi';
import type { ApiProduct } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
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

  useBreadcrumbTitle(name || (isNew ? 'New Collection' : undefined));
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [featured, setFeatured] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState('');
  const [season, setSeason] = React.useState('');
  const [type, setType] = React.useState<'standard' | 'new_arrivals' | 'occasion' | 'featured'>('standard');
  const [subtitle, setSubtitle] = React.useState('');
  const [bgColor1, setBgColor1] = React.useState('#1C5C42');
  const [bgColor2, setBgColor2] = React.useState('#0D3D2C');
  const [productSearch, setProductSearch] = React.useState('');
  const [selectedProducts, setSelectedProducts] = React.useState<{id: string; name: string}[]>([]);
  const [searchResults, setSearchResults] = React.useState<ApiProduct[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [submitted, setSubmitted] = React.useState(false);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  const debouncedProductSearch = useDebounce(productSearch, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    if (isNew) return;
    collectionsApi.get(id!)
      .then(async col => {
        setName(col.name);
        setSlug(col.slug);
        setDescription(col.description ?? '');
        setStatus(col.status);
        setSortOrder(String(col.sortOrder));
        setSeason(col.season);
        setType((col.type ?? 'standard') as 'standard' | 'new_arrivals' | 'occasion' | 'featured');
        setSubtitle(col.subtitle ?? '');
        setBgColor1(col.bg_color_1 || '#1C5C42');
        setBgColor2(col.bg_color_2 || '#0D3D2C');
        const pids = col.productIds ?? [];
        setSelectedProducts(pids.map(id => ({ id, name: '' })));
        if (pids.length > 0) {
          const resolved = await Promise.all(
            pids.map(pid => catalogApi.getProduct(pid).then(p => ({ id: pid, name: p.name })).catch(() => ({ id: pid, name: pid })))
          );
          setSelectedProducts(resolved);
        }
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load collection'));
  }, [id, isNew]);

  React.useEffect(() => {
    if (debouncedProductSearch.length < 2) { setSearchResults([]); return; }
    catalogApi.getProducts({ search: debouncedProductSearch, limit: 10 })
      .then(res => setSearchResults((res.products ?? []).filter(p => !selectedProducts.some(sp => sp.id === p.id))))
      .catch(() => setSearchResults([]));
  }, [debouncedProductSearch, selectedProducts]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched && (isNew || !slug)) {
      setSlug(
        val.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, ''),
      );
    }
  };

  const handleSlugChange = (val: string) => {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-'));
    setSlugTouched(true);
  };

  const addProduct = async (p: ApiProduct) => {
    setSelectedProducts(prev => [...prev, { id: p.id, name: p.name }]);
    setProductSearch('');
    setSearchResults([]);
    if (!isNew) {
      try {
        await collectionsApi.addProduct(id!, p.id);
      } catch {
        showToast('error', 'Failed to add product');
        setSelectedProducts(prev => prev.filter(sp => sp.id !== p.id));
      }
    }
  };

  const removeProduct = async (pid: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== pid));
    if (!isNew) {
      try {
        await collectionsApi.removeProduct(id!, pid);
      } catch {
        showToast('error', 'Failed to remove product');
      }
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    const trimmedName = name.trim();
    const cleanSlug = slug.replace(/^-+|-+$/g, '');
    if (!trimmedName) {
      showToast('error', 'Validation Error', 'Collection Name is required');
      return;
    }
    if (name !== trimmedName) setName(trimmedName);
    if (cleanSlug !== slug) setSlug(cleanSlug);
    setSaving(true);
    try {
      const payload = {
        name: trimmedName, slug: cleanSlug, description, status,
        is_featured: featured,
        sort_order: Number(sortOrder) || 0, season,
        type, subtitle: subtitle.trim() || undefined,
        bg_color_1: bgColor1, bg_color_2: bgColor2,
      };
      if (isNew) {
        const created = await collectionsApi.create(payload as never);
        for (const p of selectedProducts) {
          await collectionsApi.addProduct(created.id, p.id).catch(() => {});
        }
        showToast('success', 'Collection created', name);
      } else {
        await collectionsApi.update(id!, payload as never);
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
                  className={`${styles.input} ${submitted && !name.trim() ? styles.inputError : ''}`}
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g., Wedding Season 2026"
                />
                {submitted && !name.trim() && <span className={styles.fieldHint}>Collection Name is required</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Slug</label>
                <div className={styles.slugRow}>
                  <span className={styles.slugPrefix}>/collections/</span>
                  <input
                    className={`${styles.input} ${slug && /^-|-$/.test(slug) ? styles.inputError : ''}`}
                    value={slug}
                    onChange={e => handleSlugChange(e.target.value)}
                  />
                </div>
                {slug && /^-|-$/.test(slug) && (
                  <span className={styles.fieldHint}>Slug must not start or end with a dash</span>
                )}
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select className={styles.select} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
                    <option>Draft</option>
                    <option>Active</option>
                    <option>Archived</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Collection Type</label>
                  <select className={styles.select} value={type} onChange={e => setType(e.target.value as typeof type)}>
                    <option value="standard">Standard</option>
                    <option value="new_arrivals">New Arrivals</option>
                    <option value="occasion">Occasion</option>
                    <option value="featured">Featured</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Subtitle <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(shown on home screen cards)</span></label>
                <input
                  className={styles.input}
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  placeholder="e.g., Perfect for special moments"
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Card Gradient — Color 1</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={bgColor1} onChange={e => setBgColor1(e.target.value)} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                    <input className={styles.input} value={bgColor1} onChange={e => setBgColor1(e.target.value)} placeholder="#1C5C42" style={{ flex: 1 }} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Card Gradient — Color 2</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                    <input className={styles.input} value={bgColor2} onChange={e => setBgColor2(e.target.value)} placeholder="#0D3D2C" style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              {(type === 'occasion' || type === 'new_arrivals' || type === 'featured') && (
                <div style={{ background: `linear-gradient(135deg, ${bgColor1}, ${bgColor2})`, borderRadius: 10, padding: '14px 18px', color: '#fff' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.75 }}>Preview</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{name || 'Collection Name'}</div>
                  {subtitle && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitle}</div>}
                </div>
              )}
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
                  <button className={styles.uploadBtn} type="button" onClick={() => bannerInputRef.current?.click()}>Choose File</button>
                  <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={() => showToast('info', 'Banner image upload coming soon')} />
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
              Products in this collection ({selectedProducts.length})
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
              {selectedProducts.length === 0 ? (
                <p className={styles.emptyProducts}>No products added yet. Search above to add.</p>
              ) : (
                selectedProducts.map(p => (
                  <div key={p.id} className={styles.productItem}>
                    <div className={styles.productInfo}>
                      <span className={styles.productName}>{p.name || p.id}</span>
                    </div>
                    <button className={styles.removeBtn} onClick={() => removeProduct(p.id)}>×</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.saveBar}>
        <button className={styles.cancelBtn} onClick={() => navigate('/admin/catalog/collections')}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Create Collection' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
