import React, { useState } from 'react';
import styles from './Image.module.css';

export interface ImageProps {
  src: string;
  alt: string;
  width?: string;
  height?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  rounded?: boolean;
  fallback?: string;
  className?: string;
}

export const Image: React.FC<ImageProps> = ({
  src,
  alt,
  width = '100%',
  height = 'auto',
  objectFit = 'cover',
  rounded = false,
  fallback,
  className = '',
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imgSrc = error && fallback ? fallback : src;

  return (
    <div
      className={`${styles.wrapper} ${rounded ? styles.rounded : ''} ${className}`}
      style={{ width, height }}
    >
      {!loaded && <div className={styles.skeleton} />}
      <img
        src={imgSrc}
        alt={alt}
        className={`${styles.image} ${loaded ? styles.loaded : ''}`}
        style={{ objectFit }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
};
