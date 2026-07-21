/**
 * YouCam Apparel Virtual Try-On API client.
 *
 * Specification source:
 *   https://yce.perfectcorp.com/ai-api/products/ai-clothes-changer-api
 *   https://docs.perfectcorp.com (Apparel VTO reference)
 *   Live API probing on 2026-07-22 (P0 verification)
 *
 * Endpoint base: https://yce-api-01.makeupar.com
 * Authentication: Authorization: Bearer <YOUCAM_API_KEY>
 *
 * The API is asynchronous and uses a multi-step workflow per image:
 *   1. POST /s2s/v2.0/file/cloth   — request an upload URL for an image
 *      Body (JSON): { "files": [{ "file_name", "file_size", "content_type" }] }
 *      Returns: { "data": { "files": [{ "file_id", "requests": [{ "method": "PUT", "url": "...", "headers": {...} }] }] } }
 *   2. PUT  <requests[0].url>        — upload the raw image bytes
 *      Headers: from requests[0].headers (Content-Length, Content-Type)
 *   3. POST /s2s/v2.0/task/cloth    — create a try-on task
 *      Body: { "src_file_id", "ref_file_id", "garment_category", "change_shoes" }
 *      Returns: { "data": { "task_id": "..." } }
 *   4. GET  /s2s/v2.0/task/cloth/{task_id} — poll for the result
 *      Returns: { "data": { "status": "success"|"processing"|"failed", "result": { "image_url": "..." }, ... } }
 *
 * For apparel VTO:
 *   - src_file_id  = the person photo (the body wearing clothes)
 *   - ref_file_id  = the garment photo (the clean product image)
 *   - garment_category: "auto" | "upper_body" | "lower_body" | "full_body" | "shoes"
 *   - change_shoes: boolean
 */

export const YOUCAM_BASE_URL = "https://yce-api-01.makeupar.com";

export type GarmentCategory =
  | "auto"
  | "upper_body"
  | "lower_body"
  | "full_body"
  | "shoes";

export interface YouCamConfig {
  apiKey: string;
  baseUrl: string;
}

export interface YouCamFileMeta {
  contentType: "image/jpeg" | "image/png";
  fileName: string;
  fileSize: number;
}

export interface YouCamUploadRequestFile {
  file_name: string;
  file_size: number;
  content_type: "image/jpeg" | "image/png";
}

export interface YouCamUploadRequest {
  files: YouCamUploadRequestFile[];
}

export interface YouCamUploadRequestItem {
  content_type: string;
  file_name: string;
  file_id: string;
  requests: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
  }>;
}

export interface YouCamUploadResponse {
  file_id: string;
  upload_url: string;
  upload_method: string;
  upload_headers: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface YouCamTaskCreateResponse {
  task_id: string;
  raw: Record<string, unknown>;
}

export type YouCamTaskStatus =
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "unknown";

export interface YouCamTaskResult {
  status: YouCamTaskStatus;
  resultImageUrl?: string;
  errorMessage?: string;
  unitsUsed?: number;
  raw: Record<string, unknown>;
}

export function getYouCamConfig(): YouCamConfig | null {
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.YOUCAM_BASE_URL ?? YOUCAM_BASE_URL,
  };
}

