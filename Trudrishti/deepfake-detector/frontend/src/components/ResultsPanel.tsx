import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GradCAMView }        from './GradCAMView';
import { PredictionCard }     from './PredictionCard';
import { SRMPanel }           from './SRMPanel';
import { ExplainabilityCard } from './ExplainabilityCard';
import type { DetectionResult } from '@/types/detection';

interface ResultsPanelProps {
  result:    DetectionResult;
  imageUrl:  string;
  scaleType: '3-grade' | '5-grade';
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function ResultsPanel({ result, imageUrl, scaleType }: ResultsPanelProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="results"
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {/* ── Row 1: Image comparison + Prediction ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={item}>
            <GradCAMView
              originalUrl={imageUrl}
              gradcamBase64={result.gradcam_image}
            />
          </motion.div>
          <motion.div variants={item}>
            <PredictionCard result={result} />
          </motion.div>
        </div>

        {/* ── Row 2: SRM + Explainability ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={item}>
            <SRMPanel
              srmBase64={result.srm_image}
              interpretation={result.srm_interpretation}
            />
          </motion.div>
          <motion.div variants={item}>
            <ExplainabilityCard result={result} scaleType={scaleType} />
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
