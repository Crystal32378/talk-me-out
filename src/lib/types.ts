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

export type Step =
  | "intro"
  | "photo"
  | "garment"
  | "tryon"
  | "interrogation"
  | "verdict";

export interface TryOnResult {
  imageUrl: string;
  demo: boolean;
  fallback: boolean;
  unitsUsed?: number;
  error?: string;
}
