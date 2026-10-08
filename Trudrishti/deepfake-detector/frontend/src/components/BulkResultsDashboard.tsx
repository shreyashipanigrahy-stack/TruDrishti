import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, HelpCircle, FileDown } from 'lucide-react';
import { ResultsPanel } from './ResultsPanel';
import type { BulkItemResult } from '@/types/detection';

interface BulkResultsDashboardProps {
  bulkResults: BulkItemResult[];
  imageFiles: File[];
  imageUrls: string[];
  scaleType: '3-grade' | '5-grade';
}

export function BulkResultsDashboard({ bulkResults, imageFiles, imageUrls, scaleType }: BulkResultsDashboardProps) {
  const [activeFilename, setActiveFilename] = useState<string | null>(null);

  // Map filename to its local preview URL
  const fileUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    imageFiles.forEach((file, idx) => {
      map.set(file.name, imageUrls[idx]);
    });
    return map;
  }, [imageFiles, imageUrls]);

  // Set default active file
  useEffect(() => {
    if (bulkResults.length > 0 && !activeFilename) {
      setActiveFilename(bulkResults[0].filename);
    }
  }, [bulkResults, activeFilename]);

  const activeItem = bulkResults.find(r => r.filename === activeFilename);
  const activeUrl = activeItem ? fileUrlMap.get(activeItem.filename) : null;

  const handleExportReport = () => {
    if (!activeItem) return;
    const originalTitle = document.title;
    document.title = `TruDrishti_Analysis_Report_${activeItem.filename.split('.')[0]}_${activeItem.prediction}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Summary Grid */}
      <div>
        <h3 className="text-lg font-bold mb-4 font-mono tracking-wide" style={{ color: 'var(--cyan)' }}>
          Batch Summary Grid
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {bulkResults.map(res => {
            const previewUrl = fileUrlMap.get(res.filename);
            const isSelected = activeFilename === res.filename;
            const isSuccess = res.status === 'success';
            const isFake = res.prediction === 'FAKE';
            
            let badgeBg = 'var(--bg-glass)';
            let badgeColor = 'var(--text-muted)';
            let badgeText = 'ERROR';
            let borderStyle = '1px solid var(--border-subtle)';
            let shadowStyle = '';

            if (isSuccess) {
              if (isFake) {
                badgeBg = 'var(--status-error-bg)';
                badgeColor = 'var(--status-error)';
                badgeText = 'FAKE';
                borderStyle = isSelected ? '2px solid var(--status-error)' : '1px solid var(--border-danger)';
                shadowStyle = isSelected ? '0 0 16px var(--fake-glow)' : '';
              } else {
                badgeBg = 'var(--status-success-bg)';
                badgeColor = 'var(--status-success)';
                badgeText = 'REAL';
                borderStyle = isSelected ? '2px solid var(--status-success)' : '1px solid var(--border-success)';
                shadowStyle = isSelected ? '0 0 16px var(--real-glow)' : '';
              }
            } else {
              badgeBg = 'var(--status-warning-bg)';
              badgeColor = 'var(--status-warning)';
              badgeText = 'ERROR';
              borderStyle = isSelected ? '2px solid var(--status-warning)' : '1px solid var(--border-subtle)';
              shadowStyle = isSelected ? '0 0 16px rgba(245, 158, 11, 0.25)' : '';
            }

            return (
              <motion.button
                key={res.filename}
                onClick={() => setActiveFilename(res.filename)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass-card flex flex-col overflow-hidden text-left relative cursor-pointer group transition-all duration-300"
                style={{
                  border: borderStyle,
                  boxShadow: shadowStyle,
                  minHeight: '160px'
                }}
              >
                {/* Thumbnail Image */}
                <div className="w-full aspect-[4/3] relative overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {previewUrl ? (
                    <img src={previewUrl} alt={res.filename} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HelpCircle className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                  )}
                  {/* Absolute Badge */}
                  <span
                    className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border"
                    style={{ background: badgeBg, color: badgeColor, borderColor: 'var(--border-subtle)' }}
                  >
                    {badgeText}
                  </span>
                </div>

                {/* Info Area */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-1.5 border-t border-[var(--border-subtle)]" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <p className="text-[11px] font-mono truncate max-w-full" style={{ color: 'var(--text-primary)' }}>
                    {res.filename}
                  </p>
                  {isSuccess && res.confidence !== undefined && (
                    <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      <span>Confidence:</span>
                      <span className="font-bold" style={{ color: badgeColor }}>
                        {Math.round(res.confidence)}%
                      </span>
                    </div>
                  )}
                  {!isSuccess && (
                    <span className="text-[10px] font-mono truncate" style={{ color: 'var(--status-warning)' }}>
                      {res.error_detail || 'Failed to analyze'}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Details Container */}
      <div className="border-t border-subtle pt-6" style={{ borderColor: 'var(--border-subtle)' }}>
        {activeItem && activeUrl ? (
          activeItem.status === 'success' ? (
            <div>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-mono px-3 py-1.5 rounded-lg border"
                    style={{
                      background: 'var(--bg-glass)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Active Focus: {activeItem.filename}
                  </span>
                  <span 
                    className="text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg border"
                    style={{
                      backgroundColor: activeItem.prediction === 'FAKE' ? 'var(--status-error-bg)' : 'var(--status-success-bg)',
                      color: activeItem.prediction === 'FAKE' ? 'var(--status-error)' : 'var(--status-success)',
                      borderColor: activeItem.prediction === 'FAKE' ? 'var(--border-danger)' : 'var(--border-success)'
                    }}
                  >
                    {activeItem.prediction}
                  </span>
                </div>
                
                <button
                  onClick={handleExportReport}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-2 hover:bg-[var(--bg-hover)]"
                  style={{
                    background: 'var(--bg-glass)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export Report
                </button>
              </div>
              <ResultsPanel
                imageUrl={activeUrl}
                scaleType={scaleType}
                result={{
                  prediction: activeItem.prediction!,
                  confidence: activeItem.confidence!,
                  real_probability: activeItem.real_probability!,
                  fake_probability: activeItem.fake_probability!,
                  gradcam_image: activeItem.gradcam_image || '',
                  srm_image: activeItem.srm_image || '',
                  srm_interpretation: activeItem.srm_interpretation || '',
                  confidence_tag: activeItem.confidence_tag!,
                  explanation: activeItem.explanation!,
                  forensic_signals: activeItem.forensic_signals,
                }}
              />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-8 flex flex-col items-center justify-center text-center gap-4 max-w-xl mx-auto border"
              style={{ borderColor: 'var(--status-warning)', background: 'var(--status-warning-bg)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center border" style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)', borderColor: 'var(--status-warning)' }}>
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold mb-1" style={{ color: 'var(--status-warning)' }}>Inference Execution Failed</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Error encountered while analyzing <code className="px-1.5 py-0.5 rounded font-mono text-xs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{activeItem.filename}</code>.
                </p>
              </div>
              <div className="p-4 rounded-lg border w-full font-mono text-xs text-left max-h-[160px] overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--status-warning)' }}>
                {activeItem.error_detail || 'No detailed error message was provided.'}
              </div>
            </motion.div>
          )
        ) : (
          <div className="text-center py-12 text-muted" style={{ color: 'var(--text-muted)' }}>
            Select an image above to display its forensic analysis.
          </div>
        )}
      </div>
    </div>
  );
}
