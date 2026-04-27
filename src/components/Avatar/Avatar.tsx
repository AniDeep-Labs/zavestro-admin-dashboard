import React from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  name,
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`${styles.avatar} ${styles[`size-${size}`]} ${className}`}>
      {src ? (
        <img src={src} alt={alt || name || ''} className={styles.image} />
      ) : name ? (
        <span className={styles.initials}>{getInitials(name)}</span>
      ) : (
        <span className={styles.fallback}>
          <svg width="60%" height="60%" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </span>
      )}
    </div>
  );
};

export interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max,
  size = 'md',
  className = '',
}) => {
  const childArray = React.Children.toArray(children);
  const visible = max ? childArray.slice(0, max) : childArray;
  const remaining = max ? childArray.length - max : 0;

  return (
    <div className={`${styles.group} ${className}`}>
      {visible.map((child, i) => (
        <div key={i} className={styles.groupItem}>
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className={`${styles.avatar} ${styles[`size-${size}`]} ${styles.remaining}`}>
          <span className={styles.initials}>+{remaining}</span>
        </div>
      )}
    </div>
  );
};
