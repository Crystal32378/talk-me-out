// Core domain types for Talk Me Out of It

export type GarmentType =
  | "Top"
  | "Outerwear"
  | "Dress"
  | "Bottom"
  | "Unsure";

export type GarmentCategory =
  | "unclear-occasion"
  | "false-investment"
  | "aspirational-identity"
  | "brand-premium"
  | "one-time-scenario"
  | "high-maintenance";

export interface Garment {
  id: string;
  name: string;
  price: number;
  currency: string;
  material: string;
  care: string;
  type: GarmentType;
  category: GarmentCategory;
  categoryLabel: string;
  purchaseTension: string;
  imageUrl: string;
  roastLines: [string, string];
  isDefault: boolean;
}

export interface CustomGarmentInput {
  name: string;
  price: number;
  care: string;
  type: GarmentType;
  imageUrl: string;
}

export type QuestionId = "occasion" | "duplication" | "budget" | "care" | "regret";

export interface AnswerOption {
  id: string;
  label: string;
  score: number;
}

export interface Question {
  id: QuestionId;
  prompt: string;
  helper?: string;
  options: AnswerOption[];
}

export type AnswerMap = Record<QuestionId, number | null>;

export type VerdictId = "BUY_IT" | "TRY_IN_STORE" | "BORROW_OR_RENT" | "WALK_AWAY";

export interface VerdictDefinition {
  id: VerdictId;
  label: string;
  stamp: string;
  scoreRange: [number, number];
  color: string;
  meaning: string;
  constructiveNote: string;
  closingRoast?: string;
}

export interface VerdictEvidence {
  questionId: QuestionId;
  questionPrompt: string;
  answerLabel: string;
  score: number;
  rationale: string;
}

export interface VerdictResult {
  verdict: VerdictDefinition;
  totalScore: number;
  maxScore: number;
  evidence: VerdictEvidence[];
  roastLines: string[];
  garmentRoastLines: string[];
  constructiveNote: string;
}

/**
 * Binary presentation-layer decision.
 *
 * The underlying 4-verdict deterministic engine is unchanged. This type
 * only exists at the presentation layer to converge the user-facing
 * decision into two outcomes:
 *   - TRY_IRL  : score <= 7  (BUY_IT + TRY_IN_STORE)
 *   - SKIP     : score >= 8  (BORROW_OR_RENT + WALK_AWAY)
 *
 * "TRY_IRL" means "worth trying in person" — the virtual try-on looks
 * promising enough and the purchase rationale is reasonable enough to
 * justify spending real time on a physical fitting room.
 *
 * "SKIP" means the current purchase rationale is not strong enough to
 * justify further investment of time or money, regardless of how the
 * garment looks in the virtual try-on.
 */
export type Decision = "TRY_IRL" | "SKIP";

export type Step =
  | "intro"
  | "photo"
  | "garment"
  | "tryon"
  | "interrogation"
  | "verdict"
  | "fitting-room";

export interface TryOnResult {
  imageUrl: string;
  demo: boolean;
  fallback: boolean;
  unitsUsed?: number;
  error?: string;
}

/**
 * One saved entry in the user's persistent fitting room.
 *
 * Stored in IndexedDB (device-local only — no cloud, no account).
 * Created after a real YouCam VTO call succeeds AND the user has
 * completed the 5-question interrogation. Each entry is keyed by
 * garmentId (for default garments) or by a custom-<timestamp> id
 * (for user-uploaded garments). Re-trying the same garment updates
 * the existing entry instead of creating a duplicate.
 */
export interface FittingRoomEntry {
  /** Stable id — equals garment.id for both default and custom garments. */
  id: string;
  /** True for user-uploaded garments, false for Crystal's Closet defaults. */
  isCustom: boolean;
  /** Display name (e.g. "Lavender Maxi Dress"). */
  garmentName: string;
  /** Garment image URL or data URL (for default garments, the /garments/<slug>.jpg path). */
  garmentImage: string;
  /** Garment type ("Top" | "Outerwear" | "Dress" | "Bottom" | "Unsure"). */
  garmentType: GarmentType;
  /** VTO result image as a data URL (the YouCam-generated try-on composite). */
  tryOnImage: string;
  /** Whether the VTO was a real API result (true) or demo/fallback (false). */
  tryOnIsReal: boolean;
  /** Snapshot of the answers the user gave for this garment. */
  answers: AnswerMap;
  /** Total impulse score (0–19). */
  score: number;
  /** Original 4-verdict id (preserved for the detail view). */
  verdictId: VerdictId;
  /** Binary presentation-layer decision ("TRY_IRL" | "SKIP"). */
  decision: Decision;
  /** Unix epoch millis when this entry was last updated. */
  updatedAt: number;
}
