import { NextResponse } from "next/server";
import { getYouCamConfig } from "@/lib/youcam-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/youcam/status
 *
 * Reports whether the YouCam API is configured.
 *
 * Security: this endpoint NEVER reveals the API key, key prefix, or key
 * length — only a boolean `configured` flag plus the public base URL.
 */
export async function GET() {
  const config = getYouCamConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      baseUrl: null,
      hint: "Set YOUCAM_API_KEY in .env.local to enable real YouCam API calls.",
    });
  }
  return NextResponse.json({
    configured: true,
    baseUrl: config.baseUrl,
  });
}
