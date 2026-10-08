import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { ImageUploader } from '@/components/ImageUploader';
import { ResultsPanel } from '@/components/ResultsPanel';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { LoginPage } from '@/components/LoginPage';
import { HistoryPanel } from '@/components/HistoryPanel';
import { PerformanceMetrics } from '@/components/PerformanceMetrics';
import { BulkEvaluationPanel } from '@/components/BulkEvaluationPanel';
import { useDetection } from '@/hooks/useDetection';
import { useTheme } from '@/hooks/useTheme';
import { BarChart3, Activity, FileDown, Gauge, ShieldAlert, FileText } from 'lucide-react';
import { MonitoringDashboard } from '@/components/MonitoringDashboard';
import { ErrorAnalysis } from '@/components/ErrorAnalysis';
import { ReportsPanel } from '@/components/ReportsPanel';
import { MonitoringProvider } from '@/hooks/useMonitoring';

interface User {
  name: string;
  email: string;
  avatar: string;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { result, bulkResults, loading, error, imageUrl, imageFiles, imageUrls, detect, reset } = useDetection();
  const [activeTab, setActiveTab] = useState<'detector' | 'evaluation' | 'history' | 'metrics' | 'monitoring' | 'error_analysis' | 'reports'>('detector');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [scaleType, setScaleType] = useState<'3-grade' | '5-grade'>(() => {
    return (localStorage.getItem('trudrishti_scale_type') as '3-grade' | '5-grade') || '5-grade';
  });

  const handleScaleTypeChange = (newScale: '3-grade' | '5-grade') => {
    setScaleType(newScale);
    localStorage.setItem('trudrishti_scale_type', newScale);
  };