function authHeaders(config: YouCamConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey}`,
  };
}

/**
 * Step 1: Request an upload URL for a person or garment image.
 *
 * Live-verified shape (2026-07-22):
 *   POST /s2s/v2.0/file/cloth
 *   Body: { "files": [{ "file_name", "file_size", "content_type" }] }
 *   Response: { "status": 200, "data": { "files": [{ "file_id", "requests": [{ "method": "PUT", "url": "...", "headers": {...} }] }] } }
 */
export async function requestUploadUrl(
  config: YouCamConfig,
  meta: YouCamFileMeta,
): Promise<YouCamUploadResponse> {
  const body: YouCamUploadRequest = {
    files: [
      {
        file_name: meta.fileName,
        file_size: meta.fileSize,
        content_type: meta.contentType,
      },
    ],
  };

  const res = await fetch(`${config.baseUrl}/s2s/v2.0/file/cloth`, {
    method: "POST",
    headers: {
      ...authHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new YouCamError(
      `requestUploadUrl failed: HTTP ${res.status} — ${text.slice(0, 300) || "no body"}`,
      res.status,
      "upload_request_failed",
    );
  }

  const json = (await res.json()) as {
    data?: { files?: YouCamUploadRequestItem[] };
    files?: YouCamUploadRequestItem[];
  };

  const fileEntry = json.data?.files?.[0] ?? json.files?.[0];
  if (!fileEntry?.file_id || !fileEntry.requests?.[0]?.url) {
    throw new YouCamError(
      "requestUploadUrl returned malformed response (missing file_id or upload URL).",
      res.status,
      "upload_request_malformed",
    );
  }

  const req = fileEntry.requests[0];
  return {
    file_id: fileEntry.file_id,
    upload_url: req.url,
    upload_method: req.method,
    upload_headers: req.headers,
    raw: json as unknown as Record<string, unknown>,
  };
}

/**
 * Step 2: Upload the raw image bytes to the presigned upload URL.
 *
 * Uses the headers returned by the API (Content-Length, Content-Type) —
 * S3 presigned URLs require these to match exactly.
 */
export async function uploadImageBytes(
  upload: YouCamUploadResponse,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const headers: Record<string, string> = {
    ...upload.upload_headers,
    "Content-Type": contentType,
    "Content-Length": String(bytes.length),
  };
  // Ensure Content-Length matches the actual byte count (override any
  // stale value the API may have returned).
  headers["Content-Length"] = String(bytes.length);

  const res = await fetch(upload.upload_url, {
    method: upload.upload_method || "PUT",
    headers,
    body: bytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new YouCamError(
      `uploadImageBytes failed: HTTP ${res.status} — ${text.slice(0, 300) || "no body"}`,
      res.status,
      "upload_put_failed",
    );
  }
}

/**
 * Step 3: Create a try-on task. Returns the task_id immediately.
 */
export async function createTryOnTask(
  config: YouCamConfig,
  params: {
    srcFileId: string; // person photo
    refFileId: string; // garment photo
    garmentCategory: GarmentCategory;
    changeShoes?: boolean;
  },
): Promise<YouCamTaskCreateResponse> {
  const res = await fetch(`${config.baseUrl}/s2s/v2.0/task/cloth`, {
    method: "POST",
    headers: {
      ...authHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      src_file_id: params.srcFileId,
      ref_file_id: params.refFileId,
      garment_category: params.garmentCategory,
      change_shoes: params.changeShoes ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new YouCamError(
      `createTryOnTask failed: HTTP ${res.status} — ${text.slice(0, 300) || "no body"}`,
      res.status,
      "task_create_failed",
    );
  }

  const json = (await res.json()) as {
    data?: { task_id?: string };
    task_id?: string;
  };

  const taskId = json.data?.task_id ?? json.task_id;
  if (!taskId) {
    throw new YouCamError(
      "createTryOnTask returned malformed response (missing task_id).",
      res.status,
      "task_create_malformed",
    );
  }
  return { task_id: taskId, raw: json as unknown as Record<string, unknown> };
}

/**
 * Step 4: Poll for the result. Returns immediately with the current status.
 *
 * Live-verified response shape (2026-07-22):
 *   {
 *     "status": 200,
 *     "data": {
 *       "error": null,
 *       "results": null | { "url": "https://yce-us.s3-accelerate.amazonaws.com/..." },
 *       "task_status": "running" | "success" | "failed" | ...
 *     }
 *   }
 *
 * Note: the field is `task_status` (not `status`), and the result URL lives
 * at `data.results.url` (not `data.result.image_url`).
 */
export async function getTaskResult(
  config: YouCamConfig,
  taskId: string,
): Promise<YouCamTaskResult> {
  const res = await fetch(
    `${config.baseUrl}/s2s/v2.0/task/cloth/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: authHeaders(config),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new YouCamError(
      `getTaskResult failed: HTTP ${res.status} — ${text.slice(0, 300) || "no body"}`,
      res.status,
      "task_poll_failed",
    );
  }

  const json = (await res.json()) as Record<string, unknown>;
  const data = (json.data as Record<string, unknown>) ?? json;

  // YouCam uses `task_status`. Fall back to `status` for robustness.
  const statusRaw = String(
    data.task_status ?? data.status ?? json.task_status ?? json.status ?? "",
  ).toLowerCase();
  let status: YouCamTaskStatus = "unknown";
  if (statusRaw === "success" || statusRaw === "succeeded" || statusRaw === "done" || statusRaw === "completed") {
    status = "success";
  } else if (statusRaw === "failed" || statusRaw === "error") {
    status = "failed";
  } else if (statusRaw === "queued" || statusRaw === "pending") {
    status = "queued";
  } else if (statusRaw === "processing" || statusRaw === "running") {
    status = "processing";
  }

  // Result image URL — YouCam puts it at data.results.url.
  // Fall back to other plausible locations for robustness.
  const resultsObj = (data.results as Record<string, unknown>) ?? null;
  const resultObj = (data.result as Record<string, unknown>) ?? null;
  const resultImageUrl =
    (resultsObj?.url as string) ??
    (resultsObj?.image_url as string) ??
    (resultsObj?.result_image_url as string) ??
    (data.result_image_url as string) ??
    (data.result_url as string) ??
    (data.image_url as string) ??
    (resultObj?.image_url as string) ??
    (resultObj?.url as string) ??
    (resultObj?.result_image_url as string) ??
    ((data.output as Record<string, unknown>)?.image_url as string) ??
    ((data.output as Record<string, unknown>)?.url as string);

  // Error — YouCam puts it at data.error (an object or string when present).
  const errorObj = (data.error as Record<string, unknown>) ?? null;
  const errorMessage =
    (typeof data.error === "string" ? data.error : null) ??
    (errorObj?.message as string) ??
    (errorObj?.error as string) ??
    (data.error_message as string) ??
    (data.message as string) ??
    (json.error_message as string) ??
    (json.error as string) ??
    (json.message as string);

  // Units — YouCam does not appear to report units per call (we observed none in the response).
  const unitsUsed =
    (data.units_used as number) ??
    (data.units as number) ??
    ((data.usage as Record<string, unknown>)?.units as number) ??
    ((data.usage as Record<string, unknown>)?.used as number) ??
    (json.units_used as number) ??
    (json.units as number);

  return {
    status,
    resultImageUrl: typeof resultImageUrl === "string" ? resultImageUrl : undefined,
    errorMessage: typeof errorMessage === "string" && errorMessage.length > 0 ? errorMessage : undefined,
    unitsUsed: typeof unitsUsed === "number" ? unitsUsed : undefined,
    raw: json,
  };
}

