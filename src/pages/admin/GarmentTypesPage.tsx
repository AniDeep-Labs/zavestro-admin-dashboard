import React from 'react';
import { garmentTypesApi } from '../../api/adminApi';
import type { GarmentType } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AppConfigPage.module.css';
import { UilAngleDown, UilAngleUp, UilEditAlt, UilEye, UilEyeSlash, UilPlus, UilSave, UilTimes } from "@iconscout/react-unicons";

const FIELD_OPTIONS = [
  'shoulder','chest','waist','hip','sleeve_length','neck',
  'shirt_length','kurta_length','blazer_length','sherwani_length',
  'inseam','outseam','thigh','knee','bottom_opening','rise',
  'trouser_length','kameez_length','salwar_waist','salwar_length',
  'lehenga_length','blouse_chest','blouse_shoulder','blouse_length',
  'bicep','wrist','calf',
];

const CATEGORY_LABELS: Record<string, string> = {
  mens: 'Men\'s', womens: 'Women\'s', unisex: 'Unisex',
};

interface EditState {
  name: string;
  category: string;
  sort_order: number;
  required_measurements: string[];
  measurement_labels: Record<string, string>;
  measurement_guide_notes: Record<string, string>;
}

export const GarmentTypesPage: React.FC = () => {
  const [garmentTypes, setGarmentTypes] = React.useState<GarmentType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editState, setEditState] = React.useState<EditState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [newState, setNewState] = React.useState<EditState & { slug: string }>({
    name: '', slug: '', category: 'unisex', sort_order: 0,
    required_measurements: [], measurement_labels: {}, measurement_guide_notes: {},
  });
  const [creatingNew, setCreatingNew] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = () => {
    setLoading(true);
    garmentTypesApi.list(true)
      .then(setGarmentTypes)
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const startEdit = (gt: GarmentType) => {
    setEditingId(gt.id);
    setEditState({
      name: gt.name,
      category: gt.category ?? 'unisex',
      sort_order: gt.sort_order,
      required_measurements: [...gt.required_measurements],
      measurement_labels: { ...(gt.measurement_labels ?? {}) },
      measurement_guide_notes: { ...(gt.measurement_guide_notes ?? {}) },
    });
    setExpandedId(gt.id);
  };

  const cancelEdit = () => { setEditingId(null); setEditState(null); };

  const handleSave = async (id: string) => {
    if (!editState) return;
    setSaving(true);
    try {
      const updated = await garmentTypesApi.update(id, {
        name: editState.name,
        category: editState.category as GarmentType['category'],
        sort_order: editState.sort_order,
        required_measurements: editState.required_measurements,
        measurement_labels: editState.measurement_labels,
        measurement_guide_notes: editState.measurement_guide_notes,
      });
      setGarmentTypes(prev => prev.map(g => g.id === id ? updated : g));
      setEditingId(null);
      setEditState(null);
      showToast('success', 'Saved');
    } catch (e) {
      showToast('error', 'Failed to save', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (gt: GarmentType) => {
    try {
      const updated = await garmentTypesApi.toggleActive(gt.id, !gt.is_active);
      setGarmentTypes(prev => prev.map(g => g.id === gt.id ? updated : g));
      showToast('success', `${gt.name} ${!gt.is_active ? 'activated' : 'deactivated'}`);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    }
  };

  const handleCreateNew = async () => {
    if (!newState.name.trim() || !newState.slug.trim()) {
      showToast('error', 'Name and slug are required');
      return;
    }
    setCreatingNew(true);
    try {
      const created = await garmentTypesApi.create({
        name: newState.name.trim(),
        slug: newState.slug.trim(),
        category: newState.category as GarmentType['category'],
        sort_order: newState.sort_order,
        required_measurements: newState.required_measurements,
        measurement_labels: newState.measurement_labels,
        measurement_guide_notes: newState.measurement_guide_notes,
        is_active: true,
      });
      setGarmentTypes(prev => [...prev, created]);
      setShowNewForm(false);
      setNewState({ name: '', slug: '', category: 'unisex', sort_order: 0, required_measurements: [], measurement_labels: {}, measurement_guide_notes: {} });
      showToast('success', `${created.name} created`);
    } catch (e) {
      showToast('error', 'Failed to create', e instanceof Error ? e.message : undefined);
    } finally { setCreatingNew(false); }
  };

  const toggleField = (state: EditState, field: string): EditState => {
    const has = state.required_measurements.includes(field);
    const next = has
      ? state.required_measurements.filter(f => f !== field)
      : [...state.required_measurements, field];
    return { ...state, required_measurements: next };
  };

  const renderFieldEditor = (
    state: EditState,
    setState: (s: EditState) => void,
    idPrefix: string,
  ) => (
    <div style={{ marginTop: 12 }}>
      <div className={styles.fieldLabel} style={{ marginBottom: 8 }}>Required Measurements</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {FIELD_OPTIONS.map(f => {
          const checked = state.required_measurements.includes(f);
          return (
            <label key={`${idPrefix}-${f}`} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
              borderRadius: 16, border: `1px solid ${checked ? '#1F6B4F' : 'var(--color-border-light)'}`,
              background: checked ? 'rgba(31, 107, 79,0.1)' : 'var(--color-bg-primary)',
              cursor: 'pointer', fontSize: 12, fontWeight: checked ? 600 : 400,
              color: checked ? '#1F6B4F' : 'var(--color-text-secondary)',
            }}>
              <input
                type="checkbox"
                style={{ display: 'none' }}
                checked={checked}
                onChange={() => setState(toggleField(state, f) as typeof state)}
              />
              {f.replace(/_/g, ' ')}
            </label>
          );
        })}
      </div>

      {state.required_measurements.length > 0 && (
        <>
          <div className={styles.fieldLabel} style={{ marginBottom: 8 }}>Labels & Guide Notes per field</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.required_measurements.map(f => (
              <div key={`${idPrefix}-label-${f}`} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 8, alignItems: 'start' }}>
                <div style={{ fontSize: 12, fontWeight: 600, paddingTop: 8 }}>{f.replace(/_/g, ' ')}</div>
                <input
                  className={styles.fieldInput}
                  style={{ height: 32, fontSize: 12 }}
                  placeholder={`Label (e.g. "Chest (cm)")`}
                  value={state.measurement_labels[f] ?? ''}
                  onChange={e => setState({ ...state, measurement_labels: { ...state.measurement_labels, [f]: e.target.value } } as typeof state)}
                />
                <input
                  className={styles.fieldInput}
                  style={{ height: 32, fontSize: 12 }}
                  placeholder={`Guide note (e.g. "Measure around fullest part…")`}
                  value={state.measurement_guide_notes[f] ?? ''}
                  onChange={e => setState({ ...state, measurement_guide_notes: { ...state.measurement_guide_notes, [f]: e.target.value } } as typeof state)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Garment Types</h1>
        <button className={styles.addBtn} onClick={() => setShowNewForm(v => !v)}>
          <UilPlus size={15} /> Add Garment Type
        </button>
      </div>

      {/* New garment type form */}
      {showNewForm && (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <h3 className={styles.sectionTitle}>New Garment Type</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '10px 14px', marginBottom: 10 }}>
            <div>
              <label className={styles.fieldLabel}>Name *</label>
              <input className={styles.fieldInput} value={newState.name} onChange={e => setNewState(s => ({ ...s, name: e.target.value, slug: s.slug || e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="e.g. Shirt" style={{ width: '100%' }} />
            </div>
            <div>
              <label className={styles.fieldLabel}>Slug *</label>
              <input className={styles.fieldInput} value={newState.slug} onChange={e => setNewState(s => ({ ...s, slug: e.target.value }))} placeholder="e.g. shirt" style={{ width: '100%' }} />
            </div>
            <div>
              <label className={styles.fieldLabel}>Category</label>
              <select className={styles.fieldSelect} value={newState.category} onChange={e => setNewState(s => ({ ...s, category: e.target.value }))} style={{ width: '100%', height: 38 }}>
                <option value="mens">Men's</option>
                <option value="womens">Women's</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            <div>
              <label className={styles.fieldLabel}>Order</label>
              <input type="number" className={styles.fieldInput} value={newState.sort_order} onChange={e => setNewState(s => ({ ...s, sort_order: parseInt(e.target.value) || 0 }))} style={{ width: '100%' }} />
            </div>
          </div>
          {renderFieldEditor(newState, (s) => setNewState({ ...s, slug: newState.slug }), 'new')}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className={styles.addBtn} disabled={creatingNew} onClick={handleCreateNew}><UilSave size={13} /> {creatingNew ? 'Creating…' : 'Create'}</button>
            <button className={styles.exportBtn} onClick={() => setShowNewForm(false)}><UilTimes size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {garmentTypes.map(gt => {
            const isEditing = editingId === gt.id;
            const isExpanded = expandedId === gt.id;

            return (
              <div key={gt.id} className={styles.card} style={{ opacity: gt.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    {isEditing && editState ? (
                      <input
                        className={styles.fieldInput}
                        value={editState.name}
                        onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : s)}
                        style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 0 }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{gt.name}</span>
                    )}
                    {' '}
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
                      {CATEGORY_LABELS[gt.category ?? 'unisex']}
                    </span>
                    {!gt.is_active && (
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'rgba(215, 91, 91,0.1)', color: '#D75B5B', marginLeft: 6 }}>Inactive</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    {gt.required_measurements.length} fields
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!isEditing && (
                      <button className={styles.exportBtn} style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => startEdit(gt)}>
                        <UilEditAlt size={12} /> Edit
                      </button>
                    )}
                    <button className={styles.exportBtn} style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => handleToggleActive(gt)}>
                      {gt.is_active ? <UilEyeSlash size={12} /> : <UilEye size={12} />}
                      {gt.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className={styles.exportBtn} style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => setExpandedId(v => v === gt.id ? null : gt.id)}>
                      {isExpanded ? <UilAngleUp size={12} /> : <UilAngleDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div style={{ marginTop: 14 }}>
                    {isEditing && editState ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label className={styles.fieldLabel}>Category</label>
                            <select className={styles.fieldSelect} value={editState.category} onChange={e => setEditState(s => s ? { ...s, category: e.target.value } : s)} style={{ width: '100%', height: 36 }}>
                              <option value="mens">Men's</option>
                              <option value="womens">Women's</option>
                              <option value="unisex">Unisex</option>
                            </select>
                          </div>
                          <div>
                            <label className={styles.fieldLabel}>Order</label>
                            <input type="number" className={styles.fieldInput} value={editState.sort_order} onChange={e => setEditState(s => s ? { ...s, sort_order: parseInt(e.target.value) || 0 } : s)} style={{ width: '100%' }} />
                          </div>
                        </div>
                        {renderFieldEditor(editState, (s) => setEditState(s), `edit-${gt.id}`)}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                          <button className={styles.addBtn} disabled={saving} onClick={() => handleSave(gt.id)}><UilSave size={13} /> {saving ? 'Saving…' : 'Save'}</button>
                          <button className={styles.exportBtn} onClick={cancelEdit}><UilTimes size={13} /> Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div>
                        <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>Fields & Labels</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {gt.required_measurements.map(f => (
                            <span key={f} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, background: 'rgba(31, 107, 79,0.08)', color: '#1F6B4F', fontWeight: 500 }}>
                              {gt.measurement_labels?.[f] ?? f.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
