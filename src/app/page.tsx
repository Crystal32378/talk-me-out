"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFlowStore } from "@/lib/store";
import { IntroStep } from "@/components/steps/intro-step";
import { PhotoUploadStep } from "@/components/steps/photo-upload-step";
import { GarmentSelectStep } from "@/components/steps/garment-select-step";
import { TryOnResultStep } from "@/components/steps/tryon-result-step";
import { InterrogationStep } from "@/components/steps/interrogation-step";
import { VerdictCardStep } from "@/components/steps/verdict-card-step";
import { FittingRoomStep } from "@/components/steps/fitting-room-step";

export default function Home() {
  const step = useFlowStore((s) => s.step);
  const hydrated = useFlowStore((s) => s.hydrated);
  const hydrateFromDB = useFlowStore((s) => s.hydrateFromDB);

  // Hydrate from IndexedDB once on mount so the persisted person photo
  // and saved fitting-room entries are available immediately.
  useEffect(() => {
    void hydrateFromDB();
  }, [hydrateFromDB]);

  // Avoid rendering any step until we've at least attempted hydration,
  // so the photo-upload step doesn't briefly show "no photo" before
  // the persisted photo loads in.
  if (!hydrated) {
    return (
      <div className="relative min-h-[100svh] bg-background text-foreground" />
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-background text-foreground grain-overlay">
      {/* subtle radial backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 20% -10%, rgba(255, 59, 48, 0.10), transparent 55%), radial-gradient(ellipse at 90% 110%, rgba(255, 107, 53, 0.06), transparent 55%)",
        }}
      />
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === "intro" && <IntroStep />}
            {step === "photo" && <PhotoUploadStep />}
            {step === "garment" && <GarmentSelectStep />}
            {step === "tryon" && <TryOnResultStep />}
            {step === "interrogation" && <InterrogationStep />}
            {step === "verdict" && <VerdictCardStep />}
            {step === "fitting-room" && <FittingRoomStep />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
