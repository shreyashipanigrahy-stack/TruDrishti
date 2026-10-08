import React, { useState, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileArchive, X, AlertCircle, CheckCircle2, 
  Target, ShieldAlert, Award, ChevronDown, ChevronUp, 
  Search, Table, Activity, ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';
import type { BulkEvaluationResponse, EvaluationItemResponse, BulkItemResult } from '@/types/detection';
import { useTheme } from '@/hooks/useTheme';
import { useMonitoring } from '@/hooks/useMonitoring';
import { ImageUploader } from '@/components/ImageUploader';
import { BulkResultsDashboard } from '@/components/BulkResultsDashboard';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

const formatToIST = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    let parsedStr = dateStr;
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
      parsedStr = dateStr.replace(' ', 'T') + 'Z';
    }
    const d = new Date(parsedStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false
    });
  } catch {
    return dateStr;
  }
};

interface BulkEvaluationPanelProps {
  scaleType: '3-grade' | '5-grade';
  bulkResults: BulkItemResult[] | null;
  loading: boolean;
  error: string | null;
  imageFiles: File[];
  imageUrls: string[];
  onDetect: (file: File | File[]) => void;
  onReset: () => void;
  selectedBatchId?: string;
  onSelectBatchId?: (id: string) => void;
}

interface MetricProps {
  label: string;
  value: number; // e.g. 91.43
  icon: React.ComponentType<any>;
  description: string;
  color: string;
  glowColor: string;
}

