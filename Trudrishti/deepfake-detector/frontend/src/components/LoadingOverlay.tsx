import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { 
  FileImage, 
  Settings, 
  Brain, 
  Shuffle, 
  Palette, 
  Activity, 
  Scale, 
  Check, 
  ChevronRight, 
  ChevronDown 
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface LoadingOverlayProps {
  show: boolean;
}

const PIPELINE_STEPS = [
  {
    id: 0,
    label1: 'INPUT',
    label2: 'IMAGE',
    icon: FileImage,
    color: '#3b82f6',
    rgb: '59, 130, 246',
    statusText: 'Verifying uploaded image and loading payload...',
  },
  {
    id: 1,
    label1: 'ALIGN &',
    label2: 'NORMALIZE',
    icon: Settings,
    color: '#8b5cf6',
    rgb: '139, 92, 246',
    statusText: 'Detecting faces and normalizing dimensions...',
  },
  {
    id: 2,
    label1: 'EFFICIENTNET',
    label2: 'B4 + SRM',
    icon: Brain,
    color: '#10b981',
    rgb: '16, 185, 129',
    statusText: 'Extracting deep spatial features and SRM noise forensics...',
  },
  {
    id: 3,
    label1: 'FEATURE',
    label2: 'FUSION',
    icon: Shuffle,
    color: '#ec4899',
    rgb: '236, 72, 153',
    statusText: 'Fusing spatial representations and noise features...',
  },
  {
    id: 4,
    label1: 'GRAD-CAM',
    label2: 'EXPLAIN',
    icon: Palette,
    color: '#f59e0b',
    rgb: '245, 158, 11',
    statusText: 'Generating Grad-CAM localization heatmaps...',
  },
  {
    id: 5,
    label1: 'SRM',
    label2: 'SIGNAL',
    icon: Activity,
    color: '#06b6d4',
    rgb: '6, 182, 212',
    statusText: 'Analyzing high-frequency noise residual signal...',
  },
  {
    id: 6,
    label1: 'VERDICT',
    label2: '& SCORE',
    icon: Scale,
    color: '#00f5a0',
    rgb: '0, 245, 160',
    statusText: 'Computing final deepfake verdict and confidence scores...',
  },
];

export function LoadingOverlay({ show }: LoadingOverlayProps) {
  const { theme } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!show) {
      setStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIndex((current) => {
        if (current < PIPELINE_STEPS.length - 1) {
          return current + 1;
        }
        return current;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 16 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <div
        className="glass-card p-6 sm:p-10 md:p-12 flex flex-col items-center gap-8 w-full mx-auto relative overflow-hidden"
        style={{ 
          boxShadow: theme === 'light' ? '0 8px 30px rgba(37, 99, 235, 0.05)' : '0 0 30px rgba(0, 245, 160, 0.1)',
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-card)'
        }}
      >
        {/* Title */}
        <div className="text-center">
          <h3 
            className="text-lg sm:text-xl font-extrabold tracking-widest font-mono"
            style={{ 
              color: theme === 'light' ? 'var(--cyan)' : '#00f5a0', 
              textShadow: theme === 'light' ? 'none' : '0 0 15px rgba(0, 245, 160, 0.4)' 
            }}
          >
            Analysis Pipeline Active
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Processing facial features through verification stages
          </p>
        </div>

        {/* Pipeline Steps Container */}
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-2 md:gap-4 py-4">
          {PIPELINE_STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isCompleted = idx < stepIndex;
            const isActive = idx === stepIndex;
            const isPending = idx > stepIndex;

            return (
              <React.Fragment key={step.id}>
                {/* Step Node */}
                <div className="flex flex-col items-center w-full md:w-auto relative group">
                  {/* Icon Box */}
                  <motion.div
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={isActive ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
                    className={clsx(
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 relative"
                    )}
                    style={{
                      borderColor: isCompleted 
                        ? (theme === 'light' ? 'var(--real-color)' : '#00f5a0') 
                        : isActive 
                        ? (theme === 'light' && step.id === 6 ? 'var(--real-color)' : step.color) 
                        : 'var(--border-subtle)',
                      background: isCompleted 
                        ? (theme === 'light' ? 'var(--status-success-bg)' : 'rgba(0, 245, 160, 0.05)') 
                        : isActive 
                        ? `rgba(${step.rgb}, 0.08)` 
                        : (theme === 'light' ? 'var(--bg-secondary)' : 'rgba(255, 255, 255, 0.02)'),
                      boxShadow: isCompleted 
                        ? (theme === 'light' ? 'none' : '0 0 15px rgba(0, 245, 160, 0.25)') 
                        : isActive 
                        ? `0 0 15px rgba(${step.rgb}, 0.15)` 
                        : 'none',
                    }}
                  >
                    {/* Icon */}
                    <StepIcon 
                      className="w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-300" 
                      style={{
                        color: isCompleted 
                          ? (theme === 'light' ? 'var(--real-color)' : '#00f5a0') 
                          : isActive 
                          ? (theme === 'light' && step.id === 6 ? 'var(--real-color)' : step.color) 
                          : 'var(--text-disabled)',
                      }}
                    />

                    {/* Completion Checkmark Badge */}
                    {isCompleted && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border border-slate-900 shadow-md"
                      >
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Labels */}
                  <div 
                    className="text-center mt-3 font-mono text-[10px] sm:text-xs tracking-wider font-semibold transition-colors duration-300"
                    style={{
                      color: isCompleted 
                        ? (theme === 'light' ? 'var(--real-color)' : '#00f5a0') 
                        : isActive 
                        ? 'var(--text-primary)' 
                        : 'var(--text-disabled)'
                    }}
                  >
                    <div>{step.label1}</div>
                    <div>{step.label2}</div>
                  </div>
                </div>

                {/* Connection Arrow */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="flex items-center justify-center shrink-0 w-full md:w-auto">
                    {/* Desktop Right Arrow */}
                    <ChevronRight 
                      className={clsx(
                        "hidden md:block w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300"
                      )} 
                      style={{
                        color: isCompleted 
                          ? (theme === 'light' ? 'var(--real-color)' : '#00f5a0') 
                          : idx === stepIndex 
                          ? (theme === 'light' && step.id === 6 ? 'var(--real-color)' : step.color) 
                          : 'var(--border-strong)',
                      }}
                    />
                    {/* Mobile Down Arrow */}
                    <ChevronDown 
                      className={clsx(
                        "block md:hidden w-5 h-5 sm:w-6 sm:h-6 my-1 transition-all duration-300"
                      )} 
                      style={{
                        color: isCompleted 
                          ? (theme === 'light' ? 'var(--real-color)' : '#00f5a0') 
                          : idx === stepIndex 
                          ? (theme === 'light' && step.id === 6 ? 'var(--real-color)' : step.color) 
                          : 'var(--border-strong)',
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Status Text & Progress Bar */}
        <div className="w-full flex flex-col items-center gap-4 mt-2">
          {/* Status Message */}
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center font-mono text-xs sm:text-sm tracking-wide px-4 py-2 rounded-xl border w-full max-w-lg"
            style={{ 
              background: 'var(--bg-secondary)', 
              borderColor: 'var(--border-subtle)', 
              color: 'var(--text-secondary)' 
            }}
          >
            {PIPELINE_STEPS[stepIndex].statusText}
          </motion.div>

          {/* Progress Bar Track */}
          <div 
            className="w-full max-w-lg h-2 rounded-full overflow-hidden" 
            style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-divider)' }}
          >
            <motion.div 
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((stepIndex + 1) / PIPELINE_STEPS.length) * 100}%` }}
              transition={{ duration: 0.4 }}
              style={{
                background: 'var(--cyan)',
                boxShadow: theme === 'light' ? 'none' : '0 0 12px var(--cyan-glow)'
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
