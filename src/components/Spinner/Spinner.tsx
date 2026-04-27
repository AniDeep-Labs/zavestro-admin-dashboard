import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color,
  className = '',
}) => {
  return (
    <div
      className={`${styles.spinner} ${styles[`size-${size}`]} ${className}`}
      style={color ? { borderTopColor: color, borderRightColor: color } : undefined}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
