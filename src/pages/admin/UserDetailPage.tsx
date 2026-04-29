import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Lock, CheckCircle, Gift, UserX, UserCheck } from 'lucide-react';
import { usersApi } from '../../api/adminApi';
import type { AdminUser } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './UserDetailPage.module.css';

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [showDeactivateModal, setShowDeactivateModal] = React.useState(false);
  const [deactivateReason, setDeactivateReason] = React.useState('');
  const [showCreditsModal, setShowCreditsModal] = React.useState(false);
  const [creditsAmount, setCreditsAmount] = React.useState('');
  const [creditsReason, setCreditsReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    usersApi.get(id)
      .then(setUser)
      .catch(e => showToast('error', 'Failed to load user', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeactivate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await usersApi.update(user.id, { status: 'Deactivated' });
      setUser(updated);
      setShowDeactivateModal(false);
      setDeactivateReason('');
      showToast('success', 'Account deactivated');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleReactivate = async () => {
    if (!user) return;
    try {
      const updated = await usersApi.update(user.id, { status: 'Active' });
      setUser(updated);
      showToast('success', 'Account reactivated');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    }
  };

  const handleIssueCredits = async () => {
    if (!user || !creditsAmount || !creditsReason) return;
    setSaving(true);
    try {
      await usersApi.issueCredits(user.id, Number(creditsAmount), creditsReason);
      setShowCreditsModal(false);
      setCreditsAmount(''); setCreditsReason('');
      showToast('success', 'Credits issued', `₹${creditsAmount} added to ${user.name}'s account`);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSaving(false); }
  };

  const handleSaveNote = async () => {
    if (!user || !note.trim()) return;
    try {
      await usersApi.addNote(user.id, note.trim());
      setNote('');
      showToast('success', 'Note saved');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    }
  };

  if (loading) return <div className={styles.page}><div className={styles.backBtn}>Loading…</div></div>;
  if (!user) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/users')}><ChevronLeft size={15}/> Back</button><div>User not found.</div></div>;

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/users')}><ChevronLeft size={15}/> Back to Users</button>

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
                <tr><th>Order #</th><th>Mode</th><th>Total</th></tr>
              </thead>
              <tbody>
                <tr><td colSpan={3} className={styles.empty}>{user.orders} orders — click "View All" to see them</td></tr>
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
                      <span key={cat} className={styles.fitCat}><CheckCircle size={11}/> {cat}</span>
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
              <span className={styles.creditsBalance}>₹{user.credits?.toLocaleString('en-IN') ?? 0}</span>
            </div>
            <div className={styles.creditsLedger}>
              <div className={styles.ledgerRow}><span>Balance</span><span className={styles.credit}>₹{user.credits?.toLocaleString('en-IN') ?? 0}</span><span>Current</span></div>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Account Actions</h3>
            <div className={styles.actionList}>
              <button className={styles.creditsBtn} onClick={() => setShowCreditsModal(true)}><Gift size={14}/> Issue Credits</button>
              {user.status === 'Active' ? (
                <button className={styles.deactivateBtn} onClick={() => setShowDeactivateModal(true)}><UserX size={14}/> Deactivate Account</button>
              ) : (
                <button className={styles.reactivateBtn} onClick={handleReactivate}><UserCheck size={14}/> Reactivate Account</button>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Admin Notes</h3>
            <textarea className={styles.notesArea} placeholder="Internal notes (not visible to customer)…" rows={4}
              value={note} onChange={e => setNote(e.target.value)} />
            <button className={styles.saveNoteBtn} disabled={!note.trim()} onClick={handleSaveNote}>Save Note</button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Support Tickets</h3>
            <div className={styles.ticketRow}>
              <span className={styles.ticketTotal}>View all tickets for this user</span>
            </div>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/support')}>View All Tickets →</button>
          </div>
        </div>
      </div>

      {/* Deactivate modal */}
      {showDeactivateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeactivateModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}><Lock size={22}/></div>
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
              <button className={styles.confirmDeactivateBtn} disabled={!deactivateReason || saving} onClick={handleDeactivate}>
                {saving ? 'Deactivating…' : 'Confirm Deactivation'}
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
              <button className={styles.issueCreditBtn} disabled={!creditsAmount || !creditsReason || saving} onClick={handleIssueCredits}>
                {saving ? 'Issuing…' : 'Issue Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
