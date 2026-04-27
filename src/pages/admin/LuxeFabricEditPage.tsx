import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { luxeFabrics } from '../../data/adminMockData';
import styles from './LuxeFabricEditPage.module.css';

const MATERIALS = ['Silk', 'Banarasi', 'Organza', 'Handloom', 'Cotton Blend', 'Chiffon', 'Velvet', 'Georgette', 'Crepe', 'Other'];
const OCCASIONS = ['Wedding', 'Festive', 'Formal', 'Celebration'];
const GARMENTS = ['Lehenga', 'Saree Blouse', 'Kurta', 'Kurta Set', 'Sherwani', 'Bandhgala', 'Blouse', 'Top', 'Shirt'];

export const LuxeFabricEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const existing = isNew ? null : luxeFabrics.find(f => f.id === id) || luxeFabrics[0];

  const [name, setName] = React.useState(existing?.name || '');
  const [material, setMaterial] = React.useState(existing?.material || '');
  const [origin, setOrigin] = React.useState(existing?.origin || '');
  const [description, setDescription] = React.useState('');
  const [careInstructions, setCareInstructions] = React.useState('');
  const [selectedOccasions, setSelectedOccasions] = React.useState<string[]>(existing?.occasions || []);
  const [selectedGarments, setSelectedGarments] = React.useState<string[]>([]);
  const [colors, setColors] = React.useState('');
  const [status, setStatus] = React.useState<'Draft' | 'Active' | 'Archived'>(existing?.status || 'Draft');
  const [featuredForSwatchKit, setFeaturedForSwatchKit] = React.useState(existing?.featuredForSwatchKit || false);
  const [saving, setSaving] = React.useState(false);

  const toggleOccasion = (o: string) =>
    setSelectedOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);

  const toggleGarment = (g: string) =>
    setSelectedGarments(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); navigate('/admin/catalog/luxe-fabrics'); }, 800);
  };

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/catalog/luxe-fabrics')}>
        ← Back to Luxe Fabrics
      </button>
      <h1 className={styles.title}>{isNew ? 'Add Fabric' : `Edit: ${existing?.name}`}</h1>

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
                <span className={styles.uploadIcon}>🖼</span>
                <span className={styles.uploadText}>Upload swatch and garment photos (up to 10 images)</span>
                <button className={styles.uploadBtn} type="button">Choose Files</button>
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
