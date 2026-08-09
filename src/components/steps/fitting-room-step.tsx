"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";
import { DEFAULT_GARMENTS } from "@/lib/garments";
import { DECISION_LABELS } from "@/lib/decisions";

export function FittingRoomStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const savedResults = useFlowStore((s) => s.savedResults);
  const selectDefaultGarment = useFlowStore((s) => s.selectDefaultGarment);
  const loadSavedResultIntoSession = useFlowStore((s) => s.loadSavedResultIntoSession);
  const deleteSavedResult = useFlowStore((s) => s.deleteSavedResult);
  const clearFittingRoom = useFlowStore((s) => s.clearFittingRoom);

  const [confirmingClear, setConfirmingClear] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Tried set (by garment id)
  const triedIds = new Set(savedResults.map((r) => r.id));
  // Untired defaults — keep the fitting room useful as a progress view
  const untriedDefaults = DEFAULT_GARMENTS.filter((g) => !triedIds.has(g.id));
  // Custom looks (anything with isCustom=true) — these only exist if the
  // user uploaded them, so they are always "tried" if present.
  const customLooks = savedResults.filter((r) => r.isCustom);
  const triedDefaults = savedResults.filter((r) => !r.isCustom);

  const totalDefaultGarments = DEFAULT_GARMENTS.length;
  const totalTriedDefaults = triedDefaults.length;
  const detail = detailId
    ? savedResults.find((r) => r.id === detailId) ?? null
    : null;

  const handleClearAll = async () => {
    await clearFittingRoom();
    setConfirmingClear(false);
    setDetailId(null);
    setStep("intro");
  };

  const handleSelectDefault = (id: string) => {
    selectDefaultGarment(id);
    setStep("tryon");
  };

  const handleViewLook = (id: string) => {
    // Load the saved verdict/answers/tryOn into the session and jump
    // straight to the verdict page (no YouCam API call).
    loadSavedResultIntoSession(id);
  };

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-5xl flex-col px-5 py-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Logo size={32} />
        <button
          type="button"
          onClick={() => setStep("garment")}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {UI_COPY.fittingRoom.backCta}
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8 border-b border-border pb-6"
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {UI_COPY.fittingRoom.heading}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {UI_COPY.fittingRoom.body}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-warm-accent">
            {UI_COPY.fittingRoom.looksSaved(savedResults.length)}
          </span>
          <span className="rounded-full border border-border bg-card px-3 py-1">
            {UI_COPY.fittingRoom.progressLabel(totalTriedDefaults, totalDefaultGarments)} (Crystal&apos;s Closet)
          </span>
        </div>
      </motion.div>

      {/* Detail modal-ish inline view */}
      {detail && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 border border-warm-accent/40 bg-warm-accent/5 p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-warm-accent">
                {detail.isCustom ? "Custom upload" : "Crystal's Closet"}
              </div>
              <div className="mt-1 font-display text-lg font-semibold text-foreground">
                {detail.garmentName}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {detail.garmentType} · saved {new Date(detail.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr,1.4fr]">
            <div className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-card">
              <img
                src={detail.tryOnImage}
                alt={detail.garmentName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div
                className="inline-flex items-center self-start border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  borderColor: `${DECISION_LABELS[detail.decision].color}60`,
                  backgroundColor: `${DECISION_LABELS[detail.decision].color}10`,
                  color: DECISION_LABELS[detail.decision].color,
                }}
              >
                {DECISION_LABELS[detail.decision].short}
              </div>
              <div className="text-xs text-muted-foreground">
                Impulse score:{" "}
                <span className="text-foreground">
                  {detail.score} / 19
                </span>{" "}
                · original verdict:{" "}
                <span className="text-foreground">
                  {detail.verdictId.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleViewLook(detail.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#ff5147]"
                >
                  View full verdict
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteSavedResult(detail.id);
                    setDetailId(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#ff5147] hover:bg-[#ff3b30]/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {UI_COPY.fittingRoom.deleteLookCta}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tried section */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
          {UI_COPY.fittingRoom.triedSection}
          <span className="ml-2 text-muted-foreground">({savedResults.length})</span>
        </h2>

        {savedResults.length === 0 ? (
          <div className="border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {UI_COPY.fittingRoom.emptyState}
            </p>
            <button
              type="button"
              onClick={() => setStep("garment")}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#ff3b30] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#ff5147]"
            >
              {UI_COPY.fittingRoom.backToGarmentCta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[...triedDefaults, ...customLooks].map((entry) => {
              const decision = DECISION_LABELS[entry.decision];
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => setDetailId(entry.id)}
                    className="relative aspect-[3/4] w-full overflow-hidden bg-card text-left"
                  >
                    <img
                      src={entry.tryOnImage}
                      alt={entry.garmentName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    <div
                      className="absolute left-2 top-2 border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] backdrop-blur"
                      style={{
                        borderColor: `${decision.color}60`,
                        backgroundColor: "rgba(0,0,0,0.7)",
                        color: decision.color,
                      }}
                    >
                      {entry.decision === "TRY_IRL"
                        ? UI_COPY.fittingRoom.decisionBadgeTryIrl
                        : UI_COPY.fittingRoom.decisionBadgeSkip}
                    </div>
                  </button>
                  <div className="flex flex-col gap-1 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-warm-accent">
                      {entry.isCustom ? "Custom" : entry.garmentType}
                    </div>
                    <div className="font-display text-sm font-semibold leading-tight text-foreground">
                      {entry.garmentName}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Score {entry.score}/19</span>
                      <button
                        type="button"
                        onClick={() => void deleteSavedResult(entry.id)}
                        className="text-muted-foreground/70 transition-colors hover:text-[#ff5147]"
                        aria-label={UI_COPY.fittingRoom.deleteLookCta}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Not tried yet section */}
      {untriedDefaults.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
            {UI_COPY.fittingRoom.notTriedSection}
            <span className="ml-2 text-muted-foreground">({untriedDefaults.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {untriedDefaults.map((g) => (
              <motion.button
                key={g.id}
                type="button"
                onClick={() => handleSelectDefault(g.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:border-warm-accent/60"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
                  <img
                    src={g.imageUrl}
                    alt={g.name}
                    className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-md bg-[#ff3b30] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                      {UI_COPY.fittingRoom.tryThisCta}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-warm-accent">
                    {g.categoryLabel}
                  </div>
                  <div className="font-display text-sm font-semibold leading-tight text-foreground">
                    {g.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {g.type}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Privacy note */}
      <div className="mb-6 flex items-start gap-2 border border-border bg-surface/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warm-accent" />
        <span>{UI_COPY.fittingRoom.privacyNote}</span>
      </div>

      {/* Clear fitting room */}
      <div className="border-t border-border pt-6">
        {confirmingClear ? (
          <div className="flex flex-col gap-3 border border-[#ff3b30]/40 bg-[#ff3b30]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[#ff5147]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{UI_COPY.fittingRoom.clearAllConfirm}</span>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-md border border-border bg-card px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground hover:border-warm-accent/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-md bg-[#ff3b30] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#ff5147]"
              >
                Yes, clear everything
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            disabled={savedResults.length === 0 && !useFlowStore.getState().personImage}
            className="inline-flex items-center gap-2 rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/5 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff5147] transition-colors hover:bg-[#ff3b30]/10 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {UI_COPY.fittingRoom.clearAllCta}
          </button>
        )}
      </div>
    </div>
  );
}
