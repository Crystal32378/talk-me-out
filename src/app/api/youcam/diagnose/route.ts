import { NextResponse } from "next/server";
import { getYouCamConfig } from "@/lib/youcam-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/youcam/diagnose
 *
 * Temporary diagnostic endpoint. Calls the YouCam API's /file/cloth
 * endpoint with a minimal request and returns the full response,
 * including HTTP status and body. This helps debug why the real API
 * fails on Vercel but works locally.
 *
 * This endpoint does NOT return the API key. It only returns:
 *   - configured status
 *   - HTTP status from YouCam
 *   - Response body from YouCam (truncated)
 *   - Timing info
 *   - Node.js version
 */
export async function GET() {
  const config = getYouCamConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      error: "YOUCAM_API_KEY not set",
    });
  }

  const tStart = Date.now();
  try {
    const body = JSON.stringify({
      files: [
        {
          file_name: "test.jpg",
          file_size: 1000,
          content_type: "image/jpeg",
        },
      ],
    });

    const res = await fetch(`${config.baseUrl}/s2s/v2.0/file/cloth`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const text = await res.text();
    const elapsed = Date.now() - tStart;

    return NextResponse.json({
      configured: true,
      baseUrl: config.baseUrl,
      keyLength: config.apiKey.length,
      youcamHttpStatus: res.status,
      youcamResponse: text.slice(0, 500),
      elapsedMs: elapsed,
      nodeVersion: process.version,
      platform: process.platform,
      runtime: "nodejs",
    });
  } catch (err) {
    const elapsed = Date.now() - tStart;
    return NextResponse.json({
      configured: true,
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : "Unknown",
      elapsedMs: elapsed,
      nodeVersion: process.version,
      platform: process.platform,
    });
  }
}
