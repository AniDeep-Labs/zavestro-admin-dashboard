import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminCollections, adminProducts } from '../../data/adminMockData';
import styles from './CollectionEditPage.module.css';

export const CollectionEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const existing = isNew ? null : adminCollections.find(c => c.id === id) || adminCollections[0];

  const [name, setName] = React.useState(existing?.name || '');
  const [slug, setSlug] = React.useState(existing?.slug || '');
  const [mode, setMode] = React.useState<'Simplified' | 'Luxe' | 'Both'>(existing?.mode || 'Both');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<'Draft' | 'Active' | 'Archived'>(existing?.status || 'Draft');
  const [featured, setFeatured] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState(String(existing?.sortOrder || ''));
  const [season, setSeason] = React.useState(existing?.season || '');
  const [productSearch, setProductSearch] = React.useState('');
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>(
    isNew ? [] : adminProducts.slice(0, existing?.products || 0).map(p => p.id)
  );
  const [saving, setSaving] = React.useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (isNew) setSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const searchResults = productSearch.length > 1
    ? adminProducts.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
        !selectedProductIds.includes(p.id)
      )
    : [];

  const addProduct = (pid: string) => {
    setSelectedProductIds(prev => [...prev, pid]);
    setProductSearch('');
  };

  const removeProduct = (pid: string) =>
    setSelectedProductIds(prev => prev.filter(p => p !== pid));

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); navigate('/admin/catalog/collections'); }, 800);
  };

  const productsInCollection = adminProducts.filter(p => selectedProductIds.includes(p.id));

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/collections')}>
        ← Back to Collections
      </button>
      <h1 className={styles.title}>{isNew ? 'Create Collection' : `Edit: ${existing?.name}`}</h1>

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
                  <span className={styles.uploadIcon}>🖼</span>
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
              Products in this collection ({productsInCollection.length})
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
                    <button key={p.id} className={styles.searchResult} onClick={() => addProduct(p.id)}>
                      <span>{p.name}</span>
                      <span className={styles.resultMeta}>{p.mode} · {p.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.productList}>
              {productsInCollection.length === 0 ? (
                <p className={styles.emptyProducts}>No products added yet. Search above to add.</p>
              ) : (
                productsInCollection.map(p => (
                  <div key={p.id} className={styles.productItem}>
                    <div className={styles.productInfo}>
                      <span className={styles.productName}>{p.name}</span>
                      <span className={styles.productMeta}>{p.mode} · {p.category}</span>
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
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !name}>
          {saving ? 'Saving…' : isNew ? 'Create Collection' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
