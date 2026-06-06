import React from 'react';
import { adminAuthExtApi, getAdminUser } from '../../api/adminApi';
import { catalogApi } from '../../api/catalogApi';
import type { AdminUser } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AppConfigPage.module.css';
import { UilEye, UilEyeSlash, UilKeySkeletonAlt, UilQuestionCircle, UilShield } from "@iconscout/react-unicons";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favourite movie?",
];

export const AdminProfilePage: React.FC = () => {
  const adminUser = getAdminUser();
  const [profile, setProfile] = React.useState<AdminUser | null>(null);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Change password state
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [confirmPw, setConfirmPw] = React.useState('');
  const [showCurrentPw, setShowCurrentPw] = React.useState(false);
  const [showNewPw, setShowNewPw] = React.useState(false);
  const [changingPw, setChangingPw] = React.useState(false);

  // Security question state
  const [secQuestion, setSecQuestion] = React.useState(SECURITY_QUESTIONS[0]);
  const [secAnswer, setSecAnswer] = React.useState('');
  const [savingSecQ, setSavingSecQ] = React.useState(false);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    catalogApi.listAdminUsers()
      .then(users => {
        const me = users.find(u => u.email === adminUser?.email);
        if (me) setProfile(me);
      })
      .catch(() => {});
  }, []);

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { showToast('error', 'All fields required'); return; }
    if (newPw !== confirmPw) { showToast('error', 'New passwords do not match'); return; }
    if (newPw.length < 8) { showToast('error', 'Password must be at least 8 characters'); return; }
    setChangingPw(true);
    try {
      await adminAuthExtApi.changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('success', 'Password changed successfully');
    } catch (e) {
      showToast('error', 'Failed to change password', e instanceof Error ? e.message : undefined);
    } finally { setChangingPw(false); }
  };

  const handleSetupSecurityQuestion = async () => {
    if (!secQuestion || !secAnswer.trim()) { showToast('error', 'Question and answer are required'); return; }
    setSavingSecQ(true);
    try {
      await adminAuthExtApi.setupSecurityQuestion(secQuestion, secAnswer.trim());
      setSecAnswer('');
      showToast('success', 'Security question saved');
    } catch (e) {
      showToast('error', 'Failed to save security question', e instanceof Error ? e.message : undefined);
    } finally { setSavingSecQ(false); }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>My Profile</h1>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.main}>
          {/* Change Password */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}><UilKeySkeletonAlt size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Change Password</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className={styles.fieldLabel}>Current Password</label>
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    className={styles.fieldInput}
                    placeholder="Enter current password"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex' }}
                  >
                    {showCurrentPw ? <UilEyeSlash size={16}/> : <UilEye size={16}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className={styles.fieldLabel}>New Password</label>
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    className={styles.fieldInput}
                    placeholder="Min. 8 characters"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex' }}
                  >
                    {showNewPw ? <UilEyeSlash size={16}/> : <UilEye size={16}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className={styles.fieldLabel}>Confirm New Password</label>
                <input
                  type="password"
                  className={styles.fieldInput}
                  placeholder="Re-enter new password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  style={{ marginTop: 4 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleChangePassword(); }}
                />
              </div>
              <button
                className={styles.addBtn}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                disabled={changingPw || !currentPw || !newPw || !confirmPw}
                onClick={handleChangePassword}
              >
                {changingPw ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </div>

          {/* Security Question */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}><UilQuestionCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Security Question</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 14 }}>
              Used for account recovery if you forget your password.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className={styles.fieldLabel}>Question</label>
                <select
                  className={styles.fieldSelect}
                  value={secQuestion}
                  onChange={e => setSecQuestion(e.target.value)}
                  style={{ marginTop: 4 }}
                >
                  {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Answer</label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="Your answer (case-insensitive)"
                  value={secAnswer}
                  onChange={e => setSecAnswer(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </div>
              <button
                className={styles.addBtn}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                disabled={savingSecQ || !secAnswer.trim()}
                onClick={handleSetupSecurityQuestion}
              >
                {savingSecQ ? 'Saving…' : 'Save Security Question'}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: account info */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}><UilShield size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Account Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className={styles.metaLabel}>Name</div>
                <div className={styles.metaValue}>{profile?.name ?? '—'}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Email</div>
                <div className={styles.metaValue}>{adminUser?.email ?? '—'}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Role</div>
                <div className={styles.metaValue} style={{ textTransform: 'capitalize' }}>{(adminUser?.role ?? '').replace('_', ' ')}</div>
              </div>
              {profile?.last_login_at && (
                <div>
                  <div className={styles.metaLabel}>Last Login</div>
                  <div className={styles.metaValue}>{new Date(profile.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}
              <div>
                <div className={styles.metaLabel}>Status</div>
                <span className={`${styles.statusPill} ${profile?.is_active ? styles.statusActive : styles.statusDeactivated}`}>
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
