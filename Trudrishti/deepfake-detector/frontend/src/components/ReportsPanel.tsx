import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Search, Calendar, Eye, Download, X, ExternalLink, 
  ArrowUpDown, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { useMonitoring } from '@/hooks/useMonitoring';
import type { ReportMetadata } from '@/types/monitoring';
import { parseUTC, formatToIST, getLocalDateStringIST } from '@/utils/dateUtils';

interface ReportsPanelProps {
  selectedBatchId?: string;
  onSelectBatchId?: (id: string) => void;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

export function ReportsPanel({ selectedBatchId: propBatchId, onSelectBatchId }: ReportsPanelProps) {
  const { reports, loading, error, fetchReports, downloadFile, getRunIdForBatch } = useMonitoring();
  
  const activeBatchId = propBatchId;
  const activeRunId = getRunIdForBatch(activeBatchId || '');

  React.useEffect(() => {
    if (activeBatchId) {
      console.log('--- ReportsPanel Selection ---');
      console.log('selected batch_id:', activeBatchId);
      console.log('active_run_id:', activeRunId);
    }
  }, [activeBatchId, activeRunId]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [minAccuracy, setMinAccuracy] = useState<number>(0);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<'timestamp' | 'accuracy'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Selected report for inline/modal preview
  const [previewBatchId, setPreviewBatchId] = useState<string | null>(null);

  // Toggle sorting
  const handleSort = (field: 'timestamp' | 'accuracy') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Filter & Sort reports
  const processedReports = useMemo(() => {
    let result = [...reports];

    // Search by Batch ID
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => r.batch_id.toLowerCase().includes(q));
    }

    // Filter by Date
    if (dateFilter) {
      result = result.filter(r => {
        if (!r.created_at) return false;
        const dateStr = getLocalDateStringIST(r.created_at);
        return dateStr === dateFilter;
      });
    }

    // Filter by Accuracy
    if (minAccuracy > 0) {
      result = result.filter(r => (r.accuracy ?? 0) >= minAccuracy);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'timestamp') {
        const parsedA = parseUTC(a.created_at);
        const parsedB = parseUTC(b.created_at);
        const dateA = parsedA ? parsedA.getTime() : 0;
        const dateB = parsedB ? parsedB.getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const accA = a.accuracy ?? 0;
        const accB = b.accuracy ?? 0;
        return sortOrder === 'asc' ? accA - accB : accB - accA;
      }
    });

