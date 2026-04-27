import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { catalogApi } from '../../api/catalogApi';
import styles from './AdminLoginPage.module.css';
import regStyles from './AdminRegisterPage.module.css';

export const AdminResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(false);

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.wordmark}>Zavestro</div>
          </div>
          <div className={styles.error} role="alert">
            Invalid or missing reset link. Please request a new password reset.
          </div>
          <div style={{ marginTop: 16 }}>
            <Link to="/admin/login" className={regStyles.link}>Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirm) {
      setError('Both fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await catalogApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. Token may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.wordmark}>Zavestro</div>
          </div>
          <div className={regStyles.success}>
            <div className={regStyles.successIcon}>✓</div>
            <h3 className={regStyles.successTitle}>Password reset</h3>
            <p className={regStyles.successMsg}>Your password has been updated. You can now sign in.</p>
            <button className={styles.submitBtn} onClick={() => navigate('/admin/login')}>
              Sign In →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.wordmark}>Zavestro</div>
          <div className={styles.subtitle}>Set New Password</div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">New Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoFocus
                autoComplete="new-password"
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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : null}
            {loading ? 'Updating…' : 'Set Password →'}
          </button>
        </form>
      </div>
    </div>
  );
};