/**
 * Convenience: polls until the task is done or the timeout is reached.
 *
 * Default: poll every 2 seconds, give up after 60 seconds.
 */
export async function pollUntilDone(
  config: YouCamConfig,
  taskId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<YouCamTaskResult> {
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const start = Date.now();

  let lastResult: YouCamTaskResult | null = null;
   
  while (true) {
    if (Date.now() - start > timeoutMs) {
      throw new YouCamError(
        `pollUntilDone timed out after ${timeoutMs}ms. Last status: ${lastResult?.status ?? "n/a"}`,
        0,
        "timeout",
      );
    }
    const result = await getTaskResult(config, taskId);
    lastResult = result;
    if (result.status === "success" || result.status === "failed") {
      return result;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * End-to-end: given two image buffers, run the full YouCam try-on flow
 * and return the result image as a data URL.
 */
export async function runFullTryOn(
  config: YouCamConfig,
  params: {
    personBuffer: Buffer;
    personContentType: "image/jpeg" | "image/png";
    garmentBuffer: Buffer;
    garmentContentType: "image/jpeg" | "image/png";
    garmentCategory: GarmentCategory;
    changeShoes?: boolean;
  },
  opts: { intervalMs?: number; timeoutMs?: number; onProgress?: (msg: string) => void } = {},
): Promise<{ imageUrl: string; unitsUsed?: number; raw: YouCamTaskResult }> {
  const { onProgress } = opts;
  onProgress?.("Requesting person upload URL…");
  const personUpload = await requestUploadUrl(config, {
    contentType: params.personContentType,
    fileName: "person.jpg",
    fileSize: params.personBuffer.length,
  });

  onProgress?.("Requesting garment upload URL…");
  const garmentUpload = await requestUploadUrl(config, {
    contentType: params.garmentContentType,
    fileName: "garment.jpg",
    fileSize: params.garmentBuffer.length,
  });

  onProgress?.("Uploading person image…");
  await uploadImageBytes(personUpload, params.personBuffer, params.personContentType);

  onProgress?.("Uploading garment image…");
  await uploadImageBytes(garmentUpload, params.garmentBuffer, params.garmentContentType);

  onProgress?.("Creating try-on task…");
  const task = await createTryOnTask(config, {
    srcFileId: personUpload.file_id,
    refFileId: garmentUpload.file_id,
    garmentCategory: params.garmentCategory,
    changeShoes: params.changeShoes ?? false,
  });

  onProgress?.("Polling YouCam for result…");
  const result = await pollUntilDone(config, task.task_id, opts);

  if (result.status !== "success" || !result.resultImageUrl) {
    throw new YouCamError(
      `YouCam task did not succeed. Status: ${result.status}. Error: ${result.errorMessage ?? "unknown"}. Raw keys: ${Object.keys(result.raw).join(", ")}`,
      0,
      "task_failed",
    );
  }

  // Download the result image and convert to a data URL.
  onProgress?.("Downloading result image…");
  const imgRes = await fetch(result.resultImageUrl);
  if (!imgRes.ok) {
    throw new YouCamError(
      `Could not download result image: HTTP ${imgRes.status}`,
      imgRes.status,
      "result_download_failed",
    );
  }
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
  const dataUrl = `data:${mime};base64,${imgBuf.toString("base64")}`;

  return { imageUrl: dataUrl, unitsUsed: result.unitsUsed, raw: result };
}

/**
 * Map our internal garment type to the YouCam garment_category enum.
 */
export function mapGarmentTypeToCategory(
  type: "Top" | "Outerwear" | "Dress" | "Bottom" | "Unsure",
): GarmentCategory {
  switch (type) {
    case "Top":
      return "upper_body";
    case "Outerwear":
      return "upper_body";
    case "Dress":
      return "full_body";
    case "Bottom":
      return "lower_body";
    case "Unsure":
      return "auto";
    default:
      return "auto";
  }
}

/**
 * Typed error class for clearer error handling upstream.
 */
export class YouCamError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "YouCamError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
