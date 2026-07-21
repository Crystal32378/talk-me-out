"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface StepHeaderProps {
  stepNumber?: number;
  totalSteps?: number;
  title: string;
  body?: string;
  onBack?: () => void;
  backLabel?: string;
}

export function StepHeader({
  stepNumber,
  totalSteps,
  title,
  body,
  onBack,
  backLabel = "Back",
}: StepHeaderProps) {
  return (
    <div className="mb-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
      )}
      {stepNumber != null && totalSteps != null && (
        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-warm-accent">
          Step {stepNumber} of {totalSteps}
        </div>
      )}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="font-display text-3xl font-bold leading-tight text-balance sm:text-4xl"
      >
        {title}
      </motion.h1>
      {body && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          {body}
        </motion.p>
      )}
    </div>
  );
}
