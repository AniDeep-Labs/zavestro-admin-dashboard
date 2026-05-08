import React from 'react';
import { X } from 'lucide-react';
import { consultationsApi, allStaffApi } from '../../api/adminApi';
import type { Consultation, AllStaffMember } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ConsultationsListPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_CSS: Record<string, string> = {
  pending: 'statusColorWarning',
  scheduled: 'statusColorBlue',
  confirmed: 'statusColorBlue',
  completed: 'statusColorSuccess',
  cancelled: 'statusColorWarning',
};

function fmt(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

type ModalMode = 'assign' | 'detail';

interface Modal {
  mode: ModalMode;
  consultation: Consultation;
}

export const ConsultationsListPage: React.FC = () => {
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [allStaff, setAllStaff] = React.useState<AllStaffMember[]>([]);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState<Modal | null>(null);
  const [selectedStaffId, setSelectedStaffId] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    consultationsApi.list({ status: statusFilter || undefined })
      .then(r => setConsultations(r.consultations))
      .catch(e => showToast('error', 'Failed to load', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    allStaffApi.list().then(setAllStaff).catch(() => {});
  }, []);

  const unassigned = consultations.filter(c => !c.assigned_staff_id && c.status !== 'cancelled' && c.status !== 'completed');

  const openAssign = (c: Consultation) => {
    setSelectedStaffId(c.assigned_staff_id ?? '');
    setModal({ mode: 'assign', consultation: c });
  };

  const openDetail = (c: Consultation) => {
    setModal({ mode: 'detail', consultation: c });
  };

  const handleAssign = async () => {
    if (!modal || !selectedStaffId) return;
    setSaving(true);
    try {
      const updated = await consultationsApi.update(modal.consultation.id, {
        assigned_staff_id: selectedStaffId,
        status: modal.consultation.status === 'pending' ? 'scheduled' : undefined,
      });
      setConsultations(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      showToast('success', 'Staff assigned');
      setModal(null);
    } catch (e) {
      showToast('error', 'Assign failed', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (c: Consultation, newStatus: string) => {
    try {
      const updated = await consultationsApi.update(c.id, { status: newStatus });
      setConsultations(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
      showToast('success', `Status → ${STATUS_LABELS[newStatus] ?? newStatus}`);
      setModal(null);
    } catch (e) {
      showToast('error', 'Update failed', e instanceof Error ? e.message : undefined);
    }
  };

  const staffName = (id: string | null) => {
    if (!id) return null;
    const s = allStaff.find(x => x.id === id);
    return s ? s.name : id.slice(0, 8);
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Consultations</h1>
          {unassigned.length > 0 && (
            <p className={styles.unassignedAlert}>{unassigned.length} unassigned consultation{unassigned.length > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {statusFilter && (
          <button className={styles.clearBtn} onClick={() => setStatusFilter('')}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Scheduled At</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.empty}>Loading…</td></tr>
            ) : consultations.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No consultations found.</td></tr>
            ) : consultations.map(c => (
              <tr
                key={c.id}
                className={`${styles.row} ${!c.assigned_staff_id && c.status !== 'cancelled' && c.status !== 'completed' ? styles.rowUnassigned : ''}`}
              >
                <td>
                  <div className={styles.customer}>{c.customer_name}</div>
                  <div className={styles.slot}>{c.customer_phone}</div>
                </td>
                <td className={styles.date}>{fmt(c.scheduled_at)}</td>
                <td>
                  <span className={`${styles.statusPill} ${styles[STATUS_CSS[c.status] ?? 'statusColorWarning']}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </td>
                <td>
                  {c.assigned_staff_id
                    ? <span className={styles.stylistName}>{staffName(c.assigned_staff_id)}</span>
                    : <span className={styles.unassigned}>Unassigned</span>
                  }
                </td>
                <td className={styles.slot}>{c.notes ? c.notes.slice(0, 50) + (c.notes.length > 50 ? '…' : '') : '—'}</td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.assignBtn} onClick={() => openAssign(c)}>
                      {c.assigned_staff_id ? 'Reassign' : 'Assign'}
                    </button>
                    <button className={styles.viewBtn} onClick={() => openDetail(c)}>View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {modal?.mode === 'assign' && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Assign Staff</h2>
            <div className={styles.assignSummary}>
              <div className={styles.summaryRow}>
                <span>Customer</span><span>{modal.consultation.customer_name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Scheduled</span><span>{fmt(modal.consultation.scheduled_at)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Status</span>
                <span className={`${styles.statusPill} ${styles[STATUS_CSS[modal.consultation.status] ?? 'statusColorWarning']}`}>
                  {STATUS_LABELS[modal.consultation.status] ?? modal.consultation.status}
                </span>
              </div>
            </div>

            <div className={styles.stylistList}>
              {allStaff.length === 0
                ? <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No staff available.</p>
                : allStaff.map(s => (
                  <label key={s.id} className={`${styles.stylistOption} ${selectedStaffId === s.id ? styles.stylistSelected : ''}`}>
                    <input
                      type="radio"
                      name="staff"
                      value={s.id}
                      checked={selectedStaffId === s.id}
                      onChange={() => setSelectedStaffId(s.id)}
                    />
                    <div className={styles.stylistInfo}>
                      <span className={styles.stylistName}>{s.name}</span>
                      <span className={styles.stylistSpec}>{s.role} · {s.hub_name}</span>
                    </div>
                  </label>
                ))
              }
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setModal(null)}>Cancel</button>
              <button
                className={styles.confirmAssignBtn}
                onClick={handleAssign}
                disabled={!selectedStaffId || saving}
              >
                {saving ? 'Assigning…' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal?.mode === 'detail' && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Consultation Details</h2>
            <div className={styles.detailGrid}>
              <div className={styles.detailRow}><span>Customer</span><span>{modal.consultation.customer_name}</span></div>
              <div className={styles.detailRow}><span>Phone</span><span>{modal.consultation.customer_phone}</span></div>
              <div className={styles.detailRow}>
                <span>Status</span>
                <span className={`${styles.statusPill} ${styles[STATUS_CSS[modal.consultation.status] ?? 'statusColorWarning']}`}>
                  {STATUS_LABELS[modal.consultation.status] ?? modal.consultation.status}
                </span>
              </div>
              <div className={styles.detailRow}><span>Scheduled</span><span>{fmt(modal.consultation.scheduled_at)}</span></div>
              <div className={styles.detailRow}>
                <span>Assigned To</span>
                <span>{modal.consultation.assigned_staff_id ? staffName(modal.consultation.assigned_staff_id) : 'Unassigned'}</span>
              </div>
              <div className={styles.detailRow}><span>Completed</span><span>{fmt(modal.consultation.completed_at)}</span></div>
              {modal.consultation.notes && (
                <div className={styles.detailRow}><span>Notes</span><span style={{ maxWidth: 220, textAlign: 'right' }}>{modal.consultation.notes}</span></div>
              )}
            </div>

            {modal.consultation.status !== 'completed' && modal.consultation.status !== 'cancelled' && (
              <div className={styles.nextAction}>
                <strong>Quick actions:</strong> change status or reassign staff using the Assign button.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {modal.consultation.status === 'pending' && (
                <button className={styles.confirmAssignBtn} onClick={() => handleStatusChange(modal.consultation, 'scheduled')}>
                  Mark Scheduled
                </button>
              )}
              {(modal.consultation.status === 'scheduled' || modal.consultation.status === 'confirmed') && (
                <button className={styles.confirmAssignBtn} onClick={() => handleStatusChange(modal.consultation, 'completed')}>
                  Mark Completed
                </button>
              )}
              {modal.consultation.status !== 'cancelled' && modal.consultation.status !== 'completed' && (
                <button className={styles.cancelModalBtn} style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }} onClick={() => handleStatusChange(modal.consultation, 'cancelled')}>
                  Cancel Consultation
                </button>
              )}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
