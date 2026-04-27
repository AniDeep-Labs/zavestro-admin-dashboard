import React from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../../api/catalogApi';
import styles from './AdminLoginPage.module.css';
import regStyles from './AdminRegisterPage.module.css';

export const AdminRegisterPage: React.FC = () => {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirm) {
      setError('All fields are required.');
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
      await catalogApi.registerAdmin({ name, email, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
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
            <h3 className={regStyles.successTitle}>Request submitted!</h3>
            <p className={regStyles.successMsg}>
              Your account has been created and is <strong>pending activation</strong>.
              A super admin will review and activate it — you'll receive confirmation once approved.
            </p>
            <p className={regStyles.successNote}>
              Do not try to log in until your account is activated.
            </p>
            <div className={regStyles.loginLink} style={{ marginTop: 8 }}>
              <Link to="/admin/login" className={regStyles.link}>Go to login page</Link>
            </div>
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
          <div className={styles.subtitle}>Request Admin Access</div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Work Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@zavestro.in"
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
                placeholder="Min 8 characters"
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
            {loading ? 'Submitting…' : 'Request Access →'}
          </button>

          <div className={regStyles.loginLink}>
            Already have an account?{' '}
            <Link to="/admin/login" className={regStyles.link}>Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
};
