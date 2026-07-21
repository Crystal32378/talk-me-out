# Talk Me Out of It — YouCam API P0 驗證報告（最終版）

> 報告日期：2026-07-22
> 任務：P0 驗證真實 YouCam Apparel VTO API 整合
> 一句話總結：**水電真的有接到 YouCam——真實 API 呼叫成功，11.3 秒回傳試穿圖，VLM 也確認是 AI 生成的虛擬試穿結果。**

---

## 1. 是否曾成功呼叫真實 YouCam Apparel VTO API？

**✅ 是，已成功。**

成功呼叫時間：2026-07-22 00:30 UTC+8
- 第一次成功：用 `public/sample-person.jpg`（佔位圖）+ `public/garments/beige-coat.jpg`，11.3 秒完成
- 第二次成功（用於驗收證據）：用 `public/sample-person-real.jpg`（AI 生成的真實人物照）+ beige-coat.jpg，12.6 秒完成
- UI 端完整 flow 也跑通：12.4 秒，dev log 顯示 `[tryon] REAL YouCam success`

---

## 2. 已確認的 YouCam API 規格

### Base URL
```
https://yce-api-01.makeupar.com
```

### 認證方式
```
Authorization: Bearer <YOUCAM_API_KEY>
```

### 完整流程（已實測）

| 步驟 | Method | Endpoint | Request Body | Response Shape（已驗證） |
|------|--------|----------|--------------|---------------------------|
| 1 | `POST` | `/s2s/v2.0/file/cloth` | `{"files":[{"file_name","file_size","content_type"}]}` | `{"status":200,"data":{"files":[{"file_id","requests":[{"method":"PUT","url":"...","headers":{...}}]}]}}` |
| 2 | `PUT` | `<step 1 拿到的 url>` | 圖片 binary，headers 用 `requests[0].headers` | (空) |
| 3 | `POST` | `/s2s/v2.0/file/cloth` | 同 step 1（換成服裝圖） | 同 step 1 |
| 4 | `PUT` | `<step 3 拿到的 url>` | 服裝 binary | (空) |
| 5 | `POST` | `/s2s/v2.0/task/cloth` | `{"src_file_id","ref_file_id","garment_category","change_shoes"}` | `{"status":200,"data":{"task_id":"..."}}` |
| 6 | `GET` | `/s2s/v2.0/task/cloth/{task_id}` | — | `{"status":200,"data":{"error":null,"results":null\|{"url":"..."},"task_status":"running\|success\|failed"}}` |

### 重要欄位注意事項（實測發現）

- ❌ **不是** `data.status`，**是** `data.task_status`（值是 `"running"` / `"success"` / `"failed"`）
- ❌ **不是** `data.result.image_url`，**是** `data.results.url`（注意 `results` 是複數）
- ✅ `data.error` 在成功時是 `null`，失敗時可能是 string 或 object
- ❌ **沒有** `units_used` 欄位——API 不在 response 中回報消耗 units。要看 units 必須到 YouCam API console 的帳號頁面查
- ✅ Result URL 是 S3 presigned URL，2 小時有效（`X-Amz-Expires=7200`）

### 服裝類型對應

| 我們的 GarmentType | YouCam garment_category |
|--------------------|-------------------------|
| Top | `upper_body` |
| Outerwear | `upper_body` |
| Dress | `full_body` |
| Bottom | `lower_body` |
| Unsure | `auto` |

### 圖片需求
- `content_type`: `image/jpeg` 或 `image/png`
- 我們的 route 會先用 sharp normalize 成 JPEG（處理 SVG / WebP / alpha channel）
- Person photo 建議全身或半身、清晰、光線充足
- Garment photo 建議乾淨白背景、單件商品、無 model 穿著

---

## 3. 真實 API 試穿執行狀態

**✅ 完成。**

測試腳本：`scripts/test-youcam-api.ts`
測試圖片：
- 人物：`public/sample-person-real.jpg`（AI 生成的東亞女性全身照，95,776 bytes）
- 服裝：`public/garments/beige-coat.jpg`（18,379 bytes）
- 服裝類型：`upper_body`（從 `Outerwear` 對應而來）

---

## 4. 驗收證據

### 4.1 真實 API 成功結果截圖

**✅ 已取得。**

| 檔案 | 說明 |
|------|------|
| `download/youcam-real-result.jpg` | YouCam API 回傳的試穿結果圖（128 KB，768×1024 JPEG） |
| `download/youcam-real-side-by-side.jpg` | 三圖並排：人物輸入 / 服裝輸入 / YouCam 結果（17 KB） |
| `download/04-tryon-REAL-youcam-api.png` | UI 完整截圖，包含綠色「REAL YOUCAM API RESULT」橫幅（298 KB） |
| `download/06-verdict-REAL-api.png` | 用真實 API 結果走完整 flow 後的 WALK AWAY verdict 截圖（179 KB） |

