import React, { useState } from 'react';
import styles from './Alert.module.css';

export interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  closeable?: boolean;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  closeable = false,
  onClose,
  className = '',
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'ⓘ',
  };

  return (
    <div
      className={`${styles.alert} ${styles[`type-${type}`]} ${className}`}
      role="alert"
    >
      <span className={styles.icon}>{iconMap[type]}</span>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {message && <div className={styles.message}>{message}</div>}
      </div>
      {closeable && (
        <button
          className={styles.close}
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
          aria-label="Close alert"
        >
          ✕
        </button>
      )}
    </div>
  );
};
