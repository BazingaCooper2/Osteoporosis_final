import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={`container ${styles.inner}`}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <p className={styles.brandName}>OsteoScreen</p>
            <p className={styles.tagline}>AI-assisted clinical decision support for osteoporosis screening.</p>
            <p className={styles.disclaimer}>
              For investigational use only. Not cleared for diagnostic use.
            </p>
          </div>
          <div>
            <p className={styles.colTitle}>Portal</p>
            <ul role="list" className={styles.linkList}>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/upload">Analyze Image</Link></li>
              <li><Link href="/insights">Clinical Insights</Link></li>
              <li><Link href="/about">Model Card</Link></li>
            </ul>
          </div>
          <div>
            <p className={styles.colTitle}>Safety</p>
            <p className={styles.safetyText}>
              If you have acute pain, trauma, or red-flag symptoms,{' '}
              <strong>seek immediate medical care</strong>.
            </p>
            <p className={styles.safetyText} style={{ marginTop: '0.5rem' }}>
              This tool does not provide a medical diagnosis. Always consult a licensed healthcare provider.
            </p>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} OsteoScreen. For clinical decision support only.</p>
          <p>Not a substitute for professional medical judgment.</p>
        </div>
      </div>
    </footer>
  );
}
