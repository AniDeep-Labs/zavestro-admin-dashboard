import React from 'react';
import { adminConsultations, type ConsultationStatus } from '../../data/adminMockData';
import styles from './ConsultationsListPage.module.css';

const STATUS_LABELS: Record<ConsultationStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  consultation_done: 'Consultation Done',
  awaiting_design_approval: 'Awaiting Design Approval',
  awaiting_advance_payment: 'Awaiting Advance Payment',
  design_approved: 'Design Approved',
};

const STATUS_COLOR: Record<ConsultationStatus, string> = {
  pending: 'warning',
  assigned: 'blue',
  scheduled: 'blue',
  consultation_done: 'success',
  awaiting_design_approval: 'warning',
  awaiting_advance_payment: 'warning',
  design_approved: 'success',
};

const STYLISTS = [
  { id: 'STY-001', name: 'Priya', hub: 'Bengaluru Hub 1', specializations: ['Wedding', 'Bridal'] },
  { id: 'STY-002', name: 'Anjali', hub: 'Mumbai Hub 1', specializations: ['Wedding', 'Festive'] },
  { id: 'STY-003', name: 'Rajan', hub: 'Chennai Hub 1', specializations: ['Formal', 'Festive'] },
  { id: 'STY-004', name: 'Deepa', hub: 'Delhi Hub 1', specializations: ['Wedding', 'Celebration'] },
  { id: 'STY-005', name: 'Meena', hub: 'Bengaluru Hub 1', specializations: ['Festive', 'Formal'] },
];

const NEXT_ACTION: Record<ConsultationStatus, string> = {
  pending: 'Assign a stylist to this consultation.',
  assigned: 'Schedule the consultation slot.',
  scheduled: 'Awaiting consultation appointment.',
  consultation_done: 'Send design proposal to customer.',
  awaiting_design_approval: 'Awaiting customer approval on design.',
  awaiting_advance_payment: 'Customer needs to complete 50% advance payment.',
  design_approved: 'Design approved — move order to production.',
};

