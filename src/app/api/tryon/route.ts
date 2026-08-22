import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import {
  getYouCamConfig,
  mapGarmentTypeToCategory,
  runFullTryOn,
  YouCamError,
} from "@/lib/youcam-client";
import { reserveGeneration } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * YouCam Apparel VTO proxy.
 *
 * Security: the YouCam API key is read from a server-side environment
 * variable (YOUCAM_API_KEY) and is NEVER exposed to the browser. The
 * browser only ever talks to this route. Error responses return only
 * machine-readable error codes, never raw upstream messages.
 *
 * Behaviour:
 *   - If YOUCAM_API_KEY is configured, the route runs the full YouCam
 *     async flow (upload person, upload garment, create task, poll for
 *     result) and returns the real YouCam-generated image.
 *   - If YouCam is not configured, OR if a real YouCam call fails, the
 *     route falls back to DEMO MODE: a sharp-composited overlay of the
 *     garment on the person photo, clearly labeled
 *     "DEMO MODE — PRE-GENERATED RESULT".
 *   - If even demo compositing fails, the route returns `fallback: true`
 *     so the client renders a clearly-labeled side-by-side preview.
 *
 * Expected form fields:
 *   - person: File (JPG/PNG/WebP, max 2 MB after client compression)
 *   - garment: File
 *   - garmentType: string ("Top" | "Outerwear" | "Dress" | "Bottom" | "Unsure")
 *
 * Response (JSON):
 *   {
 *     ok: boolean,
 *     imageUrl: string,        // data URL of the generated try-on
 *     demo: boolean,           // true if demo mode (NOT a real YouCam result)
 *     fallback: boolean,       // true if even demo compositing failed
 *     unitsUsed?: number,      // YouCam units consumed (real API only; usually null)
 *     elapsedMs?: number,      // total processing time (real API only)
 *     youcamError?: string,    // machine-readable error code if YouCam failed
 *     error?: string,          // machine-readable error code for client errors
 *   }
 */

const ACCEPTED_PERSON = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_GARMENT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 2_500_000;

/** Normalise any image buffer to JPEG so we always send a consistent type to YouCam. */
async function normalizeToJpeg(
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  // sharp auto-detects format from the buffer contents.
  const out = await sharp(buffer)
    .rotate()
    .resize({
      width: 1600,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  return { buffer: out, contentType: "image/jpeg" };
}

async function compressResponseDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("invalid-result-data-url");

  let width = 1400;
  let quality = 84;
  const source = Buffer.from(match[1], "base64");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const output = await sharp(source)
      .rotate()
      .resize({ width, height: Math.round(width * 1.34), fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (output.length <= MAX_RESPONSE_BYTES || attempt === 3) {
      return `data:image/jpeg;base64,${output.toString("base64")}`;
    }
    width = Math.round(width * 0.82);
    quality = Math.max(68, quality - 6);
  }

  throw new Error("result-compression-failed");
}

/**
 * Demo fallback: returns a pre-generated real YouCam try-on result.
 *
 * This image was produced by a real, successful YouCam Apparel VTO API
 * call (person photo + beige wool coat → AI-generated try-on composite)
 * and saved to public/demo/fallback-result.jpg. It is clearly labeled
 * "DEMO MODE — PRE-GENERATED RESULT" so it can never be confused with
 * a fresh API call.
 *
 * The pre-generated result depicts a specific person + garment pair.
 * When demo mode is triggered, we return this image as-is — the UI
 * explains that the user's uploaded photos were NOT sent to YouCam
 * and that this is a pre-generated demonstration result. This is more
 * honest and visually correct than the previous approach of compositing
 * the garment over the user's face.
 *
 * The person and garment source images are also shipped in public/demo/
 * so reviewers can verify the trio matches.
 */
async function buildDemoComposite(): Promise<{
  ok: true;
  imageUrl: string;
} | { ok: false; error: string }> {
  try {
    const demoResultPath = path.join(
      process.cwd(),
      "public",
      "demo",
      "fallback-result.jpg",
    );
    const buf = await readFile(demoResultPath);

    // Overlay a clear DEMO MODE label.
    const labelSvg = Buffer.from(
      `<svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="950" width="768" height="74" fill="rgba(0,0,0,0.78)"/>
        <text x="384" y="996" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="26" letter-spacing="4" fill="#FF3B30">DEMO MODE — PRE-GENERATED RESULT</text>
      </svg>`,
    );

    const finalBuf = await sharp(buf)
      .resize(768, 1024, { fit: "cover", position: "centre" })
      .composite([{ input: labelSvg, top: 0, left: 0, blend: "over" }])
      .jpeg({ quality: 88 })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${finalBuf.toString("base64")}`;
    return { ok: true, imageUrl: dataUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Demo fallback failed: ${msg}` };
  }
}

function classifyError(err: unknown): string {
  if (err instanceof YouCamError) return err.code;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("timed out") || msg.includes("aborted")) return "timeout";
  if (msg.includes("person") || msg.includes("invalid person")) return "invalid-person";
  if (msg.includes("garment") || msg.includes("invalid garment")) return "invalid-garment";
  if (msg.includes("unrecognized") || msg.includes("empty") || msg.includes("malformed"))
    return "empty";
  return "api";
}

