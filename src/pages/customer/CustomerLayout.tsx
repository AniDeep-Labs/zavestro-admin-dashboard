import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toggleTheme, getCurrentTheme } from '../../utils/theme';
import styles from './CustomerLayout.module.css';

const navLinks = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'fabrics', label: 'Fabrics', path: '/fabrics' },
  { id: 'designs', label: 'Designs', path: '/designs' },
  { id: 'orders', label: 'Orders', path: '/orders/Z-2024-00521' },
  { id: 'account', label: 'Account', path: '/designer/onboarding' },
];

export const CustomerLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = React.useState(getCurrentTheme());

  const isLinkActive = (link: typeof navLinks[0]) => {
    if (link.id === 'home') return location.pathname === '/';
    if (link.id === 'orders') return location.pathname.startsWith('/orders');
    return location.pathname.startsWith(link.path);
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo} onClick={() => navigate('/')}>
            Zavestro
          </span>

          <nav className={styles.nav} aria-label="Main navigation">
            {navLinks.map(link => (
              <button
                key={link.id}
                className={`${styles.navLink} ${isLinkActive(link) ? styles.navLinkActive : ''}`}
                onClick={() => navigate(link.path)}
                aria-current={isLinkActive(link) ? 'page' : undefined}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className={styles.actions}>
            <button className={styles.actionBtn} aria-label="Search">🔍</button>
            <button className={styles.actionBtn} aria-label="Notifications">🔔</button>
            <button
              className={styles.actionBtn}
              onClick={() => { toggleTheme(); setTheme(getCurrentTheme()); }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className={styles.signInBtn} onClick={() => navigate('/designer/onboarding')}>
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <Outlet />
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>Zavestro</span>
          <span className={styles.footerTagline}>Made-to-order clothing, stitched to your measurements.</span>
          <div className={styles.footerLinks}>
            <button onClick={() => navigate('/')}>Home</button>
            <button onClick={() => navigate('/fabrics')}>Fabrics</button>
            <button onClick={() => navigate('/designs')}>Designs</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