    return result;
  }, [reports, searchQuery, dateFilter, minAccuracy, sortBy, sortOrder]);

  // Paginated reports
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedReports.slice(startIndex, startIndex + pageSize);
  }, [processedReports, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processedReports.length / pageSize));

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, minAccuracy]);

  const formatDate = (dateString: string | null) => {
    return formatToIST(dateString);
  };

  const handleSelectReport = (batchId: string) => {
    if (onSelectBatchId) onSelectBatchId(batchId);
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <FileText className="w-6 h-6 text-[var(--cyan)]" />
            Evidently AI Reports Manager
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Access interactive reports, distributions, metrics alignment, and PDF prints.
          </p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 hover:border-[var(--cyan)]/40 self-start"
          style={{
            background: 'var(--bg-glass)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh list
        </button>
      </div>

      {/* Filter controls */}
      <div className="glass-card p-5 border flex flex-col gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Search by Batch ID */}
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)] block mb-2">
              Search By Batch ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Enter Batch UUID..."
                className="w-full text-xs py-2.5 pl-10 pr-4 rounded-lg border font-semibold focus:outline-none focus:border-[var(--cyan)]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Filter by Date */}
          <div>
            <label className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)] block mb-2">
              Filter By Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-full text-xs py-2.5 pl-10 pr-4 rounded-lg border font-semibold focus:outline-none focus:border-[var(--cyan)]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Sort selection */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSort('timestamp')}
              className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                sortBy === 'timestamp'
                  ? 'bg-[var(--primary-light)] border-[var(--cyan)]/40 text-[var(--cyan)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Date {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => handleSort('accuracy')}
              className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                sortBy === 'accuracy'
                  ? 'bg-[var(--primary-light)] border-[var(--cyan)]/40 text-[var(--cyan)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Acc {sortBy === 'accuracy' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && reports.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-64 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        // Error State
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl border" style={{ background: 'var(--status-error-bg)', borderColor: 'var(--status-error)' }}>
          <AlertCircle className="w-5 h-5 text-[var(--status-error)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Reports Retrieval Failed</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">{error}</p>
          </div>
        </div>
      ) : processedReports.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-secondary)]/50">
          <Layers className="w-12 h-12 text-[var(--text-muted)] animate-pulse" />
          <h3 className="text-md font-bold text-[var(--text-primary)]">No Reports Matching Filters</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Create an evaluation batch or change filters to load reports.
          </p>
        </div>
      ) : (
        <>
          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedReports.map(report => {
              return (
                <motion.div
                  key={report.batch_id}
                  layout
                  whileHover={{ y: -4 }}
                  className="glass-card border p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-card)',
                  }}
                >

                  {/* Card Content */}
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="flex justify-between items-start z-10 relative">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                          <FileText className="w-4 h-4 text-[var(--cyan)]" />
                        </div>
                        <div>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest block font-mono">Batch Run</span>
                        <span 
                          onClick={() => handleSelectReport(report.batch_id)}
                          className="text-xs font-mono font-bold text-[var(--text-primary)] hover:text-[var(--cyan)] cursor-pointer block truncate w-32"
                          title={report.batch_id}
                        >
                          {report.batch_id.substring(0, 12)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Block */}
                  <div className="grid grid-cols-2 gap-2.5 z-10 relative pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)]">Accuracy</span>
                      <span className="text-sm font-black font-mono text-[var(--cyan)] block">
                        {report.accuracy !== undefined ? `${report.accuracy}%` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[var(--text-muted)]">F1 Score</span>
                      <span className="text-sm font-black font-mono text-[var(--violet)] block">
                        {report.f1_score !== undefined ? `${report.f1_score}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                    <div className="text-[10px] text-[var(--text-secondary)] font-medium">
                      Created: {formatDate(report.created_at)}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-2 mt-5 z-10 relative pt-4 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => setPreviewBatchId(report.batch_id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold border transition-all duration-200 bg-[var(--primary-light)] border-[var(--cyan)]/30 hover:border-[var(--cyan)] hover:bg-[var(--primary-light)]/85 text-[var(--cyan)] hover:scale-105 active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Report
                    </button>
                    
                    <button
                      onClick={() => downloadFile(`/reports/${report.batch_id}/download`, `report_${report.batch_id}.html`)}
                      className="p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 hover:text-[var(--cyan)] hover:border-[var(--cyan)]/50"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-glass)',
                        color: 'var(--text-secondary)',
                      }}
                      title="Download HTML Report"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => downloadFile(`/reports/${report.batch_id}/pdf`, `report_${report.batch_id}.pdf`)}
                      className="p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 hover:text-[var(--cyan)] hover:border-[var(--cyan)]/50"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-glass)',
                        color: 'var(--text-secondary)',
                      }}
                      title="Download PDF Report"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-secondary)]">
              <span className="text-[var(--text-muted)] text-xs">
                Showing <span className="font-semibold text-[var(--text-primary)]">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-[var(--text-primary)]">{Math.min(processedReports.length, currentPage * pageSize)}</span> of{' '}
                <span className="font-semibold text-[var(--text-primary)]">{processedReports.length}</span> reports
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-[var(--text-secondary)] font-semibold flex items-center px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Immersive Overlay HTML Report Preview Modal */}
      <AnimatePresence>
        {previewBatchId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-md"
            onClick={() => setPreviewBatchId(null)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 12 }}
              transition={{ duration: 0.3 }}
              className="glass-card border w-full h-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col relative text-left"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b flex justify-between items-center bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--cyan)] animate-pulse" />
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                    Interactive Evidently Report — Batch {previewBatchId}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <a
                    href={`${API_BASE}/reports/${previewBatchId}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-[var(--cyan)] hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                  </a>
                  
                  <button
                    onClick={() => setPreviewBatchId(null)}
                    className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all bg-[var(--bg-glass)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Iframe content */}
              <div className="flex-1 w-full bg-white relative">
                <iframe
                  src={`${API_BASE}/reports/${previewBatchId}/view`}
                  title={`Evidently Report ${previewBatchId}`}
                  className="w-full h-full border-none"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
