import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  count?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height,
  variant = 'text',
  count = 1,
  className = '',
}) => {
  const defaultHeight = {
    text: '16px',
    rectangular: '120px',
    circular: width,
  };

  const h = height || defaultHeight[variant];

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${styles.skeleton} ${styles[variant]} ${className}`}
          style={{ width, height: h }}
          aria-hidden="true"
        />
      ))}
    </>
  );
};
