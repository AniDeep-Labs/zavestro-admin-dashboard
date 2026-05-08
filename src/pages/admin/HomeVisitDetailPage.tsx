import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, User, Clock, Building2, FileText, UserCheck, Calendar, Ruler, ClipboardList, ExternalLink, Link } from 'lucide-react';
import { homeVisitsApi, hubsApi } from '../../api/adminApi';
import type { HomeVisit, BodyMeasurement, Hub } from '../../api/adminApi';
import { StaffAssignmentDropdown } from '../../components/StaffAssignmentDropdown/StaffAssignmentDropdown';

// Minimal inline type for linked booking info
interface LinkedBooking {
  id: string;
  booking_ref: string;
  status: string;
  item_count: number;
  completed_count: number;
  assigned_staff_name: string | null;
}
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import { useBreadcrumbTitle } from '../../contexts/BreadcrumbContext';
import styles from './OrderDetailPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_confirmation: 'Pending Confirmation',
  confirmed: 'Confirmed',
  staff_assigned: 'Staff Assigned',
  ongoing: 'Ongoing',
  measurement_taken: 'Measurement Taken',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_CSS: Record<string, string> = {
  pending: 'stageWarning',
  pending_confirmation: 'stageWarning',
  confirmed: 'stageBlue',
  staff_assigned: 'stageBlue',
  ongoing: 'stageBlue',
  measurement_taken: 'stageSuccess',
  completed: 'stageSuccess',
  cancelled: 'stageNeutral',
};

const VALID_STATUSES = ['pending', 'pending_confirmation', 'confirmed', 'staff_assigned', 'ongoing', 'measurement_taken', 'completed', 'cancelled'];

const MEASUREMENT_FIELDS: { key: keyof BodyMeasurement; label: string }[] = [
  { key: 'chest',          label: 'Chest' },
  { key: 'waist',          label: 'Waist' },
  { key: 'hips',           label: 'Hips' },
  { key: 'shoulders',      label: 'Shoulders' },
  { key: 'sleeve_length',  label: 'Sleeve Length' },
  { key: 'neck',           label: 'Neck' },
  { key: 'inseam',         label: 'Inseam' },
  { key: 'thigh',          label: 'Thigh' },
  { key: 'calf',           label: 'Calf' },
  { key: 'bicep',          label: 'Bicep' },
  { key: 'wrist',          label: 'Wrist' },
  { key: 'shirt_length',   label: 'Shirt Length' },
  { key: 'kurta_length',   label: 'Kurta Length' },
  { key: 'trouser_length', label: 'Trouser Length' },
];

