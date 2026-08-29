import React from 'react';
import { adminAuthExtApi, getAdminUser, setAdminUser } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './AppConfigPage.module.css';
import { UilEye, UilEyeSlash, UilKeySkeletonAlt, UilQuestionCircle, UilShield } from "@iconscout/react-unicons";
import { StatusBadge } from '../../components';

// [SHL-2-10] These five strings MUST stay character-identical to
// DECOY_SECURITY_QUESTIONS in the backend's admin-auth.service.ts. That list is what an
// unknown email is answered with, so any wording that appears in one list and not the
// other tells an attacker which pool the response came from — i.e. whether the account
// exists. Two of them had drifted apart by a paraphrase.
const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favourite movie?",
];

type OwnProfile = {
  name: string | null;
  // [SHL-2-11] The live values, so the page stops rendering a login-time snapshot.
  role: string | null;
  email: string | null;
  last_login_at: string | null;
  is_active: boolean | null;
  has_security_question: boolean | null;
};

export const AdminProfilePage: React.FC = () => {
  const adminUser = getAdminUser();
  const [profile, setProfile] = React.useState<OwnProfile | null>(null);
  // [SHL-2-11] A failed identity fetch must not silently fall back to the cache as if it
  // were current — the page would then state a role it has no reason to believe.
  const [profileErr, setProfileErr] = React.useState<unknown>(null);
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
    // Own-profile via /auth/me (least-privilege) — previously this listed ALL
    // admin users and filtered by email, which only super could even do.
    //
    // [SHL-2-11] Role and email come from this response too. They used to render from
    // `getAdminUser()`, a localStorage blob written by exactly one line in the codebase —
    // AdminLoginPage, at login — and never refreshed. So "My Profile → Role", the single
    // place an operator goes to ask *what am I?*, showed whatever was true when they last
    // signed in. A super_admin demoted this morning still read as super_admin, and this
    // page was already fetching the live value and discarding it.
    //
    // The cache is refreshed at the same time, because the sidebar reads it too — leaving
    // the profile page honest and the chrome beside it stale would be a worse kind of
    // wrong than both being stale together.
    adminAuthExtApi
      .me()
      .then(me => {
        setProfile({
          name: me.name ?? null,
          role: me.role ?? null,
          email: me.email ?? null,
          last_login_at: me.lastLoginAt ?? null,
          is_active: me.isActive ?? null,
          has_security_question: me.hasSecurityQuestion ?? null,
        });
        if (me.email && me.role) setAdminUser({ email: me.email, role: me.role });
      })
      .catch(setProfileErr);
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
            {profile?.has_security_question === false && (
              <div className={styles.warningBanner} role="alert">
                No security question set — it's your only self-serve password recovery. Set one now.
              </div>
            )}
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
                <div className={styles.metaValue}>{profile?.email ?? adminUser?.email ?? '—'}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Role</div>
                <div className={styles.metaValue} style={{ textTransform: 'capitalize' }}>
                  {((profile?.role ?? adminUser?.role) ?? '').replace('_', ' ') || '—'}
                  {profileErr != null && (
                    <span className={styles.staleHint}> · couldn&rsquo;t refresh — may be out of date</span>
                  )}
                </div>
              </div>
              {profile?.last_login_at && (
                <div>
                  <div className={styles.metaLabel}>Last Login</div>
                  <div className={styles.metaValue}>{new Date(profile.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}
              {profile?.is_active != null && (
                <div>
                  <div className={styles.metaLabel}>Status</div>
                  <StatusBadge status={profile.is_active ? 'active' : 'inactive'} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
