import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collectionsApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import { catalogApi } from '../../api/catalogApi';
import { Alert } from '../../components/Alert/Alert';
import type { ApiProduct } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import styles from './CollectionEditPage.module.css';
import { UilAngleLeft, UilImage } from "@iconscout/react-unicons";
import { CollectionStudio, DEFAULT_DESIGN, type CollectionDesign } from './CollectionStudio';
import type { BannerLayout, BannerTextPosition, BannerTextColor, BannerComposeStyle } from '../../api/adminApi';

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

export const CollectionEditPage: React.FC<{
  /** When rendered inside a modal, the id + done callback come as props (no routing). */
  idProp?: string;
  onClose?: () => void;
  onSaved?: () => void;
}> = ({ idProp, onClose, onSaved }) => {
  const routeParams = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = idProp ?? routeParams.id;
  const isNew = id === 'new';
  const inModal = !!onClose;
  // In a modal, finishing closes the popup; as a page, it navigates back to the list.
  const done = () => { if (onClose) { onSaved?.(); onClose(); } else navigate('/admin/catalog/collections'); };

  const [name, setName] = React.useState('');

  useBreadcrumbTitle(name || (isNew ? 'New Collection' : undefined));
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [featured, setFeatured] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState('');
  const [season, setSeason] = React.useState('');
  // Default new collections to `occasion` — the only type the storefront renders today.
  const [type, setType] = React.useState<'standard' | 'new_arrivals' | 'occasion' | 'featured'>('occasion');
  const [subtitle, setSubtitle] = React.useState('');
  const [bgColor1, setBgColor1] = React.useState('#1F6B4F');
  const [bgColor2, setBgColor2] = React.useState('#0D3D2C');
  const [productSearch, setProductSearch] = React.useState('');
  const [selectedProducts, setSelectedProducts] = React.useState<{id: string; name: string}[]>([]);
  const [searchResults, setSearchResults] = React.useState<ApiProduct[]>([]);
  const [coverImageKey, setCoverImageKey] = React.useState('');
  const [design, setDesign] = React.useState<CollectionDesign>(DEFAULT_DESIGN);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [submitted, setSubmitted] = React.useState(false);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  // Dirty guard (§6C) — warn on leaving with unsaved form edits. Products auto-save
  // in edit mode, so only the form fields are tracked.
  const [ready, setReady] = React.useState(false);
  const snap = () => JSON.stringify({
    name, slug, description, status, featured, sortOrder, season, type, subtitle, bgColor1, bgColor2, coverImageKey, design,
  });
  const [baseline, setBaseline] = React.useState('');
  const dirty = ready && baseline !== '' && baseline !== snap();
  useDirtyGuard(dirty);
  React.useEffect(() => {
    if (ready && baseline === '') setBaseline(snap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const debouncedProductSearch = useDebounce(productSearch, 350);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    if (isNew) { setReady(true); return; }
    collectionsApi.get(id!)
      .then(async col => {
        setName(col.name);
        setSlug(col.slug);
        setDescription(col.description ?? '');
        setStatus(col.status);
        setFeatured(col.is_featured ?? false); // bug fix: edit was silently un-featuring
        setSortOrder(String(col.sortOrder));
        setSeason(col.season);
        setType((col.type ?? 'standard') as 'standard' | 'new_arrivals' | 'occasion' | 'featured');
        setSubtitle(col.subtitle ?? '');
        setBgColor1(col.bg_color_1 || '#1F6B4F');
        setBgColor2(col.bg_color_2 || '#0D3D2C');
        setCoverImageKey(col.cover_image ?? '');
        setDesign({
          card_layout: (col.card_layout ?? 'full_image') as BannerLayout,
          hero_layout: (col.hero_layout ?? 'showcase') as BannerLayout,
          card_aspect: col.card_aspect ?? 0.8,
          hero_aspect: col.hero_aspect ?? 2.4,
          card_focal_x: col.card_focal_x ?? 50, card_focal_y: col.card_focal_y ?? 50,
          hero_focal_x: col.hero_focal_x ?? 50, hero_focal_y: col.hero_focal_y ?? 50,
          image_fit: (col.image_fit ?? 'cover') as 'cover' | 'contain',
          image_zoom: col.image_zoom ?? 100,
          text_position: (col.text_position ?? 'bottom') as BannerTextPosition,
          text_color: (col.text_color ?? 'light') as BannerTextColor,
          overlay: col.overlay ?? 40,
          gradient_angle: col.gradient_angle ?? 135,
          gradient_solid: col.gradient_solid ?? false,
          logo_key: col.logo_key ?? '',
          cta_text: col.cta_text ?? 'Explore',
          compose_style: (col.compose_style ?? {}) as BannerComposeStyle,
        });
        const pids = col.productIds ?? [];
        setSelectedProducts(pids.map(id => ({ id, name: '' })));
        if (pids.length > 0) {
          const resolved = await Promise.all(
            pids.map(pid => catalogApi.getProduct(pid).then(p => ({ id: pid, name: p.name })).catch(() => ({ id: pid, name: pid })))
          );
          setSelectedProducts(resolved);
        }
        setReady(true);
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
    const removed = selectedProducts.find(p => p.id === pid);
    setSelectedProducts(prev => prev.filter(p => p.id !== pid));
    if (!isNew) {
      try {
        await collectionsApi.removeProduct(id!, pid);
      } catch {
        showToast('error', 'Failed to remove product');
        if (removed) setSelectedProducts(prev => prev.some(p => p.id === pid) ? prev : [...prev, removed]); // rollback the optimistic remove
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
        cover_image: coverImageKey || undefined,
        // Collection studio design
        card_layout: design.card_layout, hero_layout: design.hero_layout,
        card_aspect: design.card_aspect, hero_aspect: design.hero_aspect,
        card_focal_x: design.card_focal_x, card_focal_y: design.card_focal_y,
        hero_focal_x: design.hero_focal_x, hero_focal_y: design.hero_focal_y,
        image_fit: design.image_fit, image_zoom: design.image_zoom,
        text_position: design.text_position, text_color: design.text_color,
        overlay: design.overlay, gradient_angle: design.gradient_angle,
        gradient_solid: design.gradient_solid,
        logo_key: design.logo_key || undefined, cta_text: design.cta_text,
        compose_style: design.compose_style,
      };
      if (isNew) {
        const created = await collectionsApi.create(payload as never);
        const failed: string[] = [];
        for (const p of selectedProducts) {
          try { await collectionsApi.addProduct(created.id, p.id); }
          catch { failed.push(p.name || p.id); }
        }
        if (failed.length) {
          showToast('error', `${failed.length} product${failed.length === 1 ? '' : 's'} couldn't be added`, `Collection created, but re-add: ${failed.join(', ')}`);
        } else {
          showToast('success', 'Collection created', name);
        }
      } else {
        await collectionsApi.update(id!, payload as never);
        showToast('success', 'Collection saved', name);
      }
      setBaseline(snap()); // clear dirty so the post-save navigate isn't blocked
      setTimeout(done, 600);
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={inModal ? styles.pageModal : styles.page}>
        {!inModal && <button className={styles.backBtn} onClick={done}><UilAngleLeft size={15}/> Back to Collections</button>}
        <div className={styles.loadError}>{loadError}</div>
      </div>
    );
  }

  return (
    <div className={inModal ? styles.pageModal : styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {!inModal && (
        <button className={styles.backBtn} onClick={done}>
          <UilAngleLeft size={15}/> Back to Collections
        </button>
      )}
      {!inModal && <h1 className={styles.title}>{isNew ? 'Create Collection' : `Edit: ${name}`}</h1>}

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
                  {/* Only `occasion` collections currently render on the storefront — the
                      other types are saved but shown nowhere (verified: every web
                      getCollections() call is type='occasion'). So we offer only Occasion
                      for new/edited collections; a pre-existing legacy type stays selectable
                      (so old rows aren't orphaned) but is clearly marked. P5 can re-enable
                      the rest once they render. */}
                  <select className={styles.select} value={type} onChange={e => setType(e.target.value as typeof type)}>
                    <option value="occasion">Occasion</option>
                    {type !== 'occasion' && (
                      <option value={type}>
                        {({ standard: 'Standard', new_arrivals: 'New Arrivals', featured: 'Featured' } as Record<string, string>)[type] ?? type} (legacy — not shown on storefront)
                      </option>
                    )}
                  </select>
                  <span className={styles.hint}>Only <strong>Occasion</strong> collections appear on the storefront today.</span>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Subtitle <span className={styles.labelHint}>(shown on home screen cards)</span></label>
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
                  <div className={styles.colorRow}>
                    <input type="color" value={bgColor1} onChange={e => setBgColor1(e.target.value)} className={styles.colorSwatch} />
                    <input className={`${styles.input} ${styles.flex1}`} value={bgColor1} onChange={e => setBgColor1(e.target.value)} placeholder="#1F6B4F" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Card Gradient — Color 2</label>
                  <div className={styles.colorRow}>
                    <input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} className={styles.colorSwatch} />
                    <input className={`${styles.input} ${styles.flex1}`} value={bgColor2} onChange={e => setBgColor2(e.target.value)} placeholder="#0D3D2C" />
                  </div>
                </div>
              </div>
              {(type === 'occasion' || type === 'new_arrivals' || type === 'featured') && (
                <div className={styles.previewBox} style={{ background: `linear-gradient(135deg, ${bgColor1}, ${bgColor2})` }}>
                  <div className={styles.previewLabel}>Preview</div>
                  <div className={styles.previewName}>{name || 'Collection Name'}</div>
                  {subtitle && <div className={styles.previewSub}>{subtitle}</div>}
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
                <input ref={bannerInputRef} type="file" accept="image/*" className={styles.hidden}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    setImageUploading(true);
                    try {
                      const key = await uploadToR2(file, 'collections');
                      setCoverImageKey(key);
                      showToast('success', 'Image uploaded');
                    } catch {
                      showToast('error', 'Upload failed', 'Please try again');
                    } finally {
                      setImageUploading(false);
                    }
                  }} />
                {coverImageKey ? (
                  <div className={`${styles.uploadArea} ${styles.uploadAreaRow}`}>
                    {R2_PUBLIC_URL && (
                      <img src={`${R2_PUBLIC_URL}/${coverImageKey}`} alt="Cover"
                        className={styles.coverThumb} />
                    )}
                    <span className={styles.coverKey}>{coverImageKey}</span>
                    <button type="button" onClick={() => setCoverImageKey('')}
                      className={styles.coverRemove}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className={styles.uploadArea}>
                    <span className={styles.uploadIcon}><UilImage size={22}/></span>
                    <span className={styles.uploadText}>Upload banner (1200 × 400px recommended)</span>
                    <button className={styles.uploadBtn} type="button" disabled={imageUploading}
                      onClick={() => bannerInputRef.current?.click()}>
                      {imageUploading ? 'Uploading…' : 'Choose File'}
                    </button>
                  </div>
                )}
              </div>
              {/* "Pin to home screen" (is_featured) toggle removed — the flag renders
                  nowhere on the storefront today (no web surface reads is_featured). The
                  existing value is preserved on save; re-add a real control when a
                  featured rail actually ships (P5). */}
            </div>
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>
              Products in this collection ({selectedProducts.length})
            </h3>
            {/* [CM-21-1] This picker searches the LEGACY `products` table. The catalogue
                the CM actually creates, prices and publishes is a LISTING (design × fabric
                × hub), and listings cannot be added to a collection at all — which is why
                every collection reads PRODUCTS 0 while the storefront sells listings.

                Making collections listing-keyed is the P5 / M5 catalogue cutover, not a
                fix that belongs here: a listing id handed to the customer app's
                /catalog/products/:id would 404, so the whole product-detail path has to
                move with it. Until then the least this screen can do is stop implying
                the two catalogues are one — a CM had no way to tell from this page that
                the thing they were searching is not the thing they sell. */}
            <Alert
              type="warning"
              title="This searches the legacy product catalogue, not your listings"
              message="Listings (design × fabric × hub) — the ones you create and publish on the Listings page — cannot be added to a collection yet. That arrives with the catalogue cutover. Anything added here comes from the older products table."
            />
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

      {/* Collection studio — design the card + landing hero */}
      <div className={`${styles.card} ${styles.studioCard}`}>
        <h3 className={styles.sectionTitle}>Storefront design</h3>
        <p className={styles.studioIntro}>Design how this collection looks as a card (in rails) and as its landing-page hero. Live preview for each.</p>
        <CollectionStudio
          design={design}
          onChange={setDesign}
          name={name}
          subtitle={subtitle}
          onContent={p => { if (p.title !== undefined) handleNameChange(p.title); if (p.subtitle !== undefined) setSubtitle(p.subtitle); }}
          season={season}
          coverUrl={coverImageKey ? (coverImageKey.startsWith('http') ? coverImageKey : `${R2_PUBLIC_URL}/${coverImageKey}`) : ''}
          bgColor1={bgColor1}
          bgColor2={bgColor2}
        />
      </div>

      <div className={styles.saveBar}>
        <button className={styles.cancelBtn} onClick={done}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Create Collection' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
