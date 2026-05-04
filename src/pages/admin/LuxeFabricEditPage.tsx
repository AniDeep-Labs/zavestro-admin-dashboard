import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Image } from 'lucide-react';
import { luxeFabricsApi } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './LuxeFabricEditPage.module.css';

const MATERIALS = ['Silk', 'Banarasi', 'Organza', 'Handloom', 'Cotton Blend', 'Chiffon', 'Velvet', 'Georgette', 'Crepe', 'Other'];
const OCCASIONS = ['Wedding', 'Festive', 'Formal', 'Celebration'];
const GARMENTS = ['Lehenga', 'Saree Blouse', 'Kurta', 'Kurta Set', 'Sherwani', 'Bandhgala', 'Blouse', 'Top', 'Shirt'];

export const LuxeFabricEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [name, setName] = React.useState('');
  const [material, setMaterial] = React.useState('');
  const [origin, setOrigin] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [careInstructions, setCareInstructions] = React.useState('');
  const [selectedOccasions, setSelectedOccasions] = React.useState<string[]>([]);
  const [selectedGarments, setSelectedGarments] = React.useState<string[]>([]);
  const [colors, setColors] = React.useState('');
  const [status, setStatus] = React.useState<'Draft' | 'Active' | 'Archived'>('Draft');
  const [featuredForSwatchKit, setFeaturedForSwatchKit] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, message?: string) =>
    setToasts(t => [...t, createToast(type, title, message)]);

  React.useEffect(() => {
    if (isNew) return;
    luxeFabricsApi.get(id!)
      .then(f => {
        setName(f.name);
        setMaterial(f.material);
        setOrigin(f.origin);
        setSelectedOccasions(f.occasions);
        setStatus(f.status);
        setFeaturedForSwatchKit(f.featuredForSwatchKit);
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load fabric'));
  }, [id, isNew]);

  const toggleOccasion = (o: string) =>
    setSelectedOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);

  const toggleGarment = (g: string) =>
    setSelectedGarments(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name, material, origin, description,
        care_instructions: careInstructions,
        occasions: selectedOccasions,
        garments: selectedGarments,
        colors: colors.split(',').map(c => c.trim()).filter(Boolean),
        status, featuredForSwatchKit,
      };
      if (isNew) {
        await luxeFabricsApi.create(payload);
        showToast('success', 'Fabric created', name);
      } else {
        await luxeFabricsApi.update(id!, payload);
        showToast('success', 'Fabric saved', name);
      }
      setTimeout(() => navigate('/admin/catalog/luxe-fabrics'), 600);
    } catch (err) {
      showToast('error', 'Save failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/luxe-fabrics')}><ChevronLeft size={15}/> Back to Luxe Fabrics</button>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/luxe-fabrics')}>
        <ChevronLeft size={15}/> Back to Luxe Fabrics
      </button>
      <h1 className={styles.title}>{isNew ? 'Add Fabric' : `Edit: ${name}`}</h1>

      <div className={styles.form}>
        <div className={styles.card}>
          <h3 className={styles.sectionTitle}>Fabric Details</h3>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label}>Fabric Name *</label>
              <input
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Banarasi Silk — Ivory"
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Material Type *</label>
                <select className={styles.select} value={material} onChange={e => setMaterial(e.target.value)}>
                  <option value="">Select material…</option>
                  {MATERIALS.map(m => <option key={m}>{m}</option>)}
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
              <label className={styles.label}>Origin</label>
              <input
                className={styles.input}
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                placeholder="e.g., Varanasi, Uttar Pradesh"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description *</label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Editorial-style description for customers…"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Care Instructions</label>
              <input
                className={styles.input}
                value={careInstructions}
                onChange={e => setCareInstructions(e.target.value)}
                placeholder="e.g., Dry clean only"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Occasion Tags</label>
              <div className={styles.checkChips}>
                {OCCASIONS.map(o => (
                  <label key={o} className={`${styles.checkChip} ${selectedOccasions.includes(o) ? styles.checkChipActive : ''}`}>
                    <input type="checkbox" checked={selectedOccasions.includes(o)} onChange={() => toggleOccasion(o)} />
                    {o}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Garment Compatibility</label>
              <div className={styles.checkChips}>
                {GARMENTS.map(g => (
                  <label key={g} className={`${styles.checkChip} ${selectedGarments.includes(g) ? styles.checkChipActive : ''}`}>
                    <input type="checkbox" checked={selectedGarments.includes(g)} onChange={() => toggleGarment(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Available Colors</label>
              <input
                className={styles.input}
                value={colors}
                onChange={e => setColors(e.target.value)}
                placeholder="Ivory, Gold, Navy (comma separated)"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Images</label>
              <div className={styles.uploadArea}>
                <span className={styles.uploadIcon}><Image size={22}/></span>
                <span className={styles.uploadText}>Upload swatch and garment photos (up to 10 images)</span>
                <button className={styles.uploadBtn} type="button" onClick={() => imageInputRef.current?.click()}>Choose Files</button>
                <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={() => showToast('info', 'Image upload for luxe fabrics coming soon')} />
              </div>
            </div>
            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={featuredForSwatchKit} onChange={e => setFeaturedForSwatchKit(e.target.checked)} />
                Featured for Swatch Kit
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.saveBar}>
        <button className={styles.cancelBtn} onClick={() => navigate('/admin/catalog/luxe-fabrics')}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !name || !material}>
          {saving ? 'Saving…' : isNew ? 'Add Fabric' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
