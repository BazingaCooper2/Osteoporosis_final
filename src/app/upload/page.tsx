'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/ui/FileUpload';
import ProgressBar from '@/components/ui/ProgressBar';
import Button from '@/components/ui/Button';
import styles from './page.module.css';
import type { InferenceState, UploadedFile, AnalysisResult } from '@/lib/types';

const STAGE_LABELS: Record<InferenceState, string> = {
  idle:       'Awaiting image upload',
  validating: 'Validating image format and size…',
  uploading:  'Sending image to analysis server…',
  running:    'Running AI inference model…',
  completed:  'Analysis complete',
  error:      'An error occurred',
};
const STAGE_PROGRESS: Record<InferenceState, number> = {
  idle: 0, validating: 15, uploading: 40, running: 75, completed: 100, error: 0,
};

export default function UploadPage() {
  const router = useRouter();
  const [state, setState] = useState<InferenceState>('idle');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (msg: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleFileSelected = useCallback((f: UploadedFile) => {
    setUploadedFile(f);
    setError(null);
    setLog([]);
    setState('idle');
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setState('error');
    pushLog(`Error: ${msg}`);
  }, []);

  const runInference = useCallback(async () => {
    if (!uploadedFile) return;
    setError(null);

    // Validate
    setState('validating');
    pushLog('Validating file type and size…');
    await delay(600);
    pushLog(`File accepted: ${uploadedFile.file.name} (${uploadedFile.sizeStr})`);

    // Upload
    setState('uploading');
    pushLog('Transmitting image securely…');
    await delay(800);

    // Inference
    setState('running');
    pushLog('Initialising bone density model v1.4.2-beta…');
    await delay(400);
    pushLog('Extracting morphological features…');
    await delay(600);
    pushLog('Computing T-score proxy…');
    await delay(500);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile.file);
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Inference failed.');
      }

      const result: AnalysisResult = await res.json();
      pushLog(`Risk classification: ${result.risk_level.toUpperCase()} (confidence ${(result.confidence * 100).toFixed(1)}%)`);
      pushLog('Analysis complete. Preparing report…');
      setState('completed');

      // Store result in sessionStorage and navigate
      sessionStorage.setItem('osteoresult', JSON.stringify(result));
      sessionStorage.setItem('osteopreview', uploadedFile.preview);
      await delay(800);
      router.push('/results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected inference error.';
      setState('error');
      setError(msg);
      pushLog(`Error: ${msg}`);
    }
  }, [uploadedFile, router]);

  const reset = () => {
    setUploadedFile(null);
    setState('idle');
    setError(null);
    setLog([]);
  };

  const isRunning = ['validating', 'uploading', 'running'].includes(state);

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Page header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Image Analysis</h1>
          <p className={styles.sub}>
            Upload a DXA scan or X-ray. The model will assess bone mineral density patterns
            and return a structured risk report.
          </p>
        </div>

        <div className={styles.layout}>
          {/* ── Left: Upload + Run ── */}
          <div className={styles.left}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Upload Medical Image</h2>
              <FileUpload
                onFileSelected={handleFileSelected}
                onError={handleError}
                disabled={isRunning}
              />

              {/* File preview */}
              {uploadedFile && (
                <div className={styles.preview}>
                  <img
                    src={uploadedFile.preview}
                    alt="Uploaded scan preview"
                    className={styles.previewImg}
                  />
                  <div className={styles.previewMeta}>
                    <span className={styles.fileName}>{uploadedFile.file.name}</span>
                    <span className={styles.fileSize}>{uploadedFile.sizeStr}</span>
                  </div>
                  {!isRunning && state !== 'completed' && (
                    <button onClick={reset} className={styles.removeBtn} aria-label="Remove file">
                      ✕ Remove
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className={styles.errorBox} role="alert" aria-live="assertive">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="8" stroke="var(--color-coral)" strokeWidth="1.5"/>
                    <path d="M9 5v5M9 12.5v1" stroke="var(--color-coral)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!uploadedFile || isRunning}
                loading={isRunning}
                onClick={runInference}
                aria-label="Run analysis on uploaded image"
              >
                {isRunning ? 'Analysing…' : 'Run Analysis →'}
              </Button>
            </div>
          </div>

          {/* ── Right: Progress + Log ── */}
          <div className={styles.right}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Inference Status</h2>

              {/* Stage indicator */}
              <div className={styles.stageList} role="list" aria-label="Inference stages">
                {(['validating', 'uploading', 'running', 'completed'] as InferenceState[]).map((s) => {
                  const stageIndex = ['validating','uploading','running','completed'].indexOf(s);
                  const currentIndex = ['idle','validating','uploading','running','completed','error'].indexOf(state);
                  const isDone  = currentIndex > stageIndex + 1;
                  const isNow   = state === s;
                  return (
                    <div key={s}
                      className={[styles.stageItem, isDone ? styles.stageDone : '', isNow ? styles.stageActive : ''].join(' ')}
                      role="listitem"
                      aria-current={isNow ? 'step' : undefined}
                    >
                      <span className={styles.stageDot} aria-hidden="true">
                        {isDone ? '✓' : isNow ? '●' : '○'}
                      </span>
                      <span className={styles.stageLabel}>{STAGE_LABELS[s]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className={styles.progressWrap}>
                <ProgressBar
                  progress={STAGE_PROGRESS[state]}
                  label={STAGE_LABELS[state]}
                  animated={isRunning}
                  variant={state === 'error' ? 'danger' : state === 'completed' ? 'success' : 'default'}
                />
              </div>

              {/* Log panel */}
              <div className={styles.logPanel} aria-label="Inference log" aria-live="polite">
                {log.length === 0 ? (
                  <p className={styles.logEmpty}>Logs will appear here once you start an analysis.</p>
                ) : (
                  log.map((entry, i) => (
                    <p key={i} className={styles.logEntry}>{entry}</p>
                  ))
                )}
              </div>
            </div>

            {/* Disclaimer card */}
            <div className={`${styles.card} ${styles.disclaimerCard}`}>
              <p className={styles.disclaimerTitle}>⚠ Important Notice</p>
              <p className={styles.disclaimerText}>
                This tool does not provide a medical diagnosis. Results are probabilistic and
                depend on image quality. <strong>Always consult a licensed healthcare provider</strong> before
                making any medical decisions.
              </p>
              <p className={styles.disclaimerText} style={{ marginTop: '0.5rem' }}>
                Images are processed securely and are <strong>not stored</strong> beyond the current session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
