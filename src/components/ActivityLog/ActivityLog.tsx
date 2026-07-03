import React from 'react';
import type { StatusTone } from '../StatusBadge';
import styles from './ActivityLog.module.css';

/**
 * ActivityLog - the canonical vertical timeline (FABLE-ADMIN-UIUX 2.7) for
 * order stages, audit trails, ticket threads. One node per event: when, who,
 * what. The marker hue reuses the StatusBadge tone scale so colour means the
 * same thing everywhere.
 */
export interface ActivityEntry {
  id: string;
  /** Pre-formatted timestamp string (caller controls locale/format). */
  at: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  /** Actor / source (e.g. "Finance - Priya"). */
  actor?: React.ReactNode;
  /** Marker hue; defaults to neutral. */
  tone?: StatusTone;
}

export interface ActivityLogProps {
  entries: ActivityEntry[];
  emptyText?: string;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  entries,
  emptyText = 'No activity yet.',
}) => {
  if (!entries.length) {
    return <p className={styles.empty}>{emptyText}</p>;
  }
  return (
    <ol className={styles.log}>
      {entries.map((e) => (
        <li key={e.id} className={styles.item}>
          <span className={`${styles.marker} ${styles[`tone-${e.tone ?? 'neutral'}`]}`} aria-hidden="true" />
          <div className={styles.content}>
            <div className={styles.head}>
              <span className={styles.title}>{e.title}</span>
              <time className={styles.time}>{e.at}</time>
            </div>
            {e.detail && <div className={styles.detail}>{e.detail}</div>}
            {e.actor && <div className={styles.actor}>{e.actor}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
};
