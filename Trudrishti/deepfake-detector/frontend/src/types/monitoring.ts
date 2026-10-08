export interface ReportMetadata {
  batch_id: string;
  report_url: string;
  created_at: string | null;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  status?: string;
}


export interface ReportInfo {
  batch_id: string;
  html_available: boolean;
  pdf_available: boolean;
  created_at: string | null;
}

export interface MisclassifiedImage {
  id: number;
  image_id: number;
  batch_id: string;
  timestamp: string | null;
  filename: string;
  ground_truth: 'REAL' | 'FAKE';
  prediction: 'REAL' | 'FAKE';
  confidence: number; // 0.0 - 1.0
  error_type: 'FALSE_POSITIVE' | 'FALSE_NEGATIVE';
  image_url: string;
  download_url: string;
  thumbnail_url: string;
}

export interface MisclassifiedImagesResponse {
  false_positive_count: number;
  false_negative_count: number;
  total_misclassified: number;
  images: MisclassifiedImage[];
}

export interface BatchAnalytics {
  batch_id: string;
  accuracy: number;
  false_positive_count: number;
  false_negative_count: number;
  hardest_images: MisclassifiedImage[];
}
