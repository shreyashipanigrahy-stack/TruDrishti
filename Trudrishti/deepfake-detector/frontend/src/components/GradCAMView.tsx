import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Layers } from 'lucide-react';

interface GradCAMViewProps {
  originalUrl:   string;
  gradcamBase64: string;
}

type Tab = 'original' | 'gradcam';

export function GradCAMView({ originalUrl, gradcamBase64 }: GradCAMViewProps) {
  const [tab, setTab] = useState<Tab>('gradcam');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'original', label: 'Original',        icon: <Eye    className="w-3.5 h-3.5" /> },
    { id: 'gradcam',  label: 'GradCAM Overlay', icon: <Layers className="w-3.5 h-3.5" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-card p-6 flex flex-col gap-4"
    >
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest"
             style={{ color: 'var(--text-muted)' }}>Visual Analysis</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
            GradCAM Attention Map
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-glass)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                          transition-all duration-200
                          ${tab === t.id ? 'img-tab-active' : ''}`}
              style={{
                color: tab === t.id ? 'var(--cyan)' : 'var(--text-muted)',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Image */}
      <div className="relative rounded-xl overflow-hidden bg-black/20"
           style={{ border: '1px solid var(--border-subtle)' }}>
        <AnimatePresence mode="wait">
          {tab === 'original' ? (
            <motion.img
              key="original"
              src={originalUrl}
              alt="Original input image"
              className="w-full object-contain rounded-xl"
              style={{ maxHeight: '340px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
          ) : (
            <motion.img
              key="gradcam"
              src={`data:image/png;base64,${gradcamBase64}`}
              alt="GradCAM heatmap overlay"
              className="w-full object-contain rounded-xl"
              style={{ maxHeight: '340px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      {tab === 'gradcam' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-4 flex-wrap"
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Activation intensity:</p>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-24 rounded-full"
                 style={{ background: 'linear-gradient(90deg, #00008b, #0000ff, #00ffff, #ffff00, #ff0000)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Low → High</span>
          </div>
        </motion.div>
      )}

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {tab === 'gradcam'
          ? 'Warm colours (red/orange) indicate regions most influential for the model\'s prediction. Cool colours (blue) are low-activation areas.'
          : 'Original uploaded image before any processing or analysis.'
        }
      </p>
    </motion.div>
  );
}
