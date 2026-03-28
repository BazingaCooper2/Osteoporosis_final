'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { AnalysisResult } from '@/lib/types';
import styles from './page.module.css';
import Link from 'next/link';

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('osteoresult');
    const storedPreview = sessionStorage.getItem('osteopreview');
    if (!stored) { router.replace('/upload'); return; }
    setResult(JSON.parse(stored));
    if (storedPreview) setPreview(storedPreview);
  }, [router]);

  const handleExportPdf = async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      const { exportResultPdf } = await import('@/lib/pdfExport');
      await exportResultPdf(result, preview ?? undefined);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!result) {
    return (
      <div className={styles.loading} aria-live="polite" aria-label="Loading results">
        <div className={styles.spinner} />
        <p>Loading results…</p>
      </div>
    );
  }

  const riskLevel = result.risk_level as 'low' | 'moderate' | 'high';
  const confPct = (result.confidence * 100).toFixed(1);
  const processedDate = new Date(result.processed_at).toLocaleString();

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Breadcrumb ── */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">›</span>
          <Link href="/upload">Analysis</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Results</span>
        </nav>

        {/* ── Page title ── */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>Analysis Results</h1>
            <p className={styles.processedAt}>Processed: {processedDate} · Model v{result.metrics.model_version}</p>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push('/upload')}
              icon={
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M6 11 L2 7 L6 3 M2 7 h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            >
              New Analysis
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={pdfLoading}
              onClick={handleExportPdf}
              icon={
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 10v3h11v-3M7.5 2v8M4.5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            >
              Export PDF
            </Button>
          </div>
        </div>

        <div className={styles.layout}>
          {/* ── LEFT: Summary + Metrics ── */}
          <div className={styles.left}>
            {/* Summary card */}
            <div className={`${styles.card} ${styles.summaryCard} animate-fade-in-up`}>
              <div className={styles.summaryTop}>
                <p className={styles.summaryLabel}>Risk Assessment</p>
                <Badge level={riskLevel} size="lg" />
              </div>
              <div className={styles.confRow}>
                <div className={styles.confMeter}>
                  <div
                    className={styles.confFill}
                    style={{ width: `${confPct}%` }}
                    aria-label={`Confidence ${confPct}%`}
                    role="meter"
                    aria-valuenow={parseFloat(confPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className={styles.confLabel}>Confidence {confPct}%</span>
              </div>
              <p className={styles.interpretation}>{result.interpretation}</p>
            </div>

            {/* Metrics table */}
            <div className={`${styles.card} animate-fade-in-up`} style={{ animationDelay: '80ms' }}>
              <h2 className={styles.cardTitle}>BMD Metrics</h2>
              <table className={styles.metricsTable}>
                <tbody>
                  <tr>
                    <td>T-Score</td>
                    <td>
                      <strong className={tScoreClass(result.metrics.t_score)}>
                        {result.metrics.t_score}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>BMD Estimate</td>
                    <td><strong>{result.metrics.bmd_estimate_gcm2} g/cm²</strong></td>
                  </tr>
                  <tr>
                    <td>WHO Classification</td>
                    <td>
                      <strong className={whoClass(result.metrics.who_classification)}>
                        {result.metrics.who_classification}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Scan Quality</td>
                    <td><strong>{result.metrics.scan_quality}</strong></td>
                  </tr>
                </tbody>
              </table>
              <p className={styles.metricsNote}>
                T-Score interpretation: &gt; −1 = Normal · −1 to −2.5 = Osteopenia · &lt; −2.5 = Osteoporosis (WHO)
              </p>
            </div>

            {/* Limitations card */}
            <div className={`${styles.card} ${styles.limitCard} animate-fade-in-up`} style={{ animationDelay: '160ms' }}>
              <h2 className={styles.cardTitle} style={{ color: 'var(--color-coral-dark)' }}>⚠ Limitations & Disclaimer</h2>
              <ul className={styles.limitList}>
                <li>This tool does <strong>not</strong> provide a medical diagnosis.</li>
                <li>Model outputs are probabilistic and may be inaccurate.</li>
                <li>Performance depends on input image quality.</li>
                <li>Not intended for use in pediatric populations.</li>
                <li>Out-of-distribution scans may produce unreliable results.</li>
              </ul>
              <p className={styles.limitCta}>
                Always consult a licensed healthcare provider before making any medical decisions.
              </p>
            </div>
          </div>

          {/* ── RIGHT: Heatmap + Next Steps + Insights link ── */}
          <div className={styles.right}>
            {/* Heatmap viewer */}
            <div className={`${styles.card} animate-fade-in-up`} style={{ animationDelay: '40ms' }}>
              <div className={styles.heatmapHeader}>
                <h2 className={styles.cardTitle}>Scan Preview</h2>
                <button
                  className={`${styles.toggleBtn} ${showHeatmap ? styles.toggleActive : ''}`}
                  onClick={() => setShowHeatmap((v) => !v)}
                  aria-pressed={showHeatmap}
                  aria-label="Toggle heatmap overlay"
                >
                  {showHeatmap ? 'Hide Overlay' : 'Show Overlay'}
                </button>
              </div>
              <div className={styles.heatmapWrap}>
                {preview ? (
                  <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                    <img src={preview} alt="Uploaded scan" className={styles.heatmapImg} />
                    {showHeatmap && (
                      <div className={styles.heatmapOverlay} aria-label="Heatmap overlay (illustrative)">
                        <span className={styles.heatmapLabel}>Illustrative overlay</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.heatmapPlaceholder}>
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" aria-hidden="true">
                      <circle cx="30" cy="30" r="28" stroke="var(--color-teal)" strokeWidth="1.5" opacity="0.2"/>
                      <path d="M20 30 Q30 20 40 30 Q30 40 20 30z" stroke="var(--color-teal)" strokeWidth="2" fill="none"/>
                    </svg>
                    <p>No preview available</p>
                  </div>
                )}
              </div>
              {showHeatmap && (
                <p className={styles.heatmapNote}>
                  Heatmap overlay is illustrative only. Gradient regions indicate areas of model attention, not clinical measurements.
                </p>
              )}
            </div>

            {/* Next Steps */}
            <div className={`${styles.card} animate-fade-in-up`} style={{ animationDelay: '120ms' }}>
              <h2 className={styles.cardTitle}>Recommended Next Steps</h2>
              <ol className={styles.nextSteps} aria-label="Recommended clinical next steps">
                {result.next_steps.map((step, i) => (
                  <li key={i} className={styles.nextStep}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Clinician CTA */}
            <div className={`${styles.card} ${styles.clinicCard} animate-fade-in-up`} style={{ animationDelay: '200ms' }}>
              <div className={styles.clinicIcon} aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="10" r="5" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M6 28c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M22 16 L26 20 M26 16 L22 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className={styles.clinicTitle}>Talk to a Clinician</p>
              <p className={styles.clinicSub}>
                Share this report with a bone health specialist or your primary care provider.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" loading={pdfLoading} onClick={handleExportPdf}>
                  Download PDF Report
                </Button>
                <Link href="/insights" className={styles.insightsLink}>
                  Read Clinical Insights →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function tScoreClass(score: number) {
  if (score > -1) return styles.metricGood;
  if (score > -2.5) return styles.metricWarn;
  return styles.metricBad;
}
function whoClass(classification: string) {
  if (classification === 'Normal') return styles.metricGood;
  if (classification === 'Osteopenia') return styles.metricWarn;
  return styles.metricBad;
}
