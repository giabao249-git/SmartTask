# Phase 8 — Chat theo phiên với bản nháp sửa nhiều lượt

Nhánh `feature/be-p8-chat` (từ `feature/be-p7-ai`). 18/09/2026. Hợp đồng: [12-chat-phien-va-ban-nhap](../04-kien-truc/12-chat-phien-va-ban-nhap.md); action theo [05 §4, §7b, §7c](../04-kien-truc/05-ai-agent.md), trí nhớ vào prompt theo [06](../04-kien-truc/06-tri-nho-ai.md). Tham chiếu Table_Calendar `ai-v2/*` và `06-ai-call-flow.md` (kịch bản C "lấy cái thứ hai", D sửa rồi duyệt).

> Quy tắc bất biến: LLM suy luận; backend chỉ tính, kiểm và **ghi khi người duyệt**. Không lượt chat nào ghi task thật — chỉ `POST /ai/proposals/:id/apply`. Backend không xếp hạng, không tự chọn người (DANH TÍNH là dữ liệu, chính sách chọn người nằm ở WORKSPACE prompt do admin viết), không tự sửa action (Validator chỉ báo lỗi; key lạ → `UNKNOWN_DRAFT_KEY`, LLM được gọi lại một lần rồi phải hỏi lại người dùng).

## A. Dữ liệu (migration `20260918032123_chat_sessions_drafts`)

| Bảng | Thay đổi |
|---|---|
| `ai_proposals` | `+ session_id → chat_sessions (SetNull)`, `+ version` (khoá lạc quan), `+ item_status jsonb {d1: DRAFT\|APPLIED\|DISCARDED}`, `+ applied_map jsonb {d1: task uuid}`, kind `+ TASK_UPDATE`; `@@index(session_id, status, created_at)`. SQL tay: partial unique `ai_proposals_one_draft` đổi thành `WHERE status='DRAFT' AND session_id IS NULL` (phiên chat được nhiều DRAFT cùng loại; form vẫn một); CHECK `item_status`/`applied_map` là object |
| `chat_sessions` | `+ next_draft_seq` (cấp draftKey duy nhất trong phiên, không tái dùng), `+ last_turn_at`, `+ archived_at`; index `(user_id, project_id, archived_at, last_turn_at)` |
| `workspace_members` | `+ department`, `+ title` (varchar 80), `+ manager_user_id → users (SetNull)` |
| `member_aliases` (mới) | `workspace_id, user_id, alias citext, created_by_id`; unique `(workspace_id, alias)` |

`prisma migrate dev --create-only` sau khi áp ra migration rỗng (đã kiểm, đã xoá).

## B. `packages/shared`

- `DISCARD_DRAFT { targetDraftKeys[] | all }`; `UPDATE_TASK_DRAFT` nhận `targetDraftKey | targetDraftKeys[]` (nháp) hoặc `targetTask` (task thật) + `patch` theo `draftPatchSchema` (trường không gửi = giữ, `null` = xoá) + `resolutionReason`; `CHAT_RESPONSE.suggestApply`; `ASK_CLARIFICATION.options[{code,label}]`; `draftKey` server cấp trên `UPDATE_TASK_DRAFT`/`assignments[]`/`moves[]`; `DraftItemStatus`.
- Mã lỗi: `AI_TURN_IN_PROGRESS`, `PROPOSAL_VERSION_CONFLICT`, `UNKNOWN_DRAFT_KEY`, `DRAFT_ALREADY_APPLIED`.

## C. ContextBuilder (mục đích `CHAT`)

