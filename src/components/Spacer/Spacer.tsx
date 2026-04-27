import React from 'react';

export interface SpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  direction?: 'vertical' | 'horizontal';
}

const sizeMap: Record<string, string> = {
  xs: 'var(--spacing-xs)',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
  xl: 'var(--spacing-xl)',
  '2xl': 'var(--spacing-2xl)',
  '3xl': 'var(--spacing-3xl)',
  '4xl': 'var(--spacing-4xl)',
};

export const Spacer: React.FC<SpacerProps> = ({
  size = 'md',
  direction = 'vertical',
}) => {
  const value = sizeMap[size];
  return (
    <div
      style={
        direction === 'vertical'
          ? { height: value, width: '100%' }
          : { width: value, height: '100%', display: 'inline-block' }
      }
      aria-hidden="true"
    />
  );
};
