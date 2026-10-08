export interface ForensicIndicator {
  name: string;
  score: number;
  weight: string;
  explanation: string;
  status: string;
}

/** Detection API response shape */
export interface DetectionResult {
  prediction:         'REAL' | 'FAKE';
  confidence:         number;   // 0–100
  real_probability:   number;   // 0–100
  fake_probability:   number;   // 0–100
  gradcam_image:      string;   // base64 PNG
  srm_image:          string;   // base64 PNG
  srm_interpretation: string;
  confidence_tag:     string;
  explanation:        string;
  forensic_signals?:  ForensicIndicator[];
}

export interface BulkItemResult {
  filename: string;
  status: 'success' | 'error';
  error_detail?: string;
  prediction?: 'REAL' | 'FAKE';
  confidence?: number;
  real_probability?: number;
  fake_probability?: number;
  confidence_tag?: string;
  explanation?: string;
  forensic_signals?: ForensicIndicator[];
  gradcam_image?: string;
  srm_image?: string;
  srm_interpretation?: string;
}

/** State returned by useDetection hook */
export interface DetectionState {
  result:         DetectionResult | null;
  bulkResults:    BulkItemResult[] | null;
  loading:        boolean;
  error:          string | null;
  imageFile:      File | null; // For single image fallback
  imageUrl:       string | null; // For single image fallback
  imageFiles:     File[]; // For bulk selection
  imageUrls:      string[]; // For bulk previews
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface ConfusionMatrixData {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

export interface AggregateMetricsData {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  confusion_matrix: ConfusionMatrixData;
}

export interface EvaluationItemResponse {
  batch_id: string;
  timestamp: string;
  filename: string;
  prediction: string;
  confidence: number;
  real_probability: number;
  fake_probability: number;
  ground_truth?: string | null;
  status: 'success' | 'error';
  error_detail?: string | null;
}

export interface BulkEvaluationResponse {
  batch_id: string;
  report_url?: string;
  metrics?: AggregateMetricsData | null;
  predictions: EvaluationItemResponse[];
}

