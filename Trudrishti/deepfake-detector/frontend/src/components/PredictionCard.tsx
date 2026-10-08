import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, TrendingUp, BarChart2 } from 'lucide-react';
import { ProbabilityBar, DonutChart } from './ProbabilityBar';
import type { DetectionResult } from '@/types/detection';

interface PredictionCardProps {
  result: DetectionResult;
}

export function PredictionCard({ result }: PredictionCardProps) {
  const isFake     = result.prediction === 'FAKE';
  const confPct    = Math.round(result.confidence);
  const realPct    = Math.round(result.real_probability);
  const fakePct    = Math.round(result.fake_probability);

  const accentColor = isFake ? '#DC2626' : '#16A34A';
  const glowColor   = isFake ? 'var(--fake-glow)'  : 'var(--real-glow)';
  const Icon        = isFake ? ShieldAlert : ShieldCheck;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6 flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
               style={{ 
                 backgroundColor: isFake ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.08)',
                 borderColor: isFake ? 'rgba(220, 38, 38, 0.25)' : 'rgba(22, 163, 74, 0.25)' 
               }}>
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-xs font-medium tracking-widest"
               style={{ color: 'var(--text-muted)' }}>Prediction</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Model Output
            </p>
          </div>
        </div>
        <BarChart2 className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* Main verdict */}
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative shrink-0">
          <DonutChart prediction={result.prediction} value={result.confidence / 100} size={110} />
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className="text-lg font-bold font-mono tabular-nums"
                  style={{ color: accentColor }}>{confPct}%</span>
            <span className="text-[10px] font-medium tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Conf</span>
          </div>
        </div>

        {/* Verdict text */}
        <div className="flex flex-col gap-2">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
            className="inline-flex items-center px-4 py-1.5 rounded-full text-xl font-extrabold tracking-wide border"
            style={{
              color: accentColor,
              backgroundColor: isFake ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.08)',
              borderColor: isFake ? 'rgba(220, 38, 38, 0.3)' : 'rgba(22, 163, 74, 0.3)'
            }}
          >
            {result.prediction}
          </motion.span>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Confidence: <strong style={{ color: accentColor }}>{confPct}%</strong>
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {result.confidence_tag}
          </p>
        </div>
      </div>

      {/* Probability bars */}
      <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-semibold tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Class Probabilities</span>
        </div>
        <ProbabilityBar label="Real" value={result.real_probability / 100} type="real" />
        <ProbabilityBar label="Fake" value={result.fake_probability / 100} type="fake" />
      </div>

      {/* Numeric table */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {[
          { label: 'Real Prob', value: `${realPct}%`, color: 'var(--real-color)' },
          { label: 'Fake Prob', value: `${fakePct}%`, color: 'var(--fake-color)' },
          { label: 'Confidence', value: `${confPct}%`, color: accentColor },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center p-3 rounded-xl"
               style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
            <span className="text-xl font-bold font-mono tabular-nums" style={{ color }}>
              {value}
            </span>
            <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
