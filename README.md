# Talk Me Out of It

> Your brutally honest fitting-room friend.

A virtual fitting room that does not help users buy faster. It helps them decide whether they should buy at all.

Built for the **YouCam API Skin AI & Apparel VTO Hackathon**. Submission deadline: August 17, 2026.

---

## Product overview

Most virtual try-on products optimize conversion. **Talk Me Out of It** uses virtual try-on as the beginning of a more thoughtful purchase decision.

The product is **not anti-shopping**. It is **anti-impulse shopping**. The system can credibly recommend `BUY IT` when a purchase is justified — it is not a fixed rejection machine.

### The five-step flow

1. **Upload a photo** — full-body or half-body, camera or file upload.
2. **Pick a garment** — six garments from **Crystal's Closet** (the creator's pre-owned wardrobe) covering distinct purchase-risk categories, or upload your own.
3. **Virtual try-on** — YouCam Apparel VTO generates a composite. Falls back to a clearly-labeled pre-generated demo result if the API is unavailable.
4. **Five honest questions** — occasion, duplication, budget, care, regret.
5. **Verdict card** — one of four explainable verdicts with score, evidence, roast lines, and a constructive closing note.

### Crystal's Closet — sample garment provenance

The six default garments in this submission are **Crystal's Closet** — original photographs taken by the project creator of clothing from her own pre-owned wardrobe.

> Sample garment photographs are original photos supplied by the project creator from her personal pre-owned wardrobe.

These are not retailer products, are not currently for sale, and there is no brand partnership. Where the original photos showed a brand label, the label has been masked in the cleaned copies committed to this repo. The creator's original photos are not modified. The UI uses the lighter attribution line **"From the creator's pre-owned wardrobe"** and intentionally shows no prices — this is a demo collection, not a shop.

### The four verdicts

| Verdict            | Score  | Meaning                                                       |
| ------------------ | -----: | ------------------------------------------------------------- |
| **BUY IT**         |   0–3 | Real use case, fits constraints                                |
| **TRY IN STORE**   |   4–7 | Reasonable idea, but online uncertainty remains               |
| **BORROW OR RENT** |  8–12 | Wants the experience more than permanent ownership            |
| **WALK AWAY**      | 13–19 | Strong evidence of an impulse purchase                         |

Maximum impulse score: **19**.

### Pitch

> Every virtual fitting-room product asks the same question:
> "How can we help you buy this faster?"
>
> We ask a different question:
> **"If you slow down for three minutes, would you still buy it?"**

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript 5
- **Styling:** Tailwind CSS 4 + custom design tokens
- **UI primitives:** shadcn/ui (New York) + Lucide icons
- **Motion:** Framer Motion
- **State:** Zustand
- **Try-On API:** YouCam Apparel Virtual Try-On (proxied server-side)
- **Image processing:** Sharp (for demo-mode compositing and image normalization)
- **No database** in the MVP — personal photos are never persisted.

---

## YouCam Apparel VTO integration

The app integrates with the real **YouCam Apparel Virtual Try-On API** (base URL `https://yce-api-01.makeupar.com`), authenticated with `Authorization: Bearer <YOUCAM_API_KEY>`.

### Architecture

The YouCam API key is **never exposed to the browser**. All requests go through a server-side proxy:

```
Browser ──▶ /api/tryon (Next.js route) ──▶ YouCam API ──▶ Browser
```

### Verified API workflow

YouCam's Apparel VTO is **asynchronous** — each try-on requires 6 HTTP calls:

| Step | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| 1 | `POST` | `/s2s/v2.0/file/cloth` | Request upload URL for person photo |
| 2 | `PUT`  | `<presigned S3 URL>` | Upload person photo bytes |
| 3 | `POST` | `/s2s/v2.0/file/cloth` | Request upload URL for garment photo |
| 4 | `PUT`  | `<presigned S3 URL>` | Upload garment photo bytes |
| 5 | `POST` | `/s2s/v2.0/task/cloth` | Create try-on task → returns `task_id` |
| 6 | `GET`  | `/s2s/v2.0/task/cloth/{task_id}` | Poll until `task_status: "success"` → returns `data.results.url` |

