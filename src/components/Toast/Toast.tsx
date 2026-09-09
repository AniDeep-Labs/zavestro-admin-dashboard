import React, { useEffect, useState, useCallback } from 'react';
import styles from './Toast.module.css';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  /** [KA5-2] Set by ToastContainer when identical toasts collapse. 1 (or absent) = single. */
  repeats?: number;
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
        <div className={styles.title}>
          {toast.title}
          {/* [KA5-2] Say that it happened more than once rather than repeating the card —
              the operator still learns the request count, without the stack. */}
          {(toast.repeats ?? 1) > 1 && <span className={styles.repeats}>×{toast.repeats}</span>}
        </div>
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
  // [KA5-2] One condition, one toast.
  //
  // A page that fires several fetches in parallel and is denied all of them raises the same
  // message once per request, and the stack rendered it once per request too — three
  // identical "You do not have permission" cards over the navigation. The operator has ONE
  // problem; the count of requests that hit it is an implementation detail.
  //
  // De-duplicated at RENDER rather than at the call sites: every page builds toasts its own
  // way, and a rule enforced in one place cannot be forgotten by the next one. Identity is
  // type + title + message, so two genuinely different failures still stack. The first id
  // wins, so dismissing removes the group.
  const shown: ToastData[] = [];
  const seen = new Map<string, number>();
  for (const t of toasts) {
    const key = `${t.type}|${t.title}|${t.message ?? ''}`;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, shown.length);
      shown.push(t);
    } else {
      shown[at] = { ...shown[at], repeats: (shown[at].repeats ?? 1) + 1 };
    }
  }

  return (
    <div className={`${styles.container} ${styles[`position-${position}`]}`} aria-live="polite">
      {shown.map((toast) => (
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
