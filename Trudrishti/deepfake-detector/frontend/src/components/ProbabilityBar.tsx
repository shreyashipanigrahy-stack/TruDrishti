import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface ProbabilityBarProps {
  label:   string;
  value:   number;   // 0–1
  type:    'real' | 'fake';
  animate?: boolean;
}

export function ProbabilityBar({ label, value, type, animate = true }: ProbabilityBarProps) {
  const pct = Math.round(value * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span
          className="text-sm font-bold font-mono tabular-nums"
          style={{ color: type === 'real' ? 'var(--real-color)' : 'var(--fake-color)' }}
        >
          {pct}%
        </span>
      </div>

      <div className="prob-bar-track">
        <motion.div
          className={type === 'real' ? 'prob-bar-fill-real' : 'prob-bar-fill-fake'}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: animate ? 1.2 : 0, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

/* ── Donut chart (mini) ──────────────────────────────────────── */
interface DonutProps {
  prediction: 'REAL' | 'FAKE';
  value: number; // 0 - 1
  size?: number;
}

export function DonutChart({ prediction, value, size = 120 }: DonutProps) {
  const r   = 40;
  const cx  = size / 2;
  const cy  = size / 2;
  const circ = 2 * Math.PI * r;

  const isFake = prediction === 'FAKE';
  const progressDash = circ * value;

  // Use exact colors requested:
  // REAL: Progress Arc: #16A34A, Remaining Arc: #E2E8F0
  // FAKE: Progress Arc: #DC2626, Remaining Arc: #E2E8F0
  const strokeColor = isFake ? '#DC2626' : '#16A34A';
  const remainingColor = '#E2E8F0';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      {/* Track (Remaining Arc) */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={r} 
        fill="none" 
        stroke={remainingColor} 
        strokeWidth="12" 
      />

      {/* Progress Arc */}
      <motion.circle
        cx={cx} 
        cy={cy} 
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${progressDash} ${circ}`}
        strokeDashoffset={0}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${progressDash} ${circ}` }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
