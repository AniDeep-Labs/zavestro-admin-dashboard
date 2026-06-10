import React from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    footer={
      <>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} state={loading ? 'loading' : 'default'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
      {message}
    </div>
  </Modal>
);

export default ConfirmDialog;