export const ConsultationsListPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [occasionFilter, setOccasionFilter] = React.useState('All');
  const [assignedFilter, setAssignedFilter] = React.useState('All');
  const [assignModal, setAssignModal] = React.useState<string | null>(null);
  const [viewModal, setViewModal] = React.useState<string | null>(null);
  const [selectedStylist, setSelectedStylist] = React.useState('');

  const filtered = adminConsultations.filter(c => {
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchOccasion = occasionFilter === 'All' || c.occasion === occasionFilter;
    const matchAssigned = assignedFilter === 'All'
      || (assignedFilter === 'Assigned' ? c.stylist !== null : c.stylist === null);
    return matchStatus && matchOccasion && matchAssigned;
  });

  const assignTarget = assignModal ? adminConsultations.find(c => c.id === assignModal) : null;
  const viewTarget = viewModal ? adminConsultations.find(c => c.id === viewModal) : null;

  const unassignedCount = adminConsultations.filter(c => !c.stylist).length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Luxe Consultations</h1>
          {unassignedCount > 0 && (
            <p className={styles.unassignedAlert}>
              {unassignedCount} consultation{unassignedCount > 1 ? 's' : ''} need{unassignedCount === 1 ? 's' : ''} a stylist assigned
            </p>
          )}
        </div>
      </div>

      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {(Object.entries(STATUS_LABELS) as [ConsultationStatus, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className={styles.filterSelect} value={occasionFilter} onChange={e => setOccasionFilter(e.target.value)}>
          <option>All</option>
          <option>Wedding</option>
          <option>Festive</option>
          <option>Formal</option>
          <option>Celebration</option>
        </select>
        <select className={styles.filterSelect} value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}>
          <option>All</option>
          <option>Assigned</option>
          <option>Unassigned</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setStatusFilter('All'); setOccasionFilter('All'); setAssignedFilter('All'); }}>
          Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Consultation ID</th>
              <th>Customer</th>
              <th>Occasion</th>
              <th>Status</th>
              <th>Stylist</th>
              <th>Booked Slot</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No consultations found.</td></tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} className={`${styles.row} ${!c.stylist ? styles.rowUnassigned : ''}`}>
                  <td className={styles.consultId}>{c.id}</td>
                  <td className={styles.customer}>{c.customer}</td>
                  <td>
                    <span className={styles.occasionPill}>{c.occasion}</span>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`statusColor${STATUS_COLOR[c.status].charAt(0).toUpperCase()}${STATUS_COLOR[c.status].slice(1)}`]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td>
                    {c.stylist
                      ? <span className={styles.stylistName}>{c.stylist}</span>
                      : <span className={styles.unassigned}>Unassigned</span>
                    }
                  </td>
                  <td className={styles.slot}>{c.bookedSlot || '—'}</td>
                  <td className={styles.date}>{c.createdAt}</td>
                  <td>
                    <div className={styles.actions}>
                      {!c.stylist && (
                        <button className={styles.assignBtn} onClick={() => { setAssignModal(c.id); setSelectedStylist(''); }}>
                          Assign Stylist
                        </button>
                      )}
                      <button className={styles.viewBtn} onClick={() => setViewModal(c.id)}>View</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Stylist Modal */}
      {assignModal && assignTarget && (
        <div className={styles.overlay} onClick={() => setAssignModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Assign Stylist</h3>
            <div className={styles.assignSummary}>
              <div className={styles.summaryRow}><span>Customer</span><span>{assignTarget.customer}</span></div>
              <div className={styles.summaryRow}><span>Occasion</span><span>{assignTarget.occasion}</span></div>
              {assignTarget.bookedSlot && (
                <div className={styles.summaryRow}><span>Slot</span><span>{assignTarget.bookedSlot}</span></div>
              )}
            </div>
            <div className={styles.stylistList}>
              {STYLISTS.map(s => (
                <label key={s.id} className={`${styles.stylistOption} ${selectedStylist === s.id ? styles.stylistSelected : ''}`}>
                  <input
                    type="radio"
                    name="stylist"
                    value={s.id}
                    checked={selectedStylist === s.id}
                    onChange={() => setSelectedStylist(s.id)}
                  />
                  <div className={styles.stylistInfo}>
                    <span className={styles.stylistName}>{s.name} — {s.hub}</span>
                    <span className={styles.stylistSpec}>Specializes in: {s.specializations.join(', ')}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setAssignModal(null)}>Cancel</button>
              <button className={styles.confirmAssignBtn} disabled={!selectedStylist} onClick={() => setAssignModal(null)}>
                Assign →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewModal && viewTarget && (
        <div className={styles.overlay} onClick={() => setViewModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Consultation Detail</h3>
            <div className={styles.detailGrid}>
              <div className={styles.detailRow}><span>ID</span><span>{viewTarget.id}</span></div>
              <div className={styles.detailRow}><span>Customer</span><span>{viewTarget.customer}</span></div>
              <div className={styles.detailRow}><span>Occasion</span><span>{viewTarget.occasion}</span></div>
              <div className={styles.detailRow}>
                <span>Status</span>
                <span className={`${styles.statusPill} ${styles[`statusColor${STATUS_COLOR[viewTarget.status].charAt(0).toUpperCase()}${STATUS_COLOR[viewTarget.status].slice(1)}`]}`}>
                  {STATUS_LABELS[viewTarget.status]}
                </span>
              </div>
              <div className={styles.detailRow}><span>Stylist</span><span>{viewTarget.stylist || 'Not yet assigned'}</span></div>
              <div className={styles.detailRow}><span>Booked Slot</span><span>{viewTarget.bookedSlot || '—'}</span></div>
              <div className={styles.detailRow}><span>Created</span><span>{viewTarget.createdAt}</span></div>
            </div>
            <div className={styles.nextAction}>
              <strong>Next action: </strong>{NEXT_ACTION[viewTarget.status]}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setViewModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
