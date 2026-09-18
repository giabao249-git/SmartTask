# Phase 7 — AI MVP: phân rã yêu cầu, giải thích rủi ro, cấu hình AI qua DB

Nhánh `feature/be-p7-ai`. 18/09/2026. Thiết kế theo [05-ai-agent](../04-kien-truc/05-ai-agent.md), [06](../04-kien-truc/06-tri-nho-ai.md) (chỉ phần nạp vào prompt), [07](../04-kien-truc/07-cache-va-chi-phi.md); API 3.11 + 3.12 của [11](../04-kien-truc/11-chot-chuc-nang-va-api.md). Mã tham chiếu: Table_Calendar `ai-v2/*`, `gemini-api.util.ts`, `gemini-prompt-cache.service.ts`; ELPREP `ai/ai-provider.service.ts`, `ai/crypto.util.ts`.

> Nguyên tắc giữ xuyên suốt: **LLM suy luận, backend chỉ tính và kiểm tra, backend không quyết định.** Không có chỗ nào trong module `ai` xếp hạng ứng viên, thay người/giờ trong đề xuất, hay parse ý định bằng regex. Validator chỉ trả `{ ok, errors[], warnings[] }` kèm số; người sửa trên thẻ xem trước; Executor đi cùng đường code với giao diện.

## Đã làm

### Module `apps/api/src/ai/`

