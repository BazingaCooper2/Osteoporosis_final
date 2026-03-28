import styles from './Badge.module.css';

type RiskLevel = 'low' | 'moderate' | 'high' | 'unknown';

interface BadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: string }> = {
  low:      { label: 'Low Risk',      icon: '✓' },
  moderate: { label: 'Moderate Risk', icon: '!' },
  high:     { label: 'Elevated Risk', icon: '⚠' },
  unknown:  { label: 'Undetermined',  icon: '?' },
};

export default function Badge({ level, size = 'md', showIcon = true }: BadgeProps) {
  const { label, icon } = RISK_CONFIG[level];
  return (
    <span
      className={[styles.badge, styles[level], styles[size]].join(' ')}
      role="status"
      aria-label={`Risk level: ${label}`}
    >
      {showIcon && <span className={styles.iconDot} aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}