export async function POST(req: NextRequest) {
  const tStart = Date.now();

  try {
    const formData = await req.formData();
    const personFile = formData.get("person");
    const garmentFile = formData.get("garment");
    const garmentType = (formData.get("garmentType") as string) ?? "Unsure";

    if (!(personFile instanceof File) || personFile.size === 0) {
      return NextResponse.json(
        { ok: false, error: "invalid-person", message: "Missing or empty person image." },
        { status: 400 },
      );
    }
    if (!(garmentFile instanceof File) || garmentFile.size === 0) {
      return NextResponse.json(
        { ok: false, error: "invalid-garment", message: "Missing or empty garment image." },
        { status: 400 },
      );
    }
    if (!ACCEPTED_PERSON.includes(personFile.type)) {
      return NextResponse.json(
        { ok: false, error: "invalid-person", message: `Unsupported person image type: ${personFile.type}` },
        { status: 400 },
      );
    }
    if (!ACCEPTED_GARMENT.includes(garmentFile.type)) {
      return NextResponse.json(
        { ok: false, error: "invalid-garment", message: `Unsupported garment image type: ${garmentFile.type}` },
        { status: 400 },
      );
    }
    if (personFile.size > MAX_BYTES || garmentFile.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "size", message: "Compressed image exceeds 2 MB limit." },
        { status: 400 },
      );
    }

    const personBufferRaw = Buffer.from(await personFile.arrayBuffer());
    const garmentBufferRaw = Buffer.from(await garmentFile.arrayBuffer());

    // Normalize both to JPEG for YouCam (its /file/cloth endpoint accepts image/jpeg or image/png).
    let personBuffer: Buffer;
    let personContentType: "image/jpeg" | "image/png";
    let garmentBuffer: Buffer;
    let garmentContentType: "image/jpeg" | "image/png";
    try {
      const p = await normalizeToJpeg(personBufferRaw);
      personBuffer = p.buffer;
      personContentType = p.contentType;
      const g = await normalizeToJpeg(garmentBufferRaw);
      garmentBuffer = g.buffer;
      garmentContentType = g.contentType;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      return NextResponse.json(
        { ok: false, error: "normalize-failed", message: `Image normalization failed: ${msg}` },
        { status: 400 },
      );
    }

    // 1) Try real YouCam API if configured.
    const config = getYouCamConfig();
    if (config) {
      // Budget guardrail — enforced BEFORE the upstream call so reloads
      // or a cleared localStorage cannot burn YouCam credits. The user
      // bucket keys on the device's anonId; requests without one share a
      // per-IP bucket so the header cannot simply be dropped to bypass it.
      const anonHeader = req.headers.get("x-tmoi-anon") ?? "";
      const quotaId = /^[a-z0-9-]{1,32}$/i.test(anonHeader)
        ? anonHeader
        : `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;
      const quota = await reserveGeneration(quotaId);
      if (!quota.ok) {
        if (quota.reason === "global-quota") {
          // The launch budget is spent. Never call YouCam again; keep the
          // product demoable via the clearly-labeled pre-generated result.
          const demo = await buildDemoComposite();
          if (demo.ok) {
            return NextResponse.json({
              ok: true,
              imageUrl: demo.imageUrl,
              demo: true,
              fallback: false,
              youcamError: "quota-exhausted",
            });
          }
          return NextResponse.json(
            { ok: false, error: "quota-exhausted", fallback: true },
            { status: 429 },
          );
        }
        return NextResponse.json(
          { ok: false, error: "user-quota", fallback: true },
          { status: 429 },
        );
      }

      // True once YouCam itself has produced a result — from that point the
      // upstream credits are spent, so the reservation must never be
      // refunded even if later post-processing (compression) fails.
      let generated = false;
      try {
        const result = await runFullTryOn(
          config,
          {
            personBuffer,
            personContentType,
            garmentBuffer,
            garmentContentType,
            garmentCategory: mapGarmentTypeToCategory(
              garmentType as "Top" | "Outerwear" | "Dress" | "Bottom" | "Unsure",
            ),
          },
          { intervalMs: 2000, timeoutMs: 55_000 },
        );
        generated = true;
        // Success — the reservation stands (successful generations count).
        await quota.commit();
        const elapsed = Date.now() - tStart;
        return NextResponse.json({
          ok: true,
          imageUrl: await compressResponseDataUrl(result.imageUrl),
          demo: false,
          fallback: false,
          unitsUsed: result.unitsUsed,
          elapsedMs: elapsed,
        });
      } catch (err) {
        // Refund only when the generation itself failed — failures are
        // free by spec, but a post-generation error already spent credits.
        if (!generated) {
          await quota.release();
        }
        const code = classifyError(err);
        // Fall through to demo mode. Only the machine-readable error code is
        // returned to the client; the raw error message is kept server-side
        // to avoid leaking YouCam internal details.
        const demo = await buildDemoComposite();
        if (demo.ok) {
          return NextResponse.json({
            ok: true,
            imageUrl: demo.imageUrl,
            demo: true,
            fallback: false,
            youcamError: code,
          });
        }
        return NextResponse.json({
          ok: false,
          error: code,
          fallback: true,
        });
      }
    }

    // 2) No YouCam config — straight to demo mode.
    const demo = await buildDemoComposite();
    if (demo.ok) {
      return NextResponse.json({
        ok: true,
        imageUrl: demo.imageUrl,
        demo: true,
        fallback: false,
      });
    }
    return NextResponse.json({
      ok: false,
      error: "demo-failed",
      fallback: true,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "server", fallback: true },
      { status: 500 },
    );
  }
}

export async function GET() {
  const config = getYouCamConfig();
  return NextResponse.json({
    name: "Talk Me Out of It — YouCam Try-On Proxy",
    youcamConfigured: !!config,
    demoMode: !config,
    youcamBaseUrl: config?.baseUrl ?? YOUCAM_DEFAULT_BASE,
    endpoints: {
      POST: "Accepts multipart/form-data with `person`, `garment`, `garmentName`, and optional `garmentType` fields.",
    },
  });
}

const YOUCAM_DEFAULT_BASE = "https://yce-api-01.makeupar.com";
