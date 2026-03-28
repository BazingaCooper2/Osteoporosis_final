import Link from 'next/link';
import styles from './page.module.css';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Upload Your Image',
    desc: 'Securely upload a DXA scan or X-ray. PNG and JPG formats are supported. Images are processed in-session only and are not stored.',
  },
  {
    step: '02',
    title: 'AI Analysis',
    desc: 'Our model evaluates bone mineral density patterns, T-score proxies, and morphological indicators associated with osteoporosis.',
  },
  {
    step: '03',
    title: 'Review Results',
    desc: 'Receive a structured risk assessment with clinical context, recommended next steps, and an exportable PDF report for your clinician.',
  },
];

const STATS = [
  { value: 'WHO', label: 'Classification Standard' },
  { value: 'T-Score', label: 'BMD Metric' },
  { value: '20 MB', label: 'Max Image Size' },
  { value: 'AES-256', label: 'In-Transit Encryption' },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero} aria-labelledby="hero-headline">
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <div className={styles.heroBadge} aria-label="Tool type">
              <span className={styles.heroBadgeDot} aria-hidden="true" />
              Clinical Decision Support
            </div>
            <h1 id="hero-headline" className={styles.heroTitle}>
              AI-Assisted<br />
              <span className={styles.heroAccent}>Osteoporosis</span><br />
              Risk Assessment
            </h1>
            <p className={styles.heroSub}>
              Upload a DXA scan or X-ray to receive a structured risk assessment powered by
              machine learning. Designed to support — not replace — clinical judgment.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/upload" className={styles.ctaPrimary} aria-label="Upload image for analysis">
                Upload For Analysis
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3.75 9h10.5M9.75 5L14.25 9l-4.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link href="/insights" className={styles.ctaSecondary}>
                View Clinical Insights
              </Link>
            </div>
            <p className={styles.heroDisclaimer}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 6v4M7 4.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              For investigational use only · Not cleared for diagnostic use · Always consult a clinician
            </p>
          </div>

          <div className={styles.heroGraphic} aria-hidden="true">
            <div className={styles.boneCard}>
              <div className={styles.boneCardHeader}>
                <span className={styles.boneCardTitle}>Sample Analysis</span>
                <span className={styles.boneCardBadge}>Moderate Risk</span>
              </div>
              <svg className={styles.boneSvg} viewBox="0 0 200 260" fill="none">
                {/* Stylized femur/spine bone graphic */}
                <ellipse cx="100" cy="40" rx="35" ry="30" fill="#1C9CA7" opacity="0.15" stroke="#1C9CA7" strokeWidth="1.5"/>
                <rect x="82" y="68" width="36" height="130" rx="18" fill="#1C9CA7" opacity="0.12" stroke="#1C9CA7" strokeWidth="1.5"/>
                <ellipse cx="100" cy="200" rx="40" ry="32" fill="#1C9CA7" opacity="0.15" stroke="#1C9CA7" strokeWidth="1.5"/>
                {/* BMD density dots */}
                {[60,80,100,120,140,160].map((y,i) => (
                  <circle key={i} cx={90 + (i%3)*8} cy={y} r="2.5" fill="#1C9CA7" opacity={0.3 + i*0.1}/>
                ))}
                {/* Highlight area */}
                <rect x="86" y="100" width="28" height="50" rx="6" fill="#EE6A5F" opacity="0.2"/>
                <rect x="86" y="100" width="28" height="50" rx="6" stroke="#EE6A5F" strokeWidth="1.5" strokeDasharray="4 2"/>
              </svg>
              <div className={styles.metricRow}>
                <div className={styles.metric}>
                  <span className={styles.metricVal}>-1.8</span>
                  <span className={styles.metricLabel}>T-Score</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricVal}>0.72</span>
                  <span className={styles.metricLabel}>g/cm²</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricVal}>84%</span>
                  <span className={styles.metricLabel}>Confidence</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className={styles.statsBar} aria-label="Platform statistics">
        <div className="container">
          <div className={styles.statsGrid}>
            {STATS.map(({ value, label }) => (
              <div key={label} className={styles.statItem}>
                <span className={styles.statValue}>{value}</span>
                <span className={styles.statLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className={`${styles.howSection} section`} aria-labelledby="how-title">
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 id="how-title" className={styles.sectionTitle}>How It Works</h2>
            <p className={styles.sectionSub}>
              A transparent, three-step workflow from image to insight
            </p>
          </div>
          <div className={`${styles.stepsGrid} stagger-children`}>
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className={`${styles.stepCard} animate-fade-in-up`}>
                <div className={styles.stepNum} aria-hidden="true">{step}</div>
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepDesc}>{desc}</p>
              </div>
            ))}
          </div>
          <div className={styles.howCta}>
            <Link href="/upload" className={styles.ctaPrimary}>
              Get Started — Analyze an Image
            </Link>
          </div>
        </div>
      </section>

      {/* ── Safety Banner ── */}
      <section className={styles.safetyBanner} aria-label="Safety notice">
        <div className="container">
          <div className={styles.safetyInner}>
            <div className={styles.safetyIcon} aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 3L25 8v8c0 6.5-4.8 10.5-11 12-6.2-1.5-11-5.5-11-12V8L14 3z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                <path d="M10 14l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.safetyText}>
              <p className={styles.safetyTitle}>Your Privacy & Safety</p>
              <p>
                Uploaded images are processed in-session and <strong>not retained after analysis</strong>.
                This tool is for decision support only.{' '}
                <strong>If you have acute pain, trauma, or red-flag symptoms, seek immediate medical care.</strong>
              </p>
            </div>
            <Link href="/about" className={styles.safetyLink}>View Model Card →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
