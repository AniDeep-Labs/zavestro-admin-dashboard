import React from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';
import { useDialog } from './useDialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
}) => {
  // [DSA-45-2] One implementation of the trap, shared with the hand-rolled
  // overlays that cannot adopt this component's markup. See useDialog.
  const { dialogProps } = useDialog(open, onClose, title);

  if (!open) return null;

  // Portal to <body> so the fixed overlay sits at the true viewport root and dims the whole
  // page (sidebar + topbar included) — rendering inline traps it inside the scroll container.
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        // [DSA-45-2] role/aria-modal belong on the DIALOG, not the backdrop — on the
        // overlay they described the dimmed page as the dialog.
        {...dialogProps}
        className={`${styles.modal} ${styles[`size-${size}`]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button className={styles.close} onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}) => {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
        {message}
      </p>
      <div className={styles.confirmActions}>
        <button className={styles.cancelBtn} onClick={onClose}>
          {cancelText}
        </button>
        <button
          className={`${styles.confirmBtn} ${variant === 'danger' ? styles.confirmDanger : ''}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};
