/**
 * Crystal's Closet — multi-garment VTO test.
 *
 * Runs each of the nine Crystal's Closet garments through the real YouCam
 * Apparel VTO API using the Crystal person test photo, and saves each
 * result image to download/vto-test-<slug>.jpg for visual QA.
 *
 * Usage:
 *   # Option A: API key in env
 *   YOUCAM_API_KEY=xxx bun run scripts/test-crystal-closet-vto.ts
 *
 *   # Option B: API key in .env.local (auto-loaded)
 *   bun run scripts/test-crystal-closet-vto.ts
 *
 *   # Optionally limit to a single slug for re-runs
 *   bun run scripts/test-crystal-closet-vto.ts --only yellow-floral-dress
 *
 * Output files:
 *   download/vto-test-<slug>.jpg      — the YouCam-generated try-on image
 *   download/vto-test-summary.json    — machine-readable summary
 *
 * This script NEVER prints the API key. It only prints the first 4 chars
 * (prefix) so you can confirm which key was used.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import {
  getYouCamConfig,
  mapGarmentTypeToCategory,
  runFullTryOn,
  YouCamError,
  type GarmentCategory,
} from "../src/lib/youcam-client";

interface GarmentSpec {
  slug: string;
  name: string;
  type: "Top" | "Outerwear" | "Dress" | "Bottom" | "Unsure";
  imageUrl: string;
}

const GARMENTS: GarmentSpec[] = [
  { slug: "yellow-floral-dress",          name: "Yellow Floral Dress",          type: "Dress",     imageUrl: "/garments/yellow-floral-dress.jpg" },
  { slug: "black-white-check-dress",      name: "Black & White Check Dress",    type: "Dress",     imageUrl: "/garments/black-white-check-dress.jpg" },
  { slug: "lavender-maxi-dress",          name: "Lavender Maxi Dress",          type: "Dress",     imageUrl: "/garments/lavender-maxi-dress.jpg" },
  { slug: "black-white-lace-top",         name: "Black & White Lace Top",       type: "Top",       imageUrl: "/garments/black-white-lace-top.jpg" },
  { slug: "black-floral-wrap-maxi-dress", name: "Black Floral Wrap Maxi Dress", type: "Dress",     imageUrl: "/garments/black-floral-wrap-maxi-dress.jpg" },
  { slug: "sage-utility-jacket",          name: "Sage Utility Jacket",          type: "Outerwear", imageUrl: "/garments/sage-utility-jacket.jpg" },
  { slug: "navy-ruffle-dress",            name: "Navy Ruffle Dress",            type: "Dress",     imageUrl: "/garments/navy-ruffle-dress.jpg" },
  { slug: "beige-linen-feel-dress",       name: "Beige Linen-Feel Dress",       type: "Dress",     imageUrl: "/garments/beige-linen-feel-dress.jpg" },
  { slug: "pink-illustrated-print-romper", name: "Pink Illustrated Print Romper", type: "Dress",   imageUrl: "/garments/pink-illustrated-print-romper.jpg" },
];

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

interface PerGarmentResult {
  slug: string;
  name: string;
  type: string;
  category: GarmentCategory;
  status: "success" | "failed";
  personImageSha256: string;
  elapsedMs?: number;
  unitsUsed?: number | null;
  errorCode?: string;
  errorMessage?: string;
  outputImage?: string;
  rawKeys?: string[];
}

async function runOne(
  config: ReturnType<typeof getYouCamConfig> & {},
  personBuffer: Buffer,
  personImageSha256: string,
  garment: GarmentSpec,
  outDir: string,
): Promise<PerGarmentResult> {
  const garmentPath = path.join(process.cwd(), "public", garment.imageUrl);
  if (!existsSync(garmentPath)) {
    return {
      slug: garment.slug,
      name: garment.name,
      type: garment.type,
      category: mapGarmentTypeToCategory(garment.type),
      status: "failed",
      personImageSha256,
      errorCode: "garment-file-missing",
      errorMessage: `Garment image not found: ${garmentPath}`,
    };
  }
  const garmentBuffer = await readFile(garmentPath);
  const category = mapGarmentTypeToCategory(garment.type);
  const tStart = Date.now();

  try {
    const result = await runFullTryOn(
      config,
      {
        personBuffer,
        personContentType: "image/jpeg",
        garmentBuffer,
        garmentContentType: "image/jpeg",
        garmentCategory: category,
      },
      {
        intervalMs: 3000,
        timeoutMs: 180_000,
        onProgress: (msg) => console.log(`    → ${msg}`),
      },
    );
    const elapsed = Date.now() - tStart;
    const outPath = path.join(outDir, `vto-test-${garment.slug}.jpg`);
    const b64 = result.imageUrl.split(",")[1] ?? "";
    await writeFile(outPath, Buffer.from(b64, "base64"));
    return {
      slug: garment.slug,
      name: garment.name,
      type: garment.type,
      category,
      status: "success",
      personImageSha256,
      elapsedMs: elapsed,
      unitsUsed: result.unitsUsed ?? null,
      outputImage: path.relative(process.cwd(), outPath),
      rawKeys: Object.keys(result.raw.raw),
    };
  } catch (err) {
    const elapsed = Date.now() - tStart;
    const code = err instanceof YouCamError ? err.code : "unknown";
    const message = err instanceof Error ? err.message : String(err);
    return {
      slug: garment.slug,
      name: garment.name,
      type: garment.type,
      category,
      status: "failed",
      personImageSha256,
      elapsedMs: elapsed,
      errorCode: code,
      errorMessage: message,
    };
  }
}

async function main() {
  await loadEnvLocal();
  const config = getYouCamConfig();
  if (!config) {
    console.error("❌ YOUCAM_API_KEY is not set.");
    console.error("   Set it in .env.local or pass via env:");
    console.error("   YOUCAM_API_KEY=xxx bun run scripts/test-crystal-closet-vto.ts");
    process.exit(1);
  }

  // Optional --only <slug> filter for re-running a single garment.
  const onlyArgIdx = process.argv.indexOf("--only");
  const onlySlug = onlyArgIdx >= 0 ? process.argv[onlyArgIdx + 1] : undefined;
  const garmentList = onlySlug
    ? GARMENTS.filter((g) => g.slug === onlySlug)
    : GARMENTS;
  if (garmentList.length === 0) {
    console.error(`No garment matched --only ${onlySlug}`);
    process.exit(1);
  }

  console.log("=== Crystal's Closet — VTO test ===");
  console.log(`Base URL:    ${config.baseUrl}`);
  console.log(`API Key:     ${config.apiKey.slice(0, 4)}${"*".repeat(Math.max(0, config.apiKey.length - 4))} (${config.apiKey.length} chars)`);
  console.log(`Garments:    ${garmentList.length} (${garmentList.map((g) => g.slug).join(", ")})`);
  console.log("");

  const personPath = path.join(process.cwd(), "public", "sample-person-crystal.jpg");
  if (!existsSync(personPath)) {
    console.error(`❌ Person photo not found: ${personPath}`);
    process.exit(1);
  }
  const personBuffer = await readFile(personPath);
  const personImageSha256 = createHash("sha256")
    .update(personBuffer)
    .digest("hex");
  console.log(`Person:      ${personPath} (${personBuffer.length} bytes)`);
  console.log(`SHA-256:     ${personImageSha256}`);
  console.log("");

  const downloadDir = path.join(process.cwd(), "download");
  if (!existsSync(downloadDir)) await mkdir(downloadDir, { recursive: true });

  const results: PerGarmentResult[] = [];
  for (const g of garmentList) {
    console.log(`▶ ${g.name}  [${g.slug}]  type=${g.type}  category=${mapGarmentTypeToCategory(g.type)}`);
    const r = await runOne(
      config,
      personBuffer,
      personImageSha256,
      g,
      downloadDir,
    );
    results.push(r);
    if (r.status === "success") {
      console.log(`  ✅ SUCCESS in ${r.elapsedMs} ms — saved ${r.outputImage}`);
    } else {
      console.log(`  ❌ FAILED in ${r.elapsedMs} ms — ${r.errorCode}: ${r.errorMessage?.slice(0, 200)}`);
    }
    console.log("");
  }

  // Write a machine-readable summary.
  const summaryPath = path.join(downloadDir, "vto-test-summary.json");
  await writeFile(summaryPath, JSON.stringify(results, null, 2));
  console.log(`Summary written to ${summaryPath}`);

  // Final pass/fail tally.
  const passed = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`\n=== TALLY ===`);
  console.log(`Passed: ${passed} / ${results.length}`);
  console.log(`Failed: ${failed} / ${results.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(99);
});
