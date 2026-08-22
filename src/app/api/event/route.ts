import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Anonymous funnel-event sink for the DoraHacks launch:
 *
 *   visitor → successful_tryon → share → bonus_unlocked → referral_open → feedback
 *
 * Storage: Upstash Redis via REST when UPSTASH_REDIS_REST_URL/TOKEN are
 * configured; otherwise events land in the deployment log (still countable
 * for a hackathon). Deliberately NOT an analytics platform — six counters
 * and a short recent-event log are all the loop needs.
 *
 * Privacy: accepts only whitelisted event names, a random device id, a
 * referrer id, a coarse source tag and a small meta object. Question
 * answers and images are never sent here (see analytics.ts).
 */

const EVENTS = new Set([
  "visitor",
  "successful_tryon",
  "share",
  "bonus_unlocked",
  "referral_open",
  "feedback",
]);

/**
 * Unique-user sets (SADD/SCARD) — Dora evidence needs "number of users",
 * not just event counts. Keyed by the anonymous device id.
 * successful_tryon only ever fires for mode:"live" generations (the
 * client gates on the server's mode field), so unique_tryon_users can
 * never be inflated by demo/fallback traffic.
 */
const UNIQUE_SETS: Record<string, string> = {
  visitor: "tmoi:uniq:visitors",
  successful_tryon: "tmoi:uniq:tryon_users",
  feedback: "tmoi:uniq:feedback_users",
  referral_open: "tmoi:uniq:referred_visitors",
};

const MAX_BODY = 2_048;
const ID_PATTERN = /^[a-z0-9-]{1,32}$/i;

// In-memory mirror for development/smoke tests ONLY. Per serverless
// instance, wiped on restart — NOT production-safe. Production requires
// Upstash Redis (see deployment guardrail in .env.example).
const memCounts = new Map<string, number>();
const memSets = new Map<string, Set<string>>();

function memRecord(event: string, day: string, anonId: string): void {
  memCounts.set(`${event}`, (memCounts.get(`${event}`) ?? 0) + 1);
  memCounts.set(`${event}:${day}`, (memCounts.get(`${event}:${day}`) ?? 0) + 1);
  const setKey = UNIQUE_SETS[event];
  if (setKey) {
    const set = memSets.get(setKey) ?? new Set<string>();
    set.add(anonId);
    memSets.set(setKey, set);
  }
}

interface EventPayload {
  event: string;
  anonId: string;
  ref?: string;
  src?: string;
  meta?: Record<string, string | number | boolean>;
  ts?: number;
}

async function redisPipeline(commands: string[][]): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
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
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let payload: EventPayload;
  try {
    payload = JSON.parse(raw) as EventPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!EVENTS.has(payload.event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!ID_PATTERN.test(payload.anonId ?? "")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (payload.ref && !ID_PATTERN.test(payload.ref)) delete payload.ref;
  if (payload.src) payload.src = String(payload.src).slice(0, 32);

  const day = new Date().toISOString().slice(0, 10);
  const record = JSON.stringify({
    e: payload.event,
    a: payload.anonId,
    r: payload.ref,
    s: payload.src,
    m: payload.meta,
    t: payload.ts ?? Date.now(),
  });

  const commands: string[][] = [
    ["INCR", `tmoi:count:${payload.event}`],
    ["INCR", `tmoi:count:${payload.event}:${day}`],
    ["LPUSH", "tmoi:log", record],
    ["LTRIM", "tmoi:log", "0", "4999"],
  ];
  const setKey = UNIQUE_SETS[payload.event];
  if (setKey) {
    commands.push(["SADD", setKey, payload.anonId]);
  }
  if (payload.event === "referral_open" && payload.ref) {
    commands.push(["INCR", `tmoi:ref:${payload.ref}`]);
  }
  if (payload.event === "feedback") {
    commands.push(["LPUSH", "tmoi:feedback", record], ["LTRIM", "tmoi:feedback", "0", "999"]);
  }

  const stored = await redisPipeline(commands);
  if (!stored) {
    // Dev fallback: in-memory mirror + log drain (recoverable from logs).
    memRecord(payload.event, day, payload.anonId);
    console.log("[tmoi-event]", record);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Funnel snapshot: total + today per event, plus the unique-user numbers
 * Dora evidence actually needs (e.g. "73 unique visitors, 58 unique real
 * try-on users, 21 shares, 14 unique referred visitors, 34 unique
 * feedback users"). Anonymous aggregates only.
 *
 * backend:"redis" is the production truth. backend:"memory" is the
 * per-instance dev fallback — never cite those numbers as evidence.
 */
export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const day = new Date().toISOString().slice(0, 10);
  const names = [...EVENTS];
  const uniqueNames: Array<[string, string]> = [
    ["unique_visitors", UNIQUE_SETS.visitor],
    ["unique_tryon_users", UNIQUE_SETS.successful_tryon],
    ["unique_feedback_users", UNIQUE_SETS.feedback],
    ["unique_referred_visitors", UNIQUE_SETS.referral_open],
  ];

  if (!url || !token) {
    // Dev-only view of the in-memory mirror, clearly labeled.
    const funnel: Record<string, { total: number; today: number }> = {};
    for (const e of names) {
      funnel[e] = {
        total: memCounts.get(e) ?? 0,
        today: memCounts.get(`${e}:${day}`) ?? 0,
      };
    }
    const unique: Record<string, number> = {};
    for (const [label, key] of uniqueNames) {
      unique[label] = memSets.get(key)?.size ?? 0;
    }
    return NextResponse.json({ ok: true, backend: "memory", day, funnel, unique });
  }

  const commands = [
    ...names.flatMap((e) => [
      ["GET", `tmoi:count:${e}`],
      ["GET", `tmoi:count:${e}:${day}`],
    ]),
    ...uniqueNames.map(([, key]) => ["SCARD", key]),
  ];
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
    if (!res.ok) throw new Error("pipeline-failed");
    const data = (await res.json()) as Array<{ result: string | number | null }>;
    const funnel: Record<string, { total: number; today: number }> = {};
    names.forEach((e, i) => {
      funnel[e] = {
        total: Number(data[i * 2]?.result ?? 0),
        today: Number(data[i * 2 + 1]?.result ?? 0),
      };
    });
    const unique: Record<string, number> = {};
    uniqueNames.forEach(([label], i) => {
      unique[label] = Number(data[names.length * 2 + i]?.result ?? 0);
    });
    return NextResponse.json({ ok: true, backend: "redis", day, funnel, unique });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
