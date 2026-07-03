import React from 'react';
import styles from './EmptyState.module.css';

/**
 * EmptyState — the canonical "nothing here" block (FABLE-ADMIN-UIUX §2.2).
 * Every list ships one, with the do-next action where one exists. A filtered
 * list that matched nothing should say so distinctly from a truly empty list.
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  /** compact = table-cell / drawer contexts */
  size?: 'md' | 'compact';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  body,
  action,
  size = 'md',
}) => (
  <div className={`${styles.wrap} ${size === 'compact' ? styles.compact : ''}`}>
    {icon && <div className={styles.icon}>{icon}</div>}
    <div className={styles.title}>{title}</div>
    {body && <div className={styles.body}>{body}</div>}
    {action && (
      <button type="button" className={styles.action} onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);