function RadialGauge({ label, value, icon: Icon, description, color, glowColor }: MetricProps) {
  const pct = Math.round(value * 100) / 100;
  const radius = 50;
  const circ = 2 * Math.PI * radius;
  const ratio = value / 100;
  const dashOffset = circ - (ratio * circ);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: `0 12px 30px ${glowColor}15` }}
      className="glass-card p-5 flex flex-col items-center justify-between text-center relative overflow-hidden group border"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
    >
      
      {/* Icon & Label */}
      <div className="flex items-center gap-2 mb-2 z-10">
        <div className="p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </span>
      </div>

      {/* SVG Radial Gauge */}
      <div className="relative my-3 z-10">
        <svg width="100" height="100" viewBox="0 0 120 120" className="rotate-[-90deg]">
          {/* Background Track */}
          <circle 
            cx="60" cy="60" r={radius} 
            fill="none" 
            stroke="var(--border-subtle)" 
            strokeWidth="10" 
          />
          {/* Animated Gauge Fill */}
          <motion.circle 
            cx="60" cy="60" r={radius} 
            fill="none" 
            stroke={color} 
            strokeWidth="10" 
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        {/* Value Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black font-mono tracking-tight text-[var(--text-primary)]">
            {pct}%
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed z-10 px-1">
        {description}
      </p>
    </motion.div>
  );
}

export function BulkEvaluationPanel({
  scaleType,
  bulkResults,
  loading: batchLoading,
  error: batchError,
  imageFiles,
  imageUrls,
  onDetect,
  onReset,
  selectedBatchId,
  onSelectBatchId,
}: BulkEvaluationPanelProps) {
  const { theme } = useTheme();
  const { fetchReports, fetchMlflowRuns } = useMonitoring();
  const [activeMode, setActiveMode] = useState<'zip' | 'batch'>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkEvaluationResponse | null>(null);

  const [zipDragging, setZipDragging] = useState(false);
  const [csvDragging, setCsvDragging] = useState(false);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<'ALL' | 'REAL' | 'FAKE'>('ALL');
  const [filterTruth, setFilterTruth] = useState<'ALL' | 'REAL' | 'FAKE' | 'UNLABELED'>('ALL');
  
  const [copiedBatchId, setCopiedBatchId] = useState(false);

  const handleCopyBatchId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedBatchId(true);
    setTimeout(() => setCopiedBatchId(false), 2000);
  };

  const downloadCSVReport = (res: BulkEvaluationResponse) => {
    const headers = ['Filename', 'Prediction', 'Confidence (%)', 'Real Probability (%)', 'Fake Probability (%)', 'Ground Truth', 'Status', 'Timestamp', 'Batch ID'];
    const rows = res.predictions.map(item => [
      item.filename,
      item.prediction,
      item.confidence.toFixed(2),
      item.real_probability.toFixed(2),
      item.fake_probability.toFixed(2),
      item.ground_truth || 'Unlabeled',
      item.status,
      item.timestamp,
      item.batch_id || res.batch_id
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `evaluation_report_${res.batch_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setZipFile(null);
    setCsvFile(null);
    setError(null);
    setResult(null);
    setPage(1);
    setExpandedId(null);
    setCopiedBatchId(false);
  };

  const triggerEvaluation = async () => {
    if (!zipFile) return;
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('trudrishti_token');

    const form = new FormData();
    form.append('zip_file', zipFile);
    if (csvFile) {
      form.append('csv_file', csvFile);
    }

    try {
      const response = await axios.post<BulkEvaluationResponse>(`${API_BASE}/batch-evaluate`, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      
      const newBatchId = response.data.batch_id;
      setResult(response.data);
      
      // Update the globally selected batch ID
      if (onSelectBatchId) {
        onSelectBatchId(newBatchId);
      }
      
      // Refetch reports and MLflow runs to invalidate cached state
      await fetchReports();
      const currentRuns = await fetchMlflowRuns();
      
      // Resolve run ID from new MLflow runs list
      const run = currentRuns.find((r: any) => 
        r.tags?.batch_id === newBatchId || 
        r.tags?.batch_id === `eval_${newBatchId}` ||
        `eval_${r.tags?.batch_id}` === newBatchId ||
        r.run_name === `eval_run_${newBatchId}`
      );
      const newRunId = run?.run_id || 'unknown';
      
      console.log('--- Bulk Evaluation Success ---');
      console.log('returned batch_id:', newBatchId);
      console.log('returned run_id:', newRunId);
      console.log('active_run_id:', newRunId);
      console.log('selected batch_id:', newBatchId);
      
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        'Bulk evaluation request failed. Make sure backend is running and files are valid.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Filtered predictions
  const filteredPredictions = useMemo(() => {
    if (!result) return [];
    return result.predictions.filter(item => {
      const matchesSearch = item.filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass = filterClass === 'ALL' || item.prediction === filterClass;
      
      let matchesTruth = true;
      if (filterTruth === 'UNLABELED') {
        matchesTruth = !item.ground_truth;
      } else if (filterTruth !== 'ALL') {
        matchesTruth = item.ground_truth === filterTruth;
      }

      return matchesSearch && matchesClass && matchesTruth;
    });
  }, [result, searchQuery, filterClass, filterTruth]);

  // Paginated items
  const itemsPerPage = 10;
  const totalItems = filteredPredictions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = useMemo(() => {
    return filteredPredictions.slice(startIndex, endIndex);
  }, [filteredPredictions, startIndex, endIndex]);

  const metricsData = useMemo(() => {
    if (!result || !result.metrics) return [];
    const m = result.metrics;
    return [
      {
        label: 'Accuracy',
        value: m.accuracy,
        icon: CheckCircle2,
        description: 'Proportion of correct deepfake and authentic classifications across all labeled images.',
        color: '#06b6d4',
        glowColor: 'rgba(6, 182, 212, 0.4)'
      },
      {
        label: 'Precision',
        value: m.precision,
        icon: Target,
        description: 'Confidence in flagged deepfakes: proportion of true deepfakes out of all images predicted FAKE.',
        color: '#10b981',
        glowColor: 'rgba(16, 185, 129, 0.4)'
      },
      {
        label: 'Recall',
        value: m.recall,
        icon: ShieldAlert,
        description: 'Proportion of actual deepfakes detected correctly by the model.',
        color: '#f59e0b',
        glowColor: 'rgba(245, 158, 11, 0.4)'
      },
      {
        label: 'F1-Score',
        value: m.f1_score,
        icon: Award,
        description: 'Harmonic mean of Precision and Recall. Represents overall model classification balance.',
        color: '#8b5cf6',
        glowColor: 'rgba(139, 92, 246, 0.4)'
      }
    ];
  }, [result]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl mx-auto flex flex-col gap-6"
    >
      {/* Header Info */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            Validation Suite
          </p>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <Activity className="w-6 h-6 text-[var(--cyan)]" />
            Model Bulk Evaluation
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">
            {activeMode === 'zip'
              ? 'Evaluate EfficientNet-B4 + SRM model accuracy. Provide a ZIP file. Optional CSV mappings or path structures within the ZIP will be parsed for ground truth labels.'
              : 'Analyze multiple images in bulk for deepfake indicators. Drag and drop multiple images to perform concurrent inferences.'}
          </p>
        </div>
        {activeMode === 'zip' && result && (
          <button
            onClick={handleReset}
            className="text-xs px-4 py-2 rounded-xl border hover:scale-105 active:scale-95 transition-all"
            style={{
              background: 'var(--bg-glass)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
          >
            New Evaluation
          </button>
        )}
        {activeMode === 'batch' && bulkResults && (
          <button
            onClick={onReset}
            className="text-xs px-4 py-2 rounded-xl border hover:scale-105 active:scale-95 transition-all"
            style={{
              background: 'var(--bg-glass)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
          >
            New Batch Analysis
          </button>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 p-1.5 rounded-2xl glass-card w-fit self-start mb-2 animate-fade-in" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-glass)' }}>
        <button
          type="button"
          onClick={() => setActiveMode('zip')}
          className="px-6 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300"
          style={{
            background: activeMode === 'zip' ? 'var(--cyan)' : 'transparent',
            color: activeMode === 'zip' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeMode === 'zip' ? '0 4px 12px var(--cyan-glow)' : 'none',
          }}
        >
          ZIP Evaluation
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('batch')}
          className="px-6 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-300"
          style={{
            background: activeMode === 'batch' ? 'var(--cyan)' : 'transparent',
            color: activeMode === 'batch' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeMode === 'batch' ? '0 4px 12px var(--cyan-glow)' : 'none',
          }}
        >
          Batch Images
        </button>
      </div>

      {activeMode === 'zip' && (
        <>
          {error && (
            <div className="p-4 rounded-xl border flex items-center gap-3" style={{ background: 'var(--status-error-bg)', borderColor: 'var(--status-error)' }}>
              <AlertCircle className="w-5 h-5 text-[var(--status-error)] shrink-0" />
              <p className="text-xs text-[var(--status-error)]">{error}</p>
            </div>
          )}

          {/* Loading Overlay */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border bg-[var(--bg-secondary)]/50" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--cyan)', borderTopColor: 'transparent' }} />
              <h3 className="text-md font-bold text-[var(--text-primary)] mb-1">Evaluating Batch Archive</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs text-center leading-relaxed">
                Extracting zip contents, running model inferences, and calculating classification metrics. This might take a moment.
              </p>
            </div>
          )}

          {/* ── SECTION 1: UPLOADER CONTROLS ── */}
          {!loading && !result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Zip Uploader */}
              <div
                onClick={() => zipInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setZipDragging(true); }}
                onDragLeave={() => setZipDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setZipDragging(false);
                  if (e.dataTransfer.files?.[0]) setZipFile(e.dataTransfer.files[0]);
                }}
                className={`glass-card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed transition-all duration-300 min-h-[220px] ${
                  zipDragging ? 'scale-[1.01] border-[var(--cyan)] shadow-[0_0_32px_var(--cyan-glow)]' : 'border-[var(--border-subtle)] hover:border-[var(--cyan)]/50'
                }`}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-light)' }}>
                  <FileArchive className="w-6 h-6 text-[var(--cyan)] animate-pulse" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold block text-[var(--text-primary)]">ZIP Images Archive *</span>
                  <span className="text-[11px] text-[var(--text-secondary)] block mt-1">Drag and drop or click to upload</span>
                </div>
                {zipFile ? (
                  <span className="text-xs font-mono px-3 py-1 rounded bg-[var(--primary-light)] text-[var(--cyan)] border border-[var(--cyan)]/30">
                    {zipFile.name} ({(zipFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">ZIP file required</span>
                )}
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  onChange={e => { if (e.target.files?.[0]) setZipFile(e.target.files[0]); }}
                  className="hidden"
                />
              </div>

              {/* CSV Uploader */}
              <div
                onClick={() => csvInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                onDragLeave={() => setCsvDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setCsvDragging(false);
                  if (e.dataTransfer.files?.[0]) setCsvFile(e.dataTransfer.files[0]);
                }}
                className={`glass-card p-8 flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed transition-all duration-300 min-h-[220px] ${
                  csvDragging ? 'scale-[1.01] border-[var(--cyan)] shadow-[0_0_32px_var(--cyan-glow)]' : 'border-[var(--border-subtle)] hover:border-[var(--cyan)]/50'
                }`}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--status-success-bg)' }}>
                  <Table className="w-6 h-6 text-[var(--status-success)]" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold block text-[var(--text-primary)]">Ground Truth CSV</span>
                  <span className="text-[11px] text-[var(--text-secondary)] block mt-1">Drag and drop or click to upload</span>
                </div>
                {csvFile ? (
                  <span className="text-xs font-mono px-3 py-1 rounded bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--border-success)]">
                    {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">Optional labels file (columns: image, label)</span>
                )}
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={e => { if (e.target.files?.[0]) setCsvFile(e.target.files[0]); }}
                  className="hidden"
                />
              </div>

              {/* Action Trigger */}
              <div className="md:col-span-2">
                <motion.button
                  disabled={!zipFile}
                  whileHover={zipFile ? { scale: 1.005 } : {}}
                  whileTap={zipFile ? { scale: 0.995 } : {}}
                  onClick={triggerEvaluation}
                  className={`w-full py-4 rounded-xl font-mono text-xs uppercase font-extrabold flex items-center justify-center gap-2 border transition-all ${
                    zipFile 
                      ? 'bg-[var(--primary-light)] border-[var(--cyan)]/40 text-[var(--cyan)] cursor-pointer hover:border-[var(--cyan)] hover:bg-[var(--primary-light)]/90'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-disabled)] cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Run Bulk Model Evaluation
                </motion.button>
              </div>
            </div>
          )}

          {/* ── SECTION 2: RESULTS VIEW ── */}
          {!loading && result && (
            <div className="flex flex-col gap-6">
              
              {/* Batch Information Banner */}
              <div 
                className="p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap" 
                style={{ 
                  background: 'var(--bg-card)', 
                  borderColor: 'var(--border-subtle)' 
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[var(--primary-light)] border border-[var(--cyan)]/20">
                    <Activity className="w-5 h-5 text-[var(--cyan)]" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-0.5">
                      Evaluation Batch ID
                    </span>
                    <span className="text-sm font-mono font-bold text-[var(--text-primary)] selection:bg-[var(--primary-light)]">
                      {result.batch_id}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadCSVReport(result)}
                    className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    style={{
                      background: 'var(--primary-light)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--cyan)'
                    }}
                  >
                    Download Report
                  </button>
                  <button
                    onClick={() => handleCopyBatchId(result.batch_id)}
                    className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {copiedBatchId ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
              </div>

              {/* Metrics Gauges Grid */}
              {result.metrics ? (
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 font-mono tracking-wide">
                      Model Diagnostics
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {metricsData.map((m) => (
                        <RadialGauge key={m.label} {...m} />
                      ))}
                    </div>
                  </div>

                  {/* Confusion Matrix Heatmap */}
                  <div className="glass-card p-5 border flex flex-col md:flex-row gap-8 justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex-1 text-left">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                        <Table className="w-4.5 h-4.5 text-[var(--cyan)]" />
                        Confusion Matrix Heatmap
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-6">Density mapping of predicted vs true labels</p>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm">
                        Of the evaluated archive images, the model successfully classified <strong>{result.metrics.confusion_matrix.tn}</strong> genuine images and <strong>{result.metrics.confusion_matrix.tp}</strong> deepfake manipulations correctly. 
                        There were <strong>{result.metrics.confusion_matrix.fp}</strong> false positives (flagged authentic captures) and <strong>{result.metrics.confusion_matrix.fn}</strong> false negatives (undetected deepfakes).
                      </p>
                    </div>

                    <div className="relative w-full max-w-[340px] shrink-0">
                      {/* Predicted Header */}
                      <div className="text-center text-[9px] font-bold tracking-widest text-[var(--text-muted)] mb-4">
                        Predicted Label
                      </div>
                      {/* Top Predicted Labels Header */}
                      <div className="grid grid-cols-2 ml-[50px] text-center text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                        <span>Real</span>
                        <span>Fake</span>
                      </div>
                      {/* Main Grid */}
                      <div className="flex">
                        {/* True label rotated */}
                        <div className="w-[20px] flex items-center justify-center relative">
                          <span className="absolute rotate-[-90deg] whitespace-nowrap text-[9px] font-bold tracking-widest text-[var(--text-muted)]">
                            True Label
                          </span>
                        </div>
                        {/* True Labels Labels Header */}
                        <div className="flex flex-col justify-around text-right text-[10px] font-bold text-[var(--text-secondary)] w-[25px] mr-1.5">
                          <span>Real</span>
                          <span>Fake</span>
                        </div>
                        {/* Grid */}
                        <div 
                          className="grid grid-cols-2 flex-1 aspect-square rounded-[12px] overflow-hidden border"
                          style={{ borderColor: '#E2E8F0' }}
                        >
                          {/* TN */}
                          <div 
                            className="flex flex-col items-center justify-center p-2 border-r border-b" 
                            style={{ 
                              backgroundColor: theme === 'light' ? '#EFF6FF' : 'rgba(59, 130, 246, 0.1)', 
                              borderColor: '#E2E8F0'
                            }}
                          >
                            <span className="text-[30px] font-bold font-mono" style={{ color: theme === 'light' ? '#1E40AF' : '#60A5FA' }}>{result.metrics.confusion_matrix.tn}</span>
                            <span className="text-[11px] font-medium mt-1 text-center" style={{ color: theme === 'light' ? '#1E40AF' : '#60A5FA' }}>True Real (TN)</span>
                          </div>
                          {/* FP */}
                          <div 
                            className="flex flex-col items-center justify-center p-2 border-b" 
                            style={{ 
                              backgroundColor: theme === 'light' ? '#FFFBEB' : 'rgba(245, 158, 11, 0.1)', 
                              borderColor: '#E2E8F0'
                            }}
                          >
                            <span className="text-[30px] font-bold font-mono" style={{ color: theme === 'light' ? '#92400E' : '#FBBF24' }}>{result.metrics.confusion_matrix.fp}</span>
                            <span className="text-[11px] font-medium mt-1 text-center" style={{ color: theme === 'light' ? '#92400E' : '#FBBF24' }}>False Fake (FP)</span>
                          </div>
                          {/* FN */}
                          <div 
                            className="flex flex-col items-center justify-center p-2 border-r" 
                            style={{ 
                              backgroundColor: theme === 'light' ? '#FFFBEB' : 'rgba(245, 158, 11, 0.1)', 
                              borderColor: '#E2E8F0'
                            }}
                          >
                            <span className="text-[30px] font-bold font-mono" style={{ color: theme === 'light' ? '#92400E' : '#FBBF24' }}>{result.metrics.confusion_matrix.fn}</span>
                            <span className="text-[11px] font-medium mt-1 text-center" style={{ color: theme === 'light' ? '#92400E' : '#FBBF24' }}>False Real (FN)</span>
                          </div>
                          {/* TP */}
                          <div 
                            className="flex flex-col items-center justify-center p-2" 
                            style={{ 
                              backgroundColor: theme === 'light' ? '#EFF6FF' : 'rgba(59, 130, 246, 0.1)'
                            }}
                          >
                            <span className="text-[30px] font-bold font-mono" style={{ color: theme === 'light' ? '#1E40AF' : '#60A5FA' }}>{result.metrics.confusion_matrix.tp}</span>
                            <span className="text-[11px] font-medium mt-1 text-center" style={{ color: theme === 'light' ? '#1E40AF' : '#60A5FA' }}>True Fake (TP)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border flex items-start gap-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                  <AlertCircle className="w-12 h-12 text-[var(--text-muted)] shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">Unlabeled Batch Evaluation</h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
                      Ground truth labels were not provided or detected. Classification performance metrics (Accuracy, Precision, Recall, Confusion Matrix) could not be calculated. The individual image predictions are listed below.
                    </p>
                  </div>
                </div>
              )}

              {/* Individual Predictions Section */}
              <div className="flex flex-col gap-4">
                {/* Filter controls */}
                <div className="flex justify-between items-center flex-wrap gap-4 pb-2 border-b border-[var(--border-subtle)]">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Individual Image Predictions</h3>
                    <p className="text-xs text-[var(--text-secondary)]">Showing {totalItems} items matching filters</p>
                  </div>

                  {/* Pagination controls on top right */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-3 bg-[var(--bg-secondary)] px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)', background: 'transparent' }}
                      >
                        &lt;
                      </button>
                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                        {startIndex + 1} - {endIndex} of {totalItems}
                      </span>
                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)', background: 'transparent' }}
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>

                {/* Search and category filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search filename..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      className="w-full text-xs py-2.5 pl-9 pr-3 rounded-lg border font-semibold transition-all focus:outline-none focus:border-[var(--cyan)]"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  {/* Prediction Filter */}
                  <div>
                    <select
                      value={filterClass}
                      onChange={e => { setFilterClass(e.target.value as any); setPage(1); }}
                      className="w-full text-xs py-2.5 px-3 rounded-lg border font-semibold focus:outline-none focus:border-[var(--cyan)]"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="ALL" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>All Predictions</option>
                      <option value="REAL" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Predicted REAL</option>
                      <option value="FAKE" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Predicted FAKE</option>
                    </select>
                  </div>

                  {/* Ground Truth Filter */}
                  <div>
                    <select
                      value={filterTruth}
                      onChange={e => { setFilterTruth(e.target.value as any); setPage(1); }}
                      className="w-full text-xs py-2.5 px-3 rounded-lg border font-semibold focus:outline-none focus:border-[var(--cyan)]"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="ALL" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>All Ground Truth</option>
                      <option value="REAL" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>GT: REAL</option>
                      <option value="FAKE" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>GT: FAKE</option>
                      <option value="UNLABELED" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Unlabeled</option>
                    </select>
                  </div>
                </div>

                {/* List */}
                <div className="space-y-3">
                  {paginatedItems.map((item, idx) => {
                    const isExpanded = expandedId === `${item.filename}-${idx}`;
                    const isFake = item.prediction === 'FAKE';
                    const isCorrect = item.ground_truth ? item.prediction === item.ground_truth : null;

                    return (
                      <div
                        key={`${item.filename}-${idx}`}
                        className="rounded-2xl border transition-all duration-300"
                        style={{
                          background: isExpanded ? 'var(--bg-card)' : 'var(--bg-glass)',
                          borderColor: isExpanded ? 'var(--border-brand)' : 'var(--border-subtle)',
                        }}
                      >
                        {/* Row Header */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : `${item.filename}-${idx}`)}
                          className="flex items-center justify-between p-4 cursor-pointer sm:gap-4 flex-wrap sm:flex-nowrap"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="min-w-0 text-left">
                              <p className="text-sm font-semibold truncate pr-2" style={{ color: 'var(--text-primary)' }}>
                                {item.filename}
                              </p>
                              {item.ground_truth && (
                                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  Ground Truth: <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{item.ground_truth}</span>
                                  {isCorrect !== null && (
                                    <span 
                                      className="ml-2 px-1.5 py-0.5 rounded font-extrabold uppercase text-[8px] border"
                                      style={{
                                        color: isCorrect ? 'var(--status-success)' : 'var(--status-error)',
                                        backgroundColor: isCorrect ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                                        borderColor: isCorrect ? 'var(--border-success)' : 'var(--border-danger)'
                                      }}
                                    >
                                      {isCorrect ? 'CORRECT' : 'INCORRECT'}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                            <span
                              className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border shadow-sm"
                              style={{
                                color: isFake ? 'var(--status-error)' : 'var(--cyan)',
                                backgroundColor: isFake ? 'var(--status-error-bg)' : 'var(--primary-light)',
                                borderColor: isFake ? 'var(--border-danger)' : 'var(--cyan-glow)'
                              }}
                            >
                              {item.prediction}
                            </span>

                            <div className="text-right sm:w-20">
                              <span className="text-sm font-bold block" style={{ color: 'var(--text-primary)' }}>
                                {item.confidence.toFixed(1)}%
                              </span>
                              <span className="text-[9px] uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                                Conf.
                              </span>
                            </div>

                            <div style={{ color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>

                        {/* Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] space-y-4 text-left">
                                {item.status === 'success' ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--border-subtle)' }}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--cyan)' }}>
                                          Real Probability
                                        </span>
                                        <span className="text-lg font-extrabold" style={{ color: 'var(--cyan)' }}>
                                          {item.real_probability.toFixed(2)}%
                                        </span>
                                      </div>
                                      <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--status-error-bg)', borderColor: 'var(--border-danger)' }}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--status-error)' }}>
                                          Fake Probability
                                        </span>
                                        <span className="text-lg font-extrabold" style={{ color: 'var(--status-error)' }}>
                                          {item.fake_probability.toFixed(2)}%
                                        </span>
                                      </div>
                                    </div>
                                    {/* Item Metadata */}
                                    <div className="flex justify-between items-center text-[10px] font-mono pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                      <span>Processed: {formatToIST(item.timestamp)}</span>
                                      <span>Batch ID: {item.batch_id || result.batch_id}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="p-3 rounded-xl border text-xs" style={{ backgroundColor: 'var(--status-error-bg)', borderColor: 'var(--border-danger)', color: 'var(--status-error)' }}>
                                      <span className="font-bold block mb-1">Failed to process image</span>
                                      {item.error_detail || 'Unknown error occurred during inference.'}
                                    </div>
                                    {/* Item Metadata */}
                                    <div className="flex justify-between items-center text-[10px] font-mono pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                      <span>Processed: {formatToIST(item.timestamp)}</span>
                                      <span>Batch ID: {item.batch_id || result.batch_id}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeMode === 'batch' && (
        <div className="flex flex-col gap-6 w-full animate-fade-in">
          {!bulkResults && (
            <div className="max-w-4xl mx-auto w-full">
              <ImageUploader
                onDetect={onDetect}
                loading={batchLoading}
                error={batchError}
                imageUrl={null}
                onReset={onReset}
                allowMultiple={true}
                hasResults={!!bulkResults}
              />
            </div>
          )}
          {bulkResults && !batchLoading && (
            <BulkResultsDashboard
              bulkResults={bulkResults}
              imageFiles={imageFiles}
              imageUrls={imageUrls}
              scaleType={scaleType}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
