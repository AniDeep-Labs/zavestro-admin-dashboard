import React from 'react';
import styles from './StatusBadge.module.css';
import { STATUS_VOCAB, statusLabel } from './vocab';
import type { StatusTone } from './vocab';

export interface StatusBadgeProps {
  status: string;
  /** Override the label only (tone still comes from the vocabulary). */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
  title,
}) => {
  const tone: StatusTone = STATUS_VOCAB[status]?.tone ?? 'neutral';
  return (
    <span
      className={`${styles.badge} ${styles[`tone-${tone}`]} ${styles[`size-${size}`]} ${className}`}
      title={title}
    >
      {label ?? statusLabel(status)}
    </span>
  );
};
