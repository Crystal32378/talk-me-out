"use client";

import { create } from "zustand";
import type {
  AnswerMap,
  CustomGarmentInput,
  Decision,
  FittingRoomEntry,
  Garment,
  Step,
  TryOnResult,
  VerdictResult,
} from "./types";
import { DEFAULT_GARMENTS } from "./garments";
import { QUESTIONS } from "./questions";
import { buildVerdict } from "./verdict-engine";
import { toDecision } from "./decisions";
import * as db from "./fitting-room-db";

interface FlowState {
  step: Step;
  personImage: string | null; // data URL — also persisted to IndexedDB
  garment: Garment | null; // resolved garment (default or built from custom input)
  customGarment: CustomGarmentInput | null;
  tryOn: TryOnResult | null;
  tryOnStatus: "idle" | "loading" | "success" | "error";
  tryOnError: string | null;
  answers: AnswerMap;
  currentQuestionIndex: number;
  verdict: VerdictResult | null;

  // Persistent fitting-room state (hydrated from IndexedDB on mount).
  savedResults: FittingRoomEntry[];
  hydrated: boolean;

  // navigation
  setStep: (step: Step) => void;
  reset: () => void;
  tryAnotherGarment: () => void;
  clearFittingRoom: () => Promise<void>;
  hydrateFromDB: () => Promise<void>;

  // photo
  setPersonImage: (dataUrl: string | null) => Promise<void>;

  // garment
  selectDefaultGarment: (id: string) => void;
  setCustomGarment: (input: CustomGarmentInput) => void;

  // try-on
  setTryOnLoading: () => void;
  setTryOnSuccess: (result: TryOnResult) => void;
  setTryOnError: (error: string) => void;

  // interrogation
  setAnswer: (questionId: keyof AnswerMap, score: number) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;

  // verdict
  finalizeVerdict: () => void;

  // fitting-room entry management
  getCachedResult: (garmentId: string) => FittingRoomEntry | null;
  /** Returns true only when the entry was actually written to IndexedDB. */
  saveCurrentResultToFittingRoom: () => Promise<boolean>;
  deleteSavedResult: (id: string) => Promise<void>;
  loadSavedResultIntoSession: (id: string) => void;
}

function emptyAnswers(): AnswerMap {
  return {
    occasion: null,
    duplication: null,
    budget: null,
    care: null,
    regret: null,
  };
}

/**
 * Clear only the per-garment session state — keep the person photo and
 * every saved fitting-room entry. Used by `tryAnotherGarment()` so the
 * user can pick the next garment without re-uploading their photo.
 */
function clearSession(set: (partial: Partial<FlowState>) => void) {
  set({
    garment: null,
    customGarment: null,
    tryOn: null,
    tryOnStatus: "idle",
    tryOnError: null,
    answers: emptyAnswers(),
    currentQuestionIndex: 0,
    verdict: null,
  });
}

/**
 * Semantic equality for fitting-room entries. Two entries describe the
 * same completed look when every field a verdict depends on matches:
 * the answers, the derived verdict/decision/score, and the try-on image.
 * `updatedAt` is intentionally excluded — it is bookkeeping, not meaning.
 * Centralized here so every save path (verdict effect, "Try another",
 * "View my fitting room") is idempotent by construction.
 */
function isSameLook(a: FittingRoomEntry, b: FittingRoomEntry): boolean {
  return (
    a.id === b.id &&
    a.tryOnImage === b.tryOnImage &&
    a.verdictId === b.verdictId &&
    a.decision === b.decision &&
    a.score === b.score &&
    QUESTIONS.every(
      (q) => a.answers[q.id as keyof AnswerMap] === b.answers[q.id as keyof AnswerMap],
    )
  );
}

