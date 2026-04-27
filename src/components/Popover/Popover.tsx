import React, { useState, useRef, useEffect } from 'react';
import styles from './Popover.module.css';

export interface PopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  trigger?: 'click' | 'hover';
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  children,
  content,
  trigger = 'click',
  position = 'bottom',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trigger === 'click') {
      const handleClickOutside = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [trigger]);

  return (
    <div className={`${styles.wrapper} ${className}`} ref={ref} {...(trigger === 'hover' ? { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) } : {})}>
      <div {...(trigger === 'click' ? { onClick: () => setOpen(!open) } : {})} className={styles.trigger}>
        {children}
      </div>
      {open && (
        <div className={`${styles.popover} ${styles[`position-${position}`]}`}>
          {content}
        </div>
      )}
    </div>
  );
};
