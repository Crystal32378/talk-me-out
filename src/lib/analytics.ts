"use client";

/**
 * Anonymous, fire-and-forget event tracking for the DoraHacks funnel:
 *
 *   visitor → successful_tryon → share → bonus_unlocked → referral_open → feedback
 *
 * Nothing here identifies a person: only the random device anonId, the
 * referrer's anonId (if any), and a coarse source tag. Question answers
 * and photos are never sent.
 */

import { captureAttribution, getAnonId, getAttribution } from "./growth";

export type FunnelEvent =
  | "visitor"
  | "successful_tryon"
  | "share"
  | "bonus_unlocked"
  | "referral_open"
  | "feedback";

export function track(event: FunnelEvent, meta?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  const { ref, src } = getAttribution();
  const payload = JSON.stringify({
    event,
    anonId: getAnonId(),
    ref: ref ?? undefined,
    src: src ?? undefined,
    meta,
    ts: Date.now(),
  });
  try {
    // keepalive lets the beacon survive page transitions (share sheets etc.)
    void fetch("/api/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never break the product.
  }
}

/**
 * Landing bootstrap: capture ?ref/?src, then fire `visitor` once per
 * browser session and `referral_open` once per device (first-touch).
 */
export function initGrowthTracking(): void {
  if (typeof window === "undefined") return;
  const { isNewRef } = captureAttribution();

  try {
    if (!sessionStorage.getItem("tmoi.visitorTracked")) {
      sessionStorage.setItem("tmoi.visitorTracked", "1");
      track("visitor");
    }
  } catch {
    track("visitor");
  }

  if (isNewRef) {
    track("referral_open");
  }
}
