'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import FileUpload, { UploadFile } from '@/components/ui/FileUpload';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import type { AnalysisResult, InferenceState, StoredResult } from '@/lib/types';
import styles from './page.module.css';

type JobStatus = 'pending' | 'processing' | 'success' | 'error';

interface Job extends UploadFile {
  id: string;
  status: JobStatus;
  error?: string;
}

const STAGE_FLOW: InferenceState[] = ['idle', 'validating', 'uploading', 'running', 'completed'];

const STAGE_LABELS: Record<InferenceState, string> = {
  idle: 'Waiting to start',
  validating: 'Validating images',
  uploading: 'Uploading to server',
  running: 'Running inference',
  completed: 'Complete',
};

const STAGE_PROGRESS: Record<InferenceState, number> = {
  idle: 0,
  validating: 20,
  uploading: 45,
  running: 80,
  completed: 100,
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'Queued',
  processing: 'Processing',
  success: 'Ready',
  error: 'Error',
};

export default function UploadPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [stage, setStage] = useState<InferenceState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const pushLog = useCallback((message: string) => {
    setLogs((prev) => {
      const entry = `${new Date().toLocaleTimeString()} — ${message}`;
      return [...prev.slice(-80), entry];
    });
  }, []);

  const safeRevoke = useCallback((url?: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const updateJob = useCallback((id: string, data: Partial<Job>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...data } : job)));
  }, []);

  const handleFileSelected = useCallback(
    (upload: UploadFile) => {
      setBatchError(null);
      setJobs((prev) => [
        ...prev,
        {
          ...upload,
          id: generateJobId(),
          status: 'pending',
          error: undefined,
        },
      ]);
      pushLog(`Queued ${upload.file.name}`);
    },
    [pushLog]
  );

  const handleUploadError = useCallback(
    (msg: string) => {
      setBatchError(msg);
      pushLog(`Upload error: ${msg}`);
    },
    [pushLog]
  );

  const removeJob = useCallback(
    (id: string) => {
      setJobs((prev) => {
        const job = prev.find((item) => item.id === id);
        safeRevoke(job?.preview);
        return prev.filter((item) => item.id !== id);
      });
    },
    [safeRevoke]
  );

  const clearJobs = useCallback(() => {
    setJobs((prev) => {
      prev.forEach((job) => safeRevoke(job.preview));
      return [];
    });
    setBatchError(null);
    setLogs([]);
    setStage('idle');
  }, [safeRevoke]);

  const runBatchInference = useCallback(async () => {
    if (jobs.length === 0 || isProcessing) return;

    setBatchError(null);
    setIsProcessing(true);
    setStage('validating');
    setLogs([]);

    const collected: StoredResult[] = [];

    for (const job of jobs) {
      setCurrentJobId(job.id);
      updateJob(job.id, { status: 'processing', error: undefined });
      const prefix = `[${job.file.name}]`;

      try {
        pushLog(`${prefix} Validating image…`);
        setStage('validating');

        const formData = new FormData();
        formData.append('image', job.file);

        setStage('uploading');
        pushLog(`${prefix} Uploading to inference service…`);

        setStage('running');
        pushLog(`${prefix} Running inference…`);
        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = `Service returned ${response.status}`;
          try {
            const errJson = await response.json();
            if (errJson?.error) errorMessage = errJson.error;
          } catch {
            /* no-op */
          }
          throw new Error(errorMessage);
        }

        const result = (await response.json()) as AnalysisResult;
        updateJob(job.id, { status: 'success' });
        collected.push({ id: job.id, fileName: job.file.name, preview: job.preview, result });
        pushLog(`${prefix} Analysis complete.`);
        setStage('running');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected inference error.';
        updateJob(job.id, { status: 'error', error: message });
        pushLog(`${prefix} Error: ${message}`);
      }
    }

    if (collected.length) {
      setStage('completed');
      sessionStorage.setItem('osteoresults', JSON.stringify(collected));
      sessionStorage.removeItem('osteoresult');
      sessionStorage.removeItem('osteopreview');
      router.push('/results');
    } else {
      setBatchError('All analyses failed. Please review the errors and try again.');
      setStage('idle');
    }

    setIsProcessing(false);
    setCurrentJobId(null);
  }, [jobs, isProcessing, pushLog, router, updateJob]);

  const totalJobs = jobs.length;
  const currentJobIndex = currentJobId ? jobs.findIndex((job) => job.id === currentJobId) : -1;
  const currentJobName = currentJobIndex >= 0 ? jobs[currentJobIndex].file.name : null;
  const baseLabel = stage === 'idle' && totalJobs > 0 ? 'Ready to run batch' : STAGE_LABELS[stage];
  const progressLabel = currentJobName && totalJobs > 1
    ? `${baseLabel} • ${currentJobIndex + 1}/${totalJobs}`
    : baseLabel;

  const isRunning = useMemo(
    () => isProcessing && ['validating', 'uploading', 'running'].includes(stage),
    [isProcessing, stage]
  );

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Image Analysis</h1>
          <p className={styles.sub}>
            Upload a DXA scan or X-ray. The model will assess bone mineral density patterns
            and return a structured risk report.
          </p>
        </div>

        <div className={styles.layout}>
          <div className={styles.left}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Upload queue</h2>
              <FileUpload
                onFileSelected={handleFileSelected}
                onError={handleUploadError}
                disabled={isProcessing}
                allowMultiple
              />

              {batchError && (
                <div className={styles.errorBox} role="alert">
                  <strong>Batch error:</strong>
                  <span>{batchError}</span>
                </div>
              )}

              <div className={styles.queueHeader}>
                <span>{totalJobs} file{totalJobs === 1 ? '' : 's'} queued</span>
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={clearJobs}
                  disabled={!totalJobs || isProcessing}
                >
                  Clear queue
                </button>
              </div>

              {totalJobs === 0 ? (
                <p className={styles.queueEmpty}>No files queued yet. Drop images above to begin.</p>
              ) : (
                <div className={styles.previewList}>
                  {jobs.map((job) => {
                    const statusClass = styles[`status-${job.status}` as keyof typeof styles] ?? '';
                    return (
                      <div key={job.id} className={styles.preview}>
                        <Image
                          src={job.preview}
                          width={52}
                          height={52}
                          alt={`${job.file.name} preview`}
                          className={styles.previewImg}
                          unoptimized
                        />
                        <div className={styles.previewMeta}>
                          <span className={styles.fileName}>{job.file.name}</span>
                          <span className={styles.fileSize}>{job.sizeStr}</span>
                          {job.error && <span className={styles.jobError}>{job.error}</span>}
                        </div>
                        <span className={[styles.statusBadge, statusClass].join(' ')}>
                          {STATUS_LABEL[job.status]}
                        </span>
                        {!isProcessing && (
                          <button
                            type="button"
                            onClick={() => removeJob(job.id)}
                            className={styles.removeBtn}
                            aria-label={`Remove ${job.file.name}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!totalJobs || isProcessing}
                loading={isProcessing}
                onClick={runBatchInference}
                aria-label="Run analysis on queued images"
              >
                {isProcessing ? 'Analysing batch…' : 'Run Batch Analysis →'}
              </Button>
            </div>
          </div>

          <div className={styles.right}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Inference Status</h2>
              {currentJobName && isRunning && (
                <p className={styles.currentJob}>
                  Processing {currentJobName}
                  {totalJobs > 1 && currentJobIndex >= 0 ? ` (${currentJobIndex + 1}/${totalJobs})` : ''}
                </p>
              )}

              <div className={styles.stageList} role="list" aria-label="Inference stages">
                {STAGE_FLOW.map((flowStage) => {
                  const stageIndex = STAGE_FLOW.indexOf(flowStage);
                  const currentIndex = STAGE_FLOW.indexOf(stage);
                  const isDone = currentIndex > stageIndex;
                  const isNow = stage === flowStage;
                  return (
                    <div
                      key={flowStage}
                      className={[
                        styles.stageItem,
                        isDone ? styles.stageDone : '',
                        isNow ? styles.stageActive : '',
                      ].join(' ')}
                      role="listitem"
                      aria-current={isNow ? 'step' : undefined}
                    >
                      <span className={styles.stageDot} aria-hidden="true">
                        {isDone ? '✓' : isNow ? '●' : '○'}
                      </span>
                      <span className={styles.stageLabel}>{STAGE_LABELS[flowStage]}</span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.progressWrap}>
                <ProgressBar
                  progress={STAGE_PROGRESS[stage]}
                  label={progressLabel}
                  animated={isProcessing}
                  variant={stage === 'completed' ? 'success' : 'default'}
                />
              </div>

              <div className={styles.logPanel} aria-label="Inference log" aria-live="polite">
                {logs.length === 0 ? (
                  <p className={styles.logEmpty}>Logs will appear here once you start an analysis.</p>
                ) : (
                  logs.map((entry, idx) => (
                    <p key={`${entry}-${idx}`} className={styles.logEntry}>
                      {entry}
                    </p>
                  ))
                )}
              </div>
            </div>

            <div className={`${styles.card} ${styles.disclaimerCard}`}>
              <p className={styles.disclaimerTitle}>⚠ Important Notice</p>
              <p className={styles.disclaimerText}>
                This tool does not provide a medical diagnosis. Results are probabilistic and
                depend on image quality. <strong>Always consult a licensed healthcare provider</strong> before
                making any medical decisions.
              </p>
              <p className={styles.disclaimerText} style={{ marginTop: '0.5rem' }}>
                Images are processed during your session and are <strong>not stored</strong> beyond completion of the analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateJobId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
