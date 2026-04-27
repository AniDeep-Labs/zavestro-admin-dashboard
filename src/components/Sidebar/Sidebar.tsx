import React from 'react';
import styles from './Sidebar.module.css';

export interface SidebarItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: string | number;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  collapsed?: boolean;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  header,
  footer,
  collapsed = false,
  className = '',
}) => {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${className}`}>
      {header && <div className={styles.header}>{header}</div>}
      <nav className={styles.nav}>
        {sections.map((section, si) => (
          <div key={si} className={styles.section}>
            {section.title && !collapsed && (
              <div className={styles.sectionTitle}>{section.title}</div>
            )}
            <ul className={styles.list}>
              {section.items.map((item, ii) => (
                <li key={ii}>
                  <a
                    href={item.href || '#'}
                    className={`${styles.item} ${item.active ? styles.itemActive : ''}`}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon && <span className={styles.icon}>{item.icon}</span>}
                    {!collapsed && <span className={styles.label}>{item.label}</span>}
                    {!collapsed && item.badge !== undefined && (
                      <span className={styles.badge}>{item.badge}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {footer && <div className={styles.footer}>{footer}</div>}
    </aside>
  );
};