**Verified response shape** (live API call, 2026-07-22):

```json
// Step 6 success response
{
  "status": 200,
  "data": {
    "error": null,
    "results": {
      "url": "https://yce-us.s3-accelerate.amazonaws.com/..."
    },
    "task_status": "success"
  }
}
```

**Key field names** (verified live — these are the actual API field names, not assumptions):
- Status field: `data.task_status` (NOT `data.status`)
- Result URL: `data.results.url` (NOT `data.result.image_url`)
- Values: `"running"` → `"success"` / `"failed"`
- The API does **not** report units consumed in the response

### P0 verification status

✅ **Real YouCam API integration verified end-to-end on 2026-07-22.**

- Two independent script tests via `scripts/test-youcam-api.ts`
- One full UI flow through the browser via `/api/tryon` proxy
- Average total time: ~12 seconds (upload × 2 + task create + poll + download)
- Result image verified by VLM as AI-generated virtual try-on output
- Server log confirmed: `POST /api/tryon 200 in 12.5s`

### Required environment variables

Create `.env.local` (this file is gitignored and never committed):

```bash
YOUCAM_API_KEY=<your_api_key>
YOUCAM_BASE_URL=https://yce-api-01.makeupar.com   # optional, defaults to the value above
```

Get your API key from the YouCam API console at `https://yce.perfectcorp.com/api-console`.
Hackathon participants get 1,000 free API units via the redeem code emailed after registering at `https://youcam-api.devpost.com`.

### Local setup

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and set YOUCAM_API_KEY

# 3. Run the dev server
bun run dev

# 4. Open http://localhost:3000
```

### Request format

```
POST /api/tryon
Content-Type: multipart/form-data

person:      <File>    # JPG/PNG/WebP, compressed client-side before upload
garment:     <File>    # JPG/PNG/WebP
garmentType: <string>  # "Top" | "Outerwear" | "Dress" | "Bottom" | "Unsure"
```

The route normalizes both images to JPEG (via Sharp) before sending to YouCam, because YouCam's `/file/cloth` endpoint accepts only `image/jpeg` or `image/png`. The client also sends a `garmentName` field for logging, but the server does not currently consume it.

### Garment type mapping

| Internal type | YouCam `garment_category` |
|---------------|---------------------------|
| Top           | `upper_body`              |
| Outerwear     | `upper_body`              |
| Dress         | `full_body`               |
| Bottom        | `lower_body`              |
| Unsure        | `auto`                    |

### API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tryon` | `POST` | Run the full YouCam try-on flow (or fall back to demo mode) |
| `/api/tryon` | `GET`  | Report whether YouCam is configured (no key info exposed) |
| `/api/youcam/status` | `GET` | Boolean `configured` flag + base URL only (no key info) |

---

## Demo mode vs Real API mode

The app supports three clearly-labeled states on the try-on result page:

| Mode | Banner text | Banner color | Trigger condition |
|------|-------------|--------------|-------------------|
| **Real API** | `● REAL YOUCAM API RESULT` | Green `#30D158` | `YOUCAM_API_KEY` set + API call succeeded |
| **Demo mode** | `DEMO MODE — PRE-GENERATED RESULT` | Orange `#FF6B35` | No API key, OR API call failed (fallback) |
| **Side-by-side** | `TRY-ON UNAVAILABLE — SIDE-BY-SIDE PREVIEW` | Red `#FF3B30` | Even the pre-generated demo image could not be loaded |

**Demo mode** does **not** composite the user's garment over the user's person photo. Instead, it serves a **pre-generated real YouCam try-on result** stored at `public/demo/fallback-result.jpg`. That image was produced by an earlier, successful real YouCam Apparel VTO call (person photo + beige wool coat → AI-generated try-on composite). When demo mode is triggered, the route reads that pre-generated image, overlays a clear `DEMO MODE — PRE-GENERATED RESULT` label across the bottom via Sharp, and returns the data URL. The UI explains that the user's uploaded photos were **not** sent to YouCam and that this is a pre-generated demonstration result. This is more honest and visually correct than the previous approach of compositing the garment over the user's face.

