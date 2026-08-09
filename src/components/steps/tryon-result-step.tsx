"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2, RefreshCw, ArrowRight, Info } from "lucide-react";
import { StepHeader } from "./step-header";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";
import type { TryOnResult } from "@/lib/types";

/**
 * Module-level guard against double-running the try-on for the same
 * garment in React StrictMode (dev only — production doesn't double-fire).
 * Keyed by garment id so switching garments re-allows the effect.
 */
let lastStartedGarmentId: string | null = null;

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const MAX_UPLOAD_BYTES = 1_500_000;
const MAX_UPLOAD_DIMENSION = 1600;

async function compressForUpload(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image-load-failed"));
      img.src = url;
    });

    const largestSide = Math.max(img.naturalWidth, img.naturalHeight);
    let scale = Math.min(1, MAX_UPLOAD_DIMENSION / largestSide);
    let quality = 0.84;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas-context");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressed = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!compressed) throw new Error("canvas-to-blob-failed");
      if (compressed.size <= MAX_UPLOAD_BYTES || attempt === 4) return compressed;

      scale *= 0.8;
      quality = Math.max(0.62, quality - 0.06);
    }

    throw new Error("image-compression-failed");
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fetchGarmentImage(url: string): Promise<Blob> {
  // For local SVGs in /public, fetch and convert to PNG blob.
  if (url.startsWith("/") || url.startsWith(window.location.origin)) {
    const res = await fetch(url);
    const blob = await res.blob();
    if (blob.type === "image/svg+xml") {
      // Convert SVG to PNG via canvas to satisfy potential API requirements.
      return svgBlobToPng(blob);
    }
    return blob;
  }
  // For data URLs
  if (url.startsWith("data:")) {
    return dataUrlToBlob(url);
  }
  // Fallback: try direct fetch (may fail CORS; that's OK for demo).
  const res = await fetch(url);
  return await res.blob();
}

