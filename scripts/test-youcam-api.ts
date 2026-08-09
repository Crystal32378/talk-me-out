/**
 * P0 Verification Script — Talk Me Out of It × YouCam Apparel VTO
 *
 * Run with:
 *   YOUCAM_API_KEY=your_real_key bun run scripts/test-youcam-api.ts
 *
 * Or, if you have .env.local with YOUCAM_API_KEY set, the script will
 * automatically pick it up (Next.js loads .env.local for the dev server,
 * but bun run does NOT — so pass the key explicitly via env, or source
 * your .env.local first).
 *
 * What this script does:
 *   1. Reads YOUCAM_API_KEY from process.env.
 *   2. Picks a person photo (public/sample-person.jpg) and a garment
 *      image (public/garments/beige-coat.jpg).
 *   3. Runs the full YouCam async flow:
 *        a. POST /s2s/v2.0/file/cloth  → get upload URL for person
 *        b. PUT <upload URL>            → upload person bytes
 *        c. POST /s2s/v2.0/file/cloth  → get upload URL for garment
 *        d. PUT <upload URL>            → upload garment bytes
 *        e. POST /s2s/v2.0/task/cloth   → create try-on task
 *        f. GET  /s2s/v2.0/task/cloth/{task_id} → poll for result
 *   4. Saves the result image to download/youcam-real-result.jpg
 *   5. Prints: HTTP status, elapsed time, units consumed, response shape.
 *
 * This script NEVER prints the API key. It only prints the first 4 chars
 * (prefix) so you can confirm which key was used.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  getYouCamConfig,
  mapGarmentTypeToCategory,
  runFullTryOn,
  YouCamError,
} from "../src/lib/youcam-client";

// We need to load .env.local manually because `bun run` does not do it.
async function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const txt = await readFile(envPath, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  await loadEnvLocal();

  const config = getYouCamConfig();
  if (!config) {
    console.error("❌ YOUCAM_API_KEY is not set.");
    console.error("   Set it in .env.local or pass via env:");
    console.error("   YOUCAM_API_KEY=xxx bun run scripts/test-youcam-api.ts");
    process.exit(1);
  }

  console.log("=== YouCam Apparel VTO — P0 Verification ===");
  console.log(`Base URL:    ${config.baseUrl}`);
  console.log(`API Key:     ${config.apiKey.slice(0, 4)}${"*".repeat(Math.max(0, config.apiKey.length - 4))} (${config.apiKey.length} chars)`);
  console.log("");

  const personPath = path.join(process.cwd(), "public", "sample-person-real.jpg");
  // Use one of the Crystal's Closet garments as the default test garment.
  // The sage utility jacket exercises the Outerwear / upper_body mapping and
  // produces a stable, easy-to-judge VTO result.
  const garmentPath = path.join(process.cwd(), "public", "garments", "sage-utility-jacket.jpg");

  if (!existsSync(personPath)) {
    console.error(`❌ Person photo not found: ${personPath}`);
    process.exit(1);
  }
  if (!existsSync(garmentPath)) {
    console.error(`❌ Garment image not found: ${garmentPath}`);
    process.exit(1);
  }

  const personBuffer = await readFile(personPath);
  const garmentBuffer = await readFile(garmentPath);
  console.log(`Person:      ${personPath} (${personBuffer.length} bytes)`);
  console.log(`Garment:     ${garmentPath} (${garmentBuffer.length} bytes)`);
  console.log("");

  const tStart = Date.now();
  try {
    const result = await runFullTryOn(
      config,
      {
        personBuffer,
        personContentType: "image/jpeg",
        garmentBuffer,
        garmentContentType: "image/jpeg",
        garmentCategory: mapGarmentTypeToCategory("Outerwear"),
      },
      {
        intervalMs: 3000,
        timeoutMs: 180_000,
        onProgress: (msg) => console.log(`  → ${msg}`),
      },
    );
    const elapsed = Date.now() - tStart;

    console.log("");
    console.log("=== RESULT ===");
    console.log(`Status:        SUCCESS`);
    console.log(`HTTP status:   200 (final GET returned image bytes)`);
    console.log(`Elapsed:       ${elapsed} ms (${(elapsed / 1000).toFixed(1)}s)`);
    console.log(`Units used:    ${result.unitsUsed ?? "not reported by API"}`);
    console.log(`Result image:  ${result.imageUrl.length} chars (data URL)`);
    console.log(`Raw response keys: ${Object.keys(result.raw.raw).join(", ")}`);

    // Save the result image so we have evidence.
    const downloadDir = path.join(process.cwd(), "download");
    if (!existsSync(downloadDir)) await mkdir(downloadDir, { recursive: true });
    const outPath = path.join(downloadDir, "youcam-real-result.jpg");
    // Strip the data URL prefix.
    const b64 = result.imageUrl.split(",")[1] ?? "";
    await writeFile(outPath, Buffer.from(b64, "base64"));
    console.log(`\n✅ Saved real YouCam result image to: ${outPath}`);
    console.log(`   Open this file to view the real try-on composite.`);
  } catch (err) {
    const elapsed = Date.now() - tStart;
    console.log("");
    console.log("=== RESULT ===");
    console.log(`Status:        FAILED`);
    console.log(`Elapsed:       ${elapsed} ms`);
    if (err instanceof YouCamError) {
      console.log(`Error code:    ${err.code}`);
      console.log(`HTTP status:   ${err.statusCode}`);
      console.log(`Message:       ${err.message}`);
    } else {
      console.log(`Message:       ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(99);
});
