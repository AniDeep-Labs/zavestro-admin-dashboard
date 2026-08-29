import React from 'react';
import styles from './StatusBadge.module.css';
import { STATUS_VOCAB, statusLabel } from './vocab';
import type { StatusTone } from './vocab';

export interface StatusBadgeProps {
  status: string;
  /** Override the label only (tone still comes from the vocabulary). */
  label?: string;
  /**
   * [PRC-15-6] Override the tone as well, for the case where the status is genuinely
   * correct but the row is an exception within it — a receipt IS "received" whether it
   * arrived clean or at 5× the pushed quantity, and the vocabulary has no way to say the
   * second one is worth looking at.
   */
  tone?: StatusTone;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  tone: toneOverride,
  size = 'md',
  className = '',
  title,
}) => {
  const tone: StatusTone = toneOverride ?? STATUS_VOCAB[status]?.tone ?? 'neutral';
  return (
    <span
      className={`${styles.badge} ${styles[`tone-${tone}`]} ${styles[`size-${size}`]} ${className}`}
      title={title}
    >
      {label ?? statusLabel(status)}
    </span>
  );
};
