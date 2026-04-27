import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toggleTheme, getCurrentTheme } from '../../utils/theme';
import styles from './DesignerLayout.module.css';

const bottomTabs = [
  { id: 'dashboard', label: 'Home', icon: '🏠', path: '/designer/dashboard' },
  { id: 'designs', label: 'Designs', icon: '🎨', path: '/designer/designs' },
  { id: 'upload', label: 'Upload', icon: '+', path: '/designer/upload/details', isFab: true },
  { id: 'earnings', label: 'Earnings', icon: '💰', path: '/designer/earnings' },
  { id: 'profile', label: 'Profile', icon: '👤', path: '/designer/profile' },
];

export const DesignerLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = React.useState(getCurrentTheme());

  const isTabActive = (tab: typeof bottomTabs[0]) => {
    if (tab.id === 'upload') return location.pathname.startsWith('/designer/upload');
    if (tab.id === 'dashboard') return location.pathname === '/designer/dashboard';
    return location.pathname.startsWith(tab.path);
  };

  return (
    <div className={styles.layout}>
      {/* Top Header Bar */}
      <header className={styles.topBar}>
        <span className={styles.brandLogo} onClick={() => navigate('/designer/dashboard')}>
          Zavestro<span className={styles.brandSub}>Designer</span>
        </span>
        <div className={styles.topActions}>
          <button
            className={styles.iconBtn}
            onClick={() => { toggleTheme(); setTheme(getCurrentTheme()); }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className={styles.iconBtn} aria-label="Notifications">🔔</button>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className={styles.bottomNav} aria-label="Designer navigation">
        {bottomTabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.navTab} ${tab.isFab ? styles.fabTab : ''} ${isTabActive(tab) ? styles.navTabActive : ''}`}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={isTabActive(tab) ? 'page' : undefined}
          >
            {tab.isFab ? (
              <span className={styles.fabIcon}>{tab.icon}</span>
            ) : (
              <span className={styles.navTabIcon}>{tab.icon}</span>
            )}
            <span className={styles.navTabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
