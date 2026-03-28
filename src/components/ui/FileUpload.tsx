'use client';
import { useRef, useState, useCallback } from 'react';
import styles from './FileUpload.module.css';
import Button from './Button';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export interface UploadFile {
  file: File;
  preview: string;
  sizeStr: string;
}

interface FileUploadProps {
  onFileSelected: (f: UploadFile) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
  allowMultiple?: boolean;
}

export default function FileUpload({ onFileSelected, onError, disabled, allowMultiple = false }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validate = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return `Unsupported format: ${file.name}. Please upload a .png or .jpg file.`;
      }
      if (file.size > MAX_SIZE_BYTES) {
        return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is ${MAX_SIZE_MB} MB.`;
      }
      return null;
    },
    []
  );

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) { onError(err); return; }
      const preview = URL.createObjectURL(file);
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
          : `${(file.size / 1024).toFixed(1)} KB`;
      onFileSelected({ file, preview, sizeStr });
    },
    [validate, onFileSelected, onError]
  );

  const processFileList = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      Array.from(fileList).forEach((file) => handleFile(file));
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      processFileList(e.dataTransfer.files);
    },
    [disabled, processFileList]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFileList(e.target.files);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [processFileList]
  );

  return (
    <div
      className={[styles.zone, isDragging ? styles.dragging : '', disabled ? styles.disabled : '']
        .filter(Boolean)
        .join(' ')}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop zone: upload a medical image"
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click(); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        multiple={allowMultiple}
        className={styles.hiddenInput}
        onChange={onInputChange}
        aria-label="File input"
        disabled={disabled}
        id="file-upload-input"
      />

      <div className={styles.content}>
        <div className={styles.iconWrap} aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="23" stroke="var(--color-teal)" strokeWidth="1.5" opacity="0.2"/>
            <path d="M24 14 L24 32 M16 22 L24 14 L32 22" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 36 L34 36" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className={styles.headline}>
          {isDragging ? 'Release to upload' : 'Drag & drop your medical image here'}
        </p>
        <p className={styles.subtext}>Supports DXA scans and X-ray images</p>

        <div className={styles.divider}><span>or</span></div>

        <Button
          variant="secondary"
          size="md"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 5v2.25H5v1.5h2.25V11h1.5V8.75H11v-1.5H8.75V5h-1.5z"/>
            </svg>
          }
          aria-controls="file-upload-input"
        >
          Browse Files
        </Button>

        <div className={styles.requirements}>
          <p>Accepted: PNG, JPG, JPEG</p>
          <p>Max size: {MAX_SIZE_MB} MB</p>
          <p>Image quality: 96 DPI minimum recommended</p>
        </div>
      </div>
    </div>
  );
}
