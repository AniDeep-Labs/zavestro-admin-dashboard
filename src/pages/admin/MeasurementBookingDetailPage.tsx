import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle, Circle, Clock, SkipForward, UserCheck, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { measurementBookingsApi, usersApi } from '../../api/adminApi';
import type { MeasurementBooking, MeasurementBookingItem, HubStaff } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './AppConfigPage.module.css';

const MEASUREMENT_STATUS_ICON = {
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

function GarmentCard({
  item,
  bookingId,
  bookingStatus,
  staffAssigned,
  onUpdate,
  showToast,
}: {
  item: MeasurementBookingItem;
  bookingId: string;
  bookingStatus: string;
  staffAssigned: boolean;
  onUpdate: (updated: MeasurementBookingItem) => void;
  showToast: (type: 'success'|'error'|'info'|'warning', title: string, msg?: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const fields = item.required_measurements ?? [];
  const ms = item.measurements;

  const handleSave = async () => {
    const measurements: Record<string, number> = {};
    for (const f of fields) {
      const v = parseFloat(form[f] ?? '');
      if (!isNaN(v) && v > 0) measurements[f] = v;
    }
    setSaving(true);
    try {
      await measurementBookingsApi.saveMeasurements(bookingId, item.id, measurements);
      const updated = await measurementBookingsApi.updateItem(bookingId, item.id, { measurement_status: 'in_progress' });
      onUpdate(updated);
      showToast('success', 'Measurements saved');
      setExpanded(false);
    } catch (e) {
      showToast('error', 'Failed to save', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    setSaving(true);
    try {
      const updated = await measurementBookingsApi.updateItem(bookingId, item.id, { measurement_status: 'completed' });
      onUpdate(updated);
      showToast('success', `${item.garment_type_name ?? 'Garment'} finalized`);
    } catch (e) {
      showToast('error', 'Failed to finalize', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
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

  const fitColor = item.fit_preference_name
    ? (FIT_COLORS[item.fit_preference_name.toLowerCase().replace(' ', '_')] ?? FIT_COLORS.regular)
    : null;

  const canStart = staffAssigned && (bookingStatus === 'confirmed' || bookingStatus === 'in_progress');

  return (
    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, padding: 16, background: 'var(--color-bg-secondary)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span>{MEASUREMENT_STATUS_ICON[item.measurement_status]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.garment_type_name ?? 'Garment'}</div>
          {item.variant_label && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.variant_label}</div>}
        </div>
        {fitColor && item.fit_preference_name && (
          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: fitColor.bg, color: fitColor.color }}>
            {item.fit_preference_name}
          </span>
        )}
        <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
          background: item.measurement_status === 'completed' ? 'rgba(28,92,66,0.12)' : item.measurement_status === 'skipped' ? 'rgba(148,163,184,0.1)' : 'rgba(245,158,11,0.12)',
          color: item.measurement_status === 'completed' ? '#1C5C42' : item.measurement_status === 'skipped' ? 'var(--color-text-tertiary)' : '#F59E0B' }}>
          {item.measurement_status.replace('_', ' ')}
        </span>
      </div>

      {item.fit_notes && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: 8 }}>"{item.fit_notes}"</div>
      )}

      {/* Show saved measurements in read-only grid if completed */}
      {item.measurement_status === 'completed' && ms && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 12px', marginBottom: 8, fontSize: 12 }}>
          {fields.map(f => {
            const v = ms[f as keyof typeof ms];
            if (v == null) return null;
            return (
              <div key={f} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 2 }}>
                <span style={{ color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{f.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{String(v)} cm</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      {item.measurement_status !== 'completed' && item.measurement_status !== 'skipped' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className={styles.addBtn}
            style={{ fontSize: 12, height: 30, padding: '0 12px' }}
            disabled={!canStart}
            title={!staffAssigned ? 'Assign staff before starting measurements' : !canStart ? 'Confirm the visit before taking measurements' : undefined}
            onClick={() => { setExpanded(e => !e); setForm({}); }}
          >
            {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {expanded ? 'Cancel' : 'Start Measurement'}
          </button>
          {item.measurement_status === 'in_progress' && (
            <button className={styles.addBtn} style={{ fontSize: 12, height: 30, padding: '0 12px', background: '#1C5C42' }} disabled={saving} onClick={handleFinalize}>
              <CheckCircle size={12}/> Finalize
            </button>
          )}
          <button className={styles.exportBtn} style={{ fontSize: 12, height: 30 }} disabled={saving} onClick={handleSkip}>
            Skip
          </button>
        </div>
      )}

      {/* Inline measurement form */}
      {expanded && (
        <div style={{ marginTop: 14, padding: 14, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', marginBottom: 12 }}>
            {fields.map(f => (
              <div key={f}>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'capitalize', marginBottom: 2 }}>{f.replace(/_/g, ' ')} (cm)</div>
                <input
                  type="number" step="0.5" min="1"
                  className={styles.fieldInput}
                  style={{ height: 34, fontSize: 13 }}
                  placeholder="—"
                  value={form[f] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button className={styles.addBtn} style={{ fontSize: 13 }} disabled={saving} onClick={handleSave}>
            <Save size={13}/> {saving ? 'Saving…' : 'Save Measurements'}
          </button>
        </div>
      )}
    </div>
  );
}

export const MeasurementBookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = React.useState<MeasurementBooking | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [staffList, setStaffList] = React.useState<HubStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = React.useState('');
  const [assigning, setAssigning] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(booking?.booking_ref);

  React.useEffect(() => {
    if (!id) return;
    measurementBookingsApi.get(id)
      .then(b => {
        setBooking(b);
        setSelectedStaff(b.assigned_staff_id ?? '');
        // Load staff if we can determine the hub via home_visit
        return usersApi.list({ limit: 1 }); // placeholder — staff loaded via hub
      })
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  // Load hubs' staff for assignment
  React.useEffect(() => {
    if (!booking?.home_visit_id) return;
    // We don't know hub_id directly from booking, try listing all staff via a broad search
    // In a full implementation, booking would carry hub_id
    setStaffList([]);
  }, [booking?.home_visit_id]);

  const handleAssignStaff = async () => {
    if (!booking || !selectedStaff) return;
    setAssigning(true);
    try {
      const updated = await measurementBookingsApi.assignStaff(booking.id, selectedStaff);
      setBooking(updated);
      showToast('success', 'Staff assigned');
    } catch (e) {
      showToast('error', 'Failed to assign', e instanceof Error ? e.message : undefined);
    } finally { setAssigning(false); }
  };

  const handleComplete = async () => {
    if (!booking) return;
    setCompleting(true);
    try {
      const updated = await measurementBookingsApi.complete(booking.id);
      setBooking(updated);
      showToast('success', 'Session completed');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setCompleting(false); }
  };

  const handleUpdateItem = (updated: MeasurementBookingItem) => {
    setBooking(prev => prev ? {
      ...prev,
      items: prev.items?.map(i => i.id === updated.id ? updated : i),
    } : prev);
  };

  if (loading) return <div className={styles.page}><div>Loading…</div></div>;
  if (!booking) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/measurement-bookings')}><ChevronLeft size={15}/> Back</button><div>Booking not found.</div></div>;

  const items = booking.items ?? [];
  const allDone = items.length > 0 && items.every(i => i.measurement_status === 'completed' || i.measurement_status === 'skipped');
  const staffAssigned = !!booking.assigned_staff_id;

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    confirmed:   { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
    in_progress: { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B' },
    completed:   { bg: 'rgba(28,92,66,0.12)',    color: '#1C5C42' },
    cancelled:   { bg: 'rgba(239,68,68,0.1)',    color: '#EF4444' },
  };
  const sc = STATUS_COLORS[booking.status] ?? STATUS_COLORS.confirmed;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/measurement-bookings')}><ChevronLeft size={15}/> Back to Bookings</button>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>{booking.booking_ref}</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {booking.customer_name} · {booking.customer_phone}
          </div>
        </div>
        <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: sc.bg, color: sc.color }}>
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.main}>
          {/* Garment cards */}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Garments ({items.length})</h3>
              {!staffAssigned && (
                <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 500 }}>Assign staff to enable measurements</span>
              )}
            </div>

            {items.length === 0 ? (
              <div className={styles.empty}>No garments in this booking.</div>
            ) : (
              items.map(item => (
                <GarmentCard
                  key={item.id}
                  item={item}
                  bookingId={booking.id}
                  bookingStatus={booking.status}
                  staffAssigned={staffAssigned}
                  onUpdate={handleUpdateItem}
                  showToast={showToast}
                />
              ))
            )}

            {allDone && booking.status !== 'completed' && (
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(28,92,66,0.08)', borderRadius: 8, border: '1px solid rgba(28,92,66,0.2)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontWeight: 600, color: '#1C5C42' }}>All garments measured!</p>
                <button className={styles.addBtn} style={{ background: '#1C5C42' }} disabled={completing} onClick={handleComplete}>
                  <CheckCircle size={14}/> {completing ? 'Completing…' : 'Complete Session'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Booking Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {booking.scheduled_at && (
                <div>
                  <div className={styles.metaLabel}>Scheduled</div>
                  <div className={styles.metaValue}>{new Date(booking.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}
              {booking.source_order_id && (
                <div>
                  <div className={styles.metaLabel}>Linked Order</div>
                  <button className={styles.linkBtn} onClick={() => navigate(`/admin/orders/${booking.source_order_id}`)}>View Order →</button>
                </div>
              )}
              {booking.notes && (
                <div>
                  <div className={styles.metaLabel}>Notes</div>
                  <div className={styles.metaValue} style={{ fontStyle: 'italic' }}>{booking.notes}</div>
                </div>
              )}
              <div>
                <div className={styles.metaLabel}>Created</div>
                <div className={styles.metaValue}>{new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}><UserCheck size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Staff Assignment</h3>
            {staffList.length > 0 ? (
              <>
                <select
                  className={styles.fieldSelect}
                  value={selectedStaff}
                  onChange={e => setSelectedStaff(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">— Unassign —</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                </select>
                <button className={styles.addBtn} style={{ width: '100%' }} disabled={assigning} onClick={handleAssignStaff}>
                  {assigning ? 'Assigning…' : 'Assign Staff'}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {booking.assigned_staff_name
                  ? <span style={{ fontWeight: 600 }}>Assigned: {booking.assigned_staff_name}</span>
                  : 'No staff assigned. Link this booking to a home visit with an assigned hub to enable staff selection.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
