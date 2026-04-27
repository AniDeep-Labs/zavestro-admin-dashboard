import React from 'react';
import styles from './Radio.module.css';

export interface RadioOption {
  label: string;
  value: string;
}

export interface RadioProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  label?: string;
  disabled?: boolean;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export const Radio: React.FC<RadioProps> = ({
  name,
  value,
  onChange,
  options,
  label,
  disabled = false,
  direction = 'vertical',
  className = '',
}) => {
  return (
    <fieldset className={`${styles.fieldset} ${className}`}>
      {label && <legend className={styles.legend}>{label}</legend>}
      <div className={`${styles.group} ${styles[direction]}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`${styles.option} ${disabled ? styles.disabled : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={styles.input}
            />
            <span className={styles.label}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
