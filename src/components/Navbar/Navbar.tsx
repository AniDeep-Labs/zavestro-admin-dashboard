import React, { useState } from 'react';
import styles from './Navbar.module.css';

export interface NavItem {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export interface NavbarProps {
  brand: React.ReactNode;
  items?: NavItem[];
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  brand,
  items = [],
  actions,
  sticky = true,
  className = '',
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={`${styles.navbar} ${sticky ? styles.sticky : ''} ${className}`}>
      <div className={styles.container}>
        <div className={styles.brand}>{brand}</div>

        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <span className={`${styles.hamburgerLine} ${mobileOpen ? styles.open : ''}`} />
        </button>

        <div className={`${styles.nav} ${mobileOpen ? styles.navOpen : ''}`}>
          <ul className={styles.navList}>
            {items.map((item, i) => (
              <li key={i}>
                <a
                  href={item.href || '#'}
                  className={`${styles.navLink} ${item.active ? styles.navLinkActive : ''}`}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                    setMobileOpen(false);
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </div>
    </nav>
  );
};
