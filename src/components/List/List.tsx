import React from 'react';
import styles from './List.module.css';

export interface ListItemProps {
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  children,
  leading,
  trailing,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`${styles.item} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {leading && <div className={styles.leading}>{leading}</div>}
      <div className={styles.content}>{children}</div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
};

export interface ListProps {
  children: React.ReactNode;
  divided?: boolean;
  className?: string;
}

export const List: React.FC<ListProps> = ({
  children,
  divided = true,
  className = '',
}) => {
  return (
    <div className={`${styles.list} ${divided ? styles.divided : ''} ${className}`} role="list">
      {children}
    </div>
  );
};