The pre-generated result trio (`fallback-person.jpg`, `fallback-garment.jpg`, `fallback-result.jpg`) is shipped in `public/demo/` so reviewers can verify the trio matches.

The final hackathon submission must demonstrate real YouCam API integration, which is verified in the P0 report (`download/P0-YouCam-API-驗證報告.md`) and the six-garment VTO test outputs in `download/vto-test-*.jpg`.

---

## Privacy and safety principles

### Privacy

- Personal photos are sent to YouCam **only** for the active try-on request.
- Photos are **not** saved to a permanent user history.
- Photos are **not** placed in `localStorage`.
- The Zustand store keeps the photo only in memory for the duration of the session.
- YouCam temporarily processes and stores uploads and generated results under its service terms. The server proxy downloads the result immediately and returns a compressed data URL to the browser.
- `.env.local` (containing the API key) is gitignored and never committed.

### Roast system red lines

The product is witty, skeptical, and direct. **It is never cruel.**

The system may critique:
- Product design, price, care requirements
- Marketing claims, scarcity tactics
- The logic behind the purchase
- Mismatch with the user's stated needs

The system must **never** critique:
- Body shape, body size, weight, age
- Skin color, physical attractiveness
- Disability, gender expression
- Any visible physical feature

All roast lines come from a fixed, approved English copy library in `src/lib/copy.ts` — there is no LLM in the verdict path, so unsafe appearance-related output is structurally impossible.

### API key safety

- The key is read from `process.env.YOUCAM_API_KEY` only in server-side modules.
- No client component imports the YouCam client module.
- The `/api/youcam/status` endpoint returns only a boolean `configured` flag and the public base URL — **no key prefix, no key length, no key fragment**.
- Error responses return only machine-readable error codes, never raw upstream messages.

---

## Known limitations

1. **YouCam API is asynchronous** — each try-on requires 6 HTTP calls and takes ~10–15 seconds end-to-end.
2. **The API does not report units consumed** in the response — you must check the YouCam API console's `Account > Usage` page to see consumption.
3. **Result URLs are S3 presigned URLs** that expire after 2 hours. The proxy downloads and converts to a data URL immediately, so users never encounter expiry.
4. **VTO output may have artifacts** — shoulder seams, fabric draping, and hand positions can look unnatural. This is a limitation of the YouCam model, not the integration.
5. **Images must be JPEG or PNG** — SVG and WebP are normalized to JPEG before upload.
6. **No database, no session persistence** — refreshing the page resets the entire flow. This is intentional for the MVP.

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts (Inter + Space Grotesk)
│   ├── page.tsx                # Stepper wrapper, switches between steps
│   ├── globals.css             # Dark editorial theme tokens
│   └── api/
│       ├── tryon/route.ts              # YouCam proxy with demo fallback
│       └── youcam/status/route.ts      # Key-configured status (no key data)
├── components/
│   ├── brand/logo.tsx          # Brand mark
│   ├── steps/
│   │   ├── step-header.tsx
│   │   ├── intro-step.tsx
│   │   ├── photo-upload-step.tsx
│   │   ├── garment-select-step.tsx
│   │   ├── tryon-result-step.tsx
│   │   ├── interrogation-step.tsx
│   │   └── verdict-card-step.tsx
│   └── ui/                     # shadcn/ui primitives
└── lib/
    ├── types.ts                # Domain types
    ├── garments.ts             # Crystal's Closet — 6 default garments + attribution
    ├── questions.ts            # 5 questions, scoring matrix
    ├── copy.ts                 # English copy library + UI strings
    ├── verdicts.ts             # Verdict definitions + thresholds
    ├── verdict-engine.ts       # Pure scoring + evidence + roast selection
    ├── store.ts                # Zustand flow store
    └── youcam-client.ts        # Live-verified YouCam API typed client

