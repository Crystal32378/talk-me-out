"use client";

/**
 * Client-side share-card composition for "Ask a Friend".
 *
 * The card is rendered entirely in the browser with <canvas>. The friend
 * sees the image directly in LINE / WhatsApp / iMessage next to the
 * referral link. We never upload the card or store the user's portrait on
 * our own servers. (YouCam's processing of try-on photos is separate and
 * covered by the existing privacy disclosure — do not describe this app
 * as "on-device only".)
 */

import { buildReferralUrl, grantShareBonus } from "./growth";
import { track } from "./analytics";

export interface ShareLookInput {
  /** Try-on result image (data URL). Optional — text-only share without it. */
  imageUrl?: string | null;
  garmentName?: string | null;
  /** Binary decision to stamp on the card, when a verdict exists. */
  decision?: "TRY_IRL" | "SKIP" | null;
  score?: number | null;
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "failed";

export interface AskFriendResult {
  outcome: ShareOutcome;
  /** Credits actually unlocked by this share (0 when capped or cancelled). */
  bonusAdded: number;
}

const CARD_W = 1080;
const CARD_H = 1440;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("share-card-image-load-failed"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

async function composeCard(input: ShareLookInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas-context");

  // Base: try-on image, or the brand dark ground when there is none.
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (input.imageUrl) {
    const img = await loadImage(input.imageUrl);
    drawCover(ctx, img, CARD_W, CARD_H);
  }

  // Legibility gradient behind the footer.
  const grad = ctx.createLinearGradient(0, CARD_H - 460, 0, CARD_H);
  grad.addColorStop(0, "rgba(10,10,10,0)");
  grad.addColorStop(0.45, "rgba(10,10,10,0.78)");
  grad.addColorStop(1, "rgba(10,10,10,0.96)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, CARD_H - 460, CARD_W, 460);

  const display = `"Space Grotesk", "Inter", system-ui, sans-serif`;

  // Verdict stamp — the product's signature mark, slightly rotated.
  if (input.decision) {
    const isTry = input.decision === "TRY_IRL";
    const stampText = isTry ? "WORTH TRYING IN PERSON" : "SKIP IT";
    const color = isTry ? "#30D158" : "#FF3B30";
    ctx.save();
    ctx.translate(CARD_W / 2, 200);
    ctx.rotate((-6 * Math.PI) / 180);
    ctx.font = `700 ${isTry ? 56 : 84}px ${display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(stampText);
    const padX = 36;
    const padY = 28;
    const bw = metrics.width + padX * 2;
    const bh = (isTry ? 56 : 84) + padY * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.fillStyle = "rgba(10,10,10,0.55)";
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = color;
    ctx.fillText(stampText, 0, 4);
    ctx.restore();
  }

  // Footer copy — Ask-a-Friend framing, not a judgment broadcast.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = CARD_H - 300;

  if (input.garmentName) {
    ctx.font = `600 34px ${display}`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(input.garmentName.slice(0, 44), 64, y);
    y += 62;
  }

  ctx.font = `700 52px ${display}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Should I actually buy this?", 64, y);
  y += 58;

  ctx.font = `400 32px ${display}`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Be my second opinion.", 64, y);

  // Brand line.
  ctx.font = `700 30px ${display}`;
  ctx.fillStyle = "#FF3B30";
  ctx.fillText("TALK ME OUT OF IT", 64, CARD_H - 96);
  ctx.font = `400 26px ${display}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  const host = window.location.host || "talk-me-out.vercel.app";
  ctx.fillText(host, 64, CARD_H - 52);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("share-card-encode-failed");
  return blob;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Firefox can reject Clipboard API writes after the async canvas work
    // above has consumed the original click activation. Keep a synchronous
    // selection fallback so the desktop download path still hands the user
    // the referral link it claims to share.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * The whole "Ask a Friend" action: compose card → native share (image +
 * referral link in one message) → on success, record the share and unlock
 * the +3 bonus (hard-capped at 5 total).
 *
 * Fallback without Web Share (mostly desktop): download the card and copy
 * the referral link, and treat it as a successful share — we cannot verify
 * the actual send, and punishing desktop users would just kill the loop.
 */
export async function askAFriend(input: ShareLookInput): Promise<AskFriendResult> {
  const url = buildReferralUrl();
  const text = `Should I actually buy this? Be my second opinion: ${url}`;

  let card: Blob | null = null;
  if (input.imageUrl) {
    try {
      card = await composeCard(input);
    } catch {
      card = null; // Text-only share still works.
    }
  }

  const finalize = (outcome: "shared" | "downloaded", method: string): AskFriendResult => {
    track("share", { method, hasCard: !!card, decision: input.decision ?? "none" });
    const bonusAdded = grantShareBonus();
    if (bonusAdded > 0) {
      track("bonus_unlocked", { added: bonusAdded });
    }
    return { outcome, bonusAdded };
  };

  if (typeof navigator.share === "function") {
    const files = card ? [new File([card], "tmoi-look.jpg", { type: "image/jpeg" })] : undefined;
    const withFiles =
      files && typeof navigator.canShare === "function" && navigator.canShare({ files });
    try {
      if (withFiles) {
        await navigator.share({ files, text, url });
      } else {
        await navigator.share({ text, url });
      }
      return finalize("shared", withFiles ? "native-image" : "native-text");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { outcome: "cancelled", bonusAdded: 0 };
      }
      // Fall through to the download path on real share failures.
    }
  }

  const copied = await copyText(text);
  if (card) {
    downloadBlob(card, "tmoi-look.jpg");
    // A downloaded image without its referral link is not a completed
    // distribution action. Do not mint bonus credits or count a share when
    // the browser blocked both clipboard strategies.
    if (!copied) return { outcome: "failed", bonusAdded: 0 };
    return finalize("downloaded", "download+copy");
  }
  if (copied) {
    return finalize("downloaded", "copy-only");
  }
  return { outcome: "failed", bonusAdded: 0 };
}
