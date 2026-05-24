import React from 'react';
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { bannersApi } from '../../api/adminApi';
import type { Banner, BannerPayload } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './PromoCodesPage.module.css';

// ─── Banner form ──────────────────────────────────────────────────────────────

function BannerForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: BannerPayload & { id?: string };
  onSave: (data: BannerPayload) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle]         = React.useState(initial.title ?? '');
  const [subtitle, setSubtitle]   = React.useState(initial.subtitle ?? '');
  const [tag, setTag]             = React.useState(initial.tag ?? '');
  const [ctaText, setCtaText]     = React.useState(initial.cta_text ?? 'Shop Now');
  const [ctaLink, setCtaLink]     = React.useState(initial.cta_link ?? '/categories');
  const [bgColor1, setBgColor1]   = React.useState(initial.bg_color_1 ?? '#1C5C42');
  const [bgColor2, setBgColor2]   = React.useState(initial.bg_color_2 ?? '#0D3D2C');
  const [sortOrder, setSortOrder] = React.useState(String(initial.sort_order ?? 0));
  const [isActive, setIsActive]   = React.useState(initial.is_active ?? true);
  const [startsAt, setStartsAt]   = React.useState(initial.starts_at ? initial.starts_at.slice(0, 10) : '');
  const [endsAt, setEndsAt]       = React.useState(initial.ends_at ? initial.ends_at.slice(0, 10) : '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      tag: tag.trim() || undefined,
      cta_text: ctaText.trim(),
      cta_link: ctaLink.trim(),
      bg_color_1: bgColor1,
      bg_color_2: bgColor2,
      sort_order: parseInt(sortOrder, 10) || 0,
      is_active: isActive,
      starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
      ends_at:   endsAt   ? new Date(endsAt).toISOString()   : undefined,
    });
  };

  return (
    <form onSubmit={submit} className={styles.fields} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Headline *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} placeholder="e.g. Made to\nMeasure." />
        <span style={hintStyle}>Use \n for line break in the app</span>
      </div>
      <div>
        <label style={labelStyle}>Subtitle</label>
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} style={inputStyle} placeholder="e.g. Shirts stitched to your exact body" />
      </div>
      <div>
        <label style={labelStyle}>Tag chip (optional)</label>
        <input value={tag} onChange={e => setTag(e.target.value)} style={inputStyle} placeholder="e.g. New Arrivals" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>CTA Text</label>
          <input value={ctaText} onChange={e => setCtaText(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>CTA Link</label>
          <input value={ctaLink} onChange={e => setCtaLink(e.target.value)} style={inputStyle} placeholder="/categories" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Background Color 1</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={bgColor1} onChange={e => setBgColor1(e.target.value)} style={{ width: 44, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
            <input value={bgColor1} onChange={e => setBgColor1(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Background Color 2</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} style={{ width: 44, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
            <input value={bgColor2} onChange={e => setBgColor2(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>
      </div>
      {/* Preview */}
      <div style={{ borderRadius: 12, padding: '20px 24px', background: `linear-gradient(135deg, ${bgColor1}, ${bgColor2})`, color: '#fff', minHeight: 90 }}>
        {tag && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: 100 }}>{tag}</span>}
        <p style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px', whiteSpace: 'pre-line' }}>{title || 'Headline'}</p>
        <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>{subtitle || 'Subtitle'}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
        <div>
          <label style={labelStyle}>Start Date (optional)</label>
          <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>End Date (optional)</label>
          <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Order</label>
          <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={inputStyle} min={0} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
        Active (visible in app)
      </label>
      <div className={styles.modalActions}>
        <button type="button" onClick={onCancel} className={styles.cancelModalBtn}>Cancel</button>
        <button type="submit" disabled={saving} className={styles.saveModalBtn}>
          {saving ? 'Saving…' : (initial.id ? 'Save Changes' : 'Create Banner')}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' };
const inputStyle: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: 'var(--font-family)', boxSizing: 'border-box', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' };
const hintStyle: React.CSSProperties  = { fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3, display: 'block' };

// ─── Main page ────────────────────────────────────────────────────────────────

export const BannersPage: React.FC = () => {
  const [banners, setBanners]     = React.useState<Banner[]>([]);
  const [loading, setLoading]     = React.useState(true);
  const [modal, setModal]         = React.useState<Banner | 'new' | null>(null);
  const [saving, setSaving]       = React.useState(false);
  const [deleting, setDeleting]   = React.useState<string | null>(null);
  const [toasts, setToasts]       = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = () => {
    setLoading(true);
    bannersApi.list()
      .then(data => setBanners(Array.isArray(data) ? data : []))
      .catch(() => showToast('error', 'Failed to load banners'))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const handleSave = async (data: BannerPayload) => {
    setSaving(true);
    try {
      if (modal === 'new') {
        await bannersApi.create(data);
        showToast('success', 'Banner created');
      } else if (modal && modal !== 'new') {
        await bannersApi.update(modal.id, data);
        showToast('success', 'Banner updated');
      }
      setModal(null);
      load();
    } catch {
      showToast('error', 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    setDeleting(id);
    try {
      await bannersApi.delete(id);
      showToast('success', 'Banner deleted');
      load();
    } catch {
      showToast('error', 'Failed to delete banner');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (b: Banner) => {
    try {
      await bannersApi.update(b.id, { is_active: !b.is_active });
      setBanners(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !x.is_active } : x));
    } catch {
      showToast('error', 'Failed to update banner');
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Hero Banners</h1>
        <button className={styles.addBtn} onClick={() => setModal('new')}>
          <Plus size={16} /> Add Banner
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
        Banners appear as the auto-scrolling hero carousel on the app home screen. Ordered by sort order (lowest first).
      </p>

      <div className={styles.card}>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 32 }}>Loading…</p>
        ) : banners.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 32 }}>
            No banners yet. Add one to get started.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Preview</th>
                <th>Headline</th>
                <th>CTA</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b.id}>
                  <td style={{ color: 'var(--color-text-tertiary)', width: 32 }}>
                    <GripVertical size={14} />
                    <span style={{ display: 'block', fontSize: 11 }}>{b.sort_order}</span>
                  </td>
                  <td>
                    <div style={{
                      width: 100, height: 52, borderRadius: 8,
                      background: `linear-gradient(135deg, ${b.bg_color_1 || '#1C5C42'}, ${b.bg_color_2 || '#0D3D2C'})`,
                      display: 'flex', alignItems: 'flex-end', padding: '6px 8px',
                    }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.2 }}>
                        {b.title}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.title}</div>
                    {b.subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{b.subtitle}</div>}
                    {b.tag && <span style={{ fontSize: 11, background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-tertiary)' }}>{b.tag}</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <div>{b.cta_text}</div>
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{b.cta_link}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    {b.starts_at ? new Date(b.starts_at).toLocaleDateString('en-IN') : '—'} →{' '}
                    {b.ends_at   ? new Date(b.ends_at).toLocaleDateString('en-IN')   : 'always'}
                  </td>
                  <td>
                    <button onClick={() => handleToggle(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: b.is_active ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
                      {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      <span style={{ fontSize: 12, marginLeft: 4 }}>{b.is_active ? 'Active' : 'Hidden'}</span>
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal(b)} style={iconBtnStyle} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id} style={{ ...iconBtnStyle, color: 'var(--color-error)' }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className={styles.modal} style={{ maxWidth: 580 }}>
            <h2 className={styles.modalTitle}>{modal === 'new' ? 'Add Banner' : 'Edit Banner'}</h2>
            <BannerForm
              initial={modal === 'new' ? {} : modal}
              onSave={handleSave}
              onCancel={() => setModal(null)}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--color-text-secondary)',
};
