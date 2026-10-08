import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Scan, AlertCircle, Plus,
  FileImage, Settings, Brain, Shuffle, Palette, Activity, Scale, ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '@/hooks/useTheme';

interface ImageUploaderProps {
  onDetect: (file: File | File[]) => void;
  loading: boolean;
  error: string | null;
  imageUrl: string | null;
  onReset: () => void;
  allowMultiple: boolean;
  hasResults: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
const MAX_MB = 20;

const PIPELINE_STEPS = [
  { id: 0, label1: 'Input', label2: 'Image', icon: FileImage, color: '#3b82f6' },
  { id: 1, label1: 'Align &', label2: 'Normalize', icon: Settings, color: '#8b5cf6' },
  { id: 2, label1: 'EfficientNet', label2: 'B4 + SRM', icon: Brain, color: '#10b981' },
  { id: 3, label1: 'Feature', label2: 'Fusion', icon: Shuffle, color: '#ec4899' },
  { id: 4, label1: 'Grad-CAM', label2: 'Explain', icon: Palette, color: '#f59e0b' },
  { id: 5, label1: 'SRM', label2: 'Signal', icon: Activity, color: '#06b6d4' },
  { id: 6, label1: 'Verdict', label2: '& Score', icon: Scale, color: '#00f5a0' },
];

export function ImageUploader({ onDetect, loading, error, imageUrl, onReset, allowMultiple, hasResults }: ImageUploaderProps) {
  const { theme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [localUrls, setLocalUrls] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(-1);

  // Sync with parent reset
  const prevHasResultsRef = useRef(false);
  useEffect(() => {
    if (prevHasResultsRef.current && !hasResults) {
      localUrls.forEach(url => URL.revokeObjectURL(url));
      setLocalFiles([]);
      setLocalUrls([]);
      setFileError(null);
    }
    prevHasResultsRef.current = hasResults;
  }, [hasResults, localUrls]);

  // Handle pipeline step animation
  useEffect(() => {
    if (loading) {
      setStepIndex(0);
      const interval = setInterval(() => {
        setStepIndex(curr => {
          if (curr < PIPELINE_STEPS.length - 1) return curr + 1;
          return curr;
        });
      }, 700);
      return () => clearInterval(interval);
    } else if (imageUrl || hasResults) {
      setStepIndex(PIPELINE_STEPS.length - 1); // all complete
    } else {
      setStepIndex(-1); // idle
    }
  }, [loading, imageUrl, hasResults]);

  // Revoke object URLs on unmount to avoid leaks
  useEffect(() => {
    return () => {
      localUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [localUrls]);

  const validate = (file: File): string | null => {
    const mime = file.type.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isAcceptedType = ACCEPTED.includes(mime);
    const isAcceptedExt = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext);

    if (!isAcceptedType && !isAcceptedExt)
      return `Unsupported format for ${file.name}. Accepted: JPEG, PNG, WebP, BMP.`;
    if (file.size > MAX_MB * 1024 * 1024)
      return `${file.name} is too large. Maximum size is ${MAX_MB} MB.`;
    return null;
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const newUrls: string[] = [];
    let err: string | null = null;

    if (!allowMultiple && fileArray.length > 0) {
      const file = fileArray[0];
      const errorMsg = validate(file);
      if (errorMsg) {
        setFileError(errorMsg);
        return;
      }
      setLocalFiles([file]);
      setLocalUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return [URL.createObjectURL(file)];
      });
      setFileError(null);
      return;
    }

    for (const file of fileArray) {
      const errorMsg = validate(file);
      if (errorMsg) {
        err = errorMsg;
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0 && err) {
      setFileError(err);
      return;
    }

    setLocalFiles(prev => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 10) {
        setFileError('Maximum 10 images are allowed. Extra images were ignored.');
        const truncated = combined.slice(0, 10);
        const allowedCount = 10 - prev.length;
        const allowedNewFiles = validFiles.slice(0, allowedCount);
        allowedNewFiles.forEach(f => newUrls.push(URL.createObjectURL(f)));
        setLocalUrls(prevUrls => [...prevUrls, ...newUrls]);
        return truncated;
      } else {
        validFiles.forEach(f => newUrls.push(URL.createObjectURL(f)));
        setLocalUrls(prevUrls => [...prevUrls, ...newUrls]);
        setFileError(err);
        return combined;
      }
    });
  }, [allowMultiple, localFiles]);

  const handleRemoveFile = (idx: number) => {
    URL.revokeObjectURL(localUrls[idx]);
    setLocalFiles(prev => prev.filter((_, i) => i !== idx));
    setLocalUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleReset = () => {
    localUrls.forEach(url => URL.revokeObjectURL(url));
    setLocalFiles([]);
    setLocalUrls([]);
    setFileError(null);
    onReset();
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const displayError = fileError ?? error;
  const localFile = localFiles[0] || null;
  const localUrl = localUrls[0] || null;
  const activeUrl = localUrl ?? imageUrl;

  const renderPipelineSteps = () => {
    const isInactive = stepIndex === -1;
    return (
      <div
        className="w-full glass-card p-5 sm:p-6 flex flex-col justify-center border"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-card)'
        }}
      >
        <div className="flex items-center justify-between w-full gap-0.5 sm:gap-1.5 py-1">
          {PIPELINE_STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isCompleted = idx < stepIndex;
            const isActive = idx === stepIndex;

            let color = 'var(--text-muted)';
            let borderColor = 'var(--text-muted)';
            let bg = 'var(--bg-glass)';
            let shadow = 'none';

            if (!isInactive) {
              if (isCompleted || (hasResults && !loading)) {
                color = 'var(--real-color)';
                borderColor = 'var(--real-color)';
                bg = 'var(--bg-glass-hover)';
                shadow = 'none';
              } else if (isActive) {
                const activeColor = (theme === 'light' && step.id === 6) ? 'var(--real-color)' : step.color;
                color = activeColor;
                borderColor = activeColor;
                bg = 'var(--bg-glass-hover)';
                shadow = `0 0 12px ${activeColor}20`;
              }
            }

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1 min-w-[60px] transition-all duration-300">
                  {/* Icon Node */}
                  <div
                    className={clsx(
                      "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300",
                      isActive && "animate-pulse"
                    )}
                    style={{
                      borderColor,
                      background: bg,
                      boxShadow: shadow,
                      borderWidth: isInactive ? '1px' : '2px'
                    }}
                  >
                    <StepIcon
                      className="w-6 h-6 transition-colors duration-300"
                      style={{ color }}
                    />
                  </div>
                  {/* Label */}
                  <div
                    className="text-[11px] tracking-wider font-extrabold text-center mt-3 w-full block"
                    style={{
                      color: isInactive
                        ? 'var(--text-muted)'
                        : (isCompleted || (hasResults && !loading))
                          ? 'var(--real-color)'
                          : isActive
                            ? 'var(--text-primary)'
                            : 'var(--text-secondary)'
                    }}
                  >
                    <div>{step.label1}</div>
                    <div className="font-extrabold">{step.label2}</div>
                  </div>
                </div>

                {/* Arrow */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="flex items-center justify-center shrink-0">
                    <ChevronRight
                      className="w-4 h-4"
                      style={{
                        color: isInactive
                          ? 'var(--text-muted)'
                          : (idx < stepIndex)
                            ? 'var(--real-color)'
                            : 'var(--text-muted)'
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-6 w-full"
    >
      {/* 1. TOP SECTION: Drop Zone OR Preview */}
      {localFiles.length === 0 ? (
        /* ── Drop Zone ── */
        <div
          id="drop-zone"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'glass-card p-14 flex flex-col items-center justify-center gap-6 cursor-pointer',
            'transition-all duration-300 select-none min-h-[320px] border-2 border-dashed',
            dragging ? 'scale-[1.01] border-[var(--cyan)] shadow-[0_0_32px_var(--cyan-glow)]' : 'border-[var(--border-brand)] hover:border-[var(--cyan)]'
          )}
          style={{
            borderColor: dragging ? 'var(--cyan)' : 'var(--border-brand)',
            background: 'var(--bg-card)'
          }}
        >
          {/* Circular Upload Icon */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center border border-dashed border-[var(--cyan)] bg-[var(--bg-glass)] shadow-[0_0_20px_var(--cyan-glow)]">
            <Upload className="w-8 h-8" style={{ color: 'var(--cyan)' }} />
          </div>

          {/* Text Info */}
          <div className="text-center space-y-1.5">
            <p className="text-2xl font-extrabold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Drop an image to analyse
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Supports JPEG · PNG · WebP
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Max 20MB
            </p>
          </div>

          {/* Pills Row */}
          <div className="flex gap-2.5 flex-wrap justify-center">
            {['JPEG', 'PNG', 'WebP'].map(fmt => (
              <span key={fmt}
                className="text-xs px-3 py-1.5 rounded-lg font-mono font-bold"
                style={{
                  background: 'var(--bg-glass)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)'
                }}>
                {fmt}
              </span>
            ))}
          </div>

          {/* Separator */}
          <span className="text-xs font-extrabold tracking-widest" style={{ color: 'var(--text-muted)' }}>— or —</span>

          {/* Browse button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="px-8 py-3 rounded-xl border text-sm font-bold font-mono tracking-wider text-[var(--cyan)] border-[var(--cyan)]/40 bg-transparent hover:bg-[var(--cyan-glow)] active:scale-95 transition-all duration-200"
          >
            Browse Files
          </button>
        </div>
      ) : (
        /* ── Preview (Single or Batch) ── */
        <div className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {allowMultiple ? `Batch Images (${localFiles.length}/10)` : 'Input Image'}
            </span>
            {!loading && (
              <button
                id="reset-btn"
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-glass)' }}
              >
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {allowMultiple ? (
            /* Thumbnail grid for multiple files */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {localFiles.map((file, idx) => (
                <div
                  key={localUrls[idx]}
                  className="relative group rounded-xl overflow-hidden aspect-square border bg-[var(--bg-glass)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <img src={localUrls[idx]} alt={file.name} className="w-full h-full object-cover" />
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/85 hover:scale-110 active:scale-90 transition-all duration-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/65 p-2 text-[10px] text-white font-mono truncate text-center">
                    {file.name}
                  </div>
                  {loading && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ))}
              {!loading && localFiles.length < 10 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="border-dashed border-2 rounded-xl aspect-square flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-glass)' }}
                >
                  <Plus className="w-6 h-6" style={{ color: 'var(--cyan)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Add Image</span>
                </button>
              )}
            </div>
          ) : (
            /* Single Image Preview with scan wrapper */
            <div className={clsx('relative rounded-xl overflow-hidden scan-wrapper', loading && 'scan-wrapper')}>
              <img
                src={activeUrl || undefined}
                alt="Uploaded for analysis"
                className="w-full object-cover rounded-xl"
                style={{ maxHeight: '340px' }}
              />
              {loading && (
                <>
                  <div className="scan-line" />
                  <div className="absolute inset-0 rounded-xl"
                    style={{ background: 'rgba(0,180,230,0.06)' }} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. MIDDLE SECTION: Pipeline Steps Row */}
      {renderPipelineSteps()}

      {/* 3. BOTTOM SECTION: Error Display & Action Button */}
      <AnimatePresence>
        {displayError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl shrink-0"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--fake-color)' }} />
            <p className="text-sm" style={{ color: 'var(--fake-color)' }}>{displayError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Button / Loading State */}
      {!loading && !hasResults && (
        <motion.button
          whileHover={localFiles.length > 0 ? { scale: 1.005 } : {}}
          whileTap={localFiles.length > 0 ? { scale: 0.995 } : {}}
          disabled={localFiles.length === 0}
          onClick={() => onDetect(allowMultiple ? localFiles : localFiles[0])}
          className="btn-analyse"
        >
          <svg
            className="w-5 h-5 animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
          </svg>
          {allowMultiple ? 'ANALYSE BATCH – DEEPFAKE DETECTION' : 'ANALYSE IMAGE – DEEPFAKE DETECTION'}
        </motion.button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-3 rounded-xl border border-[var(--cyan-glow)] bg-[var(--bg-secondary)] shadow-sm">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: 'var(--cyan)' }}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
              />
            ))}
          </div>
          <span className="text-xs font-mono font-bold tracking-wider text-[var(--text-secondary)]">
            {allowMultiple ? `Analysing Batch (${localFiles.length} Images)…` : 'Analysing Image…'}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        id="file-input"
        type="file"
        multiple={allowMultiple}
        accept={ACCEPTED.join(',')}
        onChange={onInputChange}
        className="hidden"
      />
    </motion.div>
  );
}
