import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, User, Clock, Building2, FileText, UserCheck, Calendar, Ruler } from 'lucide-react';
import { homeVisitsApi, hubStaffApi } from '../../api/adminApi';
import type { HomeVisit, BodyMeasurement, HubStaff } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrderDetailPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_CSS: Record<string, string> = {
  pending: 'stageWarning',
  confirmed: 'stageBlue',
  completed: 'stageSuccess',
  cancelled: 'stageNeutral',
};

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

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

  // Assign staff
  const [staffList, setStaffList] = React.useState<HubStaff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = React.useState('');
  const [assigning, setAssigning] = React.useState(false);

  // Reschedule
  const [rescheduleDate, setRescheduleDate] = React.useState('');
  const [rescheduleTime, setRescheduleTime] = React.useState('');
  const [rescheduling, setRescheduling] = React.useState(false);

  // Measurements
  const [measurements, setMeasurements] = React.useState<BodyMeasurement[]>([]);
  const [measurementsLoaded, setMeasurementsLoaded] = React.useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = React.useState(false);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    homeVisitsApi.get(id!)
      .then(v => {
        setVisit(v);
        if (v.hub_id) {
          hubStaffApi.list(v.hub_id).then(setStaffList).catch(() => {});
        }
        const dt = new Date(v.scheduled_at);
        setRescheduleDate(dt.toISOString().slice(0, 10));
        setRescheduleTime(dt.toTimeString().slice(0, 5));
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

  const handleAssign = async () => {
    if (!visit || !selectedStaffId || assigning) return;
    setAssigning(true);
    try {
      const updated = await homeVisitsApi.assign(visit.id, selectedStaffId);
      setVisit(updated);
      showToast('success', 'Staff assigned', updated.assigned_staff_name ?? undefined);
      setSelectedStaffId('');
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
              <span className={styles.fieldValue}>{visit.hub_name ?? '—'}</span>
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
          {staffList.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              {visit.hub_id ? 'No active staff found for this hub.' : 'No hub assigned to this visit — assign a hub first to pick staff.'}
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className={styles.fieldSelect}
                style={{ flex: '1 1 200px', maxWidth: 320 }}
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
              >
                <option value="">Select staff member…</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
              <button
                className={styles.actionBtn}
                disabled={!selectedStaffId || assigning}
                onClick={handleAssign}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }}
              >
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          )}
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

      {/* Measurements */}
      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardHeader} style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ruler size={15} /> Measurements</span>
          {!measurementsLoaded && (
            <button
              className={styles.actionBtn}
              style={{ marginLeft: 'auto' }}
              onClick={handleLoadMeasurements}
              disabled={loadingMeasurements}
            >
              {loadingMeasurements ? 'Loading…' : 'Load Measurements'}
            </button>
          )}
        </div>
        {measurementsLoaded && (
          <div className={styles.cardBody}>
            {measurements.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                {visit.fit_profile_id ? 'No measurements recorded yet for this fit profile.' : 'No fit profile linked to this visit.'}
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
