import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number; // 0–100
  label?: string;
  variant?: 'default' | 'success' | 'danger';
  showPercent?: boolean;
  animated?: boolean;
}

export default function ProgressBar({
  progress,
  label,
  variant = 'default',
  showPercent = true,
  animated = true,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={styles.wrapper}>
      {(label || showPercent) && (
        <div className={styles.meta}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.pct}>{clamped}%</span>}
        </div>
      )}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={[
            styles.fill,
            styles[variant],
            animated ? styles.animated : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
