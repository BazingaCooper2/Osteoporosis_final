'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/upload', label: 'Analyze Image' },
  { href: '/insights', label: 'Clinical Insights' },
  { href: '/about', label: 'About & Model Card' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className={styles.header} role="banner">
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} aria-label="OsteoScreen Home">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className={styles.logo}>
            <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
            <path d="M16 6 L16 26 M10 10 Q16 14 22 10 M10 22 Q16 18 22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={styles.brandName}>OsteoScreen</span>
          <span className={styles.brandTag}>Clinical Portal</span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <ul className={styles.navList} role="list">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`${styles.navLink} ${pathname === href ? styles.active : ''}`}
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/upload" className={styles.ctaBtn} aria-label="Start analysis">
          Start Analysis
        </Link>
      </div>
    </header>
  );
}
