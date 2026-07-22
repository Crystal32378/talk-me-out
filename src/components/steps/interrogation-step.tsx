"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { StepHeader } from "./step-header";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";
import { QUESTIONS } from "@/lib/questions";
import type { QuestionId } from "@/lib/types";

export function InterrogationStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const answers = useFlowStore((s) => s.answers);
  const setAnswer = useFlowStore((s) => s.setAnswer);
  const currentIndex = useFlowStore((s) => s.currentQuestionIndex);
  const nextQuestion = useFlowStore((s) => s.nextQuestion);
  const prevQuestion = useFlowStore((s) => s.prevQuestion);
  const finalizeVerdict = useFlowStore((s) => s.finalizeVerdict);

  const question = QUESTIONS[currentIndex];
  const total = QUESTIONS.length;
  const isLast = currentIndex === total - 1;
  const isFirst = currentIndex === 0;
  const selectedScore = answers[question.id as QuestionId];

  const handleSelect = (score: number) => {
    setAnswer(question.id as QuestionId, score);
    // Auto-advance with a short delay so the user sees the confirmation.
    setTimeout(() => {
      if (isLast) {
        finalizeVerdict();
        setStep("verdict");
      } else {
        nextQuestion();
      }
    }, 380);
  };

  const progress = ((currentIndex + 1) / total) * 100;

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-3xl flex-col px-5 py-8">
      <StepHeader
        stepNumber={4}
        totalSteps={5}
        title={UI_COPY.interrogation.heading}
        body={UI_COPY.interrogation.body}
        onBack={() => setStep("tryon")}
        backLabel="Back to try-on"
      />

      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>{UI_COPY.interrogation.progressLabel(currentIndex + 1, total)}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full bg-warm-accent"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.4 }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="font-display text-5xl font-bold text-warm-accent/30">
                {String(currentIndex + 1).padStart(2, "0")}
              </span>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Question {currentIndex + 1}
              </div>
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight text-balance sm:text-3xl">
              {question.prompt}
            </h2>
            {question.helper && (
              <p className="mt-2 text-sm text-muted-foreground">{question.helper}</p>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              {question.options.map((opt) => {
                const selected = selectedScore === opt.score;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.score)}
                    className={`group flex items-center gap-4 rounded-md border px-5 py-4 text-left transition-all ${
                      selected
                        ? "border-warm-accent bg-warm-accent/10 ring-1 ring-warm-accent"
                        : "border-border bg-card hover:border-warm-accent/50 hover:bg-card/60"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selected
                          ? "border-warm-accent bg-warm-accent text-white"
                          : "border-muted-foreground/40 group-hover:border-warm-accent/60"
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span
                      className={`text-sm sm:text-base ${
                        selected ? "font-semibold text-foreground" : "text-foreground/90"
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            if (isFirst) setStep("tryon");
            else prevQuestion();
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {UI_COPY.interrogation.back}
        </button>

        {selectedScore != null && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => {
              if (isLast) {
                finalizeVerdict();
                setStep("verdict");
              } else {
                nextQuestion();
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-[#ff3b30] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
          >
            {isLast ? UI_COPY.interrogation.seeVerdict : UI_COPY.interrogation.nextCta}
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
