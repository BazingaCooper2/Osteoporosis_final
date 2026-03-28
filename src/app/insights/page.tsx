'use client';
import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const RISK_FACTORS = [
  {
    title: 'Non-Modifiable Risk Factors',
    items: [
      'Age — bone density decreases after the age of 30',
      'Female sex — lower peak bone mass and estrogen decline post-menopause',
      'Family history of osteoporosis or hip fracture',
      'Small, slight body frame',
      'Ethnicity — white and Asian individuals are at higher risk',
      'Previous fragility fracture',
    ],
  },
  {
    title: 'Modifiable Risk Factors',
    items: [
      'Low dietary calcium and vitamin D intake',
      'Physical inactivity or sedentary lifestyle',
      'Excessive alcohol consumption (>3 units/day)',
      'Current smoking or history of smoking',
      'Low body weight or eating disorders',
      'Prolonged use of corticosteroids (>3 months)',
    ],
  },
  {
    title: 'Medical Conditions Affecting Bone Health',
    items: [
      'Rheumatoid arthritis',
      'Inflammatory bowel disease (Crohn\'s, ulcerative colitis)',
      'Chronic kidney or liver disease',
      'Hyperparathyroidism',
      'Hyperthyroidism',
      'Cancer treatments (chemotherapy, radiation)',
    ],
  },
];

const GUIDELINES = [
  {
    org: 'USPSTF',
    detail: 'Recommends DXA screening for women aged 65+; younger women at elevated risk based on FRAX tool.',
  },
  {
    org: 'NOF / ASBMR',
    detail: 'DXA of hip and lumbar spine; BMI measurement; vertebral imaging if vertebral fracture is suspected.',
  },
  {
    org: 'WHO',
    detail: 'T-score ≤ −2.5 SD = Osteoporosis diagnosis; −1 to −2.5 SD = Osteopenia.',
  },
  {
    org: 'IOF FRAX®',
    detail: 'Fracture Risk Assessment Tool estimates 10-year probability of major osteoporotic fracture.',
  },
];

const LIFESTYLE = [
  { icon: '🥛', label: 'Calcium', text: '1,000–1,200 mg/day (diet + supplement). Rich sources: dairy, leafy greens, fortified foods.' },
  { icon: '☀️', label: 'Vitamin D', text: '600–2,000 IU/day. Essential for calcium absorption. Sun exposure + supplementation.' },
  { icon: '🏋️', label: 'Exercise', text: 'Weight-bearing activities (walking, jogging, resistance training) 30+ min most days.' },
  { icon: '🚭', label: 'Avoid Smoking', text: 'Smoking accelerates bone loss and impairs calcium absorption.' },
  { icon: '🍷', label: 'Limit Alcohol', text: 'Limit to ≤2 drinks/day. Excess alcohol interferes with bone remodelling.' },
  { icon: '⚖️', label: 'Healthy Weight', text: 'Both low and high BMI negatively affect bone health. Maintain healthy, stable weight.' },
];

export default function InsightsPage() {
  const [openFactor, setOpenFactor] = useState<number | null>(0);

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Clinical Insights</h1>
          <p className={styles.sub}>
            Evidence-based information about osteoporosis, screening guidelines, fracture risk, and lifestyle management.
          </p>
        </div>

        {/* What is Osteoporosis */}
        <section className={`${styles.section} animate-fade-in-up`} aria-labelledby="what-title">
          <div className={styles.card}>
            <h2 id="what-title" className={styles.cardTitle}>What is Osteoporosis?</h2>
            <div className={styles.prose}>
              <p>
                Osteoporosis is a systemic skeletal disease characterised by reduced bone mineral density (BMD)
                and deterioration of bone microarchitecture, leading to increased bone fragility and susceptibility
                to fracture. It is often called a <strong>&ldquo;silent disease&rdquo;</strong> because bone loss occurs
                without symptoms until a fracture occurs.
              </p>
              <p>
                According to the WHO, a T-score of −2.5 or lower measured by dual-energy X-ray absorptiometry
                (DXA) at the femoral neck or lumbar spine defines osteoporosis. An estimated <strong>500 million
                people worldwide</strong> are affected, with one in two women and one in five men over 50
                experiencing an osteoporosis-related fracture in their lifetime.
              </p>
              <p>
                Common fracture sites include the <strong>vertebral spine, hip, wrist, and shoulder</strong>.
                Hip fractures carry significant morbidity and mortality, with up to 20% mortality in the
                12 months following the event in elderly patients.
              </p>
            </div>
          </div>
        </section>

        {/* Risk Factors */}
        <section className={styles.section} aria-labelledby="risk-title">
          <h2 id="risk-title" className={styles.sectionTitle}>Risk Factors</h2>
          <div className={styles.accordions}>
            {RISK_FACTORS.map(({ title, items }, idx) => (
              <div key={idx} className={styles.accordion}>
                <button
                  className={`${styles.accordionBtn} ${openFactor === idx ? styles.accordionOpen : ''}`}
                  onClick={() => setOpenFactor(openFactor === idx ? null : idx)}
                  aria-expanded={openFactor === idx}
                  aria-controls={`accordion-panel-${idx}`}
                  id={`accordion-btn-${idx}`}
                >
                  {title}
                  <svg
                    width="18" height="18" viewBox="0 0 18 18" fill="none"
                    className={styles.accordionChevron}
                    aria-hidden="true"
                    style={{ transform: openFactor === idx ? 'rotate(180deg)' : 'none' }}
                  >
                    <path d="M4 7l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {openFactor === idx && (
                  <div
                    className={styles.accordionPanel}
                    id={`accordion-panel-${idx}`}
                    role="region"
                    aria-labelledby={`accordion-btn-${idx}`}
                  >
                    <ul className={styles.riskList}>
                      {items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Screening Guidelines */}
        <section className={styles.section} aria-labelledby="guidelines-title">
          <h2 id="guidelines-title" className={styles.sectionTitle}>Screening Guidelines</h2>
          <div className={styles.guidelinesGrid}>
            {GUIDELINES.map(({ org, detail }) => (
              <div key={org} className={styles.guidelineCard}>
                <span className={styles.orgBadge}>{org}</span>
                <p className={styles.guidelineDetail}>{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lifestyle */}
        <section className={styles.section} aria-labelledby="lifestyle-title">
          <h2 id="lifestyle-title" className={styles.sectionTitle}>Lifestyle & Prevention</h2>
          <div className={styles.lifestyleGrid}>
            {LIFESTYLE.map(({ icon, label, text }) => (
              <div key={label} className={styles.lifestyleCard}>
                <span className={styles.lifestyleIcon} aria-hidden="true">{icon}</span>
                <strong className={styles.lifestyleLabel}>{label}</strong>
                <p className={styles.lifestyleText}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className={styles.ctaSection}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to assess your scan?</h2>
            <p className={styles.ctaSub}>
              Upload a DXA scan or X-ray for AI-assisted risk analysis. Results come with
              personalised next steps and a downloadable clinical report.
            </p>
            <Link href="/upload" className={styles.ctaBtn}>
              Upload Image for Analysis →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
