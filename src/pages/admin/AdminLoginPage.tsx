import React from 'react';
import { useNavigate } from 'react-router-dom';
import { catalogApi, setAdminToken, hasAdminToken } from '../../api/catalogApi';
import styles from './AdminLoginPage.module.css';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Already logged in
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
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';

      // API unreachable (dev / CORS) — allow demo credentials as fallback
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        if (email === 'admin@zavestro.com' && password === 'admin') {
          setAdminToken('dev-mock-token');
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

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.wordmark}>Zavestro</div>
          <div className={styles.subtitle}>Admin Dashboard</div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@zavestro.com"
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

          <button type="button" className={styles.forgotBtn}>
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
};
