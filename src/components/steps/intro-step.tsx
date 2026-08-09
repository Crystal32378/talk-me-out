"use client";

import { motion } from "framer-motion";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";

export function IntroStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const intro = UI_COPY.intro;

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-3xl flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-5">
        <Logo size={36} />
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {intro.kicker}
        </span>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col justify-center px-5 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl">
            {intro.title.split("\n").map((line, i) => (
              <span key={i}>
                {i === 1 ? <span className="text-warm-accent">{line}</span> : line}
                {i === 0 && <br />}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            {intro.body}
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setStep("photo")}
              className="group inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
            >
              {intro.primaryCta}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground sm:ml-3">
              {intro.secondaryCta}
            </span>
          </div>
        </motion.div>

        {/* Steps preview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 border-t border-border pt-8"
        >
          <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {intro.stepsLabel}
          </div>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {intro.steps.map((step, idx) => (
              <li
                key={step.n}
                className="flex items-center gap-3 border border-border bg-card/40 px-4 py-3 sm:flex-col sm:items-start sm:gap-1"
              >
                <span className="font-display text-2xl font-bold text-warm-accent">
                  {String(step.n).padStart(2, "0")}
                </span>
                <span className="text-xs leading-tight text-foreground">
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Privacy note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 flex items-start gap-3 border border-border bg-surface/60 px-4 py-3"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-warm-accent" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {intro.privacy}
          </p>
        </motion.div>
      </main>

      {/* Footer watermark */}
      <footer className="border-t border-border px-5 py-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>退堂鼓 · v1.1</span>
          <span>Powered by YouCam Apparel VTO</span>
        </div>
      </footer>
    </div>
  );
}
