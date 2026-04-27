import React from 'react';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '/',
  className = '',
}) => {
  return (
    <nav aria-label="Breadcrumb" className={`${styles.breadcrumb} ${className}`}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className={styles.item}>
              {isLast ? (
                <span className={styles.current} aria-current="page">{item.label}</span>
              ) : (
                <>
                  <a
                    href={item.href || '#'}
                    className={styles.link}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                      }
                    }}
                  >
                    {item.label}
                  </a>
                  <span className={styles.separator} aria-hidden="true">{separator}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
