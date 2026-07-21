import type { VerdictDefinition, VerdictId } from "./types";
import { CONSTRUCTIVE_NOTES, VERDICT_CLOSING_LINES } from "./copy";
import { MAX_SCORE } from "./questions";

export const VERDICTS: Record<VerdictId, VerdictDefinition> = {
  BUY_IT: {
    id: "BUY_IT",
    label: "Buy It",
    stamp: "BUY IT",
    scoreRange: [0, 3],
    color: "#30D158",
    meaning:
      "The purchase has a real use case and fits the user's constraints.",
    constructiveNote: CONSTRUCTIVE_NOTES.BUY_IT,
    closingRoast: VERDICT_CLOSING_LINES.BUY_IT[0],
  },
  TRY_IN_STORE: {
    id: "TRY_IN_STORE",
    label: "Try in Store",
    stamp: "TRY IN STORE",
    scoreRange: [4, 7],
    color: "#FFD60A",
    meaning:
      "The idea may be reasonable, but online uncertainty remains.",
    constructiveNote: CONSTRUCTIVE_NOTES.TRY_IN_STORE,
    closingRoast: VERDICT_CLOSING_LINES.TRY_IN_STORE[0],
  },
  BORROW_OR_RENT: {
    id: "BORROW_OR_RENT",
    label: "Borrow or Rent",
    stamp: "BORROW OR RENT",
    scoreRange: [8, 12],
    color: "#FF9F0A",
    meaning:
      "The user wants the experience more than permanent ownership.",
    constructiveNote: CONSTRUCTIVE_NOTES.BORROW_OR_RENT,
    closingRoast: VERDICT_CLOSING_LINES.BORROW_OR_RENT[0],
  },
  WALK_AWAY: {
    id: "WALK_AWAY",
    label: "Walk Away",
    stamp: "WALK AWAY",
    scoreRange: [13, MAX_SCORE],
    color: "#FF3B30",
    meaning:
      "The evidence strongly suggests an impulse purchase.",
    constructiveNote: CONSTRUCTIVE_NOTES.WALK_AWAY,
    closingRoast: VERDICT_CLOSING_LINES.WALK_AWAY[0],
  },
};

export const VERDICT_ORDER: VerdictId[] = [
  "BUY_IT",
  "TRY_IN_STORE",
  "BORROW_OR_RENT",
  "WALK_AWAY",
];

export function getVerdictByScore(score: number): VerdictDefinition {
  for (const id of VERDICT_ORDER) {
    const v = VERDICTS[id];
    if (score >= v.scoreRange[0] && score <= v.scoreRange[1]) {
      return v;
    }
  }
  // Fallback for any out-of-range edge case
  return score <= 3 ? VERDICTS.BUY_IT : VERDICTS.WALK_AWAY;
}
