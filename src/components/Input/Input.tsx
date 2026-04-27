import React from 'react';
import styles from './Input.module.css';

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date' | 'time';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  required?: boolean;
  helperText?: string;
  maxLength?: number;
  name?: string;
  id?: string;
}

export const Input: React.FC<InputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  label,
  icon,
  iconPosition = 'left',
  size = 'md',
  className = '',
  required = false,
  helperText,
  maxLength,
  name,
  id,
}) => {
  const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={`${styles.inputWrapper} ${icon ? styles[`hasIcon-${iconPosition}`] : ''}`}>
        {icon && iconPosition === 'left' && <div className={styles.iconLeft}>{icon}</div>}
        <input
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${styles.input} ${styles[`size-${size}`]} ${error ? styles.inputError : ''} ${className}`}
          required={required}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        />
        {icon && iconPosition === 'right' && <div className={styles.iconRight}>{icon}</div>}
      </div>
      {error && <div id={`${inputId}-error`} className={styles.errorText} role="alert">{error}</div>}
      {helperText && !error && <div id={`${inputId}-helper`} className={styles.helperText}>{helperText}</div>}
      {maxLength && (
        <div className={styles.characterCount}>
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
};
