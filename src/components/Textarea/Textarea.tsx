import React from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  rows?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  className?: string;
  name?: string;
  id?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  value,
  onChange,
  placeholder,
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  maxLength,
  rows = 4,
  resize = 'vertical',
  className = '',
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
      <textarea
        id={inputId}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        rows={rows}
        className={`${styles.textarea} ${error ? styles.textareaError : ''} ${className}`}
        style={{ resize }}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
      />
      {error && <div id={`${inputId}-error`} className={styles.errorText} role="alert">{error}</div>}
      {helperText && !error && <div id={`${inputId}-helper`} className={styles.helperText}>{helperText}</div>}
      {maxLength && (
        <div className={styles.characterCount}>{value.length}/{maxLength}</div>
      )}
    </div>
  );
};
