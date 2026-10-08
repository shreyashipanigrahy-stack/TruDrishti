import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Database, ChevronDown, ChevronUp, AlertCircle, RefreshCw, FileText, Layers } from 'lucide-react';
import { formatToIST } from '@/utils/dateUtils';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

interface InferenceLog {
  id: number;
  filename: string;
  prediction: string;
  confidence: number;
  real_probability: number;
  fake_probability: number;
  explanation: string;
  srm_interpretation: string;
  batch_id?: string | null;
  created_at: string;
}

interface GroupedLog {
  id: string; // either batch_id or `single-${log.id}`
  isBatch: boolean;
  batch_id?: string;
  filename: string;
  prediction: string;
  confidence: number;
  created_at: string;
  items: InferenceLog[];
}

export function HistoryPanel() {
  const { theme } = useTheme();
  const [logs, setLogs] = useState<InferenceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedBatchItemId, setExpandedBatchItemId] = useState<number | null>(null);
  const [batchPages, setBatchPages] = useState<Record<string, number>>({});
  const [activeSubTab, setActiveSubTab] = useState<'forensic' | 'audit'>('forensic');
  const [forensicPage, setForensicPage] = useState<number>(1);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('trudrishti_token');
    
    try {
      const response = await axios.get<InferenceLog[]>(`${API_BASE}/inferences`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setLogs(response.data);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        'Failed to connect to the backend server. Please verify the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
    setExpandedBatchItemId(null); // Reset nested item focus when toggling main row
  };

  const toggleBatchItem = (itemId: number) => {
    setExpandedBatchItemId(prev => (prev === itemId ? null : itemId));
  };

  const formatDate = (dateStr: string) => {
    return formatToIST(dateStr);
  };

  // Group raw database logs into single and batch entries
  const groupedLogs = useMemo(() => {
    const list: GroupedLog[] = [];
    const batchMap = new Map<string, InferenceLog[]>();

    logs.forEach(log => {
      if (log.batch_id) {
        if (!batchMap.has(log.batch_id)) {
          batchMap.set(log.batch_id, []);
        }
        batchMap.get(log.batch_id)!.push(log);
      } else {
        list.push({
          id: `single-${log.id}`,
          isBatch: false,
          filename: log.filename,
          prediction: log.prediction,
          confidence: log.confidence,
          created_at: log.created_at,
          items: [log]
        });
      }
    });

    batchMap.forEach((items, batchId) => {
      const hasFake = items.some(item => item.prediction === 'FAKE');
      const averageConfidence = items.reduce((acc, item) => acc + item.confidence, 0) / items.length;
      items.sort((a, b) => a.filename.localeCompare(b.filename));

      const filesSummary = items.length <= 3 
        ? items.map(item => item.filename).join(', ') 
        : `${items.slice(0, 3).map(item => item.filename).join(', ')} and ${items.length - 3} more`;

      list.push({
        id: batchId,
        isBatch: true,
        batch_id: batchId,
        filename: `Batch Upload (${items.length} images): ${filesSummary}`,
        prediction: hasFake ? 'FAKE' : 'REAL',
        confidence: averageConfidence,
        created_at: items[0].created_at,
        items: items
      });
    });

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs]);

  const forensicLogs = useMemo(() => {
    return groupedLogs.filter(log => !log.isBatch);
  }, [groupedLogs]);

  const auditLogs = useMemo(() => {
    return groupedLogs.filter(log => log.isBatch);
  }, [groupedLogs]);

  // Forensic Analysis pagination details
  const forensicItemsPerPage = 10;
  const totalForensicItems = forensicLogs.length;
  const totalForensicPages = Math.ceil(totalForensicItems / forensicItemsPerPage);
  const forensicStartIndex = (forensicPage - 1) * forensicItemsPerPage;
  const forensicEndIndex = Math.min(forensicStartIndex + forensicItemsPerPage, totalForensicItems);
  const paginatedForensicLogs = useMemo(() => {
    return forensicLogs.slice(forensicStartIndex, forensicEndIndex);
  }, [forensicLogs, forensicStartIndex, forensicEndIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Header Info */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            System Integrity
          </p>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Database className="w-6 h-6 text-[var(--cyan)]" />
            Audit Logs & Inference History
          </h2>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border hover:scale-105 active:scale-95 transition-all"
          style={{
            background: 'var(--bg-glass)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--cyan)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Retrieving secure inference logs from the database...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-6 rounded-2xl border flex flex-col items-center text-center gap-4" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle className="w-12 h-12 text-rose-400" />
          <div>
            <h3 className="text-lg font-bold text-rose-300">Connection Error</h3>
            <p className="text-sm mt-1 max-w-md" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
          <button onClick={fetchHistory} className="btn-primary text-xs flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> Retry Connection
          </button>
        </div>
      )}

      {/* Empty State (Overall) */}
      {!loading && !error && groupedLogs.length === 0 && (
        <div className="p-12 text-center rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No Inference Records Found</h3>
          <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Your audit log is currently empty. Run deepfake analysis on some images, and they will dynamically appear here in real-time.
          </p>
        </div>
      )}

      {/* Sub-tabs Selection & Pagination (Top Right) */}
      {!loading && !error && groupedLogs.length > 0 && (
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6 w-full">
          {/* Sub-tabs */}
          <div className="flex gap-2 p-1.5 rounded-xl max-w-sm" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => {
                setActiveSubTab('forensic');
                setForensicPage(1);
              }}
              className="py-2 px-4 rounded-lg text-xs font-bold transition-all duration-200 text-center"
              style={{
                background: activeSubTab === 'forensic' ? 'var(--cyan)' : 'transparent',
                color: activeSubTab === 'forensic' ? '#ffffff' : 'var(--text-secondary)',
                border: activeSubTab === 'forensic' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent'
              }}
            >
              Forensic Analysis ({forensicLogs.length})
            </button>
            <button
              onClick={() => {
                setActiveSubTab('audit');
              }}
              className="py-2 px-4 rounded-lg text-xs font-bold transition-all duration-200 text-center"
              style={{
                background: activeSubTab === 'audit' ? 'var(--cyan)' : 'transparent',
                color: activeSubTab === 'audit' ? '#ffffff' : 'var(--text-secondary)',
                border: activeSubTab === 'audit' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent'
              }}
            >
              Audit Logs ({auditLogs.length})
            </button>
          </div>

          {/* Pagination Controls (Top Right, below settings button) */}
          {activeSubTab === 'forensic' && totalForensicPages > 1 && (
            <div className="flex items-center gap-4 bg-[var(--bg-glass)] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <button
                type="button"
                disabled={forensicPage === 1}
                onClick={() => setForensicPage(prev => Math.max(1, prev - 1))}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 active:scale-95 font-bold"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'transparent'
                }}
                aria-label="Previous page"
              >
                &lt;
              </button>
              <span className="text-xs font-mono text-slate-300">
                {forensicStartIndex + 1} - {forensicEndIndex} of {totalForensicItems}
              </span>
              <button
                type="button"
                disabled={forensicPage === totalForensicPages}
                onClick={() => setForensicPage(prev => Math.min(totalForensicPages, prev + 1))}
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 active:scale-95 font-bold"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'transparent'
                }}
                aria-label="Next page"
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Logs List */}
      {!loading && !error && groupedLogs.length > 0 && (
        <div className="space-y-4">
          {activeSubTab === 'forensic' ? (
            <>
              {forensicLogs.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No Forensic Analysis Records</h3>
                  <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Your forensic analysis history is currently empty. Run deepfake analysis on a single image and it will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedForensicLogs.map((group) => {
                      const isExpanded = expandedId === group.id;
                      const isFake = group.prediction === 'FAKE';
                      return (
                        <div
                          key={group.id}
                          className="rounded-2xl border transition-all duration-300"
                          style={{
                            background: isExpanded ? 'var(--bg-card)' : 'var(--bg-glass)',
                            borderColor: isExpanded ? 'var(--border-brand)' : 'var(--border-subtle)',
                            boxShadow: isExpanded ? '0 8px 32px rgba(0, 180, 230, 0.08)' : 'none'
                          }}
                        >
                          {/* Row Header */}
                          <div
                            onClick={() => toggleExpand(group.id)}
                            className="flex items-center justify-between p-4 cursor-pointer sm:gap-4 flex-wrap sm:flex-nowrap"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className="p-2 rounded-xl"
                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                              >
                                <Clock className="w-4 h-4 text-[var(--cyan)]" />
                              </div>
                              <div className="min-w-0 text-left">
                                <p className="text-sm font-semibold truncate pr-2 text-[var(--text-primary)]">
                                  {group.filename}
                                </p>
                                <p className="text-xs text-muted" style={{ color: 'var(--text-muted)' }}>
                                  {formatDate(group.created_at)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                              {/* Status Badge */}
                              <span
                                className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full border shadow-sm ${
                                  isFake 
                                    ? 'text-[var(--status-error)] bg-[var(--status-error-bg)] border-[var(--border-danger)]' 
                                    : 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--border-success)]'
                                }`}
                              >
                                {group.prediction}
                              </span>

                              {/* Confidence percentage */}
                              <div className="text-right sm:w-20">
                                <span className="text-sm font-bold block text-[var(--text-primary)]">
                                  {group.confidence.toFixed(1)}%
                                </span>
                                <span className="text-[10px] tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                                  Conf.
                                </span>
                              </div>

                              {/* Expand/Collapse Button */}
                              <div style={{ color: 'var(--text-muted)' }}>
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Details */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                id={`collapsible-${group.id}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] space-y-4 text-left">
                                  <div className="space-y-4">
                                    {/* Probabilities Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 rounded-xl bg-[var(--status-success-bg)] border border-[var(--border-success)]">
                                        <span className="text-[10px] font-bold tracking-wider text-[var(--status-success)] block mb-1">
                                          Real Probability
                                        </span>
                                        <span className="text-lg font-extrabold text-[var(--status-success)]">
                                          {group.items[0].real_probability.toFixed(2)}%
                                        </span>
                                      </div>
                                      <div className="p-3 rounded-xl bg-[var(--status-error-bg)] border border-[var(--border-danger)]">
                                        <span className="text-[10px] font-bold tracking-wider text-[var(--status-error)] block mb-1">
                                          Fake Probability
                                        </span>
                                        <span className="text-lg font-extrabold text-[var(--status-error)]">
                                          {group.items[0].fake_probability.toFixed(2)}%
                                        </span>
                                      </div>
                                    </div>

                                    {/* SRM Forensic Notes */}
                                    {group.items[0].srm_interpretation && (
                                      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                        <h4 className="text-xs font-bold tracking-widest text-[var(--cyan)] mb-2">
                                          SRM Forensic Noise Analysis
                                        </h4>
                                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                          {group.items[0].srm_interpretation}
                                        </p>
                                      </div>
                                    )}

                                    {/* Explainability Narrative */}
                                    {group.items[0].explanation && (
                                      <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                        <h4 className="text-xs font-bold tracking-widest text-[var(--cyan)] mb-2">
                                          Explainability Narrative
                                        </h4>
                                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                          {group.items[0].explanation}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>


                </>
              )}
            </>
          ) : (
            <>
              {auditLogs.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No Audit Logs</h3>
                  <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Your batch evaluation history is currently empty. Upload a ZIP containing images in the Batch Upload section to create audit logs.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((group) => {
                    const isExpanded = expandedId === group.id;
                    return (
                      <div
                        key={group.id}
                        className="rounded-2xl border transition-all duration-300"
                        style={{
                          background: isExpanded ? 'var(--bg-card)' : 'var(--bg-glass)',
                          borderColor: isExpanded ? 'var(--border-brand)' : 'var(--border-subtle)',
                          boxShadow: isExpanded ? '0 8px 32px rgba(0, 180, 230, 0.08)' : 'none'
                        }}
                      >
                        {/* Row Header */}
                        <div
                          onClick={() => toggleExpand(group.id)}
                          className="flex items-center justify-between p-4 cursor-pointer sm:gap-4 flex-wrap sm:flex-nowrap"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="p-2 rounded-xl"
                              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                            >
                              <Layers className="w-4 h-4 text-[var(--cyan)]" />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-sm font-semibold truncate pr-2 text-[var(--text-primary)]">
                                {group.filename}
                              </p>
                              <p className="text-xs text-muted" style={{ color: 'var(--text-muted)' }}>
                                {formatDate(group.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                            <div style={{ color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] space-y-4 text-left">
                                {(() => {
                                  const currentPage = batchPages[group.id] || 1;
                                  const itemsPerPage = 10;
                                  const totalItems = group.items.length;
                                  const totalPages = Math.ceil(totalItems / itemsPerPage);
                                  
                                  const startIndex = (currentPage - 1) * itemsPerPage;
                                  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
                                  const paginatedItems = group.items.slice(startIndex, endIndex);
                                  
                                  return (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-[var(--border-subtle)]">
                                        <p className="text-[11px] font-bold text-[var(--cyan)] font-mono tracking-wider">
                                          Images In Batch ({totalItems})
                                        </p>
                                        {totalPages > 1 && (
                                          <div className="flex items-center gap-3 bg-[var(--bg-secondary)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                                            <button
                                              type="button"
                                              disabled={currentPage === 1}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setBatchPages(prev => ({ ...prev, [group.id]: currentPage - 1 }));
                                              }}
                                              className="text-xs font-black font-mono transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed px-1.5"
                                              aria-label="Previous page"
                                            >
                                              &lt;
                                            </button>
                                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                                              {startIndex + 1} - {endIndex} of {totalItems}
                                            </span>
                                            <button
                                              type="button"
                                              disabled={currentPage === totalPages}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setBatchPages(prev => ({ ...prev, [group.id]: currentPage + 1 }));
                                              }}
                                              className="text-xs font-black font-mono transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed px-1.5"
                                              aria-label="Next page"
                                            >
                                              &gt;
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      {paginatedItems.map((item) => {
                                        const isItemExpanded = expandedBatchItemId === item.id;
                                        const isItemFake = item.prediction === 'FAKE';
                                        return (
                                          <div key={item.id} className="rounded-xl border bg-[var(--bg-hover)] overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                                            {/* Sub-item Header */}
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation(); // Prevent parent row toggle
                                                toggleBatchItem(item.id);
                                              }}
                                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--bg-hover)]/85 transition-all"
                                            >
                                              <span className="text-xs font-semibold truncate pr-2 text-[var(--text-primary)]">
                                                {item.filename}
                                              </span>
                                              <div className="flex items-center gap-3">
                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${isItemFake ? 'text-[var(--status-error)] bg-[var(--status-error-bg)] border-[var(--border-danger)]' : 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--border-success)]'}`}>
                                                  {item.prediction}
                                                </span>
                                                <span className="text-xs font-bold text-[var(--text-primary)]">
                                                  {item.confidence.toFixed(1)}%
                                                </span>
                                                <div style={{ color: 'var(--text-muted)' }}>
                                                  {isItemExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Sub-item Details */}
                                            <AnimatePresence>
                                              {isItemExpanded && (
                                                <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: 'auto', opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  className="p-3 border-t bg-[var(--bg-secondary)] space-y-3 text-left"
                                                  style={{ borderColor: 'var(--border-subtle)' }}
                                                >
                                                  {/* Probabilities */}
                                                  <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-2.5 rounded-lg bg-[var(--status-success-bg)] border border-[var(--border-success)]">
                                                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--status-success)] block mb-0.5">Real Probability</span>
                                                      <span className="text-base font-extrabold text-[var(--status-success)]">{item.real_probability.toFixed(2)}%</span>
                                                    </div>
                                                    <div className="p-2.5 rounded-lg bg-[var(--status-error-bg)] border border-[var(--border-danger)]">
                                                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--status-error)] block mb-0.5">Fake Probability</span>
                                                      <span className="text-base font-extrabold text-[var(--status-error)]">{item.fake_probability.toFixed(2)}%</span>
                                                    </div>
                                                  </div>

                                                  {/* SRM Analysis */}
                                                  {item.srm_interpretation && (
                                                    <div className="p-3 rounded-lg bg-[var(--bg-hover)] border" style={{ borderColor: 'var(--border-subtle)' }}>
                                                      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--cyan)] block mb-1">SRM noise Analysis</span>
                                                      <p className="text-[11px] leading-relaxed text-secondary" style={{ color: 'var(--text-secondary)' }}>{item.srm_interpretation}</p>
                                                    </div>
                                                  )}

                                                  {/* Narrative */}
                                                  {item.explanation && (
                                                    <div className="p-3 rounded-lg bg-[var(--bg-hover)] border" style={{ borderColor: 'var(--border-subtle)' }}>
                                                      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--cyan)] block mb-1">Explainability Narrative</span>
                                                      <p className="text-[11px] leading-relaxed text-secondary" style={{ color: 'var(--text-secondary)' }}>{item.explanation}</p>
                                                    </div>
                                                  )}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
