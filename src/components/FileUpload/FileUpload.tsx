import React, { useRef, useState } from 'react';
import styles from './FileUpload.module.css';

export interface FileUploadProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFiles,
  accept,
  multiple = false,
  maxSize,
  label,
  helperText,
  error,
  disabled = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);

    if (maxSize) {
      const oversized = files.find(f => f.size > maxSize);
      if (oversized) {
        setFileError(`File "${oversized.name}" exceeds max size of ${Math.round(maxSize / 1024 / 1024)}MB`);
        return;
      }
    }

    setFileError('');
    onFiles(files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const displayError = error || fileError;

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dragActive : ''} ${disabled ? styles.disabled : ''} ${displayError ? styles.dropzoneError : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        aria-label="Upload file"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
          className={styles.input}
          aria-hidden="true"
        />
        <div className={styles.content}>
          <span className={styles.icon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </span>
          <span className={styles.text}>
            Drag & drop files here, or <span className={styles.link}>browse</span>
          </span>
          {helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      </div>
      {displayError && <div className={styles.errorText} role="alert">{displayError}</div>}
    </div>
  );
};
