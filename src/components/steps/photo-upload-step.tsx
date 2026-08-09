"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, RefreshCw, ImageIcon, ShieldCheck, AlertCircle, AlertTriangle, User } from "lucide-react";
import { StepHeader } from "./step-header";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Measure a photo's dimensions and flag likely face-only headshots.
 * A half-body / full-body photo is typically clearly taller than wide
 * (aspect ratio below 0.85). A face-only headshot is roughly square
 * (0.85–1.2). Clearly landscape photos (1.2 and above) are treated as
 * normal so wide shots are never mislabeled as headshots.
 */
function measurePhoto(
  dataUrl: string,
): Promise<{ w: number; h: number; headshot: boolean } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      resolve({ w: img.width, h: img.height, headshot: ratio > 0.85 && ratio < 1.2 });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function PhotoUploadStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const personImage = useFlowStore((s) => s.personImage);
  const setPersonImage = useFlowStore((s) => s.setPersonImage);
  const savedResultsCount = useFlowStore((s) => s.savedResults.length);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ w: number; h: number } | null>(null);
  const [headshotLikely, setHeadshotLikely] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const confirmPhotoReplacement = useCallback(() => {
    if (!personImage || savedResultsCount === 0) return true;
    return window.confirm(UI_COPY.photo.replaceClearsFittingRoom);
  }, [personImage, savedResultsCount]);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      setError(null);
      if (!file) return;
      if (!ACCEPTED.includes(file.type)) {
        setError(UI_COPY.photo.error.type);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(UI_COPY.photo.error.size);
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        if (dataUrl !== personImage && !confirmPhotoReplacement()) return;
        await setPersonImage(dataUrl);
        setShowUploader(false);
        // Check dimensions for the headshot heuristic.
        const measured = await measurePhoto(dataUrl);
        setImageDimensions(measured ? { w: measured.w, h: measured.h } : null);
        setHeadshotLikely(measured?.headshot ?? false);
      } catch {
        setError(UI_COPY.photo.error.capture);
      }
    },
    [confirmPhotoReplacement, personImage, setPersonImage],
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
    setCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setStreaming(true);
      // Wait for next tick so the video element is mounted.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(UI_COPY.photo.error.capture);
    }
  }, []);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 1280;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the captured frame so it matches what the user sees.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (dataUrl !== personImage && !confirmPhotoReplacement()) return;
    await setPersonImage(dataUrl);
    setShowUploader(false);
    stopCamera();
  }, [confirmPhotoReplacement, personImage, setPersonImage, stopCamera]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [handleFile],
  );

  const clearPhoto = useCallback(async () => {
    if (personImage && !confirmPhotoReplacement()) return;
    await setPersonImage(null);
    setError(null);
    setImageDimensions(null);
    setHeadshotLikely(false);
    setShowUploader(true);
  }, [confirmPhotoReplacement, personImage, setPersonImage]);

  // Re-measure a photo restored from IndexedDB. After a reload there is no
  // in-memory dimension data, so the headshot heuristic must re-run from
  // the persisted data URL — otherwise the persisted view could neither
  // warn on a real headshot nor guarantee a normal photo is not mislabeled.
  useEffect(() => {
    if (!personImage || imageDimensions) return;
    let cancelled = false;
    void measurePhoto(personImage).then((measured) => {
      if (cancelled || !measured) return;
      setImageDimensions({ w: measured.w, h: measured.h });
      setHeadshotLikely(measured.headshot);
    });
    return () => {
      cancelled = true;
    };
  }, [personImage, imageDimensions]);

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-3xl flex-col px-5 py-8">
      <StepHeader
        stepNumber={1}
        totalSteps={5}
        title={UI_COPY.photo.heading}
        body={UI_COPY.photo.body}
        onBack={() => setStep("intro")}
        backLabel={UI_COPY.photo.back}
      />

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {personImage && !showUploader ? (
            <motion.div
              key="persisted"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.22em] text-warm-accent">
                  {UI_COPY.photo.persistedHeading}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {UI_COPY.photo.persistedHint}
                </div>
              </div>

              <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card">
                <img
                  src={personImage}
                  alt="Your saved fitting photo"
                  className="aspect-[3/4] w-full object-cover"
                />
                {headshotLikely ? (
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 border border-[#ff3b30]/70 bg-[#ff3b30]/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ff5147] backdrop-blur">
                    <AlertTriangle className="h-3 w-3" />
                    Looks like a headshot
                  </div>
                ) : (
                  <div className="absolute left-3 top-3 border border-[#30d158]/60 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#30d158] backdrop-blur">
                    On this device
                  </div>
                )}
              </div>

              {headshotLikely && (
                <div className="max-w-sm rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/10 px-4 py-3 text-xs leading-relaxed text-[#ff5147]">
                  <strong className="mb-1 block uppercase tracking-[0.16em]">Headshot warning</strong>
                  {UI_COPY.photo.headshotWarning}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setImageDimensions(null);
                    setHeadshotLikely(false);
                    setShowUploader(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-warm-accent/60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {UI_COPY.photo.changePersistedCta}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("garment")}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
                >
                  {UI_COPY.photo.usePersistedCta}
                </button>
              </div>
            </motion.div>
          ) : personImage ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card">
                <img
                  src={personImage}
                  alt="Your uploaded photo"
                  className="aspect-[3/4] w-full object-cover"
                />
                {headshotLikely ? (
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 border border-[#ff3b30]/70 bg-[#ff3b30]/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ff5147] backdrop-blur">
                    <AlertTriangle className="h-3 w-3" />
                    Looks like a headshot
                  </div>
                ) : (
                  <div className="absolute left-3 top-3 border border-warm-accent/60 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-warm-accent backdrop-blur">
                    Photo received
                  </div>
                )}
              </div>

              {headshotLikely && (
                <div className="max-w-sm rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/10 px-4 py-3 text-xs leading-relaxed text-[#ff5147]">
                  <strong className="block mb-1 uppercase tracking-[0.16em]">Headshot warning</strong>
                  This photo looks roughly square, which usually means it is a face-only shot. The try-on API needs to see your torso. You can still continue, but the result will likely be broken. Consider replacing with a half-body or full-body photo.
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-warm-accent/60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {UI_COPY.photo.retake}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("garment")}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
                >
                  {UI_COPY.photo.continueCta}
                </button>
              </div>
            </motion.div>
          ) : cameraOpen ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[3/4] w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                {!streaming && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Starting camera…
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground hover:border-warm-accent/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={captureFrame}
                  disabled={!streaming}
                  className="inline-flex items-center gap-2 rounded-md bg-[#ff3b30] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98] disabled:opacity-40"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Capture
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-3"
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  dragging
                    ? "border-warm-accent bg-warm-accent/5"
                    : "border-border bg-card/40"
                }`}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-display text-base font-semibold text-foreground">
                    {UI_COPY.photo.dragHint}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {UI_COPY.photo.or}
                  </p>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {UI_COPY.photo.uploadCta}
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-warm-accent/60"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {UI_COPY.photo.cameraCta}
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/10 px-3 py-2 text-xs text-[#ff5147]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Photo suitability guide */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-border bg-surface/60 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-warm-accent">
                    <User className="h-3.5 w-3.5" />
                    {UI_COPY.photo.photoGuideTitle}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {UI_COPY.photo.photoGuide.map((g) => (
                      <li
                        key={g}
                        className="flex items-start gap-2 text-xs leading-relaxed text-foreground/85"
                      >
                        <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-warm-accent/70" />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Headshot warning */}
                <div className="border border-[#ff3b30]/40 bg-[#ff3b30]/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#ff5147]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Face-only photos will fail
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {UI_COPY.photo.headshotWarning}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-start gap-2 border border-border bg-surface/60 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warm-accent" />
                <span>{UI_COPY.photo.privacy}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
