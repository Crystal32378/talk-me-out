"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, RefreshCw, ImageIcon, ShieldCheck, AlertCircle } from "lucide-react";
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

export function PhotoUploadStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const personImage = useFlowStore((s) => s.personImage);
  const setPersonImage = useFlowStore((s) => s.setPersonImage);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        setPersonImage(dataUrl);
      } catch {
        setError(UI_COPY.photo.error.capture);
      }
    },
    [setPersonImage],
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

  const captureFrame = useCallback(() => {
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
    setPersonImage(dataUrl);
    stopCamera();
  }, [setPersonImage, stopCamera]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [handleFile],
  );

  const clearPhoto = useCallback(() => {
    setPersonImage(null);
    setError(null);
  }, [setPersonImage]);

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
          {personImage ? (
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
                <div className="absolute left-3 top-3 border border-warm-accent/60 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-warm-accent backdrop-blur">
                  Evidence accepted
                </div>
              </div>
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