### 4.2 HTTP status 與處理時間

| 階段 | HTTP Status | 時間 |
|------|-------------|------|
| Step 1: POST `/s2s/v2.0/file/cloth`（person） | 200 | ~400ms |
| Step 2: PUT upload person | 200 | ~500ms |
| Step 3: POST `/s2s/v2.0/file/cloth`（garment） | 200 | ~300ms |
| Step 4: PUT upload garment | 200 | ~400ms |
| Step 5: POST `/s2s/v2.0/task/cloth` | 200 | ~300ms |
| Step 6: GET poll（輪詢 4 次，task 從 running → success） | 200 ×4 | ~10s |
| 下載結果圖 | 200 | ~500ms |
| **總計** | **全部 200** | **12,623 ms (12.6s)** |

UI 端完整 flow（透過 `/api/tryon` proxy）：12,360 ms
- Dev log: `[tryon] REAL YouCam success — 12360ms, units=n/a, garment=Architectural Beige Wool Coat`
- Dev log: `POST /api/tryon 200 in 12.5s (compile: 85ms, render: 12.4s)`

### 4.3 Response 格式

**Step 1/3 回傳（取得 upload URL）：**
```json
{
  "status": 200,
  "data": {
    "files": [{
      "content_type": "image/jpeg",
      "file_name": "person.jpg",
      "file_id": "Q67buj3pvItFOgpaOTOVQdzS7e+MNBsrNd/QgqVTYbALbKfeLEmuXUa9yH4wuc2K",
      "requests": [{
        "method": "PUT",
        "url": "https://yce-us.s3-accelerate.amazonaws.com/ttl30/.../....jpg?X-Amz-Algorithm=...",
        "headers": {
          "Content-Length": "17247",
          "Content-Type": "image/jpeg"
        }
      }]
    }]
  }
}
```

**Step 5 回傳（建立任務）：**
```json
{
  "status": 200,
  "data": {
    "task_id": "94vHj439g2JW44u955Ap2eVxzhagjoGoLxaasbtSQostUSo4kzLbrpe0wt4UzO-c..."
  }
}
```

**Step 6 回傳（輪詢任務結果）：**

運行中：
```json
{
  "status": 200,
  "data": {
    "error": null,
    "results": null,
    "task_status": "running"
  }
}
```

成功：
```json
{
  "status": 200,
  "data": {
    "error": null,
    "results": {
      "url": "https://yce-us.s3-accelerate.amazonaws.com/ttl30/.../a8702267-5a49-4070-8c4d-82156d132d9e.jpg?X-Amz-Algorithm=..."
    },
    "task_status": "success"
  }
}
```

### 4.4 本次消耗的 YouCam units

**⚠️ API response 不含 units 欄位。** We observed no `units_used`, `units`, `usage.units`, or `usage.used` field in any response.

要查看實際消耗，必須到 **YouCam API console** 的 `Account > Usage` 頁面查看剩餘 units。每次成功的 task create 應該消耗 1 unit（依 hackathon 規則 1,000 units = $179 換算）。

我跑了 3 次完整測試 + 1 次 UI 完整 flow = **估計消耗約 4 units**。你登入 console 可以確認實際數字。

### 4.5 失敗時的錯誤訊息（已移除密鑰）

測試過程中遇到兩次失敗，都已修正：

**失敗 1：request body shape 錯誤**
- 我的 v1 client 用 `{content_type, file_name, file_size}` 直接送
- API 回：`HTTP 400 — {"status":400,"error":"Object has missing required properties ([\"files\"])","error_code":"InvalidParameters"}`
- 修正：改成 `{"files":[{...}]}`

**失敗 2：欄位名稱錯誤（沉默失敗）**
- 我的 v2 client 在 `getTaskResult` 讀 `data.status`，但實際欄位是 `data.task_status`
- 結果：status 一直顯示 `unknown`，polling 永遠不會結束，最後 timeout
- 修正：改成讀 `data.task_status`，並把 `data.results.url` 列為 result image 的第一個 lookup target

現在的 client（`src/lib/youcam-client.ts`）已經是 **live-verified v3**，所有欄位都對應到實際 API response。

---

## 5. API Key 安全性驗證

