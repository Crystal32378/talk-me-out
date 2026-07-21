import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  getYouCamConfig,
  mapGarmentTypeToCategory,
  runFullTryOn,
  YouCamError,
} from "@/lib/youcam-client";

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
 *   - person: File (JPG/PNG/WebP, max ~10 MB)
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
const MAX_BYTES = 10 * 1024 * 1024;

/** Normalise any image buffer to JPEG so we always send a consistent type to YouCam. */
async function normalizeToJpeg(
  buffer: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  // sharp auto-detects format from the buffer contents.
  const out = await sharp(buffer)
    .flatten({ background: "#ffffff" }) // remove alpha for JPEG
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return { buffer: out, contentType: "image/jpeg" };
}

async function buildDemoComposite(
  personBuffer: Buffer,
  garmentBuffer: Buffer,
): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  try {
    const person = await sharp(personBuffer)
      .resize(768, 1024, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90 })
      .toBuffer();

    const garmentSticker = await sharp(garmentBuffer)
      .resize(560, 560, { fit: "inside", withoutEnlargement: true })
      .extend({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const composited = await sharp(person)
      .composite([
        {
          input: garmentSticker,
          top: 180,
          left: 104,
          blend: "over",
        },
      ])
      .jpeg({ quality: 88 })
      .toBuffer();

    const labelSvg = Buffer.from(
      `<svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="950" width="768" height="74" fill="rgba(0,0,0,0.78)"/>
        <text x="384" y="996" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="26" letter-spacing="4" fill="#FF3B30">DEMO MODE — PRE-GENERATED RESULT</text>
      </svg>`,
    );

    const finalBuf = await sharp(composited)
      .composite([{ input: labelSvg, top: 0, left: 0, blend: "over" }])
      .jpeg({ quality: 86 })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${finalBuf.toString("base64")}`;
    return { ok: true, imageUrl: dataUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Demo compositing failed: ${msg}` };
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
        { ok: false, error: "size", message: "Image exceeds 10 MB limit." },
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
      const p = await normalizeToJpeg(personBufferRaw, personFile.type);
      personBuffer = p.buffer;
      personContentType = p.contentType;
      const g = await normalizeToJpeg(garmentBufferRaw, garmentFile.type);
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
        const elapsed = Date.now() - tStart;
        return NextResponse.json({
          ok: true,
          imageUrl: result.imageUrl,
          demo: false,
          fallback: false,
          unitsUsed: result.unitsUsed,
          elapsedMs: elapsed,
        });
      } catch (err) {
        const code = classifyError(err);
        // Fall through to demo mode. Only the machine-readable error code is
        // returned to the client; the raw error message is kept server-side
        // to avoid leaking YouCam internal details.
        const demo = await buildDemoComposite(personBufferRaw, garmentBufferRaw);
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
    const demo = await buildDemoComposite(personBufferRaw, garmentBufferRaw);
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
