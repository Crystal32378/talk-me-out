"use client";

import { create } from "zustand";
import type {
  AnswerMap,
  CustomGarmentInput,
  Garment,
  Step,
  TryOnResult,
} from "./types";
import { DEFAULT_GARMENTS } from "./garments";
import { QUESTIONS } from "./questions";
import type { VerdictResult } from "./types";
import { buildVerdict } from "./verdict-engine";

interface FlowState {
  step: Step;
  personImage: string | null; // data URL
  garment: Garment | null; // resolved garment (default or built from custom input)
  customGarment: CustomGarmentInput | null;
  tryOn: TryOnResult | null;
  tryOnStatus: "idle" | "loading" | "success" | "error";
  tryOnError: string | null;
  answers: AnswerMap;
  currentQuestionIndex: number;
  verdict: VerdictResult | null;

  // navigation
  setStep: (step: Step) => void;
  reset: () => void;

  // photo
  setPersonImage: (dataUrl: string | null) => void;

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

  setStep: (step) => set({ step }),
  reset: () =>
    set({
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
    }),

  setPersonImage: (dataUrl) => set({ personImage: dataUrl }),

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
      category: "unclear-occasion", // custom garments default to the generic risk bucket
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
    set({ tryOnStatus: "error", tryOnError: error, tryOn: null }),

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
}));
