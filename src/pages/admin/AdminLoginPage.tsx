import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { catalogApi, setAdminToken, hasAdminToken } from '../../api/catalogApi';
import { setAdminUser } from '../../api/adminApi';
import styles from './AdminLoginPage.module.css';
import regStyles from './AdminRegisterPage.module.css';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Forgot password state
  const [showForgot, setShowForgot] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [forgotDone, setForgotDone] = React.useState(false);
  const [forgotError, setForgotError] = React.useState('');

  React.useEffect(() => {
    if (hasAdminToken()) navigate('/admin/dashboard', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await catalogApi.login(email, password);
      setAdminToken(res.token);
      setAdminUser({ email: res.user?.email ?? email, role: res.user?.role ?? 'admin' });
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        if (email === 'admin@zavestro.com' && password === 'admin') {
          setAdminToken('dev-mock-token');
          setAdminUser({ email, role: 'admin' });
          navigate('/admin/dashboard', { replace: true });
          return;
        }
        setError('API unreachable. Use admin@zavestro.com / admin for local dev.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail) { setForgotError('Enter your email.'); return; }

    setForgotLoading(true);
    try {
      await catalogApi.forgotPassword(forgotEmail);
      setForgotDone(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.wordmark}>Zavestro</div>
          <div className={styles.subtitle}>Admin Dashboard</div>
        </div>

        {!showForgot ? (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@zavestro.in"
                autoFocus
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.showBtn}
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <div className={styles.error} role="alert">{error}</div>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : null}
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>

            <button
              type="button"
              className={styles.forgotBtn}
              onClick={() => { setShowForgot(true); setError(''); }}
            >
              Forgot password?
            </button>

            <div className={regStyles.loginLink}>
              New team member?{' '}
              <Link to="/admin/register" className={regStyles.link}>Request access</Link>
            </div>
          </form>
        ) : (
          <div className={styles.form}>
            {!forgotDone ? (
              <form onSubmit={handleForgot} noValidate>
                <p className={styles.forgotDesc}>
                  Enter your email. A super admin will generate a reset link for you.
                </p>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-email">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    className={styles.input}
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                    disabled={forgotLoading}
                  />
                </div>
                {forgotError && <div className={styles.error} role="alert" style={{ marginTop: 8 }}>{forgotError}</div>}
                <div className={styles.forgotActions}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => { setShowForgot(false); setForgotDone(false); setForgotError(''); }}
                  >
                    ← Back
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={forgotLoading}>
                    {forgotLoading ? <span className={styles.spinner} /> : null}
                    {forgotLoading ? 'Sending…' : 'Request Reset'}
                  </button>
                </div>
              </form>
            ) : (
              <div className={regStyles.success}>
                <div className={regStyles.successIcon}>✓</div>
                <h3 className={regStyles.successTitle}>Request sent</h3>
                <p className={regStyles.successMsg}>
                  A super admin has been notified. They will share a reset link with you shortly.
                </p>
                <button
                  className={styles.submitBtn}
                  onClick={() => { setShowForgot(false); setForgotDone(false); }}
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
