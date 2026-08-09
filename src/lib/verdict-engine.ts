import type {
  AnswerMap,
  Garment,
  QuestionId,
  VerdictEvidence,
  VerdictResult,
} from "./types";
import { QUESTIONS, MAX_SCORE } from "./questions";
import { getVerdictByScore } from "./verdicts";
import { ANSWER_TRIGGERED_LINES, EVIDENCE_RATIONALE } from "./copy";

/**
 * Deterministic, rule-based verdict engine.
 *
 * The engine is intentionally pure and side-effect free so it can be
 * unit-tested and produce consistent, explainable verdicts.
 *
 * Flow:
 *   1. Sum answer scores.
 *   2. Map total to a verdict using fixed thresholds.
 *   3. Build evidence from the answers that most influenced the score.
 *   4. Collect roast lines from three layers:
 *        a. Garment-specific observations (always, up to 1)
 *        b. Answer-triggered evidence lines (high-risk answers only)
 *        c. Verdict closing line (always)
 *   5. Attach the constructive note.
 */

export function computeScore(answers: AnswerMap): number {
  return QUESTIONS.reduce((total, q) => {
    const answer = answers[q.id];
    if (answer == null) return total;
    const opt = q.options.find((o) => o.score === answer);
    return total + (opt?.score ?? 0);
  }, 0);
}

function buildEvidence(answers: AnswerMap): VerdictEvidence[] {
  const evidence: VerdictEvidence[] = [];

  for (const q of QUESTIONS) {
    const score = answers[q.id];
    if (score == null) continue;
    const opt = q.options.find((o) => o.score === score);
    if (!opt) continue;

    evidence.push({
      questionId: q.id as QuestionId,
      questionPrompt: q.prompt,
      answerLabel: opt.label,
      score: opt.score,
      rationale:
        EVIDENCE_RATIONALE[q.id as QuestionId]?.[opt.id] ??
        "This answer influenced your overall score.",
    });
  }

  // Sort by score descending — the most influential factors rise to the top.
  return evidence.sort((a, b) => b.score - a.score);
}

function pickGarmentRoastLine(garment: Garment | null): string | null {
  if (!garment) return null;
  const lines = garment.roastLines;
  // Pick deterministically so re-renders don't shuffle the line.
  return lines[0];
}

function collectAnswerTriggeredLines(answers: AnswerMap): string[] {
  const out: string[] = [];
  for (const trigger of ANSWER_TRIGGERED_LINES) {
    const score = answers[trigger.questionId];
    if (score == null) continue;
    const q = QUESTIONS.find((qq) => qq.id === trigger.questionId);
    if (!q) continue;
    const opt = q.options.find((o) => o.score === score);
    if (!opt) continue;
    if (trigger.optionIds.includes(opt.id)) {
      // Pick the first unused line from this trigger.
      out.push(trigger.lines[0]);
    }
  }
  return out;
}

export function buildVerdict(
  answers: AnswerMap,
  garment: Garment | null,
): VerdictResult {
  const totalScore = computeScore(answers);
  const verdict = getVerdictByScore(totalScore);

  const allEvidence = buildEvidence(answers);
  // Only show evidence that actually contributed risk (score > 0).
  // Low-risk / supportive answers (score 0) are intentionally omitted —
  // they should not be used as filler to reach a quota of three.
  // If only one or two answers are high-risk, we show only those.
  const evidence = allEvidence.filter((e) => e.score > 0).slice(0, 3);

  const garmentLine = pickGarmentRoastLine(garment);
  const triggeredLines = collectAnswerTriggeredLines(answers).slice(0, 2);

  const roastLines: string[] = [];
  if (garmentLine) roastLines.push(garmentLine);
  roastLines.push(...triggeredLines);
  if (verdict.closingRoast) roastLines.push(verdict.closingRoast);

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const dedupedRoasts = roastLines.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });

  return {
    verdict,
    totalScore,
    maxScore: MAX_SCORE,
    evidence,
    roastLines: dedupedRoasts.slice(0, 3),
    garmentRoastLines: garment ? [...garment.roastLines] : [],
    constructiveNote: verdict.constructiveNote,
  };
}

export function formatVerdictForClipboard(
  result: VerdictResult,
  garment: Garment | null,
): string {
  const lines: string[] = [];
  lines.push("Talk Me Out of It");
  lines.push("Your brutally honest fitting-room friend.");
  lines.push("");
  lines.push(`Verdict: ${result.verdict.label}`);
  lines.push(`Impulse score: ${result.totalScore} / ${result.maxScore}`);
  lines.push("");
  if (garment) {
    lines.push(`Garment: ${garment.name}`);
    lines.push("");
  }
  lines.push("Why this verdict:");
  for (const e of result.evidence) {
    lines.push(`- ${e.rationale} (${e.answerLabel}, +${e.score})`);
  }
  lines.push("");
  if (result.roastLines.length > 0) {
    lines.push("Two cents from the fitting room:");
    for (const r of result.roastLines) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }
  lines.push("Honestly:");
  lines.push(result.constructiveNote);
  lines.push("");
  lines.push("Powered by YouCam Apparel Virtual Try-On");
  return lines.join("\n");
}
