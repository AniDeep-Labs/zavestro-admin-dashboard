import React from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogApi, setAdminToken, hasAdminToken } from '../../api/catalogApi';
import { setAdminUser, setAdminCapabilities, adminAuthExtApi } from '../../api/adminApi';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import styles from './AdminLoginPage.module.css';
import regStyles from './AuthCard.module.css';
import { UilArrowLeft, UilArrowRight, UilEye, UilEyeSlash, UilSpinner } from "@iconscout/react-unicons";
import { isProductionApi, apiHost } from '../../api/apiBase'; // [KA1-6]

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

  // Forgot-password: email a reset link (self-service, no super admin needed)
  const [fpEmail, setFpEmail] = React.useState('');
  const [fpLoading, setFpLoading] = React.useState(false);
  const [fpError, setFpError] = React.useState('');
  const [fpDone, setFpDone] = React.useState(false);

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
      // [SHL-2-12] `?? 'admin'` — the legacy god-mode role — was the fallback here, the
      // same fail-open F-58b/SHL-3-6 already closed in AdminLayout. This is the write that
      // FEEDS that cache, so it is where the wrong default originates. If a login response
      // ever arrives without a role, the safe assumption is the one with no capabilities,
      // not the one with all of them. `'pending'` is the same fail-closed value the shell
      // reads, so the two cannot disagree about what "unknown" means.
      setAdminUser({ email: res.user?.email ?? email, role: res.user?.role ?? 'pending' });
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
      // [KA1-1] A rejected login is the one error every operator eventually hits, and it
      // rendered nothing at all — the 401 handler navigated the browser to the page it was
      // already on, remounting the form. It renders inline now, in the same slot the
      // client-side validation uses. The server says "Invalid credentials"; say which two
      // things to check, since that is the entire useful content of the message.
      const status = (err as { status?: number })?.status;
      setError(
        status === 401
          ? 'Email or password is incorrect'
          : err instanceof Error
            ? err.message
            : 'Login failed. Please try again.',
      );
      // The email survives (no reload clears it now); clear only the password, which has
      // to be retyped regardless.
      setPassword('');
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

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (!fpEmail) { setFpError('Enter your email.'); return; }
    setFpLoading(true);
    try {
      // Backend always returns { requested: true } (never reveals if the email
      // exists), so a success here just means "we processed it".
      await catalogApi.forgotPassword(fpEmail);
      setFpDone(true);
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Could not send the reset link. Try again.');
    } finally { setFpLoading(false); }
  };

  const resetToLogin = () => {
    setView('login'); setError(''); setSubmitted(false);
    setSqStep('email'); setSqEmail(''); setSqQuestion(''); setSqAnswer(''); setSqNewPw('');
    setSqError(''); setSqDone(false);
    setFpEmail(''); setFpError(''); setFpDone(false);
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
            {/* [SHL-2-4] Was a bare native <input type="checkbox"> — a stark white filled
                box in dark mode, next to a card that is otherwise built entirely from the
                design system. The canon component exists and this page simply wasn't
                using it. */}
            <div className={styles.rememberRow}>
              <Checkbox
                checked={rememberMe}
                onChange={setRememberMe}
                disabled={loading}
                /* [SHL-2-3] It said "for 30 days". LEG-8-4 capped the admin token at
                   MAX_ADMIN_TOKEN_TTL_SECONDS = 24h, so that a revocation record can
                   never expire while a token it kills is still alive — but nobody
                   moved the label, so the box promised 30 days and delivered 1.
                   Measured live: rememberMe=true returns a token with a 24.0h life.
                   The number is now what the server actually does. */
                label="Keep me signed in for 24 hours"
              />
            </div>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <UilSpinner size={16} className={styles.spinnerIcon} /> : null}
              {loading ? 'Signing in…' : <><span>Sign In</span><UilArrowRight size={16} /></>}
            </button>
            {/* [KA1-4] These were the only right-aligned text on a centred card — and the
                wrapper's `alignItems: center` did NOT fix it, because `.forgotBtn` carries
                `align-self: flex-end`, which wins over a parent's `align-items`.

                They were also peers of identical weight, so the operator had to choose
                between two recovery MECHANISMS before knowing which one their account
                supports. The email route works for every admin; the security question only
                works if that admin set one up, and at the login screen — unauthenticated —
                the console cannot know whether they did. So the one that always works is
                primary, and the conditional one says out loud that it is conditional. */}
            <div className={styles.recovery}>
              <button type="button" className={styles.forgotBtn} onClick={() => setView('forgot')}>
                Email me a reset link
              </button>
              <button type="button" className={styles.forgotAlt} onClick={() => setView('security-q')}>
                Use my security question <span className={styles.forgotAltHint}>— if you set one up</span>
              </button>
            </div>
            {/* [SHL-2-5] This said "New team member? Request access" and linked to a form
                that could not succeed — the worst possible first impression, aimed at
                exactly the person least able to tell a dead route from a real one. It is a
                statement now, because the truthful answer is a sentence, not a workflow:
                nobody can self-serve an admin account. */}
            <div className={regStyles.loginLink}>
              Need access? Ask a super admin to create your account.
            </div>
            {/* [KA1-6] The card floated in a large empty ground saying nothing. What that
                space is worth saying is WHICH BACKEND this sign-in will hit — the login
                screen is the one place you are guaranteed not to know yet, and [SHL-2-13]
                already established that a non-production build pointed at the live API is
                the combination nothing else on screen distinguishes. Same rule as the
                shell's banner, applied one screen earlier. */}
            {import.meta.env.MODE !== 'production' && (
              <div className={isProductionApi() ? styles.envNoteDanger : styles.envNote}>
                {isProductionApi()
                  ? `⚠ Signing in to the PRODUCTION API (${apiHost()}) — this is the live business.`
                  : `${import.meta.env.MODE === 'development' ? 'Local dev' : 'Staging'} · API: ${apiHost()}`}
              </div>
            )}
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

        {/* ── Forgot: email a self-service reset link ── */}
        {view === 'forgot' && (
          <div className={styles.form}>
            {fpDone ? (
              <div className={regStyles.success}>
                <div className={regStyles.successIcon}>✓</div>
                <h3 className={regStyles.successTitle}>Check your email</h3>
                <p className={regStyles.successMsg}>
                  If an account exists for <strong>{fpEmail}</strong>, we've emailed a password
                  reset link. It expires in 1 hour.
                </p>
                <button className={styles.submitBtn} onClick={resetToLogin}>Back to Login</button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} noValidate>
                <p className={styles.forgotDesc}>
                  Enter your account email and we'll send you a reset link.
                </p>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input className={styles.input} type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="your@email.com" autoFocus disabled={fpLoading} />
                </div>
                {fpError && <div className={styles.error}>{fpError}</div>}
                <div className={styles.forgotActions}>
                  <button type="button" className={styles.backBtn} onClick={resetToLogin}><UilArrowLeft size={16} /> Back</button>
                  <button type="submit" className={styles.submitBtn} disabled={fpLoading}>
                    {fpLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            )}
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
