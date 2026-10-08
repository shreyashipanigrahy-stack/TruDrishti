import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Info } from 'lucide-react';

interface SRMPanelProps {
  srmBase64:      string;
  interpretation: string;
}

export function SRMPanel({ srmBase64, interpretation }: SRMPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card p-6 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
             style={{ background: 'rgba(0,180,230,0.12)',
                      border: '1px solid rgba(0,180,230,0.3)' }}>
          <Activity className="w-4 h-4" style={{ color: 'var(--cyan)' }} />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest"
             style={{ color: 'var(--text-muted)' }}>Noise Analysis</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            SRM Filter Residuals
          </p>
        </div>
      </div>

      {/* SRM image */}
      <div className="rounded-xl overflow-hidden relative"
           style={{ border: '1px solid var(--border-subtle)' }}>
        <img
          src={`data:image/png;base64,${srmBase64}`}
          alt="SRM noise residual analysis"
          className="w-full object-contain"
          style={{ maxHeight: '260px', background: '#000' }}
        />
        {/* Corner watermark */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-medium"
             style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--cyan)',
                      backdropFilter: 'blur(4px)' }}>
          SRM
        </div>
      </div>

      {/* Color scale */}
      <div className="flex items-center gap-3">
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Residual:</span>
        <div className="flex-1 h-2 rounded-full"
             style={{ background: 'linear-gradient(90deg, #000080, #00ffff, #ffffff)' }} />
        <div className="flex justify-between text-[10px] gap-2" style={{ color: 'var(--text-muted)' }}>
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Interpretation */}
      <div className="p-4 rounded-xl flex gap-3"
           style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--cyan)' }} />
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            Interpretation
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {interpretation}
          </p>
        </div>
      </div>

      {/* Method note */}
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        The SRM (Steganalysis Rich Model) applies a bank of high-pass filters to expose 
        manipulation noise residuals. GAN-generated faces typically exhibit periodic 
        checkerboard patterns invisible to the naked eye.
      </p>
    </motion.div>
  );
}
