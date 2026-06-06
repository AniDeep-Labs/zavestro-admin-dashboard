import React from 'react';
import { categoriesAdminApi, uploadToR2, R2_PUBLIC_URL } from '../../api/adminApi';
import type { ProductCategory } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AppConfigPage.module.css';
import { UilTimes, UilUpload } from "@iconscout/react-unicons";

const MODE_LABEL: Record<string, string> = {
  simplified:     'Simplified',
  premium_custom: 'Premium',
  both:           'Both',
};

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [loading, setLoading]       = React.useState(true);
  const [uploading, setUploading]   = React.useState<string | null>(null); // category id being uploaded
  const [toasts, setToasts]         = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    categoriesAdminApi.list()
      .then(setCategories)
      .catch(e => showToast('error', 'Failed to load categories', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (cat: ProductCategory, file: File) => {
    setUploading(cat.id);
    try {
      const imageKey = await uploadToR2(file, 'categories');
      const updated  = await categoriesAdminApi.updateImage(cat.id, imageKey);
      setCategories(prev => prev.map(c => c.id === cat.id ? updated : c));
      showToast('success', `Image updated for ${cat.name}`);
    } catch (e) {
      showToast('error', 'Upload failed', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (cat: ProductCategory) => {
    setUploading(cat.id);
    try {
      const updated = await categoriesAdminApi.updateImage(cat.id, null);
      setCategories(prev => prev.map(c => c.id === cat.id ? updated : c));
      showToast('success', `Image removed from ${cat.name}`);
    } catch (e) {
      showToast('error', 'Remove failed', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Categories</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
          Upload a cover image for each category. Shown in the customer app.
        </p>
      </div>

      {loading ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)' }}>
          Loading…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map(cat => {
            const isUploading = uploading === cat.id;
            const imageUrl    = cat.image_url;
            const fileRef     = React.createRef<HTMLInputElement>();

            return (
              <div key={cat.id} className={styles.card} style={{ opacity: cat.is_active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

                  {/* Thumbnail */}
                  <div style={{
                    width: 56, height: 72, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={cat.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>No img</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.name}</span>
                      <span style={{
                        fontSize: 11, padding: '1px 7px', borderRadius: 8,
                        background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)',
                      }}>
                        {cat.slug}
                      </span>
                      {cat.mode && (
                        <span style={{
                          fontSize: 11, padding: '1px 7px', borderRadius: 8,
                          background: 'rgba(31, 107, 79,0.1)', color: '#1F6B4F', fontWeight: 500,
                        }}>
                          {MODE_LABEL[cat.mode] ?? cat.mode}
                        </span>
                      )}
                      {!cat.is_active && (
                        <span style={{
                          fontSize: 11, padding: '1px 7px', borderRadius: 8,
                          background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                        }}>Inactive</span>
                      )}
                    </div>
                    {imageUrl && R2_PUBLIC_URL && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.image_url}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(cat, file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      className={styles.addBtn}
                      style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                      disabled={isUploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      <UilUpload size={13} />
                      {isUploading ? 'Uploading…' : imageUrl ? 'Replace' : 'Upload'}
                    </button>
                    {imageUrl && (
                      <button
                        className={styles.exportBtn}
                        style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                        disabled={isUploading}
                        onClick={() => handleRemove(cat)}
                      >
                        <UilTimes size={13} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