| Thành phần | Tệp | Việc |
|---|---|---|
| `AiConfigService` | `ai-config/ai-config.service.ts` | Chọn cấu hình lúc chạy theo thứ tự (workspace, purpose) → (workspace, GENERAL) → (hệ thống, purpose) → (hệ thống, GENERAL) → **dự phòng env** (`AI_PROVIDER`, `GEMINI_API_KEY`…); năng lực/giá tra `ai_model_catalog` — model chưa có trong catalog dùng năng lực an toàn (không ép JSON). CRUD `ai_configs` (khoá AES-256-GCM, chỉ trả `apiKeyMasked`), catalog (đọc cho mọi người; ghi cần `SYSTEM_ADMIN_EMAILS` — tạm tới Phase 7b), prompt có phiên bản (MASTER chỉ đọc, WORKSPACE mỗi PUT +1 version), sổ token gộp theo ngày/mục đích/người. Seed 4 model **đã thử thật** lúc khởi động (upsert, không ghi đè giá Admin đã sửa). |
| `advanced-params.ts` | | zod cho `advanced_params`: temperature, maxOutputTokens, thinkingBudget, `promptCache {enabled, ttlSeconds, minStaticChars}` (mặc định tắt), `trace`. Guard "hợp nhà cung cấp": bật cache cho model `cache_mode = NONE` → 422 `AI_CONFIG_INVALID`. |
| `crypto.util.ts` | | AES-256-GCM, khoá = sha256(`APP_KEY`); thiếu APP_KEY → không lưu được khoá (422 `AI_KEY_ENCRYPTION_MISSING`), đổi APP_KEY → giải mã ném lỗi rõ, không trả rác. `hashPrompt` 32 ký tự. |
| `ContextBuilderService` | `context/context-builder.service.ts` | Nạp **mới từ DB mỗi lượt** 4 tầng: chính sách (Master v + Workspace v + khung đầu ra theo mục đích), sự thật (danh bạ có kỹ năng, danh mục kỹ năng + alias, dự án & sprint, task mở, **bảng năng lực theo ngày** từ `WorkloadService.capacityTable`, EAR/đúng hạn từ `MetricsService`; với EXPLAIN: số liệu `ForecastService.forecast` + `burndown` + task trong sprint), ý định (memory CONFIRMED ≤ 50, thói quen tin cậy ≥ 0,6, `users.ai_personal_prompt`), danh tính (mã ngắn). Mã u/t/s/k cấp theo thứ tự **ổn định** (vào dự án trước → số nhỏ; kỹ năng theo nhóm/tên; sprint theo ngày) — `CodeBook` (`context/short-codes.ts`), lưu `ai_proposals.code_map`. Dữ liệu vào dạng **bảng `cột | cột`**, không JSON. |
| `PromptAssembler` | `prompt/prompt-assembler.ts` | Thuần: khối có tiêu đề `--- X --- … --- HẾT X ---`; tĩnh trước mốc `════════ DỮ LIỆU HAY THAY ĐỔI`, động sau; `staticHash` sha256; `tachPromptTinhDong` không thấy mốc/mốc ở đầu → gửi nguyên. Master prompt mặc định theo 05 §11 (`prompt/master-prompt.ts`) + `PURPOSE_INSTRUCTIONS` cho DECOMPOSE/EXPLAIN. |
| `AiProviderService` | `provider/ai-provider.service.ts` | Gemini `generateContent` (systemInstruction, `responseMimeType: application/json`, `responseSchema` phẳng theo mục đích, `thinkingConfig` tuỳ chọn, `cachedContent` khi bật cache), Ollama `/api/chat` (`format` = JSON Schema), `FAKE` (dev/test). Retry 3 lần cho 408/429/5xx/lỗi mạng (lùi cấp số nhân, tôn trọng `retry-after`), timeout theo `timeout_ms`, tính tiền theo giá catalog (token cache rẻ hơn), **luôn ghi `ai_token_logs`** kể cả lỗi (`user_message` cắt 2.000 ký tự, `prompt_hash`, phiên bản prompt, `raw_response` khi lỗi/bật trace). Lỗi → 503 `AI_PROVIDER_UNAVAILABLE` kèm `retryAfterSeconds`. |
| `GeminiPromptCacheService` | `provider/gemini-prompt-cache.service.ts` | `cachedContents` có `ttl`; khoá `(model, staticHash)`; chỉ khi `promptCache.enabled` và model khai `GEMINI_CACHED_CONTENTS` và phần tĩnh ≥ `minStaticChars`; mọi nhánh hỏng → gửi nguyên prompt, nghỉ 5 phút. |
| `ResponseParser` | `parser/response-parser.ts` | Thuần, không ném: bỏ fence/văn bản lạc → JSON → zod `structuredActionSchema`; thất bại → `CHAT_RESPONSE { parseFailed }` + issues. |
| `ActionValidatorService` | `validator/action-validator.service.ts` | `validateDecompose` trên dữ liệu sống: sprint tồn tại/chưa đóng và trùng sprint đích; 1–25 task, draftKey duy nhất, ước lượng 0,5–40 h; kỹ năng mã k → UUID (mã lạ = `UNKNOWN_CODE`), tên do LLM sinh → chuẩn hoá bỏ dấu/alias, không khớp → cảnh báo `SKILL_UNKNOWN` và bỏ khi tạo; người gợi ý: `UNKNOWN_CODE` / `ASSIGN_NOT_MEMBER` / `ASSIGN_ON_LEAVE` (nghỉ trọn cửa sổ) / `ASSIGN_SKILL_GAP` (mức < yêu cầu, kèm số) / `ASSIGN_CAPACITY_EXCEEDED` (giờ giao > giờ trống tới hết sprint, `freeByDay`) / `ASSIGN_OVERLOAD` (U sau khi nhận > `thresholds.overload`, từ `computeUsers`); `DEPENDENCY_CYCLE` (DFS); cảnh báo `SPRINT_CAPACITY` khi tổng vượt giờ trống cả nhóm. Trả thêm `resolution` (mã → UUID đã đối chiếu) cho Executor — action gốc **không bị sửa** (có test). `validateExplain`: `riskLevel` phải trùng backend. |
| `ProposalsService` | `proposals/proposals.service.ts` | Vòng đời `ai_proposals`: tạo DRAFT thì DRAFT cũ cùng (dự án, người, loại) → EXPIRED (khớp partial unique index); khoá trong bộ nhớ → lượt trùng 409 `AI_IN_PROGRESS`; cùng yêu cầu (hash requirement+sprint+detail) → trả DRAFT đang mở với `cached: true`, không gọi AI; reject ghi `ai_feedback(REJECTED)`; cron 03:00 dọn theo tuổi (7/30/180 ngày). |
| `ExecutorService` | `executor/executor.service.ts` | Áp dụng theo thứ tự tô-pô: `TasksService.create(source = AI)` + `createSubtask` (cùng đường code với UI → `task.created` → realtime, thông báo, tính lại tải), `task_dependencies`, `tasks.ai_proposal_id`, `ai_feedback` từng dòng (ACCEPTED / CHANGED_USER / CHANGED_HOURS / REJECTED cho task bị bỏ), proposal → APPLIED, phát `ai.proposal.applied`. Lỗi giữa chừng → xoá mềm task đã tạo (bù trừ) rồi ném lại. `applyEdits` (thuần) gộp sửa của người rồi zod lại. |
| `QuotaService` | `quota/quota.service.ts` | Hạn mức/người/ngày từ `settings.ai.dailyLimitPerUser` (0 = không giới hạn), đếm `ai_token_logs` từ 0h theo **múi giờ người dùng** (không thư viện), trừ dòng QUOTA; hết → ghi dòng QUOTA + 429 kèm `resetsAt`; `settings.ai.enabledPurposes` tắt → 403 `AI_PURPOSE_DISABLED`. |
| `AiService` | `ai.service.ts` | Điều phối một lượt: quyền (pj:PM) → hạn mức → khoá → context → provider → parse → validate → **gọi lại một lần** kèm `LỖI KIỂM TRA LƯỢT TRƯỚC` (JSON hỏng hoặc Validator lỗi) → DRAFT. `ASK_CLARIFICATION`/`CHAT_RESPONSE` trả về với `proposalId: null`. `explain`: cache 6 h theo sprint, chỉ dùng lại khi mức và giờ còn lại chưa đổi. `apply`: `Idempotency-Key` → lặp trả kết quả cũ; không khoá → 409 `PROPOSAL_ALREADY_APPLIED`; bản sửa không qua Validator → 422 `PROPOSAL_VALIDATION_FAILED { errors, warnings }`. |
| Controller | `ai.controller.ts`, `ai-admin.controller.ts` | 3.11: `POST /projects/:id/ai/decompose`, `GET /ai/proposals/:id`, `POST …/apply`, `POST …/reject`, `GET /ai/quota?workspaceId=`, `POST /sprints/:id/forecast/explain`. 3.12: `GET/POST/PATCH /ai-config/models`, `GET/POST /workspaces/:wsId/ai-configs`, `PATCH/DELETE /ai-configs/:id`, `POST /ai-configs/:id/test`, `GET/PUT /workspaces/:wsId/ai-prompts/:type`, `GET /workspaces/:wsId/ai-usage`. |
| Sự kiện | `ai.events.ts`; `realtime.listener.ts`; `notifications.listener.ts` | `ai.proposal.applied` → socket `ai:proposal:applied` (phòng dự án) + thông báo `AI_PROPOSAL_APPLIED` cho thành viên dự án (trừ người áp dụng); người được giao vẫn nhận `TASK_ASSIGNED` như tạo tay. |
| Shared | `packages/shared/src/structured-action.ts` | zod discriminated union 9 loại action (05 §4), `ValidationResult/Issue`; mã lỗi mới: `AI_PURPOSE_DISABLED`, `AI_IN_PROGRESS`, `AI_CONFIG_INVALID`, `AI_KEY_ENCRYPTION_MISSING`, `PROPOSAL_NOT_DRAFT`, `PROPOSAL_VALIDATION_FAILED`. |

