import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import axios, { AxiosError } from 'axios';
import type { ReportMetadata, ReportInfo, MisclassifiedImage, BatchAnalytics } from '@/types/monitoring';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('trudrishti_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('trudrishti_user');
      localStorage.removeItem('trudrishti_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export interface BatchMetrics {
  batch_id: string;
  total: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc: number;
  classDistribution: { name: string; value: number }[];
  predictionDistribution: { name: string; value: number }[];
  confidenceDistribution: { range: string; count: number }[];
}

export interface MonitoringContextType {
  reports: ReportMetadata[];
  inferences: any[];
  mlflowRuns: any[];
  loading: boolean;
  error: string | null;
  exportLoading: boolean;
  toastMessage: { type: 'success' | 'error'; text: string } | null;
  showToast: (text: string, type?: 'success' | 'error') => void;
  fetchReports: () => Promise<void>;
  fetchInferences: () => Promise<any[]>;
  fetchMlflowRuns: () => Promise<any[]>;
  getBatchMetrics: (batchId: string) => BatchMetrics | null;
  exportRetraining: (batchId: string) => Promise<void>;
  downloadFile: (url: string, filename: string) => Promise<void>;
  fetchMisclassified: (batchId: string) => Promise<any>;
  getRunIdForBatch: (batchId: string) => string;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<ReportMetadata[]>([]);
  const [inferences, setInferences] = useState<any[]>([]);
  const [mlflowRuns, setMlflowRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const fetchInferences = useCallback(async () => {
    try {
      const { data } = await api.get(`/inferences?_t=${Date.now()}`);
      const mapped = data.map((inf: any) => {
        let gt = null;
        if (inf.explanation) {
          const match = inf.explanation.match(/Ground Truth:\s*(REAL|FAKE)/i);
          if (match) {
            gt = match[1].toUpperCase();
          }
        }
        return {
          ...inf,
          ground_truth: gt || inf.ground_truth || null
        };
      });
      setInferences(mapped);
      return mapped;
    } catch (err) {
      console.error('Failed to fetch inferences:', err);
      return [];
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inferencesData = await fetchInferences();
      const { data } = await api.get<ReportMetadata[]>(`/reports?_t=${Date.now()}`);
      
      const enrichedReports = data.map(report => {
        const batchInfs = inferencesData.filter((inf: any) => 
          inf.batch_id === report.batch_id || 
          inf.batch_id === `eval_${report.batch_id}` || 
          `eval_${inf.batch_id}` === report.batch_id
        );
        
        const evalInfs = batchInfs.filter((inf: any) => inf.ground_truth !== null);
        if (evalInfs.length === 0) {
          return { ...report, accuracy: 0, precision: 0, recall: 0, f1_score: 0, status: 'SUCCESS' };
        }
        
        const tp = evalInfs.filter((x: any) => x.prediction === 'FAKE' && x.ground_truth === 'FAKE').length;
        const tn = evalInfs.filter((x: any) => x.prediction === 'REAL' && x.ground_truth === 'REAL').length;
        const fp = evalInfs.filter((x: any) => x.prediction === 'FAKE' && x.ground_truth === 'REAL').length;
        const fn = evalInfs.filter((x: any) => x.prediction === 'REAL' && x.ground_truth === 'FAKE').length;
        
        const total = tp + tn + fp + fn;
        const accuracy = total > 0 ? (tp + tn) / total : 0;
        const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
        const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
        const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
        
        return {
          ...report,
          accuracy: Math.round(accuracy * 1000) / 10,
          precision: Math.round(precision * 1000) / 10,
          recall: Math.round(recall * 1000) / 10,
          f1_score: Math.round(f1 * 1000) / 10,
          status: 'SUCCESS',
        };
      });
      
      setReports(enrichedReports);
    } catch (err) {
      let message = 'Failed to fetch monitoring reports.';
      if (err instanceof AxiosError && err.response) {
        message = err.response.data?.detail ?? message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchInferences]);

  const fetchMlflowRuns = useCallback(async () => {
    try {
      const { data } = await api.get(`/mlflow/runs?_t=${Date.now()}`);
      setMlflowRuns(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch MLflow runs:', err);
      return [];
    }
  }, []);

  const getRunIdForBatch = useCallback((batchId: string): string => {
    if (!batchId) return 'none';
    const run = mlflowRuns.find((r: any) => 
      r.tags?.batch_id === batchId || 
      r.tags?.batch_id === `eval_${batchId}` ||
      `eval_${r.tags?.batch_id}` === batchId ||
      r.run_name === `eval_run_${batchId}`
    );
    return run?.run_id || 'unknown';
  }, [mlflowRuns]);

  const getBatchMetrics = useCallback((batchId: string): BatchMetrics | null => {
    const batchInfs = inferences.filter((inf: any) => 
      inf.batch_id === batchId || 
      inf.batch_id === `eval_${batchId}` || 
      `eval_${inf.batch_id}` === batchId
    );
    
    const evalInfs = batchInfs.filter((inf: any) => inf.ground_truth !== null);
    if (evalInfs.length === 0) return null;

    const tp = evalInfs.filter((x: any) => x.prediction === 'FAKE' && x.ground_truth === 'FAKE').length;
    const tn = evalInfs.filter((x: any) => x.prediction === 'REAL' && x.ground_truth === 'REAL').length;
    const fp = evalInfs.filter((x: any) => x.prediction === 'FAKE' && x.ground_truth === 'REAL').length;
    const fn = evalInfs.filter((x: any) => x.prediction === 'REAL' && x.ground_truth === 'FAKE').length;
    const total = tp + tn + fp + fn;

    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1_score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Calculate ROC-AUC
    const sorted = [...evalInfs].sort((a, b) => {
      const probA = a.fake_probability !== undefined ? a.fake_probability : (a.prediction === 'FAKE' ? a.confidence : 100 - a.confidence);
      const probB = b.fake_probability !== undefined ? b.fake_probability : (b.prediction === 'FAKE' ? b.confidence : 100 - b.confidence);
      return probB - probA;
    });
    
    const positives = evalInfs.filter(x => x.ground_truth === 'FAKE').length;
    const negatives = evalInfs.filter(x => x.ground_truth === 'REAL').length;
    
    let auc = 1.0;
    if (positives > 0 && negatives > 0) {
      let accum = 0;
      let curTP = 0;
      let curFP = 0;
      let prevFP = 0;
      let prevTP = 0;
      for (const inf of sorted) {
        if (inf.ground_truth === 'FAKE') {
          curTP++;
        } else {
          curFP++;
        }
        if (curFP !== prevFP) {
          accum += ((prevTP / positives) + (curTP / positives)) * ((curFP - prevFP) / negatives) / 2;
          prevFP = curFP;
          prevTP = curTP;
        }
      }
      auc = Math.round(accum * 1000) / 1000;
    }

    // Class Distribution
    const actualReal = evalInfs.filter(x => x.ground_truth === 'REAL').length;
    const actualFake = evalInfs.filter(x => x.ground_truth === 'FAKE').length;
    const classDistribution = [
      { name: 'REAL', value: actualReal },
      { name: 'FAKE', value: actualFake },
    ];

    // Prediction Distribution
    const predReal = evalInfs.filter(x => x.prediction === 'REAL').length;
    const predFake = evalInfs.filter(x => x.prediction === 'FAKE').length;
    const predictionDistribution = [
      { name: 'REAL', value: predReal },
      { name: 'FAKE', value: predFake },
    ];

    // Confidence Distribution
    const confidenceDistribution = [
      { range: '0-20%', count: 0 },
      { range: '20-40%', count: 0 },
      { range: '40-60%', count: 0 },
      { range: '60-80%', count: 0 },
      { range: '80-100%', count: 0 },
    ];

    evalInfs.forEach(x => {
      const conf = x.confidence ?? 0;
      if (conf < 20) confidenceDistribution[0].count++;
      else if (conf < 40) confidenceDistribution[1].count++;
      else if (conf < 60) confidenceDistribution[2].count++;
      else if (conf < 80) confidenceDistribution[3].count++;
      else confidenceDistribution[4].count++;
    });

    return {
      batch_id: batchId,
      total,
      tp,
      tn,
      fp,
      fn,
      accuracy: Math.round(accuracy * 1000) / 10,
      precision: Math.round(precision * 1000) / 10,
      recall: Math.round(recall * 1000) / 10,
      f1_score: Math.round(f1_score * 1000) / 10,
      auc: Math.round(auc * 100) / 100,
      classDistribution,
      predictionDistribution,
      confidenceDistribution,
    };
  }, [inferences]);

  const exportRetraining = useCallback(async (batchId: string) => {
    setExportLoading(true);
    try {
      await api.post(`/batch/${batchId}/retraining-export`);
      showToast('Successfully exported retraining dataset to the server staging folder!');
    } catch (err) {
      let message = 'Failed to export retraining dataset.';
      if (err instanceof AxiosError && err.response) {
        message = err.response.data?.detail ?? message;
      }
      showToast(message, 'error');
    } finally {
      setExportLoading(false);
    }
  }, [showToast]);

  const downloadFile = useCallback(async (url: string, filename: string) => {
    try {
      const response = await api.get(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`, { responseType: 'blob' });
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(`Downloaded ${filename} successfully!`);
    } catch (err) {
      showToast('Failed to download file. Please check backend connection.', 'error');
    }
  }, [showToast]);

  const fetchMisclassified = useCallback(async (batchId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/batch/${batchId}/misclassified?_t=${Date.now()}`);
      return data;
    } catch (err) {
      let message = 'Failed to fetch misclassified images.';
      if (err instanceof AxiosError && err.response) {
        message = err.response.data?.detail ?? message;
      }
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('trudrishti_token');
    if (token) {
      fetchReports();
      fetchMlflowRuns();
    }
  }, [fetchReports, fetchMlflowRuns]);

  return React.createElement(
    MonitoringContext.Provider,
    {
      value: {
        reports,
        inferences,
        mlflowRuns,
        loading,
        error,
        exportLoading,
        toastMessage,
        showToast,
        fetchReports,
        fetchInferences,
        fetchMlflowRuns,
        getBatchMetrics,
        exportRetraining,
        downloadFile,
        fetchMisclassified,
        getRunIdForBatch,
      }
    },
    children
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}