- Khối tĩnh **DANH TÍNH**: mã u, họ tên, tên gọi, chức danh, phòng ban, quản lý (mã u), alias — ghi rõ "chỉ để nhận diện, KHÔNG phải chính sách". Chính sách chọn người đọc từ `ai_prompt_configs` type WORKSPACE (không hard-code); Master prompt thêm quy tắc 9 "không chọn người chỉ vì tên gần giống".
- Khối động **BẢN NHÁP ĐANG MỞ TRONG PHIÊN**: mọi proposal của phiên `[p1 · DECOMPOSE · DRAFT · version 1] d1 … · d2 …`, item ✓ (kèm mã t của task đã tạo) / ✗ đã bỏ, `next = d{seq}`; **LỊCH SỬ PHIÊN** 20 tin gần nhất kèm `structured_data` (để LLM giải "cái thứ hai"); **NGƯỜI ĐANG CHAT**; yêu cầu hiện tại kèm `selectedCode` khi trả lời chip.
- Task mở liệt kê **cả dự án** (mã t để tham chiếu task thật) kèm cột sprint; bảng năng lực như Phase 7.
- `PURPOSE_INSTRUCTIONS.CHAT` mô tả 10 loại action; `RESPONSE_SCHEMAS.CHAT` là schema phẳng gộp mọi trường (Gemini không có oneOf), trường patch `nullable`.

## D. ProposalsService / Executor / Validator

- `proposals/draft-items.ts` (thuần, có test): `assignServerKeys(action, firstSeq)` đổi key LLM → `d{seq}` kể cả `dependsOn`, trả `keyMap` (ghi `code_map.drafts`); `patchItem` vá vào đúng item rồi zod lại; `filterItems` tập con; `deriveStatus` (còn DRAFT → DRAFT; hết DRAFT có APPLIED → APPLIED; toàn DISCARDED → REJECTED); `itemsOf` một hình dạng cho 5 kind.
- `createInSession`: một giao dịch `update chat_sessions set next_draft_seq += n` → so với seq đã dùng khi đổi key → lệch thì ném (lượt được làm lại); `payload.proposed` giữ bản LLM gốc để `ai_feedback` đối chiếu.
- `locate(proposals, keys)`: key lạ / đã bỏ → `UNKNOWN_DRAFT_KEY`, đã duyệt → `DRAFT_ALREADY_APPLIED` (kèm `taskId`) — trả issues cho LLM sửa, không ném.
- `savePatched` (LLM hoặc tay, `edited[d]` cho sửa tay) / `discardItems` (feedback REJECTED) / `markApplied` (item APPLIED, `applied_map`, feedback ACCEPTED / CHANGED_USER / CHANGED_HOURS) — mỗi lần `version + 1` và phát `ai.proposal.updated`.
- `AiService.apply {draftKeys?, version?, edits?}`: kiểm version → 409; chỉ duyệt item còn DRAFT (APPLIED → 409, DISCARDED → 422); validate **tập con** trên dữ liệu sống; Executor tổng quát: DECOMPOSE/TASK_DRAFT tạo task (phụ thuộc nối được sang task đã duyệt lượt trước qua `applied_map`), TASK_UPDATE → `TasksService.update` (+`setAssignees`), ASSIGN/REBALANCE → `setAssignees`. Idempotency-Key giữ như Phase 7. `reject {draftKeys?}` huỷ một phần. `patchItem` (sửa tay) validate lại cả proposal.
- Validator thêm `validateAction` điều phối: `validateTaskDrafts` (= decompose + start ≤ due, hạn đã qua → cảnh báo), `validateTaskUpdate` (task sống trong dự án, người/sprint hợp lệ, patch rỗng → lỗi, `status` → cảnh báo chưa hỗ trợ), `validateAssignments`.

## E. API

| Endpoint | Ghi chú |
|---|---|
| `POST /ai/chat {projectId, sessionId?, text, selectedCode?, sprintId?}` | pj:MEMBER; khoá theo phiên → `409 AI_TURN_IN_PROGRESS`; hạn mức CHAT; trả `{sessionId, session, message, action, validation, proposals (TOÀN BỘ của phiên), usage}` |
| `GET /ai/sessions?projectId=&includeArchived=` · `POST /ai/sessions` · `GET /ai/sessions/:id` (`{session, messages[], proposals[]}`) · `GET /ai/sessions/:id/proposals` · `PATCH /ai/sessions/:id {title?, archived?}` · `DELETE /ai/sessions/:id` | chỉ chủ phiên (`session.userId === req.user`, khác → 404); xoá → DRAFT của phiên REJECTED, APPLIED giữ (session_id SetNull); phiên lưu trữ không chat được (409) |
| `PATCH /ai/proposals/:id/items/:draftKey {patch, version}` | sửa tay; 409 lệch version; 422 key lạ; 409 item đã duyệt |
| `POST /ai/proposals/:id/apply {draftKeys?, version?, edits?}` · `POST /ai/proposals/:id/reject {draftKeys?, reason?}` | duyệt/huỷ toàn bộ hoặc một phần; quyền: PM/quản trị hoặc người tạo là thành viên dự án |
| `GET/PUT /workspaces/:wsId/ai/prompt` · `GET/POST/DELETE /workspaces/:wsId/member-aliases[/:id]` · `PATCH /workspaces/:wsId/members/:userId/identity {department, title, managerUserId}` | admin (OWNER/ADMIN); alias trùng (citext) → 409; quản lý là chính mình → 422 |