scripts/
├── test-youcam-api.ts          # P0 verification script (real API test, single garment)
├── test-crystal-closet-vto.ts  # Final-submission VTO test — runs all 6 Crystal's Closet garments
├── probe-youcam.ts             # Diagnostic script for API field discovery
└── make-sample-person.ts       # Generate placeholder person photo

public/
├── garments/                   # 6 Crystal's Closet garment JPGs (600x800, labels masked)
├── sample-person.jpg           # Placeholder person photo (silhouette)
├── sample-person-real.jpg      # AI-generated realistic person photo (P0 testing)
└── sample-person-crystal.jpg   # Creator-supplied full-body person photo (Crystal's Closet testing)

download/                       # Verification evidence (committed)
├── P0-YouCam-API-驗證報告.md   # P0 verification report (secrets removed)
├── youcam-real-result.jpg      # Real YouCam API result image (P0 test)
├── youcam-real-side-by-side.jpg # Side-by-side: input person + garment + result (P0 test)
├── 04-tryon-REAL-youcam-api.png # UI screenshot with green "Real YouCam API Result" banner
├── 06-verdict-REAL-api.png     # Full flow verdict card screenshot
├── vto-test-<slug>.jpg         # 6 real-VTO result images for Crystal's Closet (final submission)
└── vto-test-summary.json       # Machine-readable summary of the 6-garment VTO test
```

---

## Testing the full flow

### Quick smoke test

1. Open the app.
2. Click **Begin the interrogation**.
3. Upload `public/sample-person-crystal.jpg` (or your own photo).
4. Pick one of the six Crystal's Closet garments (or upload your own).
5. Wait for the try-on result (real API if key is set, pre-generated demo otherwise).
6. Answer the five questions.
7. Read your verdict.
8. Click **Copy verdict** or **Interrogate another purchase**.

### Verify real API integration

```bash
# 1. Set YOUCAM_API_KEY in .env.local
# 2. Run the single-garment verification script
bun run scripts/test-youcam-api.ts

# Or: run all 6 Crystal's Closet garments in one pass
bun run scripts/test-crystal-closet-vto.ts
```

`test-youcam-api.ts` runs the full YouCam flow with a single garment (vintage-beige-trench) and saves the result image to `download/youcam-real-result.jpg`.

`test-crystal-closet-vto.ts` runs all six Crystal's Closet garments through the real YouCam API using `public/sample-person-crystal.jpg`, saves each result to `download/vto-test-<slug>.jpg`, and writes a machine-readable summary to `download/vto-test-summary.json`. Supports `--only <slug>` for single-garment re-runs.

### Verdict path testing

| Path              | Q1                  | Q2                | Q3                       | Q4                  | Q5                | Expected verdict |
| ----------------- | ------------------- | ----------------- | ------------------------ | ------------------- | ----------------- | ---------------- |
| BUY IT            | Specific occasion   | No                | Easily within budget     | Easy machine wash   | Considered purchase | BUY IT (0)       |
| TRY IN STORE      | This month          | One similar       | Reasonable for the value | Hand-wash           | A little guilty   | TRY IN STORE (~5) |
| BORROW OR RENT    | Cannot name         | One similar       | More than planned        | Dry-clean           | A little guilty   | BORROW OR RENT (~10) |
| WALK AWAY         | Cannot name         | Two or more       | Over budget but want     | Did not check       | Seriously regret  | WALK AWAY (17)   |

---

## Scripts

```bash
bun run dev          # Start dev server on port 3000
bun run lint         # Run ESLint
bun run build        # Production build (do NOT run in dev sandbox)
bun run db:push      # Push Prisma schema (not used in MVP)
```

---

## License

Prototype built for the YouCam API Skin AI & Apparel VTO Hackathon. All rights reserved pending competition outcome.

Powered by **YouCam Apparel Virtual Try-On**.
