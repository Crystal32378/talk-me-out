import type { Decision, VerdictId } from "./types";

/**
 * Binary decision mapping (presentation layer only).
 *
 * The deterministic 4-verdict engine in `verdict-engine.ts` and the
 * thresholds in `verdicts.ts` are intentionally NOT modified. This
 * function only maps the engine's output into the two user-facing
 * decisions defined by the persistent fitting room product brief:
 *
 *   score <= 7  → TRY_IRL   (BUY_IT + TRY_IN_STORE)
 *   score >= 8  → SKIP      (BORROW_OR_RENT + WALK_AWAY)
 *
 * "TRY_IRL" stands for "worth trying in person" — virtual try-on
 * looks promising AND purchase rationale is reasonable enough to
 * justify a real physical fitting room visit.
 *
 * "SKIP" means the current purchase rationale is not strong enough
 * to justify further investment of time or money, regardless of how
 * the garment looks in the virtual try-on.
 *
 * We accept verdictId as a parameter for future flexibility, but the
 * current mapping is purely score-based to stay aligned with the
 * original thresholds. If the engine's thresholds ever change, this
 * function's threshold should be updated to match.
 */
export function toDecision(verdictId: VerdictId, score: number): Decision {
  // verdictId is intentionally accepted but currently unused — the
  // score-based threshold is the source of truth, matching the
  // original 4-verdict boundaries (TRY_IN_STORE max = 7, BORROW_OR_RENT min = 8).
  void verdictId;
  return score <= 7 ? "TRY_IRL" : "SKIP";
}

export const DECISION_LABELS: Record<Decision, { short: string; long: string; color: string }> = {
  TRY_IRL: {
    short: "TRY IN PERSON",
    long: "WORTH TRYING IN PERSON",
    color: "#30D158",
  },
  SKIP: {
    short: "SKIP IT",
    long: "SKIP IT",
    color: "#FF3B30",
  },
};
