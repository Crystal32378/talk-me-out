"use client";

/**
 * Device-local growth state: try-on credits + anonymous identity + referral.
 *
 * DoraHacks 2.0 scarcity mechanic (decided 2026-08-22):
 *   - Everyone starts with 2 try-on credits.
 *   - A successful "Ask a Friend" share unlocks +3.
 *   - Hard cap: 5 credits total, ever. Extra shares never mint more.
 *
 * Everything here is localStorage-backed and anonymous — no account, no
 * cookie, no server-side identity. The anonId exists only so the referral
 * funnel can be counted; it is random and carries no personal data.
 */

const LS_ANON = "tmoi.anonId";
const LS_CREDITS = "tmoi.credits";
const LS_BONUS_USED = "tmoi.shareBonusUsed";
const LS_REF = "tmoi.ref";
const LS_SRC = "tmoi.src";

export const INITIAL_CREDITS = 2;
export const SHARE_BONUS = 3;
export const HARD_CAP = 5;

export const CREDITS_CHANGED_EVENT = "tmoi-credits-changed";

interface CreditState {
  /** Total credits ever granted on this device (2 initial, up to HARD_CAP). */
  granted: number;
  /** Real (non-cached, non-demo) try-ons consumed. */
  used: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readJSON<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — degrade silently; credits become session-only.
  }
}

function notifyCreditsChanged(): void {
  if (isBrowser()) window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

export function getAnonId(): string {
  if (!isBrowser()) return "server";
  let id = localStorage.getItem(LS_ANON);
  if (!id) {
    id = Math.random().toString(36).slice(2, 12);
    try {
      localStorage.setItem(LS_ANON, id);
    } catch {
      // Fall through with the in-memory id for this session.
    }
  }
  return id;
}

function getCreditState(): CreditState {
  const s = readJSON<CreditState>(LS_CREDITS);
  if (
    s &&
    typeof s.granted === "number" &&
    typeof s.used === "number" &&
    s.granted >= INITIAL_CREDITS &&
    s.granted <= HARD_CAP &&
    s.used >= 0
  ) {
    return s;
  }
  return { granted: INITIAL_CREDITS, used: 0 };
}

export function remainingTryOns(): number {
  const s = getCreditState();
  return Math.max(0, s.granted - s.used);
}

export function grantedTryOns(): number {
  return getCreditState().granted;
}

/** Consume one credit after a REAL VTO succeeds (never for cache/demo). */
export function consumeTryOn(): void {
  const s = getCreditState();
  writeJSON(LS_CREDITS, { ...s, used: s.used + 1 });
  notifyCreditsChanged();
}

/**
 * Grant the share bonus. Two independent guards, per the product spec:
 * the bonus can only ever fire ONCE per device, and the total can never
 * exceed HARD_CAP. Returns the credits actually added (0 when already
 * used or capped) so callers only fire `bonus_unlocked` when something
 * really unlocked.
 */
export function grantShareBonus(): number {
  if (!isBrowser()) return 0;
  if (localStorage.getItem(LS_BONUS_USED)) return 0;
  const s = getCreditState();
  const nextGranted = Math.min(HARD_CAP, s.granted + SHARE_BONUS);
  const added = nextGranted - s.granted;
  if (added > 0) {
    writeJSON(LS_CREDITS, { ...s, granted: nextGranted });
    try {
      localStorage.setItem(LS_BONUS_USED, "1");
    } catch {
      // ignore — the cap still prevents repeat minting
    }
    notifyCreditsChanged();
  }
  return added;
}

/**
 * Capture ?ref= / ?src= once on landing (first-touch wins) so the
 * referral funnel survives navigation. Returns what was newly captured.
 */
export function captureAttribution(): { ref: string | null; src: string | null; isNewRef: boolean } {
  if (!isBrowser()) return { ref: null, src: null, isNewRef: false };
  const params = new URLSearchParams(window.location.search);
  const incomingRef = params.get("ref");
  const incomingSrc = params.get("src");
  const own = getAnonId();

  let isNewRef = false;
  if (incomingRef && incomingRef !== own && !localStorage.getItem(LS_REF)) {
    try {
      localStorage.setItem(LS_REF, incomingRef);
      isNewRef = true;
    } catch {
      // ignore
    }
  }
  if (incomingSrc && !localStorage.getItem(LS_SRC)) {
    try {
      localStorage.setItem(LS_SRC, incomingSrc);
    } catch {
      // ignore
    }
  }
  return {
    ref: localStorage.getItem(LS_REF),
    src: localStorage.getItem(LS_SRC),
    isNewRef,
  };
}

export function getAttribution(): { ref: string | null; src: string | null } {
  if (!isBrowser()) return { ref: null, src: null };
  return { ref: localStorage.getItem(LS_REF), src: localStorage.getItem(LS_SRC) };
}

/** Referral link this device hands to friends. */
export function buildReferralUrl(src = "friend"): string {
  const origin = isBrowser() ? window.location.origin : "https://talk-me-out.vercel.app";
  return `${origin}/?ref=${getAnonId()}&src=${src}`;
}
