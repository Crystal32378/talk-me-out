import type { Question } from "./types";

/**
 * Five-question purchase decision flow.
 *
 * Scoring design (per the brief):
 * - Low score = the purchase fits the user's real life.
 * - High score = strong signal of an impulse purchase.
 * - "Cheap" is intentionally NOT a low-risk answer for budget —
 *   low price alone does not justify a purchase.
 *
 * Maximum total score: 19.
 */

export const QUESTIONS: Question[] = [
  {
    id: "occasion",
    prompt: "When will you actually wear this?",
    helper: "Be honest. Imagined occasions do not count.",
    options: [
      { id: "specific", label: "I already have a specific occasion", score: 0 },
      { id: "this-month", label: "Probably sometime this month", score: 1 },
      { id: "cannot-name", label: "I cannot name an occasion", score: 3 },
    ],
  },
  {
    id: "duplication",
    prompt: "Do you already own something similar?",
    helper: "Open your closet in your mind. Look carefully.",
    options: [
      { id: "no", label: "No", score: 0 },
      { id: "one", label: "One similar item", score: 2 },
      { id: "two-plus", label: "Two or more similar items", score: 4 },
    ],
  },
  {
    id: "budget",
    prompt: "How does the price fit your budget?",
    helper: "Low price is not the same as a smart purchase.",
    options: [
      { id: "within", label: "Easily within budget", score: 0 },
      { id: "reasonable", label: "Reasonable for the value", score: 1 },
      { id: "more-than-planned", label: "More expensive than planned", score: 3 },
      { id: "over-but-want", label: "Over budget, but I still want it", score: 5 },
    ],
  },
  {
    id: "care",
    prompt: "Do the care requirements fit your life?",
    helper: "Laundry habits are a real lifestyle decision.",
    options: [
      { id: "machine", label: "Easy machine wash", score: 0 },
      { id: "hand-wash", label: "I am willing to hand-wash it", score: 1 },
      { id: "dry-clean", label: "I accept the dry-cleaning cost", score: 2 },
      { id: "did-not-check", label: "I did not check", score: 4 },
    ],
  },
  {
    id: "regret",
    prompt: "If you never wear it next month, how would you feel?",
    helper: "Imagine the tag still attached, in the back of the closet.",
    options: [
      { id: "considered", label: "It would still be a considered purchase", score: 0 },
      { id: "little-guilty", label: "A little guilty", score: 1 },
      { id: "seriously-regret", label: "I would seriously regret it", score: 3 },
    ],
  },
];

export const MAX_SCORE = QUESTIONS.reduce(
  (max, q) => max + Math.max(...q.options.map((o) => o.score)),
  0,
);

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
