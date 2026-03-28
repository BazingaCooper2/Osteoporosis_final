export interface AnalysisResult {
  risk_level: 'low' | 'moderate' | 'high';
  confidence: number;
  metrics: {
    t_score: number;
    bmd_estimate_gcm2: number;
    who_classification: string;
    model_version: string;
    scan_quality: string;
  };
  interpretation: string;
  next_steps: string[];
  heatmap_url: string | null;
  processed_at: string;
}

export type InferenceState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'running'
  | 'completed'
  | 'error';

export interface UploadedFile {
  file: File;
  preview: string;
  sizeStr: string;
}
