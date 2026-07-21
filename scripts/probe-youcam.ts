/**
 * Diagnostic: manually probe each step of the YouCam flow,
 * printing the response shape at each step.
 *
 * Usage:
 *   bun run scripts/probe-youcam.ts
 *
 * Reads .env.local for YOUCAM_API_KEY.
 */

import { readFile } from "fs/promises";
import path from "path";
import {
  getYouCamConfig,
  requestUploadUrl,
  uploadImageBytes,
  createTryOnTask,
  getTaskResult,
  mapGarmentTypeToCategory,
} from "../src/lib/youcam-client";

async function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
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
    console.error("❌ No YOUCAM_API_KEY set");
    process.exit(1);
  }

  console.log("=== Step 1+2: Upload person ===");
  const personBuffer = await readFile(path.join(process.cwd(), "public", "sample-person.jpg"));
  const personUpload = await requestUploadUrl(config, {
    contentType: "image/jpeg",
    fileName: "person.jpg",
    fileSize: personBuffer.length,
  });
  console.log("  file_id:", personUpload.file_id.slice(0, 30) + "...");
  console.log("  upload_method:", personUpload.upload_method);
  console.log("  upload_headers:", personUpload.upload_headers);
  await uploadImageBytes(personUpload, personBuffer, "image/jpeg");
  console.log("  ✓ person uploaded");

  console.log("\n=== Step 3+4: Upload garment ===");
  const garmentBuffer = await readFile(path.join(process.cwd(), "public", "garments", "beige-coat.jpg"));
  const garmentUpload = await requestUploadUrl(config, {
    contentType: "image/jpeg",
    fileName: "garment.jpg",
    fileSize: garmentBuffer.length,
  });
  await uploadImageBytes(garmentUpload, garmentBuffer, "image/jpeg");
  console.log("  ✓ garment uploaded");

  console.log("\n=== Step 5: Create try-on task ===");
  const task = await createTryOnTask(config, {
    srcFileId: personUpload.file_id,
    refFileId: garmentUpload.file_id,
    garmentCategory: mapGarmentTypeToCategory("Outerwear"),
    changeShoes: false,
  });
  console.log("  task_id:", task.task_id);
  console.log("  raw response:", JSON.stringify(task.raw, null, 2));

  console.log("\n=== Step 6: Poll task (manual, 30 iterations × 3s) ===");
  for (let i = 1; i <= 30; i++) {
    const r = await getTaskResult(config, task.task_id);
    console.log(`  [poll ${i}] status=${r.status}, unitsUsed=${r.unitsUsed ?? "n/a"}, errorMsg=${r.errorMessage ?? "n/a"}`);
    console.log(`           raw keys: ${Object.keys(r.raw).join(", ")}`);
    console.log(`           raw: ${JSON.stringify(r.raw).slice(0, 500)}`);
    if (r.status === "success" || r.status === "failed") {
      console.log("\n=== FINAL ===");
      console.log("status:", r.status);
      console.log("resultImageUrl:", r.resultImageUrl);
      console.log("unitsUsed:", r.unitsUsed);
      console.log("errorMessage:", r.errorMessage);
      console.log("raw:", JSON.stringify(r.raw, null, 2));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
