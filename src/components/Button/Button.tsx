import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  state?: 'default' | 'loading' | 'disabled';
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  state = 'default',
  icon,
  children,
  onClick,
  fullWidth = false,
  className = '',
  type = 'button',
  ariaLabel,
  disabled = false,
}) => {
  return (
    <button
      type={type}
      className={`
        ${styles.button}
        ${styles[`variant-${variant}`]}
        ${styles[`size-${size}`]}
        ${styles[`state-${state}`]}
        ${fullWidth ? styles.fullWidth : ''}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled || state === 'loading' || state === 'disabled'}
      aria-label={ariaLabel}
    >
      {state === 'loading' && <span className={styles.spinner} />}
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const IconButton: React.FC<ButtonProps> = (props) => {
  const sizeMap = { sm: '32px', md: '40px', lg: '48px' };
  return (
    <button
      type={props.type || 'button'}
      className={`${styles.iconButton} ${styles[`variant-${props.variant || 'primary'}`]} ${props.className || ''}`}
      style={{ width: sizeMap[props.size || 'md'], height: sizeMap[props.size || 'md'] }}
      onClick={props.onClick}
      disabled={props.disabled || props.state === 'loading' || props.state === 'disabled'}
      aria-label={props.ariaLabel}
    >
      {props.state === 'loading' ? <span className={styles.spinner} /> : props.children}
    </button>
  );
};
