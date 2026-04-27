import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  hoverable?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  rounded = true,
  hoverable = false,
  className = '',
  onClick,
}) => {
  return (
    <div
      className={`
        ${styles.card}
        ${styles[`variant-${variant}`]}
        ${styles[`padding-${padding}`]}
        ${rounded ? styles.rounded : ''}
        ${hoverable ? styles.hoverable : ''}
        ${onClick ? styles.clickable : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action, className = '' }) => {
  return (
    <div className={`${styles.cardHeader} ${className}`}>
      <div>
        <h3 className={styles.cardTitle}>{title}</h3>
        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export interface CardImageProps {
  src: string;
  alt: string;
  height?: string;
  className?: string;
}

export const CardImage: React.FC<CardImageProps> = ({ src, alt, height = '200px', className = '' }) => {
  return (
    <div className={`${styles.cardImage} ${className}`} style={{ height }}>
      <img src={src} alt={alt} />
    </div>
  );
};

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  className = '',
}) => {
  const changeColor = {
    positive: 'var(--color-success)',
    negative: 'var(--color-error)',
    neutral: 'var(--color-text-secondary)',
  };

  return (
    <Card variant="default" padding="md" className={className}>
      <div className={styles.statCard}>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue}>{value}</span>
          {change && (
            <span className={styles.statChange} style={{ color: changeColor[changeType] }}>
              {changeType === 'positive' && '↑ '}
              {changeType === 'negative' && '↓ '}
              {change}
            </span>
          )}
        </div>
        {icon && <div className={styles.statIcon}>{icon}</div>}
      </div>
    </Card>
  );
};
