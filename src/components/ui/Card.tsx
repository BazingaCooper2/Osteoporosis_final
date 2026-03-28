import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'navy';
  padding?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'lg',
  animate = false,
}: CardProps) {
  return (
    <div
      className={[
        styles.card,
        styles[variant],
        styles[`pad-${padding}`],
        animate ? styles.animate : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