### Cấu hình

- `.env`: `AI_PROVIDER=gemini | ollama | fake` (dự phòng khi workspace chưa có `ai_configs`), `GEMINI_API_KEY`, `GEMINI_MODEL`, `OLLAMA_*`, `AI_DAILY_LIMIT_PER_USER`, `APP_KEY` (bắt buộc để lưu khoá trong DB), `SYSTEM_ADMIN_EMAILS`.
- Cấu hình DB không kèm khoá với Gemini → dùng `GEMINI_API_KEY` của máy chủ (một khoá dùng chung khi demo).
- Không có migration mới: 15 bảng AI đã có từ Phase 0b–0e.

### Khác

- `test/realtime.e2e-spec.ts`: ca `workload:updated` ghi rõ `startDate/dueDate` trong tuần hiện tại — trước đây task không ngày nên chạy vào Thứ Sáu chỉ còn 1/6 tải trong tuần → mức NORMAL, test rớt tuỳ ngày.

## Kiểm thử

- Đơn vị (`src/ai/*.spec.ts`, 33 ca; tổng 67): Validator **7 mã lỗi** + chuẩn hoá tên kỹ năng + không sửa action; graph (vòng, tô-pô, bỏ dấu); PromptAssembler (thứ tự tĩnh/động, hash ổn định, tách mốc, bảng); ResponseParser; CodeBook; crypto (đổi APP_KEY → lỗi rõ); Gemini URL/body/schema/usage; `estimateCost`; fake provider; `applyEdits`; `dayBounds` theo múi giờ.
- E2E `test/ai.e2e-spec.ts` (20 ca; tổng 63) với `AI_PROVIDER=fake`: PM phân rã → DRAFT (validation ok, facts, cảnh báo SKILL_UNKNOWN, log SUCCESS có `user_message`/`prompt_hash`) → bấm trùng trả DRAFT cũ → GET (MEMBER 403) → áp dụng kèm sửa (giờ d2, bỏ d3) → 2 task `source = AI`, subtask, phụ thuộc, `ai_feedback` 3 loại, thông báo `AI_PROPOSAL_APPLIED` + `TASK_ASSIGNED`, idempotent theo khoá, 409 khi lặp không khoá; vòng phụ thuộc LLM không tự sửa → 422 khi áp dụng → PM sửa → 201; mã lạ → gọi lại tự sửa (`attempts = 2`); mã lạ giữ nguyên → lỗi UNKNOWN_CODE; 400 h → ASSIGN_CAPACITY_EXCEEDED kèm số; mơ hồ → ASK_CLARIFICATION; JSON hỏng hai lần → 503 + log INVALID_OUTPUT có raw; từ chối → REJECTED + feedback; hạn mức 429 kèm `resetsAt`, dòng QUOTA không tính vào `used`; tắt EXPLAIN → 403; giải thích rủi ro: mức = backend, nguyên nhân OVERDUE, lần hai `cached`; quản trị: catalog từ DB, ghi catalog 403, tạo cấu hình (khoá mã hoá 3 phần, `apiKeyMasked`), một mặc định mỗi mục đích, bật cache cho model NONE → 422, gọi thử thất bại → `{ ok: false }` + log ERROR, prompt MASTER chỉ đọc / WORKSPACE tăng version và lượt sau ghi `workspace_prompt_version`, sổ token theo mục đích/người.
- `npm run api:lint && npm run api:test && npm run api:test:e2e` xanh.