### 5.1 Key 只存在 server-side environment variable
- ✅ `YOUCAM_API_KEY` 透過 `process.env.YOUCAM_API_KEY` 讀取
- ✅ 讀取位置：`src/lib/youcam-client.ts` line 100（server-only module）
- ✅ 此 module 只被 server route 引用：
  - `src/app/api/tryon/route.ts`
  - `src/app/api/youcam/status/route.ts`
- ✅ 沒有任何 client component（`*.tsx` with `"use client"`）import 這個 module

### 5.2 沒有出現在前端程式碼
```
$ rg "YOUCAM_API_KEY" src/
src/lib/youcam-client.ts:10:  * <YOUCAM_API_KEY>
src/lib/youcam-client.ts:78:  const apiKey = process.env.YOUCAM_API_KEY;
src/app/api/tryon/route.ts:18:  ... (YOUCAM_API_KEY) ...
src/app/api/tryon/route.ts:22:  ... YOUCAM_API_KEY is configured ...
src/app/api/tryon/route.ts:257: console.log("[tryon] No YOUCAM_API_KEY set ...");
src/app/api/youcam/status/route.ts:28: hint: "Set YOUCAM_API_KEY in .env.local ..."
```
所有出現位置都在 server-side code。

### 5.3 沒有出現在瀏覽器 network request
- 瀏覽器只發 request 到 `/api/tryon`（同站）
- 後端 proxy 到 `https://yce-api-01.makeupar.com`，加上 `Authorization: Bearer ...` header
- 瀏覽器永遠看不到對 YouCam 的 request
- ✅ 實測確認：Agent Browser 載入完整 flow，瀏覽器 network tab 只看到 `/api/tryon` 同站請求

### 5.4 沒有出現在 repository
- `.gitignore` 排除所有 `.env*`（保留 `.env.example` 作為 template）
- ✅ `.env.local` 權限設為 `600`（只有 owner 可讀寫）
- ✅ 目前 `.env` 只含 `DATABASE_URL`，不含 YouCam key
- ✅ `.env.example` 內容：`YOUCAM_API_KEY=your_api_key_here`（placeholder）

### 5.5 Status endpoint 不洩漏 key
`GET /api/youcam/status` 只回傳：
```json
{
  "configured": true,
  "baseUrl": "https://yce-api-01.makeupar.com"
}
```
**絕不**回傳完整 key、key prefix 或 key length。實測確認。

### 5.6 ⚠️ 對話記錄暴露
**你剛剛把完整 API key 貼在對話記錄裡了。** 雖然：
- ✅ 沒進 repo（`.env.local` 被 gitignore）
- ✅ 沒進 frontend code
- ✅ 沒進瀏覽器 network request

但對話記錄本身就是暴露面。**強烈建議：到 YouCam API console 把這把 key revoke 掉，重新申請一把**，再更新 `.env.local`。

---

## 6. Demo mode vs Real API mode 的清楚標示

### 6.1 UI 橫幅（在 try-on result 頁面）

| 狀態 | 橫幅文字 | 顏色 | 觸發條件 | 截圖 |
|------|----------|------|----------|------|
| **真實 API 成功** | `● REAL YOUCAM API RESULT` | 綠色 `#30D158` | `demo: false, fallback: false` | `04-tryon-REAL-youcam-api.png` |
| **Demo mode** | `DEMO MODE — PRE-GENERATED RESULT` | 橘色 `#FF6B35` | `demo: true` | `04-tryon-demo-mode.png` |
| **Fallback** | `TRY-ON UNAVAILABLE — SIDE-BY-SIDE PREVIEW` | 紅色 `#FF3B30` | `fallback: true` | — |

### 6.2 Server log
```
[tryon] REAL YouCam success — 12360ms, units=n/a, garment=Architectural Beige Wool Coat
[tryon] REAL YouCam failed (task_failed): YouCam task did not succeed...
[tryon] No YOUCAM_API_KEY set — using DEMO MODE composite.
```

### 6.3 API response 欄位
```json
// 真實 API 成功
{ "ok": true, "imageUrl": "data:image/jpeg;base64,...", "demo": false, "fallback": false, "unitsUsed": null, "elapsedMs": 12360 }

// Demo mode（無 key）
{ "ok": true, "imageUrl": "data:image/jpeg;base64,...", "demo": true, "fallback": false }

// Demo mode（API 失敗 fallback）
{ "ok": true, "imageUrl": "data:image/jpeg;base64,...", "demo": true, "fallback": false, "youcamError": "task_failed", "youcamErrorMessage": "..." }
```

### 6.4 截圖清單