async function svgBlobToPng(svgBlob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg-load-failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas-context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("canvas-to-blob-failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getErrorMessage(errorKey: string | null): string {
  if (!errorKey) return UI_COPY.tryon.errors.api;
  switch (errorKey) {
    case "invalid-person":
      return UI_COPY.tryon.errors.invalidPerson;
    case "invalid-garment":
      return UI_COPY.tryon.errors.invalidGarment;
    case "timeout":
      return UI_COPY.tryon.errors.timeout;
    case "empty":
      return UI_COPY.tryon.errors.empty;
    default:
      return UI_COPY.tryon.errors.api;
  }
}

export function TryOnResultStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const personImage = useFlowStore((s) => s.personImage);
  const garment = useFlowStore((s) => s.garment);
  const tryOn = useFlowStore((s) => s.tryOn);
  const tryOnStatus = useFlowStore((s) => s.tryOnStatus);
  const tryOnError = useFlowStore((s) => s.tryOnError);
  const setTryOnLoading = useFlowStore((s) => s.setTryOnLoading);
  const setTryOnSuccess = useFlowStore((s) => s.setTryOnSuccess);
  const setTryOnError = useFlowStore((s) => s.setTryOnError);
  const getCachedResult = useFlowStore((s) => s.getCachedResult);
  const saveCurrentResultToFittingRoom = useFlowStore((s) => s.saveCurrentResultToFittingRoom);

  const [progressStep, setProgressStep] = useState(0);
  const [usedCache, setUsedCache] = useState(false);

  // Kick off the try-on once per mount (or retry).
  const runTryOn = async (opts: { forceFresh?: boolean } = {}) => {
    if (!personImage || !garment) return;

    // Cache check — if we already have a saved result for this garment
    // AND the user didn't explicitly ask to regenerate, show the cached
    // result without calling YouCam again. This is the persistent
    // fitting-room behaviour.
    if (!opts.forceFresh) {
      const cached = getCachedResult(garment.id);
      if (cached && cached.tryOnIsReal) {
        setUsedCache(true);
        setTryOnSuccess({
          imageUrl: cached.tryOnImage,
          demo: false,
          fallback: false,
        });
        return;
      }
    }
    setUsedCache(false);
    setTryOnLoading();
    setProgressStep(0);

    // Animate the progress messaging while we wait.
    const interval = setInterval(() => {
      setProgressStep((p) => Math.min(UI_COPY.tryon.progressSteps.length - 1, p + 1));
    }, 1800);

    try {
      const [personBlob, garmentBlob] = await Promise.all([
        compressForUpload(dataUrlToBlob(personImage)),
        fetchGarmentImage(garment.imageUrl).then(compressForUpload),
      ]);

      const form = new FormData();
      form.append("person", personBlob, "person.jpg");
      form.append("garment", garmentBlob, "garment.png");
      form.append("garmentName", garment.name);
      form.append("garmentType", garment.type);

      const res = await fetch("/api/tryon", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok: boolean;
        imageUrl?: string;
        demo?: boolean;
        fallback?: boolean;
        unitsUsed?: number;
        error?: string;
        message?: string;
      };

      clearInterval(interval);

      if (data.ok && data.imageUrl) {
        const result: TryOnResult = {
          imageUrl: data.imageUrl,
          demo: !!data.demo,
          fallback: !!data.fallback,
          unitsUsed: data.unitsUsed,
        };
        setTryOnSuccess(result);
        // Persist the real YouCam result to the fitting room immediately
        // so a refresh or "try another" doesn't lose it. Demo / fallback
        // results are intentionally NOT saved (see store.ts).
        void saveCurrentResultToFittingRoom();
      } else {
        // Fallback path: still let the user continue.
        const fallback: TryOnResult = {
          imageUrl: personImage, // Show the person photo; garment is in the side panel.
          demo: false,
          fallback: true,
        };
        setTryOnSuccess(fallback);
        setTryOnError(data.error ?? "api");
      }
    } catch (err) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : "unknown";
      const fallback: TryOnResult = {
        imageUrl: personImage,
        demo: false,
        fallback: true,
      };
      setTryOnSuccess(fallback);
      setTryOnError(msg.includes("timeout") ? "timeout" : "api");
    }
  };

  useEffect(() => {
    // In React StrictMode (dev), effects fire twice: setup → cleanup → setup.
    // The original implementation used a startedRef + setTimeout that the
    // cleanup could clear, which meant the second setup saw startedRef=true
    // and skipped — so runTryOn never actually ran in dev.
    //
    // Fix: use a module-level flag keyed by garment id so the guard
    // survives the StrictMode unmount/remount cycle within the same
    // garment. The setTimeout defers the setState call so we don't
    // trigger the react-hooks/set-state-in-effect lint rule, and we
    // DON'T return a cleanup that clears it (the StrictMode cleanup
    // was what ate the original setTimeout).
    const garmentId = garment?.id;
    if (!garmentId) return;
    if (lastStartedGarmentId === garmentId && tryOnStatus !== "idle") return;
    lastStartedGarmentId = garmentId;
    const id = setTimeout(() => {
      void runTryOn();
    }, 0);
    // Intentionally no cleanup — see comment above.
    void id;
  }, [garment?.id]);
  const isLoading = tryOnStatus === "loading";
  const showFallback = tryOn?.fallback === true;
  const showDemo = tryOn?.demo === true && !showFallback;
  const showCached = usedCache && !showFallback && !showDemo;

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-4xl flex-col px-5 py-8">
      <StepHeader
        stepNumber={3}
        totalSteps={5}
        title={UI_COPY.tryon.heading}
        body={UI_COPY.tryon.body}
        onBack={() => setStep("garment")}
        backLabel={UI_COPY.tryon.back}
      />

      <div className="flex-1">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 py-10"
          >
            <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card">
              <div className="absolute inset-0 scanline bg-surface" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <Loader2 className="h-8 w-8 animate-spin text-warm-accent" />
                <div className="text-center">
                  <div className="font-display text-base font-semibold text-foreground">
                    {UI_COPY.tryon.generating}
                  </div>
                  <motion.div
                    key={progressStep}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {UI_COPY.tryon.progressSteps[progressStep]}
                  </motion.div>
                </div>
              </div>
              {/* progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
                <motion.div
                  className="h-full bg-warm-accent"
                  initial={{ width: "10%" }}
                  animate={{ width: `${((progressStep + 1) / UI_COPY.tryon.progressSteps.length) * 100}%` }}
                  transition={{ ease: "easeOut", duration: 0.6 }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {!isLoading && tryOn && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-5"
          >
            {/* Banner */}
            {showCached && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center border border-[#30d158]/60 bg-[#30d158]/10 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#30d158]">
                  {UI_COPY.tryon.cachedBanner}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {UI_COPY.tryon.cachedExplanation}
                </p>
              </div>
            )}
            {showDemo && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center border border-warm-accent/60 bg-warm-accent/10 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-warm-accent">
                  {UI_COPY.tryon.demoBanner}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {UI_COPY.tryon.demoExplanation}
                </p>
              </div>
            )}
            {showFallback && (
              <div className="flex items-center justify-center gap-2 border border-[#ff3b30]/60 bg-[#ff3b30]/10 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff5147]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {UI_COPY.tryon.fallbackBanner}
              </div>
            )}
            {!showDemo && !showFallback && !showCached && (
              <div className="flex items-center justify-center gap-2 border border-[#30d158]/60 bg-[#30d158]/10 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#30d158]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#30d158]" />
                Real YouCam API result
                {tryOn?.unitsUsed != null && (
                  <span className="ml-2 normal-case tracking-normal text-[#30d158]/70">
                    · {tryOn.unitsUsed} units consumed
                  </span>
                )}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-[2fr,1fr]">
              {/* Result image */}
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-card">
                { }
                <img
                  src={tryOn.imageUrl}
                  alt="Virtual try-on result"
                  className="h-full w-full object-cover"
                />
                {showFallback && (
                  <div className="absolute inset-0 bg-black/40" />
                )}
              </div>

              {/* Side panel: person + garment + product info */}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {UI_COPY.tryon.personLabel}
                    </div>
                    <div className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-card">
                      { }
                      <img
                        src={personImage ?? ""}
                        alt="Your photo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {UI_COPY.tryon.garmentLabel}
                    </div>
                    <div className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-white">
                      { }
                      <img
                        src={garment?.imageUrl ?? ""}
                        alt={garment?.name ?? "Garment"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Product info card */}
                {garment && (
                  <div className="border border-border bg-surface/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-warm-accent">
                      {garment.categoryLabel}
                    </div>
                    <div className="mt-1 font-display text-sm font-semibold text-foreground">
                      {garment.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {garment.type}
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      <div>
                        <span className="text-foreground/80">Material:</span>{" "}
                        {garment.material}
                      </div>
                      <div>
                        <span className="text-foreground/80">Care:</span> {garment.care}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 border border-border bg-surface/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warm-accent" />
              <span>{UI_COPY.tryon.body}</span>
            </div>

            {/* Error context */}
            {!isLoading && tryOnError && (
              <div className="flex items-start gap-2 rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/10 px-3 py-2 text-xs text-[#ff5147]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{getErrorMessage(tryOnError)}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => runTryOn({ forceFresh: true })}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-warm-accent/60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {UI_COPY.tryon.retryCta}
              </button>
              <button
                type="button"
                onClick={() => setStep("interrogation")}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
              >
                {UI_COPY.tryon.continueCta}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
