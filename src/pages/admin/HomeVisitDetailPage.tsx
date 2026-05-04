import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, User, Clock, Building2, FileText } from 'lucide-react';
import { homeVisitsApi } from '../../api/adminApi';
import type { HomeVisit } from '../../api/adminApi';
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

export const HomeVisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [visit, setVisit] = React.useState<HomeVisit | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    homeVisitsApi.get(id!)
      .then(setVisit)
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
                <span className={styles.fieldLabel}>User</span>
                <button
                  className={styles.linkBtn}
                  onClick={() => navigate(`/admin/users/${visit.customer_id}`)}
                >
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
              <span className={styles.fieldValue}>{visit.assigned_staff_name ?? <em style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</em>}</span>
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

      {/* Status Update */}
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
    </div>
  );
};
