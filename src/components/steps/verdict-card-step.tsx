"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Sparkles, Shirt, ArrowRight, Users, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";
import { formatVerdictForClipboard } from "@/lib/verdict-engine";
import { toDecision } from "@/lib/decisions";
import { track } from "@/lib/analytics";
import { askAFriend } from "@/lib/share-card";
import { useToast } from "@/hooks/use-toast";

type Phase = "score_animating" | "revealing_evidence" | "revealing_roast" | "showing_note";

export function VerdictCardStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const tryAnotherGarment = useFlowStore((s) => s.tryAnotherGarment);
  const verdict = useFlowStore((s) => s.verdict);
  const garment = useFlowStore((s) => s.garment);
  const tryOn = useFlowStore((s) => s.tryOn);
  const saveCurrentResultToFittingRoom = useFlowStore((s) => s.saveCurrentResultToFittingRoom);
  const { toast } = useToast();

  const [displayScore, setDisplayScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("score_animating");
  const [revealedEvidence, setRevealedEvidence] = useState(0);
  const [revealedRoast, setRevealedRoast] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Feedback widget state: null = not answered, then thanks after send.
  const [feedbackFair, setFeedbackFair] = useState<boolean | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  // True only after the current look has verifiably been written to
  // IndexedDB (or an identical entry already exists there). Gates the
  // "Saved to My Fitting Room" confirmation chip.
  const [savedToRoom, setSavedToRoom] = useState(false);
  // Set only via the explicit "Skip animation" button. Deferred phase
  // transitions check this flag so a pending timer can never drag the
  // card back to an earlier phase after the user has skipped ahead.
  const skippedRef = useRef(false);

  // Animate score counting up to the final value.
  // Only when the count reaches the target do we transition to the next phase.
  useEffect(() => {
    if (!verdict) return;
    const target = verdict.totalScore;
    // For score 0, skip the count-up and go straight to done.
    if (target === 0) {
      const t1 = setTimeout(() => setDisplayScore(0), 0);
      const t2 = setTimeout(() => {
        if (!skippedRef.current) setPhase("revealing_evidence");
      }, 400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    const step = Math.max(1, Math.ceil(target / 12));
    const interval = setInterval(() => {
      setDisplayScore((prev) => {
        const next = Math.min(target, prev + step);
        if (next >= target) {
          clearInterval(interval);
          // Wait a beat after the count-up finishes, then reveal verdict.
          setTimeout(() => {
            if (!skippedRef.current) setPhase("revealing_evidence");
          }, 450);
        }
        return next;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [verdict]);

  // Persist the completed look once the verdict exists. The chip is only
  // shown after the store reports success — either a verified IndexedDB
  // write, or a semantically identical entry already saved (the store's
  // centralized dedupe makes repeated calls idempotent). Never shown for
  // demo / fallback / incomplete flows, which the store refuses to save.
  useEffect(() => {
    if (!verdict || !garment || !tryOn) return;
    if (tryOn.demo || tryOn.fallback) return;
    let cancelled = false;
    void saveCurrentResultToFittingRoom().then((ok) => {
      if (!cancelled && ok) setSavedToRoom(true);
    });
    return () => {
      cancelled = true;
    };
  }, [verdict, garment, tryOn, saveCurrentResultToFittingRoom]);

  // Stagger evidence reveal — only after score animation completes.
  useEffect(() => {
    if (phase !== "revealing_evidence" || !verdict) return;
    if (verdict.evidence.length === 0) {
      const t = setTimeout(() => setPhase("revealing_roast"), 0);
      return () => clearTimeout(t);
    }
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealedEvidence(i);
      if (i >= verdict.evidence.length) {
        clearInterval(interval);
        setTimeout(() => {
          if (!skippedRef.current) setPhase("revealing_roast");
        }, 500);
      }
    }, 450);
    return () => clearInterval(interval);
  }, [phase, verdict]);

  // Stagger roast lines reveal.
  useEffect(() => {
    if (phase !== "revealing_roast" || !verdict) return;
    if (verdict.roastLines.length === 0) {
      const t = setTimeout(() => setPhase("showing_note"), 0);
      return () => clearTimeout(t);
    }
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealedRoast(i);
      if (i >= verdict.roastLines.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("showing_note"), 500);
      }
    }, 550);
    return () => clearInterval(interval);
  }, [phase, verdict]);

  if (!verdict) {
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
  const scoreDone = phase !== "score_animating";
  const evidenceDone = phase === "revealing_roast" || phase === "showing_note";
  const roastDone = phase === "showing_note";

  const skipAnimation = () => {
    skippedRef.current = true;
    setDisplayScore(verdict.totalScore);
    setRevealedEvidence(verdict.evidence.length);
    setRevealedRoast(verdict.roastLines.length);
    setPhase("showing_note");
  };

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

  // "Ask a Friend" from the verdict: share the look WITH the decision
  // stamp. The card is composed on-device (share-card.ts) — the user's
  // try-on image is never uploaded or hosted by us. Answers never leave
  // the device; only the binary decision and score go on the card.
  const handleAskFriend = async () => {
    if (sharing || !verdict) return;
    setSharing(true);
    try {
      const shareImage =
        tryOn?.imageUrl && !tryOn.demo && !tryOn.fallback ? tryOn.imageUrl : null;
      const res = await askAFriend({
        imageUrl: shareImage,
        garmentName: garment?.name ?? null,
        decision: toDecision(verdict.verdict.id, verdict.totalScore),
        score: verdict.totalScore,
      });
      if (res.outcome === "cancelled") {
        toast({ title: UI_COPY.growth.shareCancelledToast });
      } else if (res.outcome === "failed") {
        toast({ title: UI_COPY.growth.shareFailedToast, variant: "destructive" });
      } else if (res.bonusAdded > 0) {
        toast({ title: UI_COPY.growth.bonusUnlockedToast });
      } else if (res.outcome === "downloaded") {
        toast({ title: UI_COPY.growth.shareDownloadedToast });
      }
    } finally {
      setSharing(false);
    }
  };

  const handleFeedback = (fair: boolean) => {
    setFeedbackFair(fair);
  };

  const submitFeedback = () => {
    if (feedbackFair === null || feedbackSent || !verdict) return;
    track("feedback", {
      fair: feedbackFair,
      verdict: verdict.verdict.id,
      score: verdict.totalScore,
      // Free-text stays short and optional; never the question answers.
      note: feedbackNote.trim().slice(0, 140),
    });
    setFeedbackSent(true);
  };

  const handleTryAnother = () => {
    // Idempotent: the verdict effect above has normally already saved
    // this look; the store's semantic dedupe turns this repeat call into
    // a no-op (no updatedAt churn). Kept so the look is still persisted
    // if the effect's write failed transiently.
    void saveCurrentResultToFittingRoom();
    tryAnotherGarment();
  };

  const handleViewFittingRoom = () => {
    void saveCurrentResultToFittingRoom();
    setStep("fitting-room");
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

      {/* Explicit escape hatch for the reveal choreography. Kept as a
          dedicated button (not whole-card click) so it never conflicts
          with Copy / CTA / Fitting Room actions that appear later. */}
      {!roastDone && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={skipAnimation}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-warm-accent/60 hover:text-foreground"
          >
            {UI_COPY.verdict.skipAnimationCta}
          </button>
        </div>
      )}

      {/* Score + Stamp */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden border border-border bg-surface/60 p-8 text-center"
      >
        {/* Case garment — keeps the try-on result visible on the verdict */}
        {(tryOn?.imageUrl || garment) && (
          <div className="mb-6 flex items-center justify-center gap-3">
            {tryOn?.imageUrl && (
              <img
                src={tryOn.imageUrl}
                alt={garment?.name ? `Try-on result: ${garment.name}` : "Try-on result"}
                className="h-16 w-12 rounded-md border border-border object-cover"
              />
            )}
            {garment && (
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-[0.18em] text-warm-accent">
                  {UI_COPY.verdict.caseLabel}
                </div>
                <div className="font-display text-sm font-semibold leading-tight text-foreground">
                  {garment.name}
                </div>
              </div>
            )}
          </div>
        )}
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

        {/* Stamp — only reveal after score animation completes */}
        <AnimatePresence>
          {scoreDone && (
            <motion.div
              initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              className="mt-8 flex justify-center"
            >
              <div
                className="verdict-stamp text-2xl font-bold sm:text-3xl"
                style={{ color: v.color }}
              >
                {v.stamp}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtitle — only after stamp appears */}
        <AnimatePresence>
          {scoreDone && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground"
            >
              {v.meaning}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Binary decision badge — presentation layer only */}
        <AnimatePresence>
          {scoreDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 }}
              className="mt-6"
            >
              {(() => {
                const decision = toDecision(v.id, verdict.totalScore);
                const isTryIrl = decision === "TRY_IRL";
                const color = isTryIrl ? "#30D158" : "#FF3B30";
                const short = isTryIrl
                  ? UI_COPY.verdict.decisionTryIrlShort
                  : UI_COPY.verdict.decisionSkipShort;
                const long = isTryIrl
                  ? UI_COPY.verdict.decisionTryIrlLong
                  : UI_COPY.verdict.decisionSkipLong;
                return (
                  <div
                    className="mx-auto inline-flex flex-col items-center gap-2 border px-5 py-3"
                    style={{ borderColor: `${color}60`, backgroundColor: `${color}10` }}
                  >
                    <div
                      className="font-display text-base font-bold tracking-[0.18em]"
                      style={{ color }}
                    >
                      {short}
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                      {long}
                    </p>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Why this verdict — only after score animation completes */}
      <AnimatePresence>
        {scoreDone && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-6 border border-border bg-card/40 p-5"
          >
            <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
              {UI_COPY.verdict.whyHeading}
            </h3>
            {verdict.evidence.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                None of your answers raised purchase-risk signals. Every
                question checked out — you have a real occasion, no
                duplicates, a price that fits your budget, manageable care,
                and a plan you would not regret. This is rare.
              </p>
            ) : (
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
                        </p>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {/* Filler while evidence is still revealing, only when none yet shown */}
                {revealedEvidence === 0 && (
                  <li className="text-xs text-muted-foreground/60">
                    Reviewing your answers…
                  </li>
                )}
              </ul>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Roast lines — only after evidence is done */}
      <AnimatePresence>
        {evidenceDone && verdict.roastLines.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
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
      </AnimatePresence>

      {/* Constructive note — only after roast is done */}
      <AnimatePresence>
        {roastDone && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
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

      {/* Feedback — the last funnel step. One tap plus an optional line;
          never the question answers. */}
      <AnimatePresence>
        {roastDone && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-4 border border-border bg-card/40 p-5"
          >
            {feedbackSent ? (
              <p className="text-sm text-muted-foreground">{UI_COPY.feedback.thanks}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
                  {UI_COPY.feedback.heading}
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedback(true)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                      feedbackFair === true
                        ? "border-[#30d158] bg-[#30d158]/10 text-[#30d158]"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {UI_COPY.feedback.yesCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(false)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                      feedbackFair === false
                        ? "border-[#ff3b30] bg-[#ff3b30]/10 text-[#ff5147]"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    {UI_COPY.feedback.noCta}
                  </button>
                </div>
                {feedbackFair !== null && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={140}
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      placeholder={UI_COPY.feedback.placeholder}
                      className="flex-1 rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-warm-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submitFeedback}
                      className="inline-flex items-center justify-center rounded-md border border-warm-accent/60 bg-warm-accent/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-warm-accent transition-colors hover:bg-warm-accent/10"
                    >
                      {UI_COPY.feedback.submitCta}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Saved confirmation — appears only after the look has verifiably
          been written to IndexedDB. Clickable: opens My Fitting Room. */}
      <AnimatePresence>
        {roastDone && savedToRoom && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            onClick={() => setStep("fitting-room")}
            className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-[#30d158]/50 bg-[#30d158]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#30d158] transition-colors hover:bg-[#30d158]/20"
          >
            <Check className="h-3.5 w-3.5" />
            {UI_COPY.verdict.savedToFittingRoom}
            <ArrowRight className="h-3 w-3" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Actions — only after the constructive note */}
      <AnimatePresence>
        {roastDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <button
              type="button"
              onClick={handleAskFriend}
              disabled={sharing}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98] disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              {UI_COPY.growth.askFriendCta}
            </button>
            <button
              type="button"
              onClick={handleTryAnother}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-warm-accent/60"
            >
              <Shirt className="h-3.5 w-3.5" />
              {UI_COPY.verdict.tryAnotherCta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleViewFittingRoom}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-warm-accent/60 bg-warm-accent/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-warm-accent transition-colors hover:bg-warm-accent/10"
            >
              {UI_COPY.verdict.viewFittingRoomCta}
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
        )}
      </AnimatePresence>

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
