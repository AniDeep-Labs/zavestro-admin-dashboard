import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2, User, Calendar, ClipboardList, CheckCircle } from 'lucide-react';
import { measurementBookingsApi, garmentTypesApi, fitPreferencesApi, customerLookupApi, ordersApi } from '../../api/adminApi';
import type { GarmentType, FitPreference, CustomerLookupResult } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { CustomerQuickLookup } from '../../components/CustomerQuickLookup/CustomerQuickLookup';
import styles from './AppConfigPage.module.css';

interface GarmentRow {
  id: string;
  garment_type_id: string;
  variant_label: string;
  fit_preference_id: string;
  fit_notes: string;
}

const STEPS = ['Customer & Schedule', 'Add Garments', 'Review & Confirm'];

export const MeasurementBookingNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledUserId = searchParams.get('user_id') ?? '';
  const prefilledOrderId = searchParams.get('order_id') ?? '';
  const prefilledScheduledAt = searchParams.get('scheduled_at') ?? '';
  const prefilledHomeVisitId = searchParams.get('home_visit_id') ?? '';

  const [step, setStep] = React.useState(0);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [createdBooking, setCreatedBooking] = React.useState<{ booking_ref: string; id: string } | null>(null);

  // Step 1: Customer & Schedule
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerLookupResult | null>(null);
  const [scheduledDate, setScheduledDate] = React.useState(prefilledScheduledAt ? prefilledScheduledAt.split('T')[0] : '');
  const [scheduledTime, setScheduledTime] = React.useState(prefilledScheduledAt ? prefilledScheduledAt.split('T')[1]?.slice(0, 5) : '');
  const [customerNotes, setCustomerNotes] = React.useState('');

  // Step 2: Garments
  const [garmentTypes, setGarmentTypes] = React.useState<GarmentType[]>([]);
  const [fitPreferences, setFitPreferences] = React.useState<FitPreference[]>([]);
  const [garmentRows, setGarmentRows] = React.useState<GarmentRow[]>([
    { id: crypto.randomUUID(), garment_type_id: '', variant_label: '', fit_preference_id: '', fit_notes: '' },
  ]);

  // Step 3: admin notes
  const [adminNotes, setAdminNotes] = React.useState('');

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  // Load garment types + fit preferences on mount
  React.useEffect(() => {
    Promise.all([garmentTypesApi.list(), fitPreferencesApi.list()])
      .then(([gt, fp]) => { setGarmentTypes(gt); setFitPreferences(fp); })
      .catch(() => showToast('error', 'Failed to load garment types'));
  }, []);

  // Pre-fill customer if user_id provided
  React.useEffect(() => {
    if (!prefilledUserId) return;
    customerLookupApi.search(prefilledUserId)
      .then(results => { if (results[0]) setSelectedCustomer(results[0]); })
      .catch(() => {});
  }, [prefilledUserId]);

  const addGarmentRow = () => {
    setGarmentRows(prev => [...prev, { id: crypto.randomUUID(), garment_type_id: '', variant_label: '', fit_preference_id: '', fit_notes: '' }]);
  };

  const removeGarmentRow = (rowId: string) => {
    if (garmentRows.length === 1) return;
    setGarmentRows(prev => prev.filter(r => r.id !== rowId));
  };

  const updateGarmentRow = (rowId: string, field: keyof GarmentRow, value: string) => {
    setGarmentRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  // Auto-fill variant label when garment type changes and label is empty
  const handleGarmentTypeChange = (rowId: string, typeId: string) => {
    const gt = garmentTypes.find(g => g.id === typeId);
    setGarmentRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const label = r.variant_label || (gt?.name ?? '');
      return { ...r, garment_type_id: typeId, variant_label: label };
    }));
  };

  const validateStep1 = () => {
    if (!selectedCustomer) { showToast('error', 'Select a customer'); return false; }
    if (!scheduledDate) { showToast('error', 'Select a scheduled date'); return false; }
    const d = new Date(scheduledDate);
    if (d < new Date(new Date().toDateString())) { showToast('error', 'Scheduled date cannot be in the past'); return false; }
    return true;
  };

  const validateStep2 = () => {
    for (let i = 0; i < garmentRows.length; i++) {
      const r = garmentRows[i];
      if (!r.garment_type_id) { showToast('error', `Row ${i + 1}: Select a garment type`); return false; }
      if (!r.variant_label.trim()) { showToast('error', `Row ${i + 1}: Variant label is required`); return false; }
      if (!r.fit_preference_id) { showToast('error', `Row ${i + 1}: Select a fit preference`); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      const scheduledAt = scheduledDate
        ? `${scheduledDate}T${scheduledTime || '10:00'}:00+05:30`
        : undefined;

      const result = await measurementBookingsApi.create({
        user_id: selectedCustomer.id,
        home_visit_id: prefilledHomeVisitId || undefined,
        scheduled_at: scheduledAt,
        notes: customerNotes || undefined,
        admin_notes: adminNotes || undefined,
        items: garmentRows.map((r, idx) => ({
          garment_type_id: r.garment_type_id,
          variant_label: r.variant_label.trim(),
          fit_preference_id: r.fit_preference_id,
          fit_notes: r.fit_notes || undefined,
          sort_order: idx,
        })),
      });

      // If launched from an order, auto-link the new booking to that order
      if (prefilledOrderId) {
        try {
          await ordersApi.linkMeasurement(prefilledOrderId, result.booking.id);
        } catch {
          // non-fatal — booking is still created; admin can link manually
        }
      }

      setCreatedBooking({ booking_ref: result.booking.booking_ref, id: result.booking.id });
      showToast('success', `Booking ${result.booking.booking_ref} created`);
    } catch (e) {
      showToast('error', 'Failed to create booking', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (createdBooking) {
    return (
      <div className={styles.page}>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className={styles.card} style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: 40 }}>
          <CheckCircle size={48} style={{ color: '#1C5C42', margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Booking Confirmed</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
            Booking reference: <strong style={{ fontFamily: 'monospace' }}>{createdBooking.booking_ref}</strong>
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13, margin: '0 0 24px' }}>
            {garmentRows.length} garment{garmentRows.length !== 1 ? 's' : ''} booked for {selectedCustomer?.name}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className={styles.addBtn} onClick={() => navigate(`/admin/measurement-bookings/${createdBooking.id}`)}>
              View Booking
            </button>
            <button className={styles.exportBtn} onClick={() => { setCreatedBooking(null); setStep(0); setSelectedCustomer(null); setScheduledDate(''); setScheduledTime(''); setCustomerNotes(''); setAdminNotes(''); setGarmentRows([{ id: crypto.randomUUID(), garment_type_id: '', variant_label: '', fit_preference_id: '', fit_notes: '' }]); }}>
              Book Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/measurement-bookings')}>
          <ChevronLeft size={15} /> Back
        </button>
        <h1 className={styles.title} style={{ margin: 0 }}>New Measurement Booking</h1>
      </div>

      {/* Step progress */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-light)' }}>
        {STEPS.map((label, i) => {
          const icons = [<User size={14} key="u"/>, <ClipboardList size={14} key="c"/>, <CheckCircle size={14} key="ch"/>];
          const active = i === step;
          const done = i < step;
          return (
            <div
              key={i}
              style={{
                flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
                background: active ? 'var(--color-primary)' : done ? 'rgba(28,92,66,0.08)' : 'var(--color-bg-secondary)',
                color: active ? '#fff' : done ? '#1C5C42' : 'var(--color-text-tertiary)',
                borderRight: i < STEPS.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: done ? 'pointer' : 'default',
              }}
              onClick={() => { if (done) setStep(i); }}
            >
              {done ? <CheckCircle size={14} /> : icons[i]}
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Customer & Schedule ── */}
      {step === 0 && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 20 }}>Customer & Schedule</h2>

          {/* Customer search */}
          <div style={{ marginBottom: 20 }}>
            <CustomerQuickLookup
              label="Customer *"
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
              onClear={() => setSelectedCustomer(null)}
            />
          </div>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label className={styles.fieldLabel}>Scheduled Date *</label>
              <input type="date" className={styles.fieldInput} style={{ width: '100%' }} value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className={styles.fieldLabel}>Scheduled Time</label>
              <select className={styles.fieldSelect} style={{ width: '100%', height: 38 }} value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}>
                <option value="">— Select time —</option>
                {Array.from({ length: 22 }, (_, i) => {
                  const h = Math.floor(i / 2) + 9;
                  const m = i % 2 === 0 ? '00' : '30';
                  const hh = h.toString().padStart(2, '0');
                  const label = `${hh}:${m}`;
                  return <option key={label} value={label}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Customer Notes */}
          <div>
            <label className={styles.fieldLabel}>Customer Notes</label>
            <textarea className={styles.fieldInput} rows={3} style={{ width: '100%', resize: 'vertical' }} placeholder="Any special instructions from the customer…" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Step 2: Add Garments ── */}
      {step === 1 && (
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Garments to Measure</h2>
            <button className={styles.addBtn} style={{ fontSize: 12 }} onClick={addGarmentRow}>
              <Plus size={13} /> Add Garment
            </button>
          </div>

          {garmentRows.map((row, idx) => (
            <div key={row.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, padding: 16, marginBottom: 12, background: 'var(--color-bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', minWidth: 28 }}>#{idx + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Garment</span>
                {garmentRows.length > 1 && (
                  <button className={styles.exportBtn} style={{ height: 28, padding: '0 10px', fontSize: 11 }} onClick={() => removeGarmentRow(row.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                <div>
                  <label className={styles.fieldLabel}>Garment Type *</label>
                  <select
                    className={styles.fieldSelect}
                    style={{ width: '100%', height: 36 }}
                    value={row.garment_type_id}
                    onChange={e => handleGarmentTypeChange(row.id, e.target.value)}
                  >
                    <option value="">— Select type —</option>
                    {garmentTypes.map(gt => (
                      <option key={gt.id} value={gt.id}>{gt.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={styles.fieldLabel}>Variant Label * <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(e.g. "Formal Office Shirt")</span></label>
                  <input
                    className={styles.fieldInput}
                    style={{ width: '100%', height: 36 }}
                    placeholder="Give this garment a name…"
                    value={row.variant_label}
                    onChange={e => updateGarmentRow(row.id, 'variant_label', e.target.value)}
                  />
                </div>

                <div>
                  <label className={styles.fieldLabel}>Fit Preference *</label>
                  <select
                    className={styles.fieldSelect}
                    style={{ width: '100%', height: 36 }}
                    value={row.fit_preference_id}
                    onChange={e => updateGarmentRow(row.id, 'fit_preference_id', e.target.value)}
                  >
                    <option value="">— Select fit —</option>
                    {fitPreferences.map(fp => (
                      <option key={fp.id} value={fp.id}>{fp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={styles.fieldLabel}>Fit Notes <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className={styles.fieldInput}
                    style={{ width: '100%', height: 36 }}
                    placeholder="e.g. slightly loose around waist…"
                    value={row.fit_notes}
                    onChange={e => updateGarmentRow(row.id, 'fit_notes', e.target.value)}
                  />
                </div>
              </div>

              {/* Show required measurements preview */}
              {row.garment_type_id && (() => {
                const gt = garmentTypes.find(g => g.id === row.garment_type_id);
                if (!gt) return null;
                return (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span style={{ fontWeight: 600 }}>Measurements to take:</span>{' '}
                    {gt.required_measurements.map(f => gt.measurement_labels?.[f]?.replace(' (cm)', '') ?? f).join(', ')}
                  </div>
                );
              })()}
            </div>
          ))}

          <button className={styles.exportBtn} style={{ width: '100%', marginTop: 4 }} onClick={addGarmentRow}>
            <Plus size={13} /> Add Another Garment
          </button>
        </div>
      )}

      {/* ── Step 3: Review & Confirm ── */}
      {step === 2 && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 20 }}>Review & Confirm</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div className={styles.metaLabel}>Customer</div>
              <div className={styles.metaValue} style={{ fontWeight: 600 }}>{selectedCustomer?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{selectedCustomer?.phone}</div>
            </div>
            <div>
              <div className={styles.metaLabel}>Scheduled</div>
              <div className={styles.metaValue}>
                {scheduledDate ? new Date(scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'}
                {scheduledTime ? ` at ${scheduledTime}` : ''}
              </div>
            </div>
          </div>

          {customerNotes && (
            <div style={{ marginBottom: 20 }}>
              <div className={styles.metaLabel}>Customer Notes</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{customerNotes}</div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div className={styles.metaLabel} style={{ marginBottom: 10 }}>Garments ({garmentRows.length})</div>
            {garmentRows.map((row, idx) => {
              const gt = garmentTypes.find(g => g.id === row.garment_type_id);
              const fp = fitPreferences.find(f => f.id === row.fit_preference_id);
              return (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < garmentRows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', minWidth: 20 }}>#{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{gt?.name ?? '?'}</span>
                    <span style={{ color: 'var(--color-text-secondary)', margin: '0 6px' }}>—</span>
                    <span>{row.variant_label}</span>
                    {row.fit_notes && <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic', marginLeft: 8 }}>"{row.fit_notes}"</span>}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(28,92,66,0.1)', color: '#1C5C42' }}>
                    {fp?.name ?? '?'}
                  </span>
                </div>
              );
            })}
          </div>

          <div>
            <label className={styles.fieldLabel}>Admin Notes <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(internal, optional)</span></label>
            <textarea className={styles.fieldInput} rows={2} style={{ width: '100%', resize: 'vertical' }} placeholder="Internal notes for the ops team…" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button className={styles.exportBtn} disabled={step === 0} onClick={() => setStep(s => s - 1)}>
          <ChevronLeft size={14} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className={styles.addBtn} onClick={handleNext}>
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button className={styles.addBtn} style={{ background: '#1C5C42' }} disabled={saving} onClick={handleSubmit}>
            <Calendar size={14} /> {saving ? 'Creating…' : 'Confirm Booking'}
          </button>
        )}
      </div>
    </div>
  );
};
