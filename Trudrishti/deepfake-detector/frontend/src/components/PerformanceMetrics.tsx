import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Target, CheckCircle2, ShieldAlert, Cpu, BarChart3, Database, AlertCircle, Table } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import { useMonitoring } from '@/hooks/useMonitoring';
import { useTheme } from '@/hooks/useTheme';

interface PerformanceMetricsProps {
  selectedBatchId?: string;
  onSelectBatchId?: (id: string) => void;
}

export function PerformanceMetrics({ selectedBatchId: propBatchId, onSelectBatchId }: PerformanceMetricsProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const COLORS = [isLight ? '#2563EB' : '#06b6d4', isLight ? '#DC2626' : '#ec4899'];
  const { reports, inferences, loading, error, getBatchMetrics, getRunIdForBatch } = useMonitoring();
  const [localBatchId, setLocalBatchId] = useState<string>('');

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
  const metrics = activeBatchId ? getBatchMetrics(activeBatchId) : null;

  useEffect(() => {
    if (activeBatchId) {
      console.log('--- PerformanceMetrics Dashboard Selection ---');
      console.log('selected batch_id:', activeBatchId);
      console.log('active_run_id:', activeRunId);
    }
  }, [activeBatchId, activeRunId]);

  const metricsColors = {
    accuracy: isLight ? '#2563EB' : '#06b6d4',
    precision: isLight ? '#16A34A' : '#10b981',
    recall: isLight ? '#F59E0B' : '#f59e0b',
    f1Score: isLight ? '#7C3AED' : '#8b5cf6',
    rocAuc: isLight ? '#DC2626' : '#ec4899',
  };

  const handleBatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalBatchId(val);
    if (onSelectBatchId) onSelectBatchId(val);
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-12">
        <div className="skeleton h-8 w-60 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-[420px] rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Metrics Retrieval Failed</h3>
        <p className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">{error}</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4 max-w-md mx-auto">
        <BarChart3 className="w-12 h-12 text-[var(--text-muted)]" />
        <h3 className="text-lg font-bold text-[var(--text-primary)]">No Evaluation Batches Found</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Run a bulk evaluation run first to generate performance metrics.
        </p>
      </div>
    );
  }

  // Calculate percentages and distribution variables
  const classDistribution = metrics?.classDistribution || [];
  const predictionDistribution = metrics?.predictionDistribution || [];

  const classTotal = classDistribution.reduce((acc, curr) => acc + curr.value, 0);
  const realClass = classDistribution.find(d => d.name === 'REAL')?.value || 0;
  const fakeClass = classDistribution.find(d => d.name === 'FAKE')?.value || 0;
  const realClassPct = classTotal > 0 ? (realClass / classTotal) * 100 : 0;
  const fakeClassPct = classTotal > 0 ? (fakeClass / classTotal) * 100 : 0;

  const predTotal = predictionDistribution.reduce((acc, curr) => acc + curr.value, 0);
  const realPred = predictionDistribution.find(d => d.name === 'REAL')?.value || 0;
  const fakePred = predictionDistribution.find(d => d.name === 'FAKE')?.value || 0;
  const realPredPct = predTotal > 0 ? (realPred / predTotal) * 100 : 0;
  const fakePredPct = predTotal > 0 ? (fakePred / predTotal) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl mx-auto flex flex-col gap-6"
    >
      {/* Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <p className="text-xs font-semibold tracking-widest mb-1 text-[var(--text-secondary)]">
            Model Diagnostics
          </p>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <BarChart3 className="w-6 h-6 text-[var(--cyan)]" />
            Model Performance Metrics
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wider whitespace-nowrap">Active Run:</span>
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

      {metrics ? (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Accuracy', val: `${metrics.accuracy}%`, icon: CheckCircle2, color: metricsColors.accuracy },
              { label: 'Precision', val: `${metrics.precision}%`, icon: Target, color: metricsColors.precision },
              { label: 'Recall', val: `${metrics.recall}%`, icon: ShieldAlert, color: metricsColors.recall },
              { label: 'F1-Score', val: `${metrics.f1_score}%`, icon: Award, color: metricsColors.f1Score },
              { label: 'ROC-AUC', val: metrics.auc.toFixed(2), icon: Cpu, color: metricsColors.rocAuc },
            ].map(({ label, val, icon: Icon, color }, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-4 border relative overflow-hidden group"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                  <span className="text-[9px] font-bold tracking-wider text-[var(--text-secondary)]">{label}</span>
                </div>
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight" style={{ color }}>
                  {val}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Confusion Matrix Heatmap Card */}
          <div className="glass-card p-6 border flex flex-col items-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
            <div className="w-full text-left mb-6">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Table className="w-4.5 h-4.5 text-[var(--cyan)]" />
                Confusion Matrix Heatmap
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Density mapping of predicted vs true labels</p>
            </div>

            <div className="relative w-full max-w-[460px] font-mono">
              {/* Predicted Header */}
              <div className="text-center text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)] mb-4">
                Predicted Label
              </div>
              {/* Top Predicted Labels Header */}
              <div className="grid grid-cols-2 ml-[80px] text-center text-xs font-bold text-[var(--text-secondary)] mb-2">
                <span>REAL</span>
                <span>FAKE</span>
              </div>
              {/* Main Grid */}
              <div className="flex">
                {/* True label rotated */}
                <div className="w-[40px] flex items-center justify-center relative">
                  <span className="absolute rotate-[-90deg] whitespace-nowrap text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">
                    True Label
                  </span>
                </div>
                {/* True Labels Labels Header */}
                <div className="flex flex-col justify-around text-right text-xs font-bold text-[var(--text-secondary)] w-[40px] mr-3 py-14">
                  <span>REAL</span>
                  <span>FAKE</span>
                </div>
                {/* Grid */}
                <div 
                  className="grid grid-cols-2 flex-1 aspect-square rounded-2xl overflow-hidden border gap-2.5 p-3 bg-slate-950/20"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {/* TN */}
                  <div 
                    className="flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 hover:scale-[1.02] text-center" 
                    style={{ 
                      backgroundColor: theme === 'light' ? '#EFF6FF' : 'rgba(6, 182, 212, 0.12)', 
                      borderColor: theme === 'light' ? '#BFDBFE' : 'rgba(6, 182, 212, 0.35)',
                      boxShadow: theme === 'light' ? 'none' : 'inset 0 0 20px rgba(6, 182, 212, 0.1)'
                    }}
                  >
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-[var(--cyan)]">
                      {metrics.tn}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-center text-[var(--cyan)]">
                      True Real (TN)
                    </span>
                    <span className="text-[10px] font-mono font-medium mt-0.5 opacity-80 text-[var(--cyan)]">
                      {((metrics.tn / metrics.total) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* FP */}
                  <div 
                    className="flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 hover:scale-[1.02] text-center" 
                    style={{ 
                      backgroundColor: theme === 'light' ? '#FEF2F2' : 'rgba(239, 68, 68, 0.08)', 
                      borderColor: theme === 'light' ? '#FCA5A5' : 'rgba(239, 68, 68, 0.25)',
                      boxShadow: theme === 'light' ? 'none' : 'inset 0 0 20px rgba(239, 68, 68, 0.05)'
                    }}
                  >
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-rose-500 dark:text-rose-400">
                      {metrics.fp}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-center text-rose-500 dark:text-rose-400">
                      False Fake (FP)
                    </span>
                    <span className="text-[10px] font-mono font-medium mt-0.5 opacity-80 text-rose-500 dark:text-rose-400">
                      {((metrics.fp / metrics.total) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* FN */}
                  <div 
                    className="flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 hover:scale-[1.02] text-center" 
                    style={{ 
                      backgroundColor: theme === 'light' ? '#FEF2F2' : 'rgba(239, 68, 68, 0.08)', 
                      borderColor: theme === 'light' ? '#FCA5A5' : 'rgba(239, 68, 68, 0.25)',
                      boxShadow: theme === 'light' ? 'none' : 'inset 0 0 20px rgba(239, 68, 68, 0.05)'
                    }}
                  >
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-rose-500 dark:text-rose-400">
                      {metrics.fn}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-center text-rose-500 dark:text-rose-400">
                      False Real (FN)
                    </span>
                    <span className="text-[10px] font-mono font-medium mt-0.5 opacity-80 text-rose-500 dark:text-rose-400">
                      {((metrics.fn / metrics.total) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* TP */}
                  <div 
                    className="flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 hover:scale-[1.02] text-center" 
                    style={{ 
                      backgroundColor: theme === 'light' ? '#F5F3FF' : 'rgba(139, 92, 246, 0.12)', 
                      borderColor: theme === 'light' ? '#DDD6FE' : 'rgba(139, 92, 246, 0.35)',
                      boxShadow: theme === 'light' ? 'none' : 'inset 0 0 20px rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-violet-500 dark:text-violet-400">
                      {metrics.tp}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-center text-violet-500 dark:text-violet-400">
                      True Fake (TP)
                    </span>
                    <span className="text-[10px] font-mono font-medium mt-0.5 opacity-80 text-violet-500 dark:text-violet-400">
                      {((metrics.tp / metrics.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Heatmap summary statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[var(--border-subtle)] w-full">
              <div className="text-center p-3 bg-slate-900/10 dark:bg-slate-950/20 rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--text-muted)' }}>Total Images</span>
                <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{metrics.total}</span>
              </div>
              <div className="text-center p-3 bg-slate-900/10 dark:bg-slate-950/20 rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--text-success)' }}>Correct Predictions</span>
                <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-success)' }}>{metrics.tn + metrics.tp}</span>
              </div>
              <div className="text-center p-3 bg-slate-900/10 dark:bg-slate-950/20 rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--status-error)' }}>Incorrect Predictions</span>
                <span className="text-lg font-bold font-mono" style={{ color: 'var(--status-error)' }}>{metrics.fp + metrics.fn}</span>
              </div>
              <div className="text-center p-3 bg-slate-900/10 dark:bg-slate-950/20 rounded-xl border border-[var(--border-subtle)]">
                <span className="text-[10px] font-bold uppercase block mb-0.5" style={{ color: 'var(--cyan)' }}>Accuracy %</span>
                <span className="text-lg font-bold font-mono" style={{ color: 'var(--cyan)' }}>{metrics.accuracy}%</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Pie Charts Grid */}
            <div className="glass-card p-5 border flex flex-col justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <div>
                <h3 className="text-xs font-bold tracking-widest text-[var(--text-secondary)] mb-4">
                  Class & Prediction Distribution
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Class Distribution (True Labels) */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] mb-2">Class Distribution (Ground Truth)</span>
                    <div className="flex items-center justify-center gap-4 w-full">
                      <div className="w-[50%] h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={metrics.classDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={24}
                              outerRadius={44}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {metrics.classDistribution.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: isLight ? '#ffffff' : '#0b1329', border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`, borderRadius: '8px' }} 
                              itemStyle={{ color: isLight ? '#0F172A' : '#f1f5f9' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-[50%] flex flex-col justify-center gap-1.5 text-left font-mono">
                        <div className="text-[9px] border-b border-[var(--border-subtle)] pb-0.5 mb-1 font-bold text-[var(--text-muted)] uppercase tracking-wider">Ground Truth</div>
                        <div className="text-xs font-semibold flex items-center justify-between gap-1.5" style={{ color: isLight ? '#2563EB' : '#22d3ee' }}>
                          <span>REAL:</span>
                          <span className="font-extrabold">{realClass} <span className="text-[9px] font-normal text-slate-500">({realClassPct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="text-xs font-semibold flex items-center justify-between gap-1.5" style={{ color: isLight ? '#DC2626' : '#ec4899' }}>
                          <span>FAKE:</span>
                          <span className="font-extrabold">{fakeClass} <span className="text-[9px] font-normal text-slate-500">({fakeClassPct.toFixed(1)}%)</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Prediction Distribution */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] mb-2">Prediction Distribution</span>
                    <div className="flex items-center justify-center gap-4 w-full">
                      <div className="w-[50%] h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={metrics.predictionDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={24}
                              outerRadius={44}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {metrics.predictionDistribution.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: isLight ? '#ffffff' : '#0b1329', border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`, borderRadius: '8px' }} 
                              itemStyle={{ color: isLight ? '#0F172A' : '#f1f5f9' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-[50%] flex flex-col justify-center gap-1.5 text-left font-mono">
                        <div className="text-[9px] border-b border-[var(--border-subtle)] pb-0.5 mb-1 font-bold text-[var(--text-muted)] uppercase tracking-wider">Prediction</div>
                        <div className="text-xs font-semibold flex items-center justify-between gap-1.5" style={{ color: isLight ? '#2563EB' : '#22d3ee' }}>
                          <span>REAL:</span>
                          <span className="font-extrabold">{realPred} <span className="text-[9px] font-normal text-slate-500">({realPredPct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="text-xs font-semibold flex items-center justify-between gap-1.5" style={{ color: isLight ? '#DC2626' : '#ec4899' }}>
                          <span>FAKE:</span>
                          <span className="font-extrabold">{fakePred} <span className="text-[9px] font-normal text-slate-500">({fakePredPct.toFixed(1)}%)</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legends */}
              <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] flex items-center gap-1.5" style={{ color: isLight ? '#2563EB' : '#22d3ee' }}>
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: isLight ? '#2563EB' : '#06b6d4' }} /> REAL Label
                </span>
                <span className="text-[10px] flex items-center gap-1.5" style={{ color: isLight ? '#DC2626' : '#ec4899' }}>
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: isLight ? '#DC2626' : '#ec4899' }} /> FAKE Label
                </span>
              </div>
            </div>

            {/* Confidence Distribution */}
            <div className="glass-card p-5 border flex flex-col justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <div>
                <h3 className="text-xs font-bold tracking-widest text-[var(--text-secondary)] mb-4">
                  Confidence Score Distribution
                </h3>
                
                <div className="w-full h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.confidenceDistribution} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'} />
                      <XAxis dataKey="range" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ background: isLight ? '#ffffff' : '#0b1329', border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`, borderRadius: '8px' }} itemStyle={{ color: isLight ? '#0F172A' : '#f1f5f9' }} />
                      <Bar dataKey="count" fill={isLight ? '#7C3AED' : '#8b5cf6'} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="count" position="top" fill={isLight ? '#0F172A' : '#f1f5f9'} fontSize={10} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p className="text-[10px] text-center mt-1" style={{ color: 'var(--text-muted)' }}>Histogram representing sample counts grouped by probability thresholds</p>
            </div>

          </div>

          {/* Diagnostics Notes */}
          <div className="glass-card p-5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
            <h3 className="text-xs font-bold tracking-widest text-[var(--text-secondary)] mb-2 flex items-center gap-1">
              <Database className="w-4 h-4 text-[var(--cyan)]" style={{ color: 'var(--cyan)' }} /> Boundary Optimization Notes
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This batch classification represents <strong>{metrics.total} samples</strong> with ground truths. 
              The balance between True Positive Rate and True Negative Rate yields an accuracy of <strong>{metrics.accuracy}%</strong>. 
              Review the <strong>Confusion Matrix</strong> and <strong>Error Analysis</strong> dashboards to inspect specific sample images that fall outside classification boundaries.
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3 border border-dashed rounded-2xl bg-[var(--bg-secondary)]/40" style={{ borderColor: 'var(--border-subtle)' }}>
          <AlertCircle className="w-10 h-10 text-[var(--cyan)]" style={{ color: 'var(--cyan)' }} />
          <h3 className="text-md font-bold text-[var(--text-primary)]">Metrics Unavailable for Batch</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm">
            Inference samples in batch <strong>{activeBatchId}</strong> do not contain ground truth labels. Evaluated metrics require a verified Ground Truth.
          </p>
        </div>
      )}
    </motion.div>
  );
}