## Cách thử tay với Gemini thật

1. Đặt `GEMINI_API_KEY` trong `apps/api/.env` (hoặc tạo cấu hình workspace qua `POST /workspaces/:wsId/ai-configs` với `catalogId` của `gemini-2.5-flash`), `APP_KEY` bất kỳ ≥ 8 ký tự.
2. `npm run api:dev` → Swagger `/docs` nhóm **AI** và **Quản trị AI**.
3. `POST /projects/:id/ai/decompose { requirement, sprintId, detail }` → xem `action.tasks`, `validation`, `usage` (token, ms, chi phí) → `POST /ai/proposals/:id/apply { edits }`.
4. Kiểm chứng cache/chi phí: `SELECT created_at, purpose, input_tokens, cached_input_tokens, output_tokens, estimated_cost, duration_ms, status FROM ai_token_logs ORDER BY created_at DESC LIMIT 10;`

## Chưa làm / để phase sau

- Chat theo phiên, `ASSIGN_PROPOSAL`/`REBALANCE`/`UPDATE_TASK_DRAFT`, memory/habit API, cache kết quả chat: Phase 9 (schema zod đã có sẵn trong shared).
- Ghi `task_dependencies` trong Executor là ghi trực tiếp vì `PUT /tasks/:id/dependencies` (S1) chưa có; Phase 8 làm xong thì Executor gọi service đó.
- Phân quyền động (nhóm quyền theo chức năng, thay `SYSTEM_ADMIN_EMAILS`): **Phase 7b** `feature/be-p7b-permissions`.
- Bộ hồi quy 20 kịch bản (05 §12) cần Gemini thật — làm khi có khoá và dữ liệu seed demo (Phase 10).
