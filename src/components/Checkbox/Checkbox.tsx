import React from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  indeterminate?: boolean;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
  className = '',
}) => {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        ref={el => { if (el) el.indeterminate = indeterminate; }}
        className={styles.input}
      />
      <span className={styles.checkmark} />
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
};
