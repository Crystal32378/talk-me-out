/**
 * Server-side YouCam generation quota (DoraHacks budget guardrail).
 *
 * Budget math (2026-08-22): 1,000 YouCam credits ÷ 2 credits per successful
 * generation = 500 successful generations total. Product is sized for up to
 * 100 users × 5 try-ons. Once the global counter reaches the cap, the
 * YouCam API must not be called again — enforced HERE, before the upstream
 * call, so reloads / cleared localStorage cannot burn the budget.
 *
 * Semantics: reserve → (commit | release).
 *   - reserve()  INCRs the counters up-front; over-cap reservations are
 *     immediately refunded and rejected, so two concurrent requests can
 *     never both squeeze past the boundary.
 *   - release()  refunds after a FAILED generation (API error / timeout) —
 *     per spec, only successful generations consume quota.
 *   - commit()   keeps the reservation after a successful generation.
 *
 * Storage: Upstash Redis via REST (same env vars as /api/event). Without
 * it, falls back to per-instance in-memory counters — imperfect across
 * serverless instances, but the client-side credit gate still bounds
 * honest users, and a warning is logged so the gap is visible.
 */

const GLOBAL_MAX = Number(process.env.TMOI_MAX_GENERATIONS ?? 500);
const PER_USER_MAX = 5;

const GLOBAL_KEY = "tmoi:quota:global";
const userKey = (id: string) => `tmoi:quota:user:${id}`;

export type QuotaRejection = "global-quota" | "user-quota";

export interface QuotaReservation {
  ok: true;
  /** Keep the reservation — call after a successful generation. */
  commit: () => Promise<void>;
  /** Refund the reservation — call after a failed generation. */
  release: () => Promise<void>;
}

export interface QuotaRejected {
  ok: false;
  reason: QuotaRejection;
}

async function redis(commands: string[][]): Promise<Array<{ result: unknown }> | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Array<{ result: unknown }>;
  } catch {
    return null;
  }
}

// ---- In-memory fallback (per serverless instance) ----
const memory = new Map<string, number>();
let warnedNoRedis = false;

function memIncr(key: string): number {
  const next = (memory.get(key) ?? 0) + 1;
  memory.set(key, next);
  return next;
}

function memDecr(key: string): void {
  memory.set(key, Math.max(0, (memory.get(key) ?? 0) - 1));
}

export async function reserveGeneration(
  userId: string,
): Promise<QuotaReservation | QuotaRejected> {
  const uKey = userKey(userId);

  const results = await redis([
    ["INCR", GLOBAL_KEY],
    ["INCR", uKey],
  ]);

  if (results) {
    const globalCount = Number(results[0]?.result ?? 0);
    const userCount = Number(results[1]?.result ?? 0);

    if (globalCount > GLOBAL_MAX) {
      await redis([
        ["DECR", GLOBAL_KEY],
        ["DECR", uKey],
      ]);
      return { ok: false, reason: "global-quota" };
    }
    if (userCount > PER_USER_MAX) {
      await redis([
        ["DECR", GLOBAL_KEY],
        ["DECR", uKey],
      ]);
      return { ok: false, reason: "user-quota" };
    }
    return {
      ok: true,
      commit: async () => {
        // Reservation already counts — nothing to do on success.
      },
      release: async () => {
        await redis([
          ["DECR", GLOBAL_KEY],
          ["DECR", uKey],
        ]);
      },
    };
  }

  // Redis unavailable — per-instance fallback.
  if (!warnedNoRedis) {
    warnedNoRedis = true;
    console.warn(
      "[tmoi-quota] UPSTASH_REDIS_REST_URL not configured — global quota is per-instance only.",
    );
  }
  const globalCount = memIncr(GLOBAL_KEY);
  const userCount = memIncr(uKey);
  if (globalCount > GLOBAL_MAX) {
    memDecr(GLOBAL_KEY);
    memDecr(uKey);
    return { ok: false, reason: "global-quota" };
  }
  if (userCount > PER_USER_MAX) {
    memDecr(GLOBAL_KEY);
    memDecr(uKey);
    return { ok: false, reason: "user-quota" };
  }
  return {
    ok: true,
    commit: async () => {},
    release: async () => {
      memDecr(GLOBAL_KEY);
      memDecr(uKey);
    },
  };
}