export const HomeVisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [visit, setVisit] = React.useState<HomeVisit | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Hub assignment
  const [allHubs, setAllHubs] = React.useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubId] = React.useState('');
  const [assigningHub, setAssigningHub] = React.useState(false);
  const [showHubPicker, setShowHubPicker] = React.useState(false);

  // Assign staff
  const [assigning, setAssigning] = React.useState(false);

  // Reschedule
  const [rescheduleDate, setRescheduleDate] = React.useState('');
  const [rescheduleTime, setRescheduleTime] = React.useState('');
  const [rescheduling, setRescheduling] = React.useState(false);

  // Measurements
  const [measurements, setMeasurements] = React.useState<BodyMeasurement[]>([]);
  const [measurementsLoaded, setMeasurementsLoaded] = React.useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = React.useState(false);
  const [showRecordForm, setShowRecordForm] = React.useState(false);
  const [recordForm, setRecordForm] = React.useState<Record<string, string>>({});
  const [savingMeasurements, setSavingMeasurements] = React.useState(false);

  // Linked measurement booking
  const [linkedBooking, setLinkedBooking] = React.useState<LinkedBooking | null | undefined>(undefined);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(visit?.customer_name ? `Visit – ${visit.customer_name}` : undefined);

  React.useEffect(() => {
    hubsApi.list({ limit: 100 }).then(r => setAllHubs(r.hubs.filter(h => h.status === 'Active'))).catch(() => {});
    homeVisitsApi.get(id!)
      .then(v => {
        setVisit(v);
        const dt = new Date(v.scheduled_at);
        setRescheduleDate(dt.toISOString().slice(0, 10));
        setRescheduleTime(dt.toTimeString().slice(0, 5));
        // Load linked measurement booking
        fetch(`/api/admin/home-visits/${id}/measurement-booking`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
        })
          .then(r => r.json())
          .then(r => setLinkedBooking(r.data ?? null))
          .catch(() => setLinkedBooking(null));
      })
      .catch(e => showToast('error', 'Failed to load visit', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!visit || updating) return;
    setUpdating(true);
    try {
      const updated = await homeVisitsApi.updateStatus(visit.id, newStatus);
      setVisit(prev => prev ? { ...prev, status: updated.status } : prev);
      showToast('success', 'Status updated', STATUS_LABELS[newStatus]);
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignHub = async () => {
    if (!visit || !selectedHubId || assigningHub) return;
    setAssigningHub(true);
    try {
      const updated = await homeVisitsApi.assignHub(visit.id, selectedHubId);
      setVisit(updated);
      setShowHubPicker(false);
      setSelectedHubId('');
      showToast('success', 'Hub assigned', updated.hub_name ?? undefined);
    } catch (e) {
      showToast('error', 'Hub assignment failed', e instanceof Error ? e.message : undefined);
    } finally {
      setAssigningHub(false);
    }
  };

  const handleAssign = async (staffId: string | null) => {
    if (!visit || assigning) return;
    setAssigning(true);
    try {
      const updated = await homeVisitsApi.assign(visit.id, staffId ?? '');
      setVisit(updated);
      showToast('success', staffId ? 'Staff assigned' : 'Staff unassigned', updated.assigned_staff_name ?? undefined);
    } catch (e) {
      showToast('error', 'Assign failed', e instanceof Error ? e.message : undefined);
    } finally {
      setAssigning(false);
    }
  };

  const handleReschedule = async () => {
    if (!visit || !rescheduleDate || !rescheduleTime || rescheduling) return;
    setRescheduling(true);
    try {
      const iso = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
      const updated = await homeVisitsApi.reschedule(visit.id, iso);
      setVisit(prev => prev ? { ...prev, scheduled_at: updated.scheduled_at } : prev);
      showToast('success', 'Visit rescheduled');
    } catch (e) {
      showToast('error', 'Reschedule failed', e instanceof Error ? e.message : undefined);
    } finally {
      setRescheduling(false);
    }
  };

  const handleLoadMeasurements = async () => {
    if (!visit || loadingMeasurements || measurementsLoaded) return;
    setLoadingMeasurements(true);
    try {
      const data = await homeVisitsApi.getMeasurements(visit.id);
      setMeasurements(data);
      setMeasurementsLoaded(true);
    } catch (e) {
      showToast('error', 'Failed to load measurements', e instanceof Error ? e.message : undefined);
    } finally {
      setLoadingMeasurements(false);
    }
  };

  const handleRecordMeasurements = async () => {
    if (!visit || savingMeasurements) return;
    const data: Record<string, number> = {};
    for (const [k, v] of Object.entries(recordForm)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) data[k] = n;
    }
    if (Object.keys(data).length === 0) {
      showToast('error', 'Enter at least one measurement');
      return;
    }
    setSavingMeasurements(true);
    try {
      const saved = await homeVisitsApi.recordMeasurements(visit.id, data);
      setMeasurements(prev => [saved, ...prev]);
      setMeasurementsLoaded(true);
      setShowRecordForm(false);
      setRecordForm({});
      showToast('success', 'Measurements recorded');
    } catch (e) {
      showToast('error', 'Failed to save measurements', e instanceof Error ? e.message : undefined);
    } finally {
      setSavingMeasurements(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton} style={{ height: 400, borderRadius: 12 }} />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/home-visits')}>
          <ChevronLeft size={15} /> Back to Home Visits
        </button>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-error)' }}>Visit not found.</div>
      </div>
    );
  }

  const scheduledDate = new Date(visit.scheduled_at);

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <button className={styles.backBtn} onClick={() => navigate('/admin/home-visits')}>
        <ChevronLeft size={15} /> Back to Home Visits
      </button>

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.orderId}>Home Visit</h1>
          <div className={styles.orderMeta}>
            Booked {new Date(visit.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <span className={`${styles.stagePill} ${styles[STATUS_CSS[visit.status] ?? 'stageNeutral']}`}>
          {STATUS_LABELS[visit.status] ?? visit.status}
        </span>
      </div>

      <div className={styles.grid}>
        {/* Customer Info */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><User size={15} /> Customer</div>
          <div className={styles.cardBody}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <span className={styles.fieldValue}>{visit.customer_name}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Phone</span>
              <span className={styles.fieldValue}>{visit.customer_phone ?? '—'}</span>
            </div>
            {visit.customer_id && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Profile</span>
                <button className={styles.linkBtn} onClick={() => navigate(`/admin/users/${visit.customer_id}`)}>
                  View Profile →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><Clock size={15} /> Schedule</div>
          <div className={styles.cardBody}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Date</span>
              <span className={styles.fieldValue}>
                {scheduledDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Time</span>
              <span className={styles.fieldValue}>
                {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {visit.completed_at && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Completed</span>
                <span className={styles.fieldValue}>
                  {new Date(visit.completed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><MapPin size={15} /> Visit Address</div>
          <div className={styles.cardBody}>
            {visit.address_name && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Contact</span>
                <span className={styles.fieldValue}>{visit.address_name}</span>
              </div>
            )}
            {visit.address_phone && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Phone</span>
                <span className={styles.fieldValue}>{visit.address_phone}</span>
              </div>
            )}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Address</span>
              <span className={styles.fieldValue}>
                {[visit.address_line1, visit.address_line2].filter(Boolean).join(', ')}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>City</span>
              <span className={styles.fieldValue}>{visit.city ?? '—'}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>State</span>
              <span className={styles.fieldValue}>{visit.state ?? '—'}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Pincode</span>
              <span className={styles.fieldValue}>{visit.pincode ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><Building2 size={15} /> Assignment</div>
          <div className={styles.cardBody}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Hub</span>
              {showHubPicker ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className={styles.fieldSelect}
                    style={{ flex: '1 1 160px', maxWidth: 280 }}
                    value={selectedHubId}
                    onChange={e => setSelectedHubId(e.target.value)}
                  >
                    <option value="">Select hub…</option>
                    {allHubs.map(h => (
                      <option key={h.id} value={h.id}>{h.name} — {h.city}</option>
                    ))}
                  </select>
                  <button
                    className={styles.actionBtn}
                    disabled={!selectedHubId || assigningHub}
                    onClick={handleAssignHub}
                    style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }}
                  >
                    {assigningHub ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => { setShowHubPicker(false); setSelectedHubId(''); }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={styles.fieldValue}>{visit.hub_name ?? '—'}</span>
                  <button
                    className={styles.actionBtn}
                    style={{ fontSize: 11, padding: '2px 10px' }}
                    onClick={() => setShowHubPicker(true)}
                  >
                    {visit.hub_id ? 'Change' : 'Assign Hub'}
                  </button>
                </div>
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Staff</span>
              <span className={styles.fieldValue}>
                {visit.assigned_staff_name ?? <em style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</em>}
              </span>
            </div>
            {visit.fit_profile_id && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Fit Profile</span>
                <span className={styles.fieldValue} style={{ fontFamily: 'monospace', fontSize: 11 }}>{visit.fit_profile_id}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {visit.notes && (
          <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <div className={styles.cardHeader}><FileText size={15} /> Notes</div>
            <div className={styles.cardBody}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>{visit.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Update Status */}
      <div className={styles.card} style={{ marginTop: 16 }}>
        <div className={styles.cardHeader}>Update Status</div>
        <div className={styles.cardBody} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {VALID_STATUSES.map(s => (
            <button
              key={s}
              disabled={updating || visit.status === s}
              onClick={() => handleStatusChange(s)}
              className={styles.actionBtn}
              style={{
                opacity: visit.status === s ? 1 : undefined,
                fontWeight: visit.status === s ? 700 : undefined,
                background: visit.status === s ? 'var(--color-green)' : undefined,
                color: visit.status === s ? '#fff' : undefined,
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Assign Staff */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardHeader}><UserCheck size={15} /> Assign Staff</div>
        <div className={styles.cardBody}>
          <StaffAssignmentDropdown
            value={visit.assigned_staff_id ?? null}
            onChange={handleAssign}
            hubId={visit.hub_id ?? undefined}
            showWorkload
            disabled={assigning}
            placeholder={visit.hub_id ? 'Assign staff…' : 'Assign a hub first to pick staff'}
          />
        </div>
      </div>

      {/* Reschedule */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardHeader}><Calendar size={15} /> Reschedule Visit</div>
        <div className={styles.cardBody}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="date"
              className={styles.fieldSelect}
              style={{ flex: '1 1 160px', maxWidth: 200 }}
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
            />
            <input
              type="time"
              className={styles.fieldSelect}
              style={{ flex: '1 1 120px', maxWidth: 160 }}
              value={rescheduleTime}
              onChange={e => setRescheduleTime(e.target.value)}
            />
            <button
              className={styles.actionBtn}
              disabled={!rescheduleDate || !rescheduleTime || rescheduling}
              onClick={handleReschedule}
              style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }}
            >
              {rescheduling ? 'Saving…' : 'Save New Time'}
            </button>
          </div>
        </div>
      </div>

      {/* Measurement Booking */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardHeader} style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={15} /> Measurement Booking</span>
        </div>
        <div className={styles.cardBody}>
          {linkedBooking === undefined ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>Loading…</p>
          ) : linkedBooking ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{linkedBooking.booking_ref}</span>
                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: linkedBooking.status === 'completed' ? 'rgba(28,92,66,0.1)' : linkedBooking.status === 'in_progress' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.1)',
                  color: linkedBooking.status === 'completed' ? '#1C5C42' : linkedBooking.status === 'in_progress' ? '#F59E0B' : '#3B82F6',
                }}>
                  {linkedBooking.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                {linkedBooking.item_count} garment{linkedBooking.item_count !== 1 ? 's' : ''}
                {linkedBooking.completed_count > 0 && ` · ${linkedBooking.completed_count} measured`}
                {linkedBooking.assigned_staff_name && ` · Staff: ${linkedBooking.assigned_staff_name}`}
              </div>
              <button
                className={styles.actionBtn}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => navigate(`/admin/measurement-bookings/${linkedBooking.id}`)}
              >
                <ExternalLink size={13}/> View / Start Measurements
              </button>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                No measurement booking linked to this visit.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={styles.actionBtn}
                  style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (visit.customer_id) params.set('user_id', visit.customer_id);
                    if (visit.scheduled_at) params.set('scheduled_at', visit.scheduled_at.slice(0, 16));
                    params.set('home_visit_id', visit.id);
                    navigate(`/admin/measurement-bookings/new?${params}`);
                  }}
                >
                  <ClipboardList size={13}/> Create New Booking
                </button>
                <button
                  className={styles.actionBtn}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => navigate(`/admin/measurement-bookings?user_id=${visit.customer_id ?? ''}`)}
                >
                  <Link size={13}/> Find & Link Existing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Measurements */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardHeader} style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ruler size={15} /> Measurements</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {!measurementsLoaded && (
              <button className={styles.actionBtn} onClick={handleLoadMeasurements} disabled={loadingMeasurements}>
                {loadingMeasurements ? 'Loading…' : 'Load Measurements'}
              </button>
            )}
            <button
              className={styles.actionBtn}
              style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }}
              onClick={() => setShowRecordForm(v => !v)}
            >
              {showRecordForm ? 'Cancel' : 'Record Measurements'}
            </button>
          </div>
        </div>
        {showRecordForm && (
          <div className={styles.cardBody} style={{ borderBottom: '1px solid var(--color-border-light)', marginBottom: 0, paddingBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Enter measurements in centimetres. Leave blank to skip a field.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px 16px' }}>
              {MEASUREMENT_FIELDS.map(({ key, label }) => (
                <div key={key} className={styles.field}>
                  <span className={styles.fieldLabel}>{label} (cm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className={styles.fieldSelect}
                    style={{ height: 34, padding: '0 8px', fontSize: 13 }}
                    placeholder="—"
                    value={recordForm[key] ?? ''}
                    onChange={e => setRecordForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button
                className={styles.actionBtn}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }}
                disabled={savingMeasurements}
                onClick={handleRecordMeasurements}
              >
                {savingMeasurements ? 'Saving…' : 'Save Measurements'}
              </button>
              <button className={styles.actionBtn} onClick={() => { setShowRecordForm(false); setRecordForm({}); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {measurementsLoaded && (
          <div className={styles.cardBody}>
            {measurements.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                No measurements recorded yet. Use "Record Measurements" above after the visit.
              </p>
            ) : measurements.map((m, i) => (
              <div key={m.id} style={{ marginBottom: i < measurements.length - 1 ? 20 : 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                  Recorded {new Date(m.measured_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{m.measurement_method === 'home_visit' ? 'Home Visit' : 'Self'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 16px' }}>
                  {MEASUREMENT_FIELDS.map(({ key, label }) => {
                    const val = m[key] as number | null;
                    if (val === null || val === undefined) return null;
                    return (
                      <div key={key} className={styles.field}>
                        <span className={styles.fieldLabel}>{label}</span>
                        <span className={styles.fieldValue}>{val} cm</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
