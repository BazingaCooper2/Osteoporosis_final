import React from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        loading ? styles.loading : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && (
        <span className={styles.spinner} aria-hidden="true" />
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className={styles.icon} aria-hidden="true">{icon}</span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span className={styles.icon} aria-hidden="true">{icon}</span>
      )}
    </button>
  );
}
