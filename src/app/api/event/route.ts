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

const MAX_BODY = 2_048;
const ID_PATTERN = /^[a-z0-9-]{1,32}$/i;

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
  if (payload.event === "referral_open" && payload.ref) {
    commands.push(["INCR", `tmoi:ref:${payload.ref}`]);
  }
  if (payload.event === "feedback") {
    commands.push(["LPUSH", "tmoi:feedback", record], ["LTRIM", "tmoi:feedback", "0", "999"]);
  }

  const stored = await redisPipeline(commands);
  if (!stored) {
    // Log-drain fallback — still recoverable from Vercel logs.
    console.log("[tmoi-event]", record);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Funnel snapshot: total + today per event. Requires the Redis sink; the
 * numbers are anonymous aggregates, so exposing them is harmless — and
 * during Dora judging they double as public traction evidence.
 */
export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return NextResponse.json(
      { ok: false, reason: "no-storage-configured" },
      { status: 501 },
    );
  }
  const day = new Date().toISOString().slice(0, 10);
  const names = [...EVENTS];
  const commands = names.flatMap((e) => [
    ["GET", `tmoi:count:${e}`],
    ["GET", `tmoi:count:${e}:${day}`],
  ]);
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
    const data = (await res.json()) as Array<{ result: string | null }>;
    const funnel: Record<string, { total: number; today: number }> = {};
    names.forEach((e, i) => {
      funnel[e] = {
        total: Number(data[i * 2]?.result ?? 0),
        today: Number(data[i * 2 + 1]?.result ?? 0),
      };
    });
    return NextResponse.json({ ok: true, day, funnel });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
