import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle, Circle, Clock, SkipForward, UserCheck, Save, ChevronDown, ChevronUp, Plus, Trash2, ExternalLink } from 'lucide-react';
import { measurementBookingsApi, garmentTypesApi, fitPreferencesApi } from '../../api/adminApi';
import type { MeasurementBooking, MeasurementBookingItem, GarmentType, FitPreference } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import { StaffAssignmentDropdown } from '../../components/StaffAssignmentDropdown/StaffAssignmentDropdown';
import styles from './AppConfigPage.module.css';

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:     <Circle size={14} style={{ color: 'var(--color-text-tertiary)' }} />,
  in_progress: <Clock size={14} style={{ color: '#F59E0B' }} />,
  completed:   <CheckCircle size={14} style={{ color: '#1C5C42' }} />,
  skipped:     <SkipForward size={14} style={{ color: 'var(--color-text-tertiary)' }} />,
};

const FIT_COLORS: Record<string, { bg: string; color: string }> = {
  slim:    { bg: 'rgba(28,92,66,0.12)',   color: '#1C5C42' },
  regular: { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
  loose:   { bg: 'rgba(212,167,116,0.15)',color: '#b07c35' },
  custom:  { bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
};

const BOOKING_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:       { bg: 'rgba(148,163,184,0.15)', color: '#64748B' },
  confirmed:   { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
  in_progress: { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
  completed:   { bg: 'rgba(28,92,66,0.12)',    color: '#1C5C42' },
  cancelled:   { bg: 'rgba(239,68,68,0.1)',    color: '#EF4444' },
};

// ── Garment Card ─────────────────────────────────────────────────────────────

function GarmentCard({
  item, bookingId, bookingStatus, staffId,
  onUpdate, onDelete, showToast,
}: {
  item: MeasurementBookingItem;
  bookingId: string;
  bookingStatus: string;
  staffId: string | null;
  onUpdate: (updated: MeasurementBookingItem) => void;
  onDelete: (itemId: string) => void;
  showToast: (type: 'success'|'error'|'info'|'warning', title: string, msg?: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [staffNotes, setStaffNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const fields = item.required_measurements ?? [];
  const labels = item.measurement_labels ?? {};
  const guideNotes = item.measurement_guide_notes ?? {};
  const savedData = item.measurements_data ?? {};
  const isFinalized = !!item.finalized_at;
  const hasMeasurements = item.measurement_id != null;

  // Pre-fill form with saved values when expanding
  React.useEffect(() => {
    if (expanded && hasMeasurements) {
      const prefill: Record<string, string> = {};
      for (const f of fields) {
        const v = savedData[f];
        if (v != null) prefill[f] = String(v);
      }
      setForm(prefill);
      setStaffNotes(item.measurement_notes ?? '');
    }
  }, [expanded]);

  const handleSave = async () => {
    const missing = fields.filter(f => {
      const v = parseFloat(form[f] ?? '');
      return isNaN(v) || v <= 0;
    });
    if (missing.length > 0) {
      showToast('warning', `Fill in: ${missing.map(f => labels[f] ?? f).join(', ')}`);
      return;
    }
    const measurements: Record<string, number> = {};
    for (const f of fields) {
      measurements[f] = parseFloat(form[f]);
    }
    setSaving(true);
    try {
      await measurementBookingsApi.saveMeasurements(bookingId, item.id, measurements, staffId ?? undefined, staffNotes || undefined);
      // Refresh item with updated data
      const updatedBooking = await measurementBookingsApi.get(bookingId);
      const updatedItem = updatedBooking.items?.find(i => i.id === item.id);
      if (updatedItem) onUpdate(updatedItem);
      showToast('success', 'Measurements saved');
      setExpanded(false);
    } catch (e) {
      showToast('error', 'Failed to save', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await measurementBookingsApi.finalizeItem(bookingId, item.id);
      const updatedBooking = await measurementBookingsApi.get(bookingId);
      const updatedItem = updatedBooking.items?.find(i => i.id === item.id);
      if (updatedItem) onUpdate(updatedItem);
      showToast('success', `${item.garment_type_name ?? 'Garment'} finalized — profile updated`);
    } catch (e) {
      showToast('error', 'Failed to finalize', e instanceof Error ? e.message : undefined);
    } finally { setFinalizing(false); }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const updated = await measurementBookingsApi.updateItem(bookingId, item.id, { measurement_status: 'skipped' });
      onUpdate(updated);
      showToast('info', 'Garment skipped');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${item.variant_label ?? item.garment_type_name ?? 'garment'} from this booking?`)) return;
    setDeleting(true);
    try {
      await measurementBookingsApi.deleteItem(bookingId, item.id);
      onDelete(item.id);
    } catch (e) {
      showToast('error', 'Cannot delete', e instanceof Error ? e.message : undefined);
    } finally { setDeleting(false); }
  };

  const fitSlug = item.fit_preference_slug ?? item.fit_preference_name?.toLowerCase().split(' ')[0];
  const fitColor = fitSlug ? (FIT_COLORS[fitSlug] ?? FIT_COLORS.regular) : null;
  const canStart = !!staffId && (bookingStatus === 'confirmed' || bookingStatus === 'in_progress' || bookingStatus === 'draft');

  return (
    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--color-bg-secondary)' }}>
      {/* Card header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {STATUS_ICON[item.measurement_status]}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.garment_type_name ?? 'Garment'}</span>
            {item.variant_label && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>— {item.variant_label}</span>
            )}
          </div>
          {item.fit_notes && (
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic', marginTop: 2 }}>"{item.fit_notes}"</div>
          )}
        </div>
        {fitColor && item.fit_preference_name && (
          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: fitColor.bg, color: fitColor.color }}>
            {item.fit_preference_name}
          </span>
        )}
        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
          background: item.measurement_status === 'completed' ? 'rgba(28,92,66,0.12)' :
                      item.measurement_status === 'skipped'   ? 'rgba(148,163,184,0.1)' :
                      item.measurement_status === 'in_progress' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.1)',
          color: item.measurement_status === 'completed' ? '#1C5C42' :
                 item.measurement_status === 'skipped'   ? 'var(--color-text-tertiary)' :
                 item.measurement_status === 'in_progress' ? '#F59E0B' : 'var(--color-text-tertiary)',
        }}>
          {item.measurement_status.replace('_', ' ')}
        </span>
      </div>

      {/* Saved measurements (read-only display) */}
      {hasMeasurements && !expanded && Object.keys(savedData).length > 0 && (
        <div style={{ padding: '0 16px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px 12px', fontSize: 12 }}>
          {fields.map(f => {
            const v = savedData[f];
            if (v == null) return null;
            return (
              <div key={f} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 2 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{(labels[f] ?? f.replace(/_/g, ' ')).replace(' (cm)', '')}</span>
                <span style={{ fontWeight: 600 }}>{v} cm</span>
              </div>
            );
          })}
          {isFinalized && (
            <div style={{ gridColumn: '1 / -1', marginTop: 4, fontSize: 11, color: '#1C5C42', fontWeight: 600 }}>
              ✓ Finalized {item.finalized_at ? new Date(item.finalized_at).toLocaleDateString('en-IN') : ''} · Profile updated
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      {item.measurement_status !== 'skipped' && (
        <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--color-border)' }}>
          {!isFinalized && (
            <button
              className={styles.addBtn}
              style={{ fontSize: 12, height: 30, padding: '0 12px' }}
              disabled={!canStart}
              title={!staffId ? 'Assign staff before taking measurements' : undefined}
              onClick={() => { setExpanded(e => !e); }}
            >
              {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              {expanded ? 'Cancel' : hasMeasurements ? 'Edit' : 'Start'}
            </button>
          )}
          {hasMeasurements && !isFinalized && item.measurement_status === 'in_progress' && (
            <button
              className={styles.addBtn}
              style={{ fontSize: 12, height: 30, padding: '0 12px', background: '#1C5C42' }}
              disabled={finalizing}
              onClick={handleFinalize}
            >
              <CheckCircle size={12}/> {finalizing ? 'Finalizing…' : 'Finalize'}
            </button>
          )}
          {item.measurement_status === 'pending' && !hasMeasurements && (
            <button className={styles.exportBtn} style={{ fontSize: 12, height: 30 }} disabled={saving} onClick={handleSkip}>
              <SkipForward size={12}/> Skip
            </button>
          )}
          {!hasMeasurements && (
            <button className={styles.exportBtn} style={{ fontSize: 12, height: 30, marginLeft: 'auto' }} disabled={deleting} onClick={handleDelete}>
              <Trash2 size={12}/> Remove
            </button>
          )}
        </div>
      )}

      {/* Inline measurement form */}
      {expanded && !isFinalized && (
        <div style={{ padding: 16, borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px', marginBottom: 12 }}>
            {fields.map(f => (
              <div key={f}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                  {labels[f] ?? `${f.replace(/_/g, ' ')} (cm)`}
                </div>
                {guideNotes[f] && (
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4, fontStyle: 'italic' }}>
                    {guideNotes[f]}
                  </div>
                )}
                <input
                  type="number" step="0.5" min="0.5"
                  className={styles.fieldInput}
                  style={{ height: 34, fontSize: 13 }}
                  placeholder="cm"
                  value={form[f] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Staff Notes (optional)</div>
            <textarea
              className={styles.fieldInput}
              rows={2}
              style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              placeholder="e.g. Customer has slightly uneven shoulders, used left side…"
              value={staffNotes}
              onChange={e => setStaffNotes(e.target.value)}
            />
          </div>
          <button className={styles.addBtn} style={{ fontSize: 13 }} disabled={saving} onClick={handleSave}>
            <Save size={13}/> {saving ? 'Saving…' : 'Save Measurements'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add Garment Inline Form ───────────────────────────────────────────────────

function AddGarmentForm({
  bookingId, garmentTypes, fitPreferences, onAdded, onCancel, showToast,
}: {
  bookingId: string;
  garmentTypes: GarmentType[];
  fitPreferences: FitPreference[];
  onAdded: (item: MeasurementBookingItem) => void;
  onCancel: () => void;
  showToast: (type: 'success'|'error'|'info'|'warning', title: string, msg?: string) => void;
}) {
  const [garmentTypeId, setGarmentTypeId] = React.useState('');
  const [variantLabel, setVariantLabel] = React.useState('');
  const [fitPreferenceId, setFitPreferenceId] = React.useState('');
  const [fitNotes, setFitNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const gt = garmentTypes.find(g => g.id === garmentTypeId);

  const handleAdd = async () => {
    if (!garmentTypeId) { showToast('warning', 'Select a garment type'); return; }
    if (!variantLabel.trim()) { showToast('warning', 'Variant label is required'); return; }
    if (!fitPreferenceId) { showToast('warning', 'Select a fit preference'); return; }
    setSaving(true);
    try {
      const item = await measurementBookingsApi.addItem(bookingId, {
        garment_type_id: garmentTypeId,
        variant_label: variantLabel.trim(),
        fit_preference_id: fitPreferenceId,
        fit_notes: fitNotes || undefined,
      });
      onAdded(item);
      showToast('success', 'Garment added to session');
    } catch (e) {
      showToast('error', 'Failed to add', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ border: '1px dashed var(--color-primary)', borderRadius: 10, padding: 16, background: 'rgba(28,92,66,0.03)', marginTop: 10 }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 12 }}>Add Garment to Session</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 10 }}>
        <div>
          <label className={styles.fieldLabel}>Garment Type *</label>
          <select className={styles.fieldSelect} value={garmentTypeId} onChange={e => { setGarmentTypeId(e.target.value); const g = garmentTypes.find(g => g.id === e.target.value); if (g && !variantLabel) setVariantLabel(g.name); }} style={{ width: '100%', height: 36 }}>
            <option value="">— Select —</option>
            {garmentTypes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel}>Variant Label *</label>
          <input className={styles.fieldInput} value={variantLabel} onChange={e => setVariantLabel(e.target.value)} placeholder="e.g. Casual Weekend Shirt" style={{ width: '100%', height: 36 }} />
        </div>
        <div>
          <label className={styles.fieldLabel}>Fit Preference *</label>
          <select className={styles.fieldSelect} value={fitPreferenceId} onChange={e => setFitPreferenceId(e.target.value)} style={{ width: '100%', height: 36 }}>
            <option value="">— Select —</option>
            {fitPreferences.map(fp => <option key={fp.id} value={fp.id}>{fp.name}</option>)}
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel}>Fit Notes (optional)</label>
          <input className={styles.fieldInput} value={fitNotes} onChange={e => setFitNotes(e.target.value)} placeholder="Specific fit instructions…" style={{ width: '100%', height: 36 }} />
        </div>
      </div>
      {gt && (
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
          <span style={{ fontWeight: 600 }}>Fields:</span>{' '}
          {gt.required_measurements.map(f => gt.measurement_labels?.[f]?.replace(' (cm)', '') ?? f).join(', ')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={styles.addBtn} style={{ fontSize: 12 }} disabled={saving} onClick={handleAdd}>
          <Plus size={12}/> {saving ? 'Adding…' : 'Add to Session'}
        </button>
        <button className={styles.exportBtn} style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Detail Page ──────────────────────────────────────────────────────────

export const MeasurementBookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = React.useState<MeasurementBooking | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [garmentTypes, setGarmentTypes] = React.useState<GarmentType[]>([]);
  const [fitPreferences, setFitPreferences] = React.useState<FitPreference[]>([]);
  const [assigning, setAssigning] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [showAddGarment, setShowAddGarment] = React.useState(false);
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notesForm, setNotesForm] = React.useState('');

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(booking?.booking_ref);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([
      measurementBookingsApi.get(id),
      garmentTypesApi.list(),
      fitPreferencesApi.list(),
    ])
      .then(([b, gts, fps]) => {
        setBooking(b);
        setNotesForm(b.admin_notes ?? '');
        setGarmentTypes(gts);
        setFitPreferences(fps);
      })
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAssignStaff = async (staffId: string | null) => {
    if (!booking) return;
    setAssigning(true);
    try {
      const updated = await measurementBookingsApi.assignStaff(booking.id, staffId);
      setBooking(prev => prev ? { ...prev, ...updated, assigned_staff_id: updated.assigned_staff_id, items: prev.items } : prev);
      showToast('success', staffId ? 'Staff assigned' : 'Staff unassigned');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setAssigning(false); }
  };

  const handleComplete = async () => {
    if (!booking) return;
    setCompleting(true);
    try {
      const updated = await measurementBookingsApi.complete(booking.id);
      setBooking(prev => prev ? { ...prev, ...updated, items: prev.items } : prev);
      showToast('success', 'Session completed');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setCompleting(false); }
  };

  const handleSaveNotes = async () => {
    if (!booking) return;
    try {
      const updated = await measurementBookingsApi.update(booking.id, { admin_notes: notesForm });
      setBooking(prev => prev ? { ...prev, admin_notes: updated.admin_notes } : prev);
      setEditingNotes(false);
      showToast('success', 'Notes saved');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    }
  };

  const handleUpdateItem = (updated: MeasurementBookingItem) => {
    setBooking(prev => prev ? { ...prev, items: prev.items?.map(i => i.id === updated.id ? updated : i) } : prev);
  };

  const handleDeleteItem = (itemId: string) => {
    setBooking(prev => prev ? { ...prev, items: prev.items?.filter(i => i.id !== itemId) } : prev);
  };

  const handleItemAdded = (item: MeasurementBookingItem) => {
    setBooking(prev => prev ? { ...prev, items: [...(prev.items ?? []), item] } : prev);
    setShowAddGarment(false);
  };

  if (loading) return <div className={styles.page}><div style={{ textAlign: 'center', padding: 32 }}>Loading…</div></div>;
  if (!booking) return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/measurement-bookings')}><ChevronLeft size={15}/> Back</button>
      <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)' }}>Booking not found.</div>
    </div>
  );

  const items = booking.items ?? [];
  const allDone = items.length > 0 && items.every(i => i.measurement_status === 'completed' || i.measurement_status === 'skipped');
  const completedCount = items.filter(i => i.measurement_status === 'completed').length;
  const skippedCount = items.filter(i => i.measurement_status === 'skipped').length;
  const staffAssigned = !!booking.assigned_staff_id;
  const sc = BOOKING_STATUS_COLORS[booking.status] ?? BOOKING_STATUS_COLORS.confirmed;
  const canAddGarments = ['draft', 'confirmed', 'in_progress'].includes(booking.status);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/measurement-bookings')}><ChevronLeft size={15}/> Back to Bookings</button>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className={styles.title} style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>{booking.booking_ref}</h1>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>
              {booking.status.replace('_', ' ')}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {booking.customer_name}
            {booking.customer_phone && ` · ${booking.customer_phone}`}
            {booking.customer_email && ` · ${booking.customer_email}`}
          </div>
        </div>
        {allDone && booking.status !== 'completed' && (
          <button className={styles.addBtn} style={{ background: '#1C5C42' }} disabled={completing} onClick={handleComplete}>
            <CheckCircle size={14}/> {completing ? 'Completing…' : `Complete Session (${completedCount} done, ${skippedCount} skipped)`}
          </button>
        )}
      </div>

      <div className={styles.twoCol}>
        {/* Main: garment cards */}
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Garments ({items.length})</h3>
              {!staffAssigned && (
                <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 500 }}>← Assign staff to enable measurements</span>
              )}
            </div>

            {items.length === 0 ? (
              <div className={styles.empty}>No garments in this booking. Add one below.</div>
            ) : (
              items.map(item => (
                <GarmentCard
                  key={item.id}
                  item={item}
                  bookingId={booking.id}
                  bookingStatus={booking.status}
                  staffId={booking.assigned_staff_id}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  showToast={showToast}
                />
              ))
            )}

            {/* Add garment mid-session */}
            {canAddGarments && (
              showAddGarment ? (
                <AddGarmentForm
                  bookingId={booking.id}
                  garmentTypes={garmentTypes}
                  fitPreferences={fitPreferences}
                  onAdded={handleItemAdded}
                  onCancel={() => setShowAddGarment(false)}
                  showToast={showToast}
                />
              ) : (
                <button
                  className={styles.exportBtn}
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => setShowAddGarment(true)}
                >
                  <Plus size={13}/> Add Another Garment to This Session
                </button>
              )
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Booking Info */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Booking Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {booking.scheduled_at && (
                <div>
                  <div className={styles.metaLabel}>Scheduled</div>
                  <div className={styles.metaValue}>{new Date(booking.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}
              {booking.home_visit_id && (
                <div>
                  <div className={styles.metaLabel}>Linked Home Visit</div>
                  <button className={styles.linkBtn} style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate(`/admin/home-visits/${booking.home_visit_id}`)}>
                    <ExternalLink size={12}/> View Home Visit
                  </button>
                </div>
              )}
              {booking.source_order_id && (
                <div>
                  <div className={styles.metaLabel}>Source Order</div>
                  <button className={styles.linkBtn} style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate(`/admin/orders/${booking.source_order_id}`)}>
                    <ExternalLink size={12}/> View Order
                  </button>
                </div>
              )}
              {booking.notes && (
                <div>
                  <div className={styles.metaLabel}>Customer Notes</div>
                  <div className={styles.metaValue} style={{ fontStyle: 'italic' }}>{booking.notes}</div>
                </div>
              )}
              <div>
                <div className={styles.metaLabel}>Created</div>
                <div className={styles.metaValue}>{new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>
          </div>

          {/* Staff Assignment */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}><UserCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Staff Assignment</h3>
            <StaffAssignmentDropdown
              value={booking.assigned_staff_id}
              onChange={handleAssignStaff}
              showWorkload
              disabled={assigning}
              placeholder="Assign a staff member…"
            />
          </div>

          {/* Admin Notes */}
          <div className={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Admin Notes</h3>
              {!editingNotes && (
                <button className={styles.exportBtn} style={{ fontSize: 11, height: 26 }} onClick={() => setEditingNotes(true)}>Edit</button>
              )}
            </div>
            {editingNotes ? (
              <>
                <textarea className={styles.fieldInput} rows={3} style={{ width: '100%', fontSize: 12, resize: 'vertical' }} value={notesForm} onChange={e => setNotesForm(e.target.value)} placeholder="Internal notes for the ops team…" />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className={styles.addBtn} style={{ fontSize: 12 }} onClick={handleSaveNotes}><Save size={12}/> Save</button>
                  <button className={styles.exportBtn} style={{ fontSize: 12 }} onClick={() => { setEditingNotes(false); setNotesForm(booking.admin_notes ?? ''); }}>Cancel</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: booking.admin_notes ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontStyle: booking.admin_notes ? 'normal' : 'italic' }}>
                {booking.admin_notes || 'No admin notes'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
