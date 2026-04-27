import React, { useEffect, useState, useCallback } from 'react';
import styles from './Toast.module.css';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(dismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, dismiss]);

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'ⓘ',
  };

  return (
    <div className={`${styles.toast} ${styles[`type-${toast.type}`]} ${exiting ? styles.exit : ''}`} role="alert">
      <span className={styles.icon}>{iconMap[toast.type]}</span>
      <div className={styles.content}>
        <div className={styles.title}>{toast.title}</div>
        {toast.message && <div className={styles.message}>{toast.message}</div>}
      </div>
      <button className={styles.close} onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
};

export interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'top-right',
}) => {
  return (
    <div className={`${styles.container} ${styles[`position-${position}`]}`} aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

let toastCounter = 0;
export const createToast = (
  type: ToastData['type'],
  title: string,
  message?: string,
  duration?: number
): ToastData => ({
  id: `toast-${++toastCounter}-${Date.now()}`,
  type,
  title,
  message,
  duration,
});
