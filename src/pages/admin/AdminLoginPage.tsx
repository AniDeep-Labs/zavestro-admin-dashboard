import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { catalogApi, setAdminToken, hasAdminToken } from '../../api/catalogApi';
import { setAdminUser, setAdminCapabilities, adminAuthExtApi } from '../../api/adminApi';
import styles from './AdminLoginPage.module.css';
import regStyles from './AdminRegisterPage.module.css';
import { UilArrowLeft, UilArrowRight, UilEye, UilEyeSlash, UilSpinner } from "@iconscout/react-unicons";

type View = 'login' | 'forgot' | 'security-q' | 'change-password';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = React.useState<View>('login');

  // Login form
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  // Force change password (must_change_password=true after login)
  const [forceToken, setForceToken] = React.useState('');
  const [forceEmail, setForceEmail] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [newPwConfirm, setNewPwConfirm] = React.useState('');
  const [changingPw, setChangingPw] = React.useState(false);
  const [changeError, setChangeError] = React.useState('');

  // Security question flow
  const [sqEmail, setSqEmail] = React.useState('');
  const [sqQuestion, setSqQuestion] = React.useState('');
  const [sqAnswer, setSqAnswer] = React.useState('');
  const [sqNewPw, setSqNewPw] = React.useState('');
  const [sqStep, setSqStep] = React.useState<'email' | 'answer'>('email');
  const [sqLoading, setSqLoading] = React.useState(false);
  const [sqError, setSqError] = React.useState('');
  const [sqDone, setSqDone] = React.useState(false);

  React.useEffect(() => {
    if (hasAdminToken()) navigate('/admin/dashboard', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitted(true);
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await catalogApi.login(email, password, rememberMe);
      setAdminToken(res.token);
      setAdminUser({ email: res.user?.email ?? email, role: res.user?.role ?? 'admin' });
      // Fetch capabilities so the sidebar/routes gate by role (non-fatal).
      try { const me = await adminAuthExtApi.me(); setAdminCapabilities(me.capabilities ?? []); } catch { /* AdminLayout retries on mount */ }
      if (res.mustChangePassword) {
        setForceToken(res.token);
        setForceEmail(res.user?.email ?? email);
        setView('change-password');
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    if (!newPw || newPw.length < 8) { setChangeError('Password must be at least 8 characters.'); return; }
    if (newPw !== newPwConfirm) { setChangeError('Passwords do not match.'); return; }
    setChangingPw(true);
    try {
      await adminAuthExtApi.changePassword(password, newPw);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally { setChangingPw(false); }
  };

  const handleSqGetQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSqError('');
    if (!sqEmail) { setSqError('Enter your email.'); return; }
    setSqLoading(true);
    try {
      const { question } = await adminAuthExtApi.getSecurityQuestion(sqEmail);
      setSqQuestion(question);
      setSqStep('answer');
    } catch (err) {
      setSqError(err instanceof Error ? err.message : 'No security question found for this account.');
    } finally { setSqLoading(false); }
  };

  const handleSqReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSqError('');
    if (!sqAnswer) { setSqError('Enter your answer.'); return; }
    if (!sqNewPw || sqNewPw.length < 8) { setSqError('New password must be at least 8 characters.'); return; }
    setSqLoading(true);
    try {
      await adminAuthExtApi.resetViaQuestion(sqEmail, sqAnswer, sqNewPw);
      setSqDone(true);
    } catch (err) {
      setSqError(err instanceof Error ? err.message : 'Incorrect answer or reset failed.');
    } finally { setSqLoading(false); }
  };

  const resetToLogin = () => {
    setView('login'); setError(''); setSubmitted(false);
    setSqStep('email'); setSqEmail(''); setSqQuestion(''); setSqAnswer(''); setSqNewPw('');
    setSqError(''); setSqDone(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.wordmark}>Zavestro</div>
          <div className={styles.subtitle}>Admin Dashboard</div>
        </div>

        {/* ── Login ── */}
        {view === 'login' && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email" type="email"
                className={`${styles.input} ${submitted && !email ? styles.inputError : ''}`}
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@zavestro.in" autoFocus autoComplete="email" disabled={loading}
              />
              {submitted && !email && <span className={styles.fieldHint}>Email is required</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <div className={styles.passwordWrap}>
                <input
                  id="password" type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${submitted && !password ? styles.inputError : ''}`}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" autoComplete="current-password" disabled={loading}
                />
                <button type="button" className={styles.showBtn} onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <UilEyeSlash size={16} /> : <UilEye size={16} />}
                </button>
              </div>
              {submitted && !password && <span className={styles.fieldHint}>Password is required</span>}
            </div>
            <label className={styles.rememberRow}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} disabled={loading} />
              <span>Remember me for 30 days</span>
            </label>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <UilSpinner size={16} className={styles.spinnerIcon} /> : null}
              {loading ? 'Signing in…' : <><span>Sign In</span><UilArrowRight size={16} /></>}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <button type="button" className={styles.forgotBtn} onClick={() => setView('security-q')}>
                Forgot password via security question
              </button>
              <button type="button" className={styles.forgotBtn} onClick={() => setView('forgot')}>
                Request reset link from super admin
              </button>
            </div>
            <div className={regStyles.loginLink}>
              New team member?{' '}
              <Link to="/admin/register" className={regStyles.link}>Request access</Link>
            </div>
          </form>
        )}

        {/* ── Force change password ── */}
        {view === 'change-password' && (
          <form className={styles.form} onSubmit={handleForceChange} noValidate>
            <div style={{ background: 'var(--color-warning-bg, #FBF1DD)', border: '1px solid var(--color-warning, #E4952A)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--color-text-primary)', marginBottom: 4 }}>
              You must change your password before continuing. Signed in as <strong>{forceEmail}</strong>.
            </div>
            <input type="hidden" value={forceToken} />
            <div className={styles.field}>
              <label className={styles.label}>New Password (min 8 chars)</label>
              <input className={styles.input} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoFocus />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Confirm New Password</label>
              <input className={styles.input} type="password" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)} />
            </div>
            {changeError && <div className={styles.error}>{changeError}</div>}
            <button type="submit" className={styles.submitBtn} disabled={changingPw}>
              {changingPw ? 'Changing…' : 'Set New Password'}
            </button>
          </form>
        )}

        {/* ── Forgot: request super admin link ── */}
        {view === 'forgot' && (
          <div className={styles.form}>
            <p className={styles.forgotDesc}>
              Contact a super admin to generate a reset link for your account.
            </p>
            <button className={styles.backBtn} onClick={resetToLogin}><UilArrowLeft size={16} /> Back to Login</button>
          </div>
        )}

        {/* ── Security question reset ── */}
        {view === 'security-q' && (
          <div className={styles.form}>
            {sqDone ? (
              <div className={regStyles.success}>
                <div className={regStyles.successIcon}>✓</div>
                <h3 className={regStyles.successTitle}>Password reset</h3>
                <p className={regStyles.successMsg}>Your password has been reset. You can now log in.</p>
                <button className={styles.submitBtn} onClick={resetToLogin}>Back to Login</button>
              </div>
            ) : sqStep === 'email' ? (
              <form onSubmit={handleSqGetQuestion} noValidate>
                <p className={styles.forgotDesc}>Reset using your security question.</p>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input className={styles.input} type="email" value={sqEmail} onChange={e => setSqEmail(e.target.value)} placeholder="your@email.com" autoFocus disabled={sqLoading} />
                </div>
                {sqError && <div className={styles.error}>{sqError}</div>}
                <div className={styles.forgotActions}>
                  <button type="button" className={styles.backBtn} onClick={resetToLogin}><UilArrowLeft size={16} /> Back</button>
                  <button type="submit" className={styles.submitBtn} disabled={sqLoading}>
                    {sqLoading ? 'Loading…' : 'Next'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSqReset} noValidate>
                <div className={styles.field}>
                  <label className={styles.label} style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sqQuestion}</label>
                  <input className={styles.input} type="text" value={sqAnswer} onChange={e => setSqAnswer(e.target.value)} placeholder="Your answer" autoFocus disabled={sqLoading} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>New Password (min 8 chars)</label>
                  <input className={styles.input} type="password" value={sqNewPw} onChange={e => setSqNewPw(e.target.value)} disabled={sqLoading} />
                </div>
                {sqError && <div className={styles.error}>{sqError}</div>}
                <div className={styles.forgotActions}>
                  <button type="button" className={styles.backBtn} onClick={() => { setSqStep('email'); setSqError(''); }}><UilArrowLeft size={16} /> Back</button>
                  <button type="submit" className={styles.submitBtn} disabled={sqLoading}>
                    {sqLoading ? 'Resetting…' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
