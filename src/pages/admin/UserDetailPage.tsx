import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminUsers, adminOrders } from '../../data/adminMockData';
import styles from './UserDetailPage.module.css';

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeactivateModal, setShowDeactivateModal] = React.useState(false);
  const [deactivateReason, setDeactivateReason] = React.useState('');
  const [showCreditsModal, setShowCreditsModal] = React.useState(false);
  const [creditsAmount, setCreditsAmount] = React.useState('');
  const [creditsReason, setCreditsReason] = React.useState('');

  const user = adminUsers.find(u => u.id === id) || adminUsers[0];
  const userOrders = adminOrders.slice(0, user.orders).map(o => ({ ...o, customer: user.name }));

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/users')}>← Back to Users</button>

      <div className={styles.twoCol}>
        {/* Left: profile */}
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.profileCard}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.profileInfo}>
                <div className={styles.profileName}>{user.name}</div>
                <div className={styles.profileDetails}>
                  <span>{user.phone}</span>
                  <span>{user.email}</span>
                  <span>{user.city}</span>
                  <span>Joined {user.joined}</span>
                </div>
              </div>
              <span className={`${styles.statusPill} ${user.status === 'Active' ? styles.statusActive : styles.statusDeactivated}`}>
                {user.status}
              </span>
            </div>
          </div>

          {/* Orders */}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Orders ({user.orders} total)</h3>
              <button className={styles.linkBtn} onClick={() => navigate('/admin/orders')}>View All →</button>
            </div>
            <table className={styles.miniTable}>
              <thead>
                <tr><th>Order #</th><th>Mode</th><th>Stage</th><th>Total</th><th>Date</th></tr>
              </thead>
              <tbody>
                {userOrders.slice(0, 5).map((o, i) => (
                  <tr key={i} className={styles.miniRow} onClick={() => navigate(`/admin/orders/${o.id}`)}>
                    <td className={styles.orderId}>{o.id}</td>
                    <td>
                      <span className={`${styles.pill} ${o.mode === 'Luxe' ? styles.pillGold : styles.pillGreen}`}>{o.mode}</span>
                    </td>
                    <td>{o.stage.replace(/_/g, ' ')}</td>
                    <td>₹{o.total.toLocaleString()}</td>
                    <td>{o.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fit Profiles */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Fit Profiles</h3>
            <div className={styles.fitProfiles}>
              {['Self', 'Spouse'].map(member => (
                <div key={member} className={styles.fitMember}>
                  <div className={styles.fitMemberName}>{member}</div>
                  <div className={styles.fitCategories}>
                    {['Shirt', 'Trouser', 'Kurta'].map(cat => (
                      <span key={cat} className={styles.fitCat}>{cat} ✓</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.profileNote}>Read-only — admins cannot edit customer measurements.</div>
          </div>

          {/* Credits */}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Credits</h3>
              <span className={styles.creditsBalance}>₹{user.credits}</span>
            </div>
            <div className={styles.creditsLedger}>
              <div className={styles.ledgerRow}><span>Fit feedback reward</span><span className={styles.credit}>+₹50</span><span>20 Apr 2026</span></div>
              <div className={styles.ledgerRow}><span>Referral reward</span><span className={styles.credit}>+₹100</span><span>15 Apr 2026</span></div>
              <div className={styles.ledgerRow}><span>Applied to order</span><span className={styles.debit}>−₹100</span><span>13 Apr 2026</span></div>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Account Actions</h3>
            <div className={styles.actionList}>
              <button className={styles.creditsBtn} onClick={() => setShowCreditsModal(true)}>Issue Credits</button>
              {user.status === 'Active' ? (
                <button className={styles.deactivateBtn} onClick={() => setShowDeactivateModal(true)}>Deactivate Account</button>
              ) : (
                <button className={styles.reactivateBtn}>Reactivate Account</button>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Admin Notes</h3>
            <textarea className={styles.notesArea} placeholder="Internal notes (not visible to customer)…" rows={4} />
            <button className={styles.saveNoteBtn}>Save Note</button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Support Tickets</h3>
            <div className={styles.ticketRow}>
              <span className={styles.ticketBadge}>2 open</span>
              <span className={styles.ticketTotal}>5 total</span>
            </div>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/support')}>View All Tickets →</button>
          </div>
        </div>
      </div>

      {/* Deactivate modal */}
      {showDeactivateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeactivateModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>🔒</div>
            <h3 className={styles.modalTitle}>Deactivate {user.name}'s account?</h3>
            <p className={styles.modalWarning}>
              This customer will not be able to log in or place new orders. Existing orders will NOT be cancelled.
            </p>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason for deactivation (required)</label>
              <select className={styles.fieldSelect} value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)}>
                <option value="">Select reason…</option>
                <option>Fraud / Suspicious activity</option>
                <option>Customer request (account closure)</option>
                <option>Duplicate account</option>
                <option>Policy violation</option>
                <option>Other</option>
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowDeactivateModal(false)}>Cancel</button>
              <button className={styles.confirmDeactivateBtn} disabled={!deactivateReason} onClick={() => setShowDeactivateModal(false)}>
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits modal */}
      {showCreditsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreditsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Issue Credits to {user.name}</h3>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Amount (₹)</label>
              <input type="number" className={styles.fieldInput} value={creditsAmount} onChange={e => setCreditsAmount(e.target.value)} placeholder="e.g., 100" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reason (required)</label>
              <textarea className={styles.fieldTextarea} value={creditsReason} onChange={e => setCreditsReason(e.target.value)} placeholder="e.g., Compensation for delayed order" rows={2} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowCreditsModal(false)}>Cancel</button>
              <button className={styles.issueCreditBtn} disabled={!creditsAmount || !creditsReason} onClick={() => setShowCreditsModal(false)}>
                Issue Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