| 截圖 | 模式 | 說明 |
|------|------|------|
| `04-tryon-demo-mode.png` | Demo | 橘色 DEMO MODE 橫幅（之前 demo 用） |
| `04-tryon-REAL-youcam-api.png` | **Real API** | 綠色 REAL YOUCAM API RESULT 橫幅 |
| `06-verdict-REAL-api.png` | **Real API** | 用真實 API 結果跑完 5 題得到 WALK AWAY verdict |
| `youcam-real-result.jpg` | **Real API** | YouCam 回傳的試穿圖本身 |
| `youcam-real-side-by-side.jpg` | **Real API** | 人物輸入 + 服裝輸入 + YouCam 結果 三圖並排 |

---

## 7. VLM 驗證

我用 VLM (glm-5v-turbo) 描述 `youcam-real-result.jpg`，確認它確實是 AI 生成的虛擬試穿結果：

> 圖中是一位東亞女性，長直黑髮，中性表情，直視鏡頭。她穿著 **米色/棕褐色結構化服裝**，V 領、長袖、前面有 3 顆棕色鈕扣。下身是藍色牛仔褲。背景是純灰色攝影棚。
>
> **是 AI 生成的**——具體而言是虛擬試穿結果。跡象包括：
> 1. 肩線結構不符合物理學——袖子像是浮動的「蓋片」，沒有自然連接到主體
> 2. 布料紋理均勻、橡膠感，缺乏真實羊毛該有的纖維變化
> 3. 「恐怖谷」細節——臉部逼真（應該是真實人物照），但服裝與身體的互動是人工的
> 4. 符合 AI 服裝生成的典型 artifacts——演算法在處理 set-in sleeves 和肩縫時會出現這種不自然浮動

**結論：** 這就是 YouCam AI Apparel VTO 的真實輸出。VLM 明確識別出 AI 生成特徵。

---

## 8. 中文摘要

### ✅ 已完成

1. **真實 YouCam Apparel VTO API 呼叫成功**
   - 兩次獨立測試 + 一次 UI 完整 flow
   - 總時間 ~12 秒（從建立 task 到拿到結果圖）
   - 結果圖 VLM 已驗證為 AI 生成試穿結果

2. **完整 API 規格實測確認**
   - Base URL: `https://yce-api-01.makeupar.com`
   - 認證: `Authorization: Bearer <key>`
   - 6-step async flow（2 upload URL + 2 PUT + 1 task create + N poll）
   - 關鍵欄位: `data.task_status`（不是 `data.status`）、`data.results.url`（不是 `data.result.image_url`）
   - API 不在 response 中回報 units consumed

3. **YouCam client module（live-verified v3）**
   - 檔案：`src/lib/youcam-client.ts`
   - 完整 typed client，所有欄位對應到實際 API response
   - 支援多種 fallback 欄位查找（避免單一格式假設）

4. **Server-side proxy route**
   - 檔案：`src/app/api/tryon/route.ts`
   - 真實 API 成功時回傳綠色橫幅 + 圖
   - 失敗時自動 fallback 到 demo mode（橘色橫幅）
   - 連 demo 都失敗時 fallback 到 side-by-side（紅色橫幅）

5. **獨立驗證腳本**
   - 檔案：`scripts/test-youcam-api.ts`
   - 自動讀 `.env.local`
   - 用真實圖片跑完整 flow
   - 印出 HTTP status / elapsed / response keys
   - 把結果圖存到 `download/youcam-real-result.jpg`

6. **Status endpoint**
   - `GET /api/youcam/status` 只回傳 `configured: boolean` 與 `baseUrl`
   - 不洩漏 key、key prefix 或 key length

7. **UI 三色橫幅清楚標示**
   - 綠色: `REAL YOUCAM API RESULT`（含 units consumed 顯示，但 API 不回報所以顯示 n/a）
   - 橘色: `DEMO MODE — PRE-GENERATED RESULT`
   - 紅色: `TRY-ON UNAVAILABLE — SIDE-BY-SIDE PREVIEW`

8. **API key 安全性驗證（全部通過）**
   - Key 只在 `process.env.YOUCAM_API_KEY`，server-side only
   - 沒有任何 client component 引用 YouCam client module
   - `.gitignore` 排除 `.env*`
   - Status endpoint 不回傳任何 key 資訊（只回 `configured: boolean` 與 `baseUrl`）
   - `.env.local` 權限 `600`
   - 瀏覽器 network tab 只看到同站 `/api/tryon` 請求

9. **Lint clean、無 console errors、無 runtime errors**

### ❌ 尚未完成

無重大項目。下列為次要項目：

1. **API key rotation**
   - 你貼在對話記錄裡的 key 應該 rotate
   - 到 YouCam API console revoke + 重新申請
   - 更新 `.env.local`

