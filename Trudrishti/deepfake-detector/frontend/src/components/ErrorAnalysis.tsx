import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Database, ShieldAlert, Award, Image as ImageIcon,
  Search, ArrowUpDown, X, ExternalLink, Calendar, Info, Play, AlertCircle
} from 'lucide-react';
import { useMonitoring } from '@/hooks/useMonitoring';
import type { MisclassifiedImage, MisclassifiedImagesResponse } from '@/types/monitoring';

interface ErrorAnalysisProps {
  selectedBatchId?: string;
  onSelectBatchId?: (id: string) => void;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

export function ErrorAnalysis({ selectedBatchId: propBatchId, onSelectBatchId }: ErrorAnalysisProps) {
  const { theme } = useTheme();
  const {
    reports,
    loading: hookLoading,
    error: hookError,
    exportLoading,
    fetchMisclassified,
    exportRetraining,
    downloadFile,
    getRunIdForBatch
  } = useMonitoring();

  const [localBatchId, setLocalBatchId] = useState<string>('');
  const [data, setData] = useState<MisclassifiedImagesResponse | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Gallery controls
  const [filterType, setFilterType] = useState<'ALL' | 'FALSE_POSITIVE' | 'FALSE_NEGATIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Inspection modal state
  const [selectedImage, setSelectedImage] = useState<MisclassifiedImage | null>(null);

  // Sync prop batch selection
  useEffect(() => {
    if (propBatchId) {
      setLocalBatchId(propBatchId);
    } else if (reports.length > 0 && !localBatchId) {
      setLocalBatchId(reports[0].batch_id);
      if (onSelectBatchId) onSelectBatchId(reports[0].batch_id);
    }
  }, [reports, propBatchId, onSelectBatchId, localBatchId]);

  const activeBatchId = propBatchId || localBatchId;
  const activeRunId = getRunIdForBatch(activeBatchId);

  useEffect(() => {
    if (activeBatchId) {
      console.log('--- ErrorAnalysis Dashboard Selection ---');
      console.log('selected batch_id:', activeBatchId);
      console.log('active_run_id:', activeRunId);
    }
  }, [activeBatchId, activeRunId]);

  // Fetch misclassified images
  useEffect(() => {
    if (!activeBatchId) return;

    let isMounted = true;
    const loadData = async () => {
      setLocalLoading(true);
      setLocalError(null);
      try {
        const res = await fetchMisclassified(activeBatchId);
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setLocalError(err.message ?? 'Failed to load error analysis.');
        }
      } finally {
        if (isMounted) {
          setLocalLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [activeBatchId, fetchMisclassified]);

  const handleBatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalBatchId(val);
    if (onSelectBatchId) onSelectBatchId(val);
  };

  // Filter and sort the misclassified images list
  const filteredAndSortedImages = useMemo(() => {
    if (!data || !data.images) return [];
    let list = [...data.images];

    // Filter by Error Type
    if (filterType !== 'ALL') {
      list = list.filter(img => img.error_type === filterType);
    }

    // Filter by Filename search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(img => img.filename.toLowerCase().includes(q));
    }

    // Sort by confidence
    list.sort((a, b) => {
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      return sortOrder === 'desc' ? confB - confA : confA - confB;
    });

    return list;
  }, [data, filterType, searchQuery, sortOrder]);

  const loading = hookLoading || localLoading;
  const error = hookError || localError;

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto text-left">
      {/* Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-[var(--text-secondary)] font-mono">
            Error Diagnostics
          </p>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <ShieldAlert className="w-6 h-6 text-[var(--cyan)]" style={{ color: 'var(--cyan)' }} />
            Model Error Analysis & Gallery
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">Active Run:</span>
          <select
            value={activeBatchId}
            onChange={handleBatchChange}
            className="text-xs py-2 px-3 rounded-lg border font-semibold focus:outline-none focus:border-[var(--cyan)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {reports.map(r => (
              <option key={r.batch_id} value={r.batch_id}>
                {r.batch_id.substring(0, 16)}... ({r.accuracy ? `${r.accuracy}% Acc` : 'No Eval'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        // Loading Skeletons
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-24 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="skeleton h-48 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : error ? (
        // Error State
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl border" style={{ background: 'var(--status-error-bg)', borderColor: 'var(--border-danger)', color: 'var(--status-error)' }}>
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--status-error)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--status-error)' }}>Analysis Retrieval Failed</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        </div>
      ) : !activeBatchId ? (
        // No evaluation run selected
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 border border-dashed rounded-2xl bg-[var(--bg-secondary)]/40" style={{ borderColor: 'var(--border-subtle)' }}>
          <ImageIcon className="w-12 h-12 text-[var(--text-muted)] animate-pulse" />
          <h3 className="text-md font-bold text-[var(--text-primary)]">No Evaluation Run Selected</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Please run an evaluation batch first to retrieve error metrics.
          </p>
        </div>
      ) : (
        <>
          {/* Metrics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 border relative overflow-hidden group text-left"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Total Misclassified</span>
              </div>
              <p className="text-3xl font-black font-mono text-rose-400">
                {data?.total_misclassified ?? 0}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-5 border relative overflow-hidden group text-left"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)]">False Positives (FP)</span>
              </div>
              <p className="text-3xl font-black font-mono text-amber-500">
                {data?.false_positive_count ?? 0}
              </p>
              <span className="text-[9px] text-[var(--text-secondary)] block mt-1">REAL predicted as FAKE</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-5 border relative overflow-hidden group text-left"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                <span className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)]">False Negatives (FN)</span>
              </div>
              <p className="text-3xl font-black font-mono text-pink-400">
                {data?.false_negative_count ?? 0}
              </p>
              <span className="text-[9px] text-[var(--text-secondary)] block mt-1">FAKE predicted as REAL</span>
            </motion.div>
          </div>

          {/* Action Downloads Panel */}
          <div className="glass-card p-5 border text-left" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <h3 className="text-xs font-bold tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-[var(--cyan)]" />
              Downloads &amp; Retraining Export Staging
            </h3>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => downloadFile(`/batch/${activeBatchId}/false-positives/download`, `false_positives_${activeBatchId}.zip`)}
                disabled={!data || data.false_positive_count === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                style={{
                  background: 'var(--status-warning-bg)',
                  borderColor: 'var(--status-warning)',
                  color: 'var(--status-warning)'
                }}
              >
                <Download className="w-4 h-4" />
                Download FP ZIP
              </button>

              <button
                onClick={() => downloadFile(`/batch/${activeBatchId}/false-negatives/download`, `false_negatives_${activeBatchId}.zip`)}
                disabled={!data || data.false_negative_count === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                style={{
                  background: 'var(--status-error-bg)',
                  borderColor: 'var(--border-danger)',
                  color: 'var(--status-error)'
                }}
              >
                <Download className="w-4 h-4" />
                Download FN ZIP
              </button>

              <button
                onClick={() => downloadFile(`/batch/${activeBatchId}/misclassified/download`, `misclassified_${activeBatchId}.zip`)}
                disabled={!data || data.total_misclassified === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                style={{
                  background: 'var(--status-error-bg)',
                  borderColor: 'var(--border-danger)',
                  color: 'var(--status-error)'
                }}
              >
                <Download className="w-4 h-4" />
                Download All Misclassified ZIP
              </button>

              <button
                onClick={() => exportRetraining(activeBatchId)}
                disabled={!data || data.total_misclassified === 0 || exportLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ml-auto"
                style={{
                  background: 'var(--primary-light)',
                  borderColor: 'var(--cyan)',
                  color: 'var(--cyan)'
                }}
              >
                <Database className="w-4 h-4" />
                {exportLoading ? 'Exporting...' : 'Export Retraining Dataset'}
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="glass-card p-4 border flex flex-col md:flex-row justify-between items-center gap-4 text-left" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <div className="flex gap-2">
              {[
                { type: 'ALL', label: 'All Misclassifications' },
                { type: 'FALSE_POSITIVE', label: 'False Positives Only' },
                { type: 'FALSE_NEGATIVE', label: 'False Negatives Only' }
              ].map(tab => (
                <button
                  key={tab.type}
                  onClick={() => setFilterType(tab.type as any)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 border"
                  style={{
                    background: filterType === tab.type ? 'var(--cyan)' : 'transparent',
                    borderColor: filterType === tab.type ? 'transparent' : 'var(--border-subtle)',
                    color: filterType === tab.type ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3 w-full md:w-auto items-center">
              {/* Search Filename */}
              <div className="relative flex-1 md:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full md:w-48 text-xs py-2 pl-9 pr-4 rounded-lg border font-semibold focus:outline-none focus:border-[var(--cyan)] bg-[var(--bg-secondary)]"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Toggle Sort order */}
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="p-2 rounded-lg border hover:bg-[var(--bg-hover)] flex items-center gap-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                title="Sort by Confidence"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Conf: {sortOrder.toUpperCase()}
              </button>
            </div>
          </div>

          {/* Image Gallery Grid */}
          {filteredAndSortedImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3 border border-dashed rounded-2xl bg-[var(--bg-secondary)]/40" style={{ borderColor: 'var(--border-subtle)' }}>
              <ImageIcon className="w-12 h-12 text-[var(--text-muted)]" />
              <h3 className="text-md font-bold text-[var(--text-primary)]">No Images Found</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-relaxed">
                No misclassified captures match your search filter selection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAndSortedImages.map((img) => {
                const isFP = img.error_type === 'FALSE_POSITIVE';
                return (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -4 }}
                    className="glass-card border overflow-hidden flex flex-col group cursor-pointer"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
                    onClick={() => setSelectedImage(img)}
                  >
                    {/* Thumbnail Image Container */}
                    <div className="aspect-video w-full bg-[var(--bg-secondary)] relative overflow-hidden border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <img
                        src={`${API_BASE}${img.thumbnail_url}`}
                        alt={img.filename}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/0f172a/06b6d4?text=Image+Load+Error';
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-md"
                          style={{
                            background: isFP ? 'var(--status-warning-bg)' : 'var(--status-error-bg)',
                            color: isFP ? 'var(--status-warning)' : 'var(--status-error)',
                            borderColor: isFP ? 'var(--status-warning)' : 'var(--border-danger)'
                          }}
                        >
                          {isFP ? 'FP' : 'FN'}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <span 
                          className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border shadow-md"
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--cyan)',
                            borderColor: 'var(--cyan-glow)'
                          }}
                        >
                          {(img.confidence * 100).toFixed(1)}% Conf
                        </span>
                      </div>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="p-3 space-y-2 text-left flex-1 flex flex-col justify-between">
                      <p className="text-[11px] font-mono font-bold truncate" style={{ color: 'var(--text-secondary)' }} title={img.filename}>
                        {img.filename}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-1 pt-1.5 border-t text-[10px]" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                          <span className="block" style={{ color: 'var(--text-muted)' }}>Ground Truth</span>
                          <span className="font-bold text-[var(--cyan)]">{img.ground_truth}</span>
                        </div>
                        <div>
                          <span className="block text-right" style={{ color: 'var(--text-muted)' }}>Prediction</span>
                          <span className="font-bold block text-right" style={{ color: 'var(--status-error)' }}>{img.prediction}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Image Inspection Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="glass-card border w-full max-w-2xl overflow-hidden flex flex-col relative text-left"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h3 className="font-bold text-sm font-mono truncate max-w-md" style={{ color: 'var(--text-primary)' }}>
                    {selectedImage.filename}
                  </h3>
                  <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                    ID: {selectedImage.image_id} · Batch: {selectedImage.batch_id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-1.5 rounded-lg border text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all bg-[var(--bg-secondary)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Large Image Rendering Area */}
              <div className="bg-[var(--bg-secondary)]/50 w-full max-h-[380px] overflow-hidden flex items-center justify-center border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <img
                  src={`${API_BASE}${selectedImage.image_url}`}
                  alt={selectedImage.filename}
                  className="max-w-full max-h-[380px] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/800x450/0f172a/06b6d4?text=Large+Image+Load+Error';
                  }}
                />
              </div>

              {/* Detailed Metrics Panel */}
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl">
                  <span className="block text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Ground Truth</span>
                  <span className="font-black text-[var(--cyan)] text-sm font-mono">{selectedImage.ground_truth}</span>
                </div>

                <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl">
                  <span className="block text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Prediction</span>
                  <span className="font-black text-[var(--status-error)] text-sm font-mono">{selectedImage.prediction}</span>
                </div>

                <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl">
                  <span className="block text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Confidence</span>
                  <span className="font-black text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{(selectedImage.confidence * 100).toFixed(2)}%</span>
                </div>

                <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl">
                  <span className="block text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Error Type</span>
                  <span className={`font-black text-xs font-mono block mt-0.5 ${
                    selectedImage.error_type === 'FALSE_POSITIVE' ? 'text-[var(--status-warning)]' : 'text-[var(--status-error)]'
                  }`}>
                    {selectedImage.error_type.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Extra Metadata Footer */}
              <div className="p-4 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] text-[10px] flex justify-between flex-wrap gap-2" style={{ color: 'var(--text-muted)' }}>
                <span>Timestamp: {selectedImage.timestamp ? (() => {
                  let parsedStr = selectedImage.timestamp;
                  if (!parsedStr.endsWith('Z') && !parsedStr.includes('+')) {
                    parsedStr = parsedStr.replace(' ', 'T') + 'Z';
                  }
                  const d = new Date(parsedStr);
                  return isNaN(d.getTime()) ? selectedImage.timestamp : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
                })() : 'N/A'}</span>
                <a
                  href={`${API_BASE}${selectedImage.image_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--cyan)] hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3 h-3" /> View original full size
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