  const handleTabChange = (tab: 'detector' | 'batch' | 'evaluation' | 'history' | 'metrics' | 'monitoring' | 'error_analysis' | 'reports') => {
    reset();
    if (tab === 'batch') {
      setActiveTab('evaluation');
    } else {
      setActiveTab(tab);
    }
  };

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('trudrishti_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (newUser: User, token: string) => {
    setUser(newUser);
    localStorage.setItem('trudrishti_user', JSON.stringify(newUser));
    localStorage.setItem('trudrishti_token', token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('trudrishti_user');
    localStorage.removeItem('trudrishti_token');
  };

  const handleExportReport = () => {
    const originalTitle = document.title;
    if (result) {
      document.title = `TruDrishti_Analysis_Report_${result.prediction}_${Math.round(result.confidence)}pct`;
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <MonitoringProvider>
      {/* Background decorations */}
      <div className="bg-mesh" />
      <div className="bg-grid" />

      {/* Main layout */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <Header theme={theme} onToggleTheme={toggleTheme} user={user} onLogout={handleLogout} scaleType={scaleType} onChangeScaleType={handleScaleTypeChange} />

        {/* Layout container: Left Sidebar + Right Content */}
        <div className="flex-1 w-full px-4 sm:px-6 pb-16 pt-6 flex flex-col md:flex-row gap-8 relative">

          {/* Vertical Tab Selector Sidebar */}
          <aside className="w-full md:w-60 flex-shrink-0">
            <div className="flex flex-col gap-2 p-2 rounded-2xl glass-card sticky top-24" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => handleTabChange('detector')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'detector' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'detector' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <span>Detector</span>
              </button>
              <button
                onClick={() => handleTabChange('evaluation')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'evaluation' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'evaluation' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <span>Bulk Evaluation</span>
              </button>
              <button
                onClick={() => handleTabChange('history')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'history' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <span>History</span>
              </button>

              <div className="h-px my-1.5 mx-2" style={{ backgroundColor: 'var(--border-subtle)' }} />
              <div className="px-4 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Evaluation
              </div>

              <button
                onClick={() => handleTabChange('monitoring')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'monitoring' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'monitoring' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <Gauge className="w-4 h-4 shrink-0" />
                <span>AI Monitoring</span>
              </button>

              <button
                onClick={() => handleTabChange('metrics')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'metrics' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'metrics' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Performance Metrics</span>
              </button>
              <button
                onClick={() => handleTabChange('error_analysis')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'error_analysis' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'error_analysis' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Error Analysis</span>
              </button>
              <button
                onClick={() => handleTabChange('reports')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 justify-start`}
                style={{
                  background: activeTab === 'reports' ? 'var(--cyan)' : 'transparent',
                  color: activeTab === 'reports' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Reports</span>
              </button>
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 min-w-0">
            {activeTab === 'history' ? (
              <HistoryPanel />
            ) : activeTab === 'metrics' ? (
              <PerformanceMetrics selectedBatchId={selectedBatchId} onSelectBatchId={setSelectedBatchId} />
            ) : activeTab === 'error_analysis' ? (
              <ErrorAnalysis selectedBatchId={selectedBatchId} onSelectBatchId={setSelectedBatchId} />
            ) : activeTab === 'reports' ? (
              <ReportsPanel selectedBatchId={selectedBatchId} onSelectBatchId={setSelectedBatchId} />
            ) : activeTab === 'evaluation' ? (
              <BulkEvaluationPanel
                scaleType={scaleType}
                bulkResults={bulkResults}
                loading={loading}
                error={error}
                imageFiles={imageFiles}
                imageUrls={imageUrls}
                onDetect={detect}
                onReset={reset}
                selectedBatchId={selectedBatchId}
                onSelectBatchId={setSelectedBatchId}
              />
            ) : activeTab === 'monitoring' ? (
              <MonitoringDashboard 
                selectedBatchId={selectedBatchId} 
                onSelectBatchId={setSelectedBatchId} 
                onNavigateTab={handleTabChange} 
              />
            ) : (
              <>
                {/* ── Hero section (only when no result yet) ── */}
                <AnimatePresence>
                  {!result && !loading && (
                    <motion.div
                      key="hero"
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="text-center mb-10"
                    >
                      <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                        <span className="gradient-text">
                          Detect Deepfakes
                        </span>
                        <br />
                        <span style={{ color: 'var(--text-primary)' }}>with AI Precision</span>
                      </h2>

                      {/* Feature chips */}
                      <div className="flex flex-wrap gap-2 justify-center mt-6">
                        {[
                          'EfficientNet-B4',
                          'GradCAM XAI',
                          'SRM Forensics',
                          'Confidence Scoring',
                        ].map(chip => (
                          <span key={chip}
                            className="text-xs px-3 py-1.5 rounded-full font-semibold border"
                            style={{
                              background: 'var(--primary-light)',
                              borderColor: 'var(--border-subtle)',
                              color: theme === 'light' ? 'var(--primary-active)' : 'var(--text-secondary)'
                            }}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>



                {/* ── Upload section ── */}
                <div className="max-w-5xl mx-auto w-full">
                  <ImageUploader
                    onDetect={detect}
                    loading={loading}
                    error={error}
                    imageUrl={imageUrl}
                    onReset={reset}
                    allowMultiple={false}
                    hasResults={!!result}
                  />
                </div>

                {/* ── Results Panel (inline below upload, when complete) ── */}
                <AnimatePresence>
                  {result && !loading && (
                    <motion.div
                      key="results-wrapper"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      className="w-full mt-4"
                    >
                      {/* Results header bar */}
                      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-8">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                            style={{ color: 'var(--text-muted)' }}>Analysis Complete</p>
                          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            Detection Results
                            <span className={`ml-3 text-lg font-extrabold ${result.prediction === 'FAKE' ? 'text-[var(--status-error)]' : 'text-[var(--cyan)]'}`}>
                              — {result.prediction}
                            </span>
                          </h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleExportReport}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 flex items-center gap-2 hover:bg-[var(--bg-hover)]"
                            style={{
                              background: 'var(--bg-glass)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            <FileDown className="w-4 h-4" />
                            Export Report
                          </button>
                          <button
                            id="analyse-another-btn"
                            onClick={reset}
                            className="btn-primary text-sm"
                          >
                            Reset / Clear results
                          </button>
                        </div>
                      </div>

                      {imageUrl && (
                        <ResultsPanel result={result} imageUrl={imageUrl} scaleType={scaleType} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </main>
        </div>
      </div>
    </MonitoringProvider>
  );
}