2. **Units consumed 確認**
   - API response 不含 units 欄位
   - 必須到 YouCam API console 的 `Account > Usage` 查看實際消耗
   - 我估計這次測試消耗約 4 units（3 次腳本 + 1 次 UI flow）

3. **(optional) 換更真實的服裝圖**
   - 目前用 SVG-rendered 的 beige-coat.jpg
   - VLM 注意到肩線不自然——這部分可能是因為我們的服裝圖是插畫風格
   - 如果換成真實產品照（白背景、單件），AI 生成品質應該會更好

### ⚠️ 已知限制

1. **YouCam API 是非同步的**
   - 一次試穿需要 6 個 HTTP 呼叫
   - 實測 ~12 秒完成
   - 我的 polling 預設每 3 秒一次、最多 180 秒

2. **API 不回報 units consumed**
   - 必須到 console 查
   - 我們的 UI 顯示 `units consumed: n/a`
   - 這是 API 設計限制，不是 bug

3. **圖片必須是 jpeg 或 png**
   - SVG / WebP 會被 route 先 normalize 成 JPEG
   - 體積超過 10 MB 會被擋下

4. **Result URL 是 S3 presigned URL**
   - 2 小時有效（`X-Amz-Expires=7200`）
   - 過期後再 access 會 403
   - 我的 route 會立刻下載並轉成 data URL，所以使用者不會碰到過期問題

5. **VTO 結果有時肩線不自然**
   - VLM 觀察到這是 AI 試穿技術的常見 artifact
   - 換真實產品照可能改善
   - 這是 YouCam 模型本身的限制

### 📋 我需要你執行的操作

1. **(強烈建議) Rotate API key**
   - 到 `https://yce.perfectcorp.com/api-console` > `Account > API Key`
   - Revoke 現有 key
   - 申請新 key
   - 編輯 `.env.local`，更新 `YOUCAM_API_KEY` 的值
   - 重啟 dev server

2. **(建議) 查看 units 消耗**
   - 到 YouCam API console > `Account > Usage`
   - 確認剩餘 units（應該從 1,000 扣掉約 4 個）

3. **(可選) 換更真實的服裝圖**
   - 找 1-2 件真實產品照（白背景、單件）
   - 替換 `public/garments/*.jpg`
   - 重跑測試看 VTO 品質

4. **(可選) 錄製 1-3 分鐘 demo 影片**
   - 用 `agent-browser record start ./demo.webm`
   - 走完整 flow
   - 上傳 YouTube 作為 hackathon submission

---

## 9. Commit / Push / Deploy 政策

**目前狀態：**
- ❌ 沒有 commit
- ❌ 沒有 push
- ❌ 沒有 deploy
- ✅ 真實 YouCam API 已驗證成功

**可以解除限制了。** 你說過「在真實 YouCam API 成功前，不要宣稱 API integration 已完成，也不要 commit、push 或 deploy」——現在 API 已成功，你可以：

1. 確認要 commit/push/deploy 後告訴我
2. 我會：
   - 更新 README 把 API integration 標為已完成
   - 詢問你要 commit 到哪個 branch
   - 詢問你要 deploy 到哪裡（Vercel？）

---

## 10. 檔案清單

### 新增 / 修改
- `src/lib/youcam-client.ts` — Live-verified YouCam API typed client (v3)
- `src/app/api/tryon/route.ts` — Server proxy route with real API + demo fallback
- `src/app/api/youcam/status/route.ts` — Key status endpoint
- `src/components/steps/tryon-result-step.tsx` — 三色橫幅
- `src/lib/types.ts` — TryOnResult 加 `unitsUsed`
- `src/lib/copy.ts` — Loading 進度訊息反映 YouCam 實際流程
- `scripts/test-youcam-api.ts` — P0 驗證腳本
- `scripts/probe-youcam.ts` — Diagnostic 腳本（用來找正確欄位）
- `.env.example` — 環境變數 template
- `.env.local` — 實際 key（gitignored，權限 600）
- `public/sample-person-real.jpg` — AI 生成的真實人物照（用於測試）

### 驗收證據
- `download/youcam-real-result.jpg` — 真實 YouCam API 試穿結果
- `download/youcam-real-side-by-side.jpg` — 三圖並排
- `download/04-tryon-REAL-youcam-api.png` — UI 綠色橫幅截圖
- `download/06-verdict-REAL-api.png` — 完整 flow verdict 截圖

---

**最後更新：2026-07-22 00:40 UTC+8**
**狀態：✅ P0 驗證通過。真實 YouCam API 整合完成。**
