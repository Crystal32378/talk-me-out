"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Copy, Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";
import { formatVerdictForClipboard } from "@/lib/verdict-engine";
import { useToast } from "@/hooks/use-toast";

export function VerdictCardStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const reset = useFlowStore((s) => s.reset);
  const verdict = useFlowStore((s) => s.verdict);
  const garment = useFlowStore((s) => s.garment);
  const { toast } = useToast();

  const [displayScore, setDisplayScore] = useState(0);
  const [revealedEvidence, setRevealedEvidence] = useState(0);
  const [revealedRoast, setRevealedRoast] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [copied, setCopied] = useState(false);

  // Animate score counting up to the final value.
  useEffect(() => {
    if (!verdict) return;
    const target = verdict.totalScore;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 12));
    const interval = setInterval(() => {
      current = Math.min(target, current + step);
      setDisplayScore(current);
      if (current >= target) clearInterval(interval);
    }, 90);
    return () => clearInterval(interval);
  }, [verdict]);

  // Stagger evidence reveal.
  useEffect(() => {
    if (!verdict) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealedEvidence(i);
      if (i >= verdict.evidence.length) clearInterval(interval);
    }, 450);
    return () => clearInterval(interval);
  }, [verdict]);

  // Stagger roast lines reveal.
  useEffect(() => {
    if (!verdict) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealedRoast(i);
      if (i >= verdict.roastLines.length) clearInterval(interval);
    }, 550);
    return () => clearInterval(interval);
  }, [verdict]);

  // Constructive note appears last.
  useEffect(() => {
    if (!verdict) return;
    const timeout = setTimeout(() => setShowNote(true), 1800);
    return () => clearTimeout(timeout);
  }, [verdict]);

  if (!verdict) {
    // Defensive fallback: if user lands here without a verdict, send them back.
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-5">
        <button
          type="button"
          onClick={() => setStep("interrogation")}
          className="rounded-md bg-[#ff3b30] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white"
        >
          Return to questions
        </button>
      </div>
    );
  }

  const { verdict: v } = verdict;

  const handleCopy = async () => {
    const text = formatVerdictForClipboard(verdict, garment);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: UI_COPY.verdict.copied });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: "Could not copy automatically",
        description: "Select the verdict text and copy manually.",
        variant: "destructive",
      });
    }
  };

  const handleRestart = () => {
    reset();
    setStep("intro");
  };

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-3xl flex-col px-5 py-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Logo size={32} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {UI_COPY.verdict.headingLabel}
        </span>
      </div>

      {/* Score + Stamp */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden border border-border bg-surface/60 p-8 text-center"
      >
        <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {UI_COPY.verdict.scoreLabel}
        </div>
        <div className="font-display flex items-baseline justify-center gap-2">
          <motion.span
            className="text-7xl font-bold leading-none sm:text-8xl"
            style={{ color: v.color }}
          >
            {displayScore}
          </motion.span>
          <span className="text-xl text-muted-foreground">
            / {verdict.maxScore}
          </span>
        </div>

        {/* Stamp */}
        <motion.div
          initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: -6, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.4 }}
          className="mt-8 flex justify-center"
        >
          <div
            className="verdict-stamp text-2xl font-bold sm:text-3xl"
            style={{ color: v.color }}
          >
            {v.stamp}
          </div>
        </motion.div>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          {v.meaning}
        </p>
      </motion.section>

      {/* Why this verdict */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 border border-border bg-card/40 p-5"
      >
        <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
          {UI_COPY.verdict.whyHeading}
        </h3>
        <ul className="flex flex-col gap-3">
          <AnimatePresence>
            {verdict.evidence.slice(0, revealedEvidence).map((e, idx) => (
              <motion.li
                key={e.questionId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35 }}
                className="flex gap-3"
              >
                <span className="font-mono text-xs text-warm-accent">
                  {UI_COPY.verdict.evidenceBullet(idx + 1)}
                </span>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-foreground">
                    {e.rationale}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="text-foreground/80">Q:</span> {e.questionPrompt}
                    <br />
                    <span className="text-foreground/80">A:</span> {e.answerLabel}
                    <span className="ml-2 font-mono text-warm-accent">+{e.score}</span>
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.section>

      {/* Roast lines */}
      {verdict.roastLines.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-4 border border-border bg-surface/60 p-5"
        >
          <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-warm-accent" />
            {UI_COPY.verdict.roastHeading}
          </h3>
          <ul className="flex flex-col gap-3">
            {verdict.roastLines.slice(0, revealedRoast).map((line, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="border-l-2 border-warm-accent/60 pl-3 text-sm italic leading-relaxed text-foreground/90"
              >
                {line}
              </motion.li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Constructive note */}
      <AnimatePresence>
        {showNote && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 border border-warm-accent/40 bg-warm-accent/5 p-5"
          >
            <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-warm-accent">
              {UI_COPY.verdict.noteHeading}
            </h3>
            <p className="text-sm leading-relaxed text-foreground">
              {verdict.constructiveNote}
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0 }}
        className="mt-6 flex flex-col gap-2 sm:flex-row"
      >
        <button
          type="button"
          onClick={handleRestart}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {UI_COPY.verdict.restartCta}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-warm-accent/60"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-warm-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {UI_COPY.verdict.copyCta}
        </button>
      </motion.div>

      {/* Watermark */}
      <footer className="mt-auto pt-10">
        <div className="border-t border-border pt-4 text-center">
          <div className="font-display text-sm font-bold text-foreground">
            {UI_COPY.verdict.shareHeading}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {UI_COPY.verdict.shareTagline}
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            {UI_COPY.verdict.poweredBy}
          </div>
        </div>
      </footer>
    </div>
  );
}