export const useFlowStore = create<FlowState>((set, get) => ({
  step: "intro",
  personImage: null,
  garment: null,
  customGarment: null,
  tryOn: null,
  tryOnStatus: "idle",
  tryOnError: null,
  answers: emptyAnswers(),
  currentQuestionIndex: 0,
  verdict: null,
  savedResults: [],
  hydrated: false,

  setStep: (step) => set({ step }),

  reset: () =>
    set({
      step: "intro",
      garment: null,
      customGarment: null,
      tryOn: null,
      tryOnStatus: "idle",
      tryOnError: null,
      answers: emptyAnswers(),
      currentQuestionIndex: 0,
      verdict: null,
      // Intentionally do NOT clear personImage or savedResults here —
      // `reset()` is a "go back to intro" navigation action, not a
      // "wipe the fitting room" action. Use `clearFittingRoom()` for
      // the latter.
    }),

  tryAnotherGarment: () => {
    clearSession(set);
    set({ step: "garment" });
  },

  clearFittingRoom: async () => {
    await db.clearAll();
    set({
      personImage: null,
      garment: null,
      customGarment: null,
      tryOn: null,
      tryOnStatus: "idle",
      tryOnError: null,
      answers: emptyAnswers(),
      currentQuestionIndex: 0,
      verdict: null,
      savedResults: [],
      step: "intro",
    });
  },

  hydrateFromDB: async () => {
    if (get().hydrated) return;
    const [person, looks] = await Promise.all([
      db.loadPersonPhoto(),
      db.loadAllLooks(),
    ]);
    set({
      personImage: person?.dataUrl ?? null,
      savedResults: looks,
      hydrated: true,
    });
  },

  setPersonImage: async (dataUrl) => {
    const state = get();
    if (state.personImage === dataUrl) return;

    // Every saved VTO result belongs to the person photo that created it.
    // Replacing or removing that photo must invalidate those results before
    // the new photo becomes active; otherwise a garment-only cache key could
    // show the previous person's generated image.
    const mustClearLooks = state.savedResults.length > 0;
    if (mustClearLooks) {
      await db.clearAll();
    } else if (!dataUrl) {
      await db.clearPersonPhoto();
    }

    if (dataUrl) {
      await db.savePersonPhoto(dataUrl);
    }

    clearSession(set);
    set({
      personImage: dataUrl,
      savedResults: mustClearLooks ? [] : state.savedResults,
    });
  },

  selectDefaultGarment: (id) => {
    const g = DEFAULT_GARMENTS.find((gg) => gg.id === id);
    if (g) set({ garment: g, customGarment: null });
  },

  setCustomGarment: (input) => {
    const built: Garment = {
      id: `custom-${Date.now()}`,
      name: input.name,
      price: input.price,
      currency: "USD",
      material: "Not specified",
      care: input.care,
      type: input.type,
      category: "unclear-occasion",
      categoryLabel: "Custom upload",
      purchaseTension: "User-supplied garment",
      imageUrl: input.imageUrl,
      roastLines: [
        "You brought this in yourself. The fitting room will not be gentler because of it.",
        "Custom uploads are the most honest test of the whole flow.",
      ],
      isDefault: false,
    };
    set({ garment: built, customGarment: input });
  },

  setTryOnLoading: () =>
    set({ tryOnStatus: "loading", tryOnError: null, tryOn: null }),
  setTryOnSuccess: (result) =>
    set({ tryOnStatus: "success", tryOn: result, tryOnError: null }),
  setTryOnError: (error) =>
    set((state) => ({
      tryOnStatus: "error",
      tryOnError: error,
      tryOn: state.tryOn,
    })),

  setAnswer: (questionId, score) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: score },
    })),

  goToQuestion: (index) =>
    set({
      currentQuestionIndex: Math.max(0, Math.min(QUESTIONS.length - 1, index)),
    }),

  nextQuestion: () =>
    set((state) => ({
      currentQuestionIndex: Math.min(
        QUESTIONS.length - 1,
        state.currentQuestionIndex + 1,
      ),
    })),

  prevQuestion: () =>
    set((state) => ({
      currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
    })),

  finalizeVerdict: () => {
    const { answers, garment } = get();
    const verdict = buildVerdict(answers, garment);
    set({ verdict });
  },

  getCachedResult: (garmentId) => {
    return get().savedResults.find((r) => r.id === garmentId) ?? null;
  },

  saveCurrentResultToFittingRoom: async () => {
    const { garment, tryOn, answers, verdict, savedResults } = get();
    if (!garment || !tryOn || !verdict) return false;
    // Don't save fallback results to the fitting room — they aren't real
    // VTO outputs and would mislead the user on revisit. Demo results
    // are also not saved (they aren't tied to the user's actual photo).
    if (tryOn.fallback || tryOn.demo) return false;

    const decision: Decision = toDecision(verdict.verdict.id, verdict.totalScore);
    const entry: FittingRoomEntry = {
      id: garment.id,
      isCustom: !garment.isDefault,
      garmentName: garment.name,
      garmentImage: garment.imageUrl,
      garmentType: garment.type,
      tryOnImage: tryOn.imageUrl,
      tryOnIsReal: !tryOn.demo && !tryOn.fallback,
      answers,
      score: verdict.totalScore,
      verdictId: verdict.verdict.id,
      decision,
      updatedAt: Date.now(),
    };

    // Idempotency: if a semantically identical entry is already saved,
    // report success without rewriting it — repeated calls (verdict
    // effect, "Try another", "View my fitting room") must not churn
    // `updatedAt` or reorder the fitting room.
    const existing = savedResults.find((r) => r.id === entry.id);
    if (existing && isSameLook(existing, entry)) return true;

    try {
      await db.saveLook(entry);
    } catch {
      // IndexedDB write failed (private mode, quota, etc.) — report
      // honestly so the UI never shows a "saved" confirmation for an
      // entry that was not persisted.
      return false;
    }
    // Update in-memory list (replace if already present, else prepend).
    const filtered = savedResults.filter((r) => r.id !== entry.id);
    set({ savedResults: [entry, ...filtered] });
    return true;
  },

  deleteSavedResult: async (id) => {
    await db.deleteLook(id);
    set((state) => ({
      savedResults: state.savedResults.filter((r) => r.id !== id),
    }));
  },

  loadSavedResultIntoSession: (id) => {
    const entry = get().savedResults.find((r) => r.id === id);
    if (!entry) return;
    // Hydrate the session from a saved entry so the user can revisit
    // the full verdict / answers / try-on without re-calling YouCam.
    const garment: Garment = entry.isCustom
      ? {
          id: entry.id,
          name: entry.garmentName,
          price: 0,
          currency: "USD",
          material: "Not specified",
          care: "",
          type: entry.garmentType,
          category: "unclear-occasion",
          categoryLabel: "Custom upload",
          purchaseTension: "User-supplied garment",
          imageUrl: entry.garmentImage,
          roastLines: [
            "You brought this in yourself. The fitting room will not be gentler because of it.",
            "Custom uploads are the most honest test of the whole flow.",
          ],
          isDefault: false,
        }
      : DEFAULT_GARMENTS.find((g) => g.id === entry.id) ?? {
          id: entry.id,
          name: entry.garmentName,
          price: 0,
          currency: "USD",
          material: "",
          care: "",
          type: entry.garmentType,
          category: "unclear-occasion",
          categoryLabel: "",
          purchaseTension: "",
          imageUrl: entry.garmentImage,
          roastLines: ["", ""],
          isDefault: true,
        };

    // Rebuild the verdict from the saved answers so all evidence / roast
    // lines / constructive note are available without re-running the
    // engine wiring.
    const verdict = buildVerdict(entry.answers, garment);

    set({
      garment,
      customGarment: null,
      tryOn: {
        imageUrl: entry.tryOnImage,
        demo: false,
        fallback: false,
      },
      tryOnStatus: "success",
      tryOnError: null,
      answers: entry.answers,
      currentQuestionIndex: 0,
      verdict,
      step: "verdict",
    });
  },
}));
