import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Image, Check, Plus } from 'lucide-react';
import { catalogApi } from '../../api/catalogApi';
import type { ApiCategory, ApiVariant, ApiMedia, VariantPayload } from '../../api/catalogApi';

import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ProductEditPage.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantDraft {
  id?: string;       // set if already saved to API
  sku: string;
  size: string;
  color: string;
  price: string;
  fabric_name: string;
  available: boolean;
}

interface PendingImage {
  key: string;
  file: File;
  preview: string;
}

const emptyVariant = (): VariantDraft => ({
  sku: '', size: '', color: '', price: '', fabric_name: '', available: true,
});

// ─── Component ────────────────────────────────────────────────────────────────

export const ProductEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  // Form fields
  const [name, setName] = React.useState('');
  const [shortDesc, setShortDesc] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [mode] = React.useState<'simplified'>('simplified');
  const [basePrice, setBasePrice] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [deliveryMin, setDeliveryMin] = React.useState('7');
  const [deliveryMax, setDeliveryMax] = React.useState('10');
  const [isMadeToOrder, setIsMadeToOrder] = React.useState(true);
  const [status, setStatus] = React.useState<'active' | 'draft' | 'archived'>('draft');

  // Meta
  const [categories, setCategories] = React.useState<ApiCategory[]>([]);
  const [newCatName, setNewCatName] = React.useState('');
  const [showNewCat, setShowNewCat] = React.useState(false);
  const [creatingCat, setCreatingCat] = React.useState(false);

  // Images
  const [existingImages, setExistingImages] = React.useState<ApiMedia[]>([]);
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Variants
  const [variants, setVariants] = React.useState<VariantDraft[]>([]);
  const originalVariantsRef = React.useRef<VariantDraft[]>([]);
  const [showAddVariant, setShowAddVariant] = React.useState(false);
  const [variantDraft, setVariantDraft] = React.useState<VariantDraft>(emptyVariant());

  // Loading
  const [fetchLoading, setFetchLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  // ─── Load categories ──────────────────────────────────────────────────────

  React.useEffect(() => {
    catalogApi.getCategories()
      .then(res => {
        const list = Array.isArray(res) ? res : (res as { categories: ApiCategory[] }).categories;
        setCategories(list ?? []);
      })
      .catch(() => setCategories([]));
  }, []);

  // ─── Load product (edit mode) ─────────────────────────────────────────────

  React.useEffect(() => {
    if (isNew) return;
    setFetchLoading(true);
    catalogApi.getProduct(id!)
      .then(p => {
        setName(p.name ?? '');
        setShortDesc(p.short_description ?? '');
        setDescription(p.description ?? '');

        setBasePrice(String(p.base_price ?? ''));
        setCategoryId(typeof p.category === 'object' ? p.category?.id ?? '' : '');
        setTags((p.tags ?? []).join(', '));
        setDeliveryMin(String(p.delivery_days_min ?? 7));
        setDeliveryMax(String(p.delivery_days_max ?? 10));
        setIsMadeToOrder(p.is_made_to_order ?? true);
        setStatus(p.status ?? 'draft');
        setExistingImages(p.images ?? []);
        const loadedVariants = (p.variants ?? []).map((v: ApiVariant) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: String(v.price),
          fabric_name: v.fabric_name,
          available: v.available,
        }));
        setVariants(loadedVariants);
        originalVariantsRef.current = loadedVariants.map(v => ({ ...v }));
      })
      .catch(err => {
        showToast('error', 'Failed to load product', err instanceof Error ? err.message : undefined);
      })
      .finally(() => setFetchLoading(false));
  }, [id, isNew]);

  // ─── Image drag & drop ────────────────────────────────────────────────────

  const addFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) return;
    const newPending: PendingImage[] = valid.map(file => ({
      key: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages(prev => [...prev, ...newPending]);
  };

  const removePending = (key: string) => {
    setPendingImages(prev => {
      const img = prev.find(x => x.key === key);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(x => x.key !== key);
    });
  };

  const removeExisting = async (mediaId: string) => {
    try {
      await catalogApi.deleteMedia(mediaId);
      setExistingImages(prev => prev.filter(x => x.id !== mediaId));
      showToast('success', 'Image removed');
    } catch (err) {
      showToast('error', 'Failed to remove image', err instanceof Error ? err.message : undefined);
    }
  };

  // ─── Create category inline ───────────────────────────────────────────────

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const cat = await catalogApi.createCategory(newCatName.trim());
      setCategories(prev => [...prev, cat]);
      setCategoryId(cat.id);
      setNewCatName('');
      setShowNewCat(false);
      showToast('success', `Category "${cat.name}" created`);
    } catch (err) {
      showToast('error', 'Failed to create category', err instanceof Error ? err.message : undefined);
    } finally {
      setCreatingCat(false);
    }
  };

  // ─── Variant management ───────────────────────────────────────────────────

  const addVariantDraft = () => {
    if (!variantDraft.sku || !variantDraft.color) {
      showToast('warning', 'SKU and Color are required');
      return;
    }
    setVariants(prev => [...prev, { ...variantDraft }]);
    setVariantDraft(emptyVariant());
    setShowAddVariant(false);
  };

  const removeVariantDraft = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const toggleVariantAvailable = (index: number) => {
    setVariants(prev =>
      prev.map((v, i) => i === index ? { ...v, available: !v.available } : v)
    );
  };

  // ─── Save ─────────────────────────────────────────────────────────────────

  const validate = () => {
    if (!name.trim()) { showToast('warning', 'Product name is required'); return false; }
    if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
      showToast('warning', 'Enter a valid base price');
      return false;
    }
    if (!categoryId) { showToast('warning', 'Please select a category'); return false; }
    return true;
  };

  const handleSave = async (targetStatus?: 'active' | 'draft') => {
    if (!validate()) return;
    const saveStatus = targetStatus ?? status;
    setSaving(true);
    setStatus(saveStatus);

    const payload = {
      name: name.trim(),
      short_description: shortDesc.trim(),
      description: description.trim(),
      mode,
      base_price: Number(basePrice),
      category_id: categoryId,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      delivery_days_min: Number(deliveryMin),
      delivery_days_max: Number(deliveryMax),
      is_made_to_order: isMadeToOrder,
      status: saveStatus,
    };

    try {
      let productId = id!;

      if (isNew) {
        const created = await catalogApi.createProduct(payload);
        productId = created.id;
      } else {
        await catalogApi.updateProduct(productId, payload);
      }

      // Upload pending images
      for (const img of pendingImages) {
        try {
          const uploaded = await catalogApi.uploadMedia(productId, img.file);
          setExistingImages(prev => [...prev, uploaded]);
          URL.revokeObjectURL(img.preview);
        } catch {
          showToast('warning', `Failed to upload ${img.file.name}`);
        }
      }
      setPendingImages([]);

      // Save new variants (only those without an id)
      for (const v of variants.filter(v => !v.id)) {
        const vp: VariantPayload = {
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: Number(v.price) || Number(basePrice),
          fabric_name: v.fabric_name,
          available: v.available,
        };
        try {
          const saved = await catalogApi.addVariant(productId, vp);
          setVariants(prev =>
            prev.map(x => x.sku === v.sku && !x.id ? { ...x, id: saved.id } : x)
          );
        } catch {
          showToast('warning', `Failed to save variant ${v.sku || v.color}`);
        }
      }

      // Update existing variants that were modified
      for (const v of variants.filter(v => !!v.id)) {
        const orig = originalVariantsRef.current.find(o => o.id === v.id);
        if (!orig || v.available === orig.available) continue;
        try {
          await catalogApi.updateVariant(productId, v.id!, { available: v.available });
        } catch {
          showToast('warning', `Failed to update variant ${v.sku || v.color}`);
        }
      }

      showToast('success', isNew ? 'Product created' : 'Product updated');
      setTimeout(() => navigate('/admin/catalog/products'), 800);
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (fetchLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Loading product…</div>
      </div>
    );
  }

  const allImages = [
    ...existingImages.map(img => ({ type: 'existing' as const, img })),
    ...pendingImages.map(img => ({ type: 'pending' as const, img })),
  ];

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageTop}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/products')}>
          <ChevronLeft size={15}/> Products
        </button>
        <h1 className={styles.title}>
          {isNew ? 'New Product' : name || 'Edit Product'}
        </h1>
      </div>

      <div className={styles.twoCol}>
        {/* ── LEFT: product details ── */}
        <div className={styles.mainCol}>
          {/* Basic Info */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Basic Info</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Product Name *</label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Classic Oxford Shirt"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Short Description</label>
                <input
                  className={styles.input}
                  value={shortDesc}
                  onChange={e => setShortDesc(e.target.value)}
                  placeholder="One line — shown in listing cards"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Base Price (₹) *</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                  placeholder="e.g., 1299"
                />
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>Category *</label>
                  <button
                    type="button"
                    className={styles.inlineLink}
                    onClick={() => setShowNewCat(s => !s)}
                  >
                    {showNewCat ? 'Cancel' : '+ New category'}
                  </button>
                </div>
                {showNewCat ? (
                  <div className={styles.inlineCreate}>
                    <input
                      className={styles.input}
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      placeholder="Category name"
                      onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                    />
                    <button
                      type="button"
                      className={styles.createBtn}
                      onClick={handleCreateCategory}
                      disabled={creatingCat || !newCatName.trim()}
                    >
                      {creatingCat ? '…' : 'Create'}
                    </button>
                  </div>
                ) : (
                  <select
                    className={styles.select}
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                  >
                    <option value="">Select category…</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Tags</label>
                <input
                  className={styles.input}
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="formal, wedding, cotton (comma separated)"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Description</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Full Description</label>
                <textarea
                  className={styles.textarea}
                  rows={5}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed product description…"
                />
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Delivery & Ordering</h3>
            <div className={styles.fields}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Min Delivery Days</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={deliveryMin}
                    onChange={e => setDeliveryMin(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Max Delivery Days</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={deliveryMax}
                    onChange={e => setDeliveryMax(e.target.value)}
                  />
                </div>
              </div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={isMadeToOrder}
                  onChange={e => setIsMadeToOrder(e.target.checked)}
                />
                <span>Made to order</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── RIGHT: status + images ── */}
        <div className={styles.sideCol}>
          {/* Status */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Status</h3>
            <div className={styles.statusGroup}>
              {(['active', 'draft', 'archived'] as const).map(s => (
                <label key={s} className={styles.radioRow}>
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                  />
                  <span className={`${styles.statusLabel} ${styles[`status_${s}`]}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                </label>
              ))}
            </div>
            <div className={styles.saveActions}>
              <button
                type="button"
                className={styles.draftBtn}
                onClick={() => handleSave('draft')}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                className={styles.publishBtn}
                onClick={() => handleSave('active')}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Publish'}
              </button>
            </div>
          </div>

          {/* Images */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              Images
              <span className={styles.imageCount}>{allImages.length}</span>
            </h3>

            {/* Drop zone */}
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              aria-label="Upload images"
            >
              <span className={styles.dropIcon}><Image size={28}/></span>
              <span className={styles.dropText}>
                {isDragging ? 'Drop to upload' : 'Drag & drop or click to upload'}
              </span>
              <span className={styles.dropHint}>PNG, JPG, WEBP — multiple allowed</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className={styles.hiddenInput}
              onChange={e => e.target.files && addFiles(e.target.files)}
            />

            {/* Image grid */}
            {allImages.length > 0 && (
              <div className={styles.imageGrid}>
                {existingImages.map((img, i) => (
                  <div key={img.id} className={`${styles.imageThumb} ${i === 0 ? styles.imagePrimary : ''}`}>
                    <img src={img.url} alt="" />
                    {i === 0 && <span className={styles.primaryBadge}>Primary</span>}
                    <button
                      type="button"
                      className={styles.removeImage}
                      onClick={() => removeExisting(img.id)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pendingImages.map((img, i) => (
                  <div
                    key={img.key}
                    className={`${styles.imageThumb} ${styles.imagePending} ${existingImages.length === 0 && i === 0 ? styles.imagePrimary : ''}`}
                  >
                    <img src={img.preview} alt="" />
                    {existingImages.length === 0 && i === 0 && <span className={styles.primaryBadge}>Primary</span>}
                    <span className={styles.pendingBadge}>Pending</span>
                    <button
                      type="button"
                      className={styles.removeImage}
                      onClick={() => removePending(img.key)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Variants ── */}
      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Variants</h3>
          <button
            type="button"
            className={styles.addVariantBtn}
            onClick={() => { setShowAddVariant(true); setVariantDraft(emptyVariant()); }}
          >
            <Plus size={14}/> Add Variant
          </button>
        </div>

        <div className={styles.variantTableWrap}>
          <table className={styles.variantTable}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Size</th>
                <th>Color</th>
                <th>Fabric</th>
                <th>Price (₹)</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 && !showAddVariant ? (
                <tr>
                  <td colSpan={7} className={styles.variantEmpty}>
                    No variants yet. Add your first variant above.
                  </td>
                </tr>
              ) : (
                variants.map((v, i) => (
                  <tr key={v.id ?? i}>
                    <td className={styles.variantSku}>{v.sku || '—'}</td>
                    <td>{v.size || '—'}</td>
                    <td>{v.color || '—'}</td>
                    <td>{v.fabric_name || '—'}</td>
                    <td>₹{v.price ? Number(v.price).toLocaleString('en-IN') : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.availToggle} ${v.available ? styles.availOn : styles.availOff}`}
                        onClick={() => toggleVariantAvailable(i)}
                      >
                        {v.available ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td>
                      {!v.id && (
                        <button
                          type="button"
                          className={styles.removeVariantBtn}
                          onClick={() => removeVariantDraft(i)}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}

              {/* Inline add form */}
              {showAddVariant && (
                <tr className={styles.addRow}>
                  <td>
                    <input
                      className={styles.variantInput}
                      placeholder="SKU *"
                      value={variantDraft.sku}
                      onChange={e => setVariantDraft(v => ({ ...v, sku: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.variantInput}
                      placeholder="S / M / XL"
                      value={variantDraft.size}
                      onChange={e => setVariantDraft(v => ({ ...v, size: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.variantInput}
                      placeholder="Color *"
                      value={variantDraft.color}
                      onChange={e => setVariantDraft(v => ({ ...v, color: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.variantInput}
                      placeholder="Cotton / Linen"
                      value={variantDraft.fabric_name}
                      onChange={e => setVariantDraft(v => ({ ...v, fabric_name: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.variantInput}
                      type="number"
                      placeholder={basePrice || '0'}
                      value={variantDraft.price}
                      onChange={e => setVariantDraft(v => ({ ...v, price: e.target.value }))}
                    />
                  </td>
                  <td>
                    <label className={styles.availCheck}>
                      <input
                        type="checkbox"
                        checked={variantDraft.available}
                        onChange={e => setVariantDraft(v => ({ ...v, available: e.target.checked }))}
                      />
                    </label>
                  </td>
                  <td>
                    <div className={styles.variantRowActions}>
                      <button type="button" className={styles.confirmVariantBtn} onClick={addVariantDraft}><Check size={14}/></button>
                      <button type="button" className={styles.cancelVariantBtn} onClick={() => setShowAddVariant(false)}>×</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div className={styles.saveBar}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => navigate('/admin/catalog/products')}
          disabled={saving}
        >
          Cancel
        </button>
        <div className={styles.saveRight}>
          <button
            type="button"
            className={styles.draftBtnBar}
            onClick={() => handleSave('draft')}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            className={styles.publishBtnBar}
            onClick={() => handleSave('active')}
            disabled={saving}
          >
            {saving ? 'Publishing…' : isNew ? 'Create & Publish' : 'Save & Publish'}
          </button>
        </div>
      </div>
    </div>
  );
};
