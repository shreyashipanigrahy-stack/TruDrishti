import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Calendar, Percent, ArrowUpDown, ChevronLeft, ChevronRight, 
  Download, FileText, Eye, AlertCircle, RefreshCw, CheckCircle, Database
} from 'lucide-react';
import { useMonitoring } from '@/hooks/useMonitoring';
import { parseUTC, formatToIST, getLocalDateStringIST } from '@/utils/dateUtils';

interface MonitoringDashboardProps {
  selectedBatchId?: string;
  onSelectBatchId?: (id: string) => void;
  onNavigateTab?: (tab: 'detector' | 'batch' | 'evaluation' | 'history' | 'metrics' | 'monitoring' | 'error_analysis' | 'reports') => void;
}

export function MonitoringDashboard({ selectedBatchId, onSelectBatchId, onNavigateTab }: MonitoringDashboardProps) {
  const { reports, loading, error, fetchReports, downloadFile, getRunIdForBatch } = useMonitoring();
  
  const activeBatchId = selectedBatchId;
  const activeRunId = getRunIdForBatch(activeBatchId || '');

  React.useEffect(() => {
    if (activeBatchId) {
      console.log('--- MonitoringDashboard Selection ---');
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const handleViewReport = (batchId: string) => {
    if (onSelectBatchId) onSelectBatchId(batchId);
    if (onNavigateTab) onNavigateTab('reports');
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <span className="gradient-text">AI Monitoring Dashboard</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Analyze evaluation run reports, model performance, accuracy logs, and status checks.
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
          Refresh Runs
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card p-5 border flex flex-col gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Search by Batch ID */}
          <div className="relative">
            <label className="text-[10px] font-bold tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
              Search By Batch ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by UUID..."
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
            <label className="text-[10px] font-bold tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
              Filter By Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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

          {/* Filter by Accuracy */}
          <div>
            <label className="text-[10px] font-bold tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
              Min Accuracy: {minAccuracy}%
            </label>
            <div className="flex items-center gap-3 h-[38px]">
              <input
                type="range"
                min="0"
                max="100"
                value={minAccuracy}
                onChange={e => setMinAccuracy(Number(e.target.value))}
                className="flex-1 accent-[var(--cyan)] h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--bg-secondary)] border"
                style={{ borderColor: 'var(--border-subtle)' }}
              />
              {minAccuracy > 0 && (
                <button
                  onClick={() => setMinAccuracy(0)}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl border" style={{ background: 'rgba(244,63,94,0.07)', borderColor: 'rgba(244,63,94,0.3)' }}>
          <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-300">Failed to load monitoring data</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Runs Table Card */}
      <div className="glass-card border overflow-hidden flex flex-col" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
                <th className="p-4 font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Batch ID</th>
                <th 
                  className="p-4 font-bold tracking-wider cursor-pointer select-none transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center gap-1 hover:text-[var(--cyan)] transition-colors">
                    Created Date
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th 
                  className="p-4 font-bold tracking-wider cursor-pointer select-none transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => handleSort('accuracy')}
                >
                  <div className="flex items-center gap-1 hover:text-[var(--cyan)] transition-colors">
                    Accuracy
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="p-4 font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Precision</th>
                <th className="p-4 font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Recall</th>
                <th className="p-4 font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>F1 Score</th>
                <th className="p-4 font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="p-4 font-bold tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Table Loading Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="p-4"><div className="h-4 w-32 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4"><div className="h-4 w-24 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4"><div className="h-4 w-12 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4"><div className="h-4 w-12 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4"><div className="h-4 w-12 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4"><div className="h-4 w-12 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4"><div className="h-4.5 w-16 bg-[var(--border-subtle)] rounded animate-pulse" /></td>
                    <td className="p-4 text-right"><div className="h-7 w-28 bg-[var(--border-subtle)] rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedReports.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
                      <Database className="w-10 h-10 animate-pulse" style={{ color: 'var(--border-strong)' }} />
                      <p className="font-bold font-mono text-[var(--text-secondary)]">No evaluation runs found</p>
                      <p className="text-xs max-w-sm">
                        No reports match your filters. Try adjusting the search query or accuracy thresholds.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                // Data Rows
                paginatedReports.map((report) => {
                  const isSelected = selectedBatchId === report.batch_id;
                  return (
                    <tr 
                      key={report.batch_id} 
                      className={`border-b transition-colors ${
                        isSelected ? 'bg-[var(--cyan)]/5' : 'hover:bg-[var(--bg-glass-hover)]'
                      }`}
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <td className="p-4 font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                        {report.batch_id.substring(0, 16)}...
                      </td>
                      <td className="p-4" style={{ color: 'var(--text-secondary)' }}>{formatDate(report.created_at)}</td>
                      <td className="p-4 font-mono font-bold" style={{ color: 'var(--cyan)' }}>
                        {report.accuracy !== undefined ? `${report.accuracy}%` : 'N/A'}
                      </td>
                      <td className="p-4 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {report.precision !== undefined ? `${report.precision}%` : 'N/A'}
                      </td>
                      <td className="p-4 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {report.recall !== undefined ? `${report.recall}%` : 'N/A'}
                      </td>
                      <td className="p-4 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {report.f1_score !== undefined ? `${report.f1_score}%` : 'N/A'}
                      </td>
                      <td className="p-4">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border"
                          style={{
                            backgroundColor: 'var(--bg-success)',
                            borderColor: 'var(--border-success)',
                            color: 'var(--status-success)'
                          }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          {report.status ?? 'SUCCESS'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleViewReport(report.batch_id)}
                            className="p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 hover:text-[var(--cyan)] hover:border-[var(--cyan)]/50"
                            style={{
                              borderColor: 'var(--border-subtle)',
                              background: 'var(--bg-glass)',
                              color: 'var(--text-secondary)',
                            }}
                            title="View Report Analysis"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => downloadFile(`/reports/${report.batch_id}/download`, `report_${report.batch_id}.html`)}
                            className="p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 hover:text-[var(--cyan)] hover:border-[var(--cyan)]/50"
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
                            className="p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 hover:text-[var(--cyan)] hover:border-[var(--cyan)]/50"
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && processedReports.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-[var(--text-muted)] text-xs">
              Showing <span className="font-semibold text-[var(--text-primary)]">{Math.min(processedReports.length, (currentPage - 1) * pageSize + 1)}</span> to{' '}
              <span className="font-semibold text-[var(--text-primary)]">{Math.min(processedReports.length, currentPage * pageSize)}</span> of{' '}
              <span className="font-semibold text-[var(--text-primary)]">{processedReports.length}</span> runs
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
      </div>
    </div>
  );
}
