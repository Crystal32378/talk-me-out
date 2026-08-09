"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Upload, AlertCircle, Tag } from "lucide-react";
import { StepHeader } from "./step-header";
import { UI_COPY } from "@/lib/copy";
import { useFlowStore } from "@/lib/store";
import { DEFAULT_GARMENTS, GARMENT_COLLECTION_NAME, GARMENT_ATTRIBUTION_LINE } from "@/lib/garments";
import type { CustomGarmentInput, GarmentType } from "@/lib/types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

export function GarmentSelectStep() {
  const setStep = useFlowStore((s) => s.setStep);
  const garment = useFlowStore((s) => s.garment);
  const selectDefaultGarment = useFlowStore((s) => s.selectDefaultGarment);
  const setCustomGarment = useFlowStore((s) => s.setCustomGarment);
  const savedResults = useFlowStore((s) => s.savedResults);

  const [tab, setTab] = useState<"default" | "custom">("default");
  const [error, setError] = useState<string | null>(null);

  // Custom upload form state
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customCare, setCustomCare] = useState("");
  const [customType, setCustomType] = useState<GarmentType>("Top");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImage = async (file: File | undefined) => {
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
      const url = await dataUrlFromFile(file);
      setCustomImage(url);
    } catch {
      setError("Could not read the image file.");
    }
  };

  const submitCustom = () => {
    setError(null);
    if (!customImage || !customName.trim() || !customCare.trim()) {
      setError(UI_COPY.garment.custom.errorRequired);
      return;
    }
    const input: CustomGarmentInput = {
      imageUrl: customImage,
      name: customName.trim(),
      price: customPrice ? Number(customPrice) : 0,
      care: customCare.trim(),
      type: customType,
    };
    setCustomGarment(input);
    setStep("tryon");
  };

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-4xl flex-col px-5 py-8">
      <StepHeader
        stepNumber={2}
        totalSteps={5}
        title={UI_COPY.garment.heading}
        body={UI_COPY.garment.body}
        onBack={() => setStep("photo")}
        backLabel={UI_COPY.garment.back}
      />

      {/* My Fitting Room entry — visible whenever at least one look is saved */}
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setStep("fitting-room")}
          className="inline-flex items-center gap-2 rounded-md border border-warm-accent/60 bg-warm-accent/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-warm-accent transition-colors hover:bg-warm-accent/10"
        >
          {UI_COPY.garment.fittingRoomCta}
          {savedResults.length > 0 && (
            <span className="rounded-full bg-warm-accent/20 px-2 py-0.5 text-[10px] tracking-[0.14em]">
              {savedResults.length} SAVED
            </span>
          )}
        </button>
      </div>

      {/* Collection attribution */}
      <div className="mb-6 flex flex-col gap-1 border-l-2 border-warm-accent/60 pl-3">
        <div className="font-display text-sm font-semibold tracking-tight text-foreground">
          {GARMENT_COLLECTION_NAME}
        </div>
        <div className="text-xs text-muted-foreground">
          {GARMENT_ATTRIBUTION_LINE}
        </div>
      </div>

      {/* Tab switch */}
      <div className="mb-6 inline-flex w-full max-w-md gap-1 rounded-md border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("default")}
          className={`flex-1 rounded px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
            tab === "default"
              ? "bg-[#ff3b30] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {UI_COPY.garment.defaultTab}
        </button>
        <button
          type="button"
          onClick={() => setTab("custom")}
          className={`flex-1 rounded px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
            tab === "custom"
              ? "bg-[#ff3b30] text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {UI_COPY.garment.customTab}
        </button>
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {tab === "default" ? (
            <motion.div
              key="default"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {DEFAULT_GARMENTS.map((g) => {
                  const selected = garment?.id === g.id;
                  const tried = savedResults.some((r) => r.id === g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => selectDefaultGarment(g.id)}
                      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-all ${
                        selected
                          ? "border-warm-accent ring-1 ring-warm-accent"
                          : "border-border hover:border-warm-accent/60"
                      }`}
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
                        {/* Using a plain img for SVG assets in /public */}
                        { }
                        <img
                          src={g.imageUrl}
                          alt={g.name}
                          className="h-full w-full object-cover"
                        />
                        {selected && (
                          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-warm-accent text-white">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                        {tried && (
                          <div className="absolute left-2 top-2 border border-[#30d158]/60 bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#30d158] backdrop-blur">
                            {UI_COPY.garment.triedBadge}
                          </div>
                        )}
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
                    </button>
                  );
                })}
              </div>

              {garment && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex flex-col gap-3 border border-border bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {UI_COPY.garment.selected}
                    </div>
                    <div className="font-display text-base font-semibold text-foreground">
                      {garment.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {garment.material} · {garment.care}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("tryon")}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
                  >
                    {UI_COPY.garment.continueCta}
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="custom"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6 sm:grid-cols-[1fr,1.2fr]"
            >
              {/* Image dropzone */}
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Garment image
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed border-border bg-card/40 text-center transition-colors hover:border-warm-accent/60"
                >
                  {customImage ? (
                    <>
                      { }
                      <img
                        src={customImage}
                        alt="Custom garment"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-warm-accent">
                        Tap to replace
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-7 w-7 text-muted-foreground" />
                      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {UI_COPY.garment.custom.imageCta}
                      </span>
                      <span className="px-4 text-[10px] leading-relaxed text-muted-foreground/70">
                        Use a clean, single-garment product photo.
                        White or transparent background works best.
                      </span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED.join(",")}
                  onChange={(e) => handleImage(e.target.files?.[0])}
                  className="hidden"
                />
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {UI_COPY.garment.custom.nameLabel}
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Vintage leather jacket"
                    className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-warm-accent focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {UI_COPY.garment.custom.priceLabel}
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-md border border-border bg-card py-3 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-warm-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {UI_COPY.garment.custom.typeLabel}
                    </label>
                    <select
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value as GarmentType)}
                      className="w-full rounded-md border border-border bg-card px-3 py-3 text-sm text-foreground focus:border-warm-accent focus:outline-none"
                    >
                      {UI_COPY.garment.custom.typeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {UI_COPY.garment.custom.careLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={customCare}
                    onChange={(e) => setCustomCare(e.target.value)}
                    placeholder="e.g. Machine wash cold, tumble dry low"
                    className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-warm-accent focus:outline-none"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-[#ff3b30]/40 bg-[#ff3b30]/10 px-3 py-2 text-xs text-[#ff5147]">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitCustom}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-[#ff3b30] px-7 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-[#ff5147] active:scale-[0.98]"
                >
                  {UI_COPY.garment.custom.submitCta}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