Realtime: `ai:proposal:updated {sessionId, projectId, proposal}` và `ai:session:updated {sessionId, change}` tới `user:{id}`; `ai:proposal:applied` tới phòng dự án như Phase 7.

## F. Kiểm thử

- Đơn vị `src/ai/proposals/draft-items.spec.ts` (7 ca; tổng 74): cấp key + dependsOn, key server cho TASK_UPDATE/ASSIGN, vá patch/null/key lạ/không sửa đối tượng vào, lọc tập con, suy trạng thái.
- E2E `test/ai-chat.e2e-spec.ts` (12 ca; tổng 75) với `AI_PROVIDER=mock` (`AiMockQueue.push(action | fn(prompt))`, hàng đợi rỗng rơi về `fake` nên e2e Phase 7 giữ nguyên): phân rã qua chat → key server d1..d3, prompt có DANH TÍNH (alias, chức danh, phòng ban) + BẢN NHÁP + `next = d1`, master có quy tắc "tên gần giống"; "cái thứ hai đổi 6 giờ, giao Lan" → vá d2, version 2, prompt lượt sau thấy `[p1 · DECOMPOSE · DRAFT · version 1]` và LỊCH SỬ có structured_data; "bỏ d3" → DISCARDED + feedback; d9 → UNKNOWN_DRAFT_KEY cả sau khi gọi lại, nháp không đổi; hai lượt chồng → 409; "duyệt đi" → suggestApply không tạo task; duyệt d1,d2 sai version 409 → đúng → task nguồn AI, ước lượng 6 h, người Lan, phụ thuộc d2→d1, `applied_map`, proposal APPLIED, feedback ACCEPTED/CHANGED_USER/REJECTED, duyệt lại → 409; mở lại GET session đủ 12 tin + trạng thái item; người khác 404; sửa d1 đã duyệt → DRAFT_ALREADY_APPLIED; sửa task thật → TASK_UPDATE d4 → duyệt → hạn đổi, version task 2, không tạo task mới; CREATE_TASK_DRAFT d5,d6 → sửa tay kèm version (409/200/422) → ASK_CLARIFICATION → `selectedCode` vào prompt → từ chối một phần; phiên đổi tên/lưu trữ/mở lại/xoá; alias trùng 409, quản lý chính mình 422, WORKSPACE prompt vào system prompt lượt sau.
- `npm run api:lint && npm run api:test && npm run api:test:e2e` xanh.
- `node scripts/ai-smoke.mjs --chat` chạy 3 lượt chat với provider thật (hoặc fake) và in bản nháp.

## Chưa làm / phase sau

- Đổi cột/trạng thái task qua chat (`patch.status`) — cảnh báo "chưa hỗ trợ" (cần `move` với vị trí).
- `MEMORY_PROPOSAL` chỉ hiển thị thẻ; ghi memory/habit API (docs 06 §7) và bộ hồi quy 20 kịch bản: Phase 9.
- ASSIGN/REBALANCE validate mới ở mức thành viên/task sống; kiểm giờ trống trước hạn từng dòng theo bảng năng lực (S4 capacity-table) bổ sung ở Phase 9.
- Phân quyền động (Phase 7b) thay `SYSTEM_ADMIN_EMAILS`.
