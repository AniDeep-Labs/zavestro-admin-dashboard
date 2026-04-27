import React from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''} ${className}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={styles.input}
        aria-checked={checked}
      />
      <span className={`${styles.track} ${styles[`size-${size}`]} ${checked ? styles.trackActive : ''}`}>
        <span className={`${styles.thumb} ${checked ? styles.thumbActive : ''}`} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
};
