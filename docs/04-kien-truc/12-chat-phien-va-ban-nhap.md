# 12 · Chat theo phiên và bản nháp có thể sửa nhiều lượt

Mục tiêu: người dùng **chat** để tạo/sửa việc thay vì dán yêu cầu vào form rồi nhận một kết quả cứng. Nếu AI phân rã sai, người nói tiếp "cái thứ ba đổi thành 6 giờ, giao Lan, bỏ cái thứ năm" — bản nháp bên phải cập nhật theo, và chỉ khi người bấm **Duyệt** thì task thật mới được tạo (thẻ chuyển xanh lá).

Kế thừa từ Table_Calendar AI V2 (`~/Table_Calendar/docs/ai-scheduling-architecture/04–08`): bốn tầng thẩm quyền, structured action có `draftKey`, `targetDraftKey` + `patch` + `resolutionReason` cho lượt sửa, lịch sử chat gửi kèm `structuredData` để LLM tự giải tham chiếu "cái thứ hai", danh tính (alias/nhóm) chỉ để **nhận diện** không mang chính sách. Điểm Table_Calendar làm chưa tốt và SmartTask sửa: bản nháp ở đó chỉ sống trong `structuredData` + localStorage của trình duyệt → mở lại phiên là mất, mở hai tab là lệch. SmartTask lưu bản nháp ở server (`ai_proposals.session_id`) và UI **chỉ vẽ từ server**.

Quy tắc bất biến giữ nguyên ([05](05-ai-agent.md)): LLM suy luận (chọn người, chia việc, ước lượng), backend chỉ tính sẵn số liệu, kiểm hợp lệ và ghi khi người duyệt; backend không bao giờ thay thế/xếp hạng hộ.

## 1. Danh mục intent (từ câu nói → action → bản nháp)

| # | Người nói | Action LLM trả | Ảnh hưởng tới bản nháp trong phiên |
|---|---|---|---|
| 1 | "Phân rã yêu cầu: …", "chia nhỏ US-12" | `DECOMPOSE_PROPOSAL` (tasks d1…dN) | tạo **proposal mới** kind `DECOMPOSE` |
| 2 | "Tạo 3 task cho màn đăng nhập, giao Huy, hạn thứ Sáu" | `CREATE_TASK_DRAFT` (drafts) | tạo proposal mới kind `TASK_DRAFT` |
| 3 | "cái thứ hai đổi 6 giờ", "d3 giao Lan", "tất cả dời hạn sang 24/10", "gộp d4 vào d2" | `UPDATE_TASK_DRAFT` `{targetDraftKey \| targetDraftKeys[], patch, resolutionReason}` | **vá vào proposal đang mở** chứa key đó; không tạo dòng mới |
| 4 | "bỏ cái thứ năm", "xoá hết nháp" | `DISCARD_DRAFT` `{targetDraftKeys[] \| all:true}` | item → `DISCARDED`; proposal hết item DRAFT → `REJECTED` |
| 5 | "Dời hạn ST-12 sang 24/10", "đổi người làm ST-7 thành Lan" (task **thật**) | `UPDATE_TASK_DRAFT` `{targetTask: t7, patch}` | tạo proposal kind `TASK_UPDATE` (kèm `version` task lúc đề xuất) |
| 6 | "Giao hết việc sprint 3, đừng dồn cho Lan" | `ASSIGN_PROPOSAL` | proposal kind `ASSIGN` |
| 7 | "Ai đang quá tải? Gỡ bớt cho Minh" | `REBALANCE_PROPOSAL` | proposal kind `REBALANCE` |
| 8 | "Sprint này có kịp không?" | `RISK_EXPLANATION` | không tạo nháp (thẻ số liệu trong chat) |
| 9 | "Lan còn bao nhiêu giờ trống tuần này?" | `CHAT_RESPONSE` (+`dataRef`) | không |
| 10 | "Từ giờ đừng giao Minh tuần cuối tháng" | `MEMORY_PROPOSAL` | thẻ ghi nhớ chờ xác nhận (không phải proposal task) |
| 11 | "Giao cho Bảo" (có 2 Bảo), yêu cầu thiếu dữ liệu | `ASK_CLARIFICATION` `{question, options:[{code,label}]}` | không; lượt sau UI gửi `selectedCode` |
| 11b | "ai có thể làm task này", "ai rảnh nhận d2" | `DATA_QUERY` intent `TASK_CANDIDATES` (`filters.task` hoặc `filters.draft`) | không — backend trả bảng ứng viên (xem [14](14-tra-cuu-hoi-dap.md)) |
| 12 | "Duyệt đi", "ok tạo hết" | `CHAT_RESPONSE` + `suggestApply: true` | **không ghi** — UI chỉ nhấp nháy nút Duyệt; tạo thật luôn qua nút |

Cố ý không có qua chat: đổi cấu hình workspace/vai trò/prompt/alias, xoá dự án/sprint, xoá task thật (chỉ đề xuất đổi trạng thái).

## 2. Mô hình dữ liệu (thay đổi so với [08](08-mo-hinh-du-lieu.md))

```
ai_proposals
  + session_id      uuid NULL → chat_sessions (SetNull)      -- NULL = tạo từ form (decompose cũ)
  + version         int default 1                            -- khoá lạc quan khi duyệt/sửa
  + item_status     jsonb  { "d1":"DRAFT"|"APPLIED"|"DISCARDED", … }
  + applied_map     jsonb  { "d1":"<task uuid>", … }         -- để thẻ xanh lá link sang ST-xx
  ~ kind            + TASK_UPDATE
  ~ index một-DRAFT-mỗi-(project,user,kind) đổi thành:  WHERE status='DRAFT' AND session_id IS NULL
  + index (session_id, status, created_at)

chat_sessions
  + next_draft_seq  int default 1     -- cấp draftKey duy nhất trong phiên (d1, d2, … không tái dùng)
  + last_turn_at    timestamptz
  + archived_at     timestamptz NULL

workspace_members            -- dữ liệu để LLM "suy luận tên người" theo chính sách
  + department      varchar(80) NULL
  + title           varchar(80) NULL
  + manager_user_id uuid NULL → users

member_aliases (mới, admin quản lý, giống Table_Calendar UserAlias)
  workspace_id, user_id, alias citext, created_by  — unique (workspace_id, alias)
```

Trạng thái proposal suy ra từ item: còn ≥1 item DRAFT → `DRAFT`; hết DRAFT và ≥1 APPLIED → `APPLIED`; hết DRAFT và 0 APPLIED → `REJECTED`; quá `expires_at` → `EXPIRED` (cron cũ).

## 3. Khoá và nhất quán (chỗ dễ lỗi)

| Rủi ro | Cơ chế |
|---|---|
| Nháp "lạc" sang phiên khác | mọi truy vấn proposal của panel đi qua `session_id`; `UPDATE_TASK_DRAFT` chỉ được vá key **thuộc phiên hiện tại** (Validator tra `draftKey → proposalId` trong phiên; key lạ = `UNKNOWN_DRAFT_KEY`, LLM được bảo hỏi lại) |
| Mở lại phiên cũ bị mất nháp | nháp ở DB; `GET /ai/sessions/:id` trả `{session, messages, proposals}` một lần; UI không giữ nháp trong localStorage |
| Hai tab / hai lượt chồng nhau | khoá server theo phiên: lượt mới khi lượt cũ chưa xong → `409 AI_TURN_IN_PROGRESS`; duyệt kèm `version` → lệch = `409 PROPOSAL_VERSION_CONFLICT` |
| draftKey trùng giữa hai proposal trong phiên | server cấp key từ `next_draft_seq` khi lưu (đổi key LLM trả về theo bảng ánh xạ, ghi vào `code_map`); ngữ cảnh lượt sau liệt kê key thật nên LLM không tự bịa |
| Model trả `targetTask: ""`, nhét `dN` vào `targetTask`, hoặc để phần sửa trong `tasks[]` thay vì `patch` | `response-parser.normalizeAction` nắn lại trước khi kiểm schema (chỉ phép biến đổi không mang tính quyết định) và ghi vào log `[AI] đã nắn đầu ra`; `UPDATE_TASK_DRAFT` không có gì để sửa → `CHAT_RESPONSE` (không phải lỗi JSON) |
| Duyệt xong mà chat vẫn "sửa" item đã tạo | Validator: item `APPLIED` không nhận patch → LLM phải chuyển sang `UPDATE_TASK_DRAFT{targetTask}` (task thật, proposal `TASK_UPDATE` mới) |
| Hạn mức | mỗi lượt chat = 1 lượt gọi; nháp hết hạn 7 ngày như cũ |

## 4. Ngữ cảnh mỗi lượt (ContextBuilder thêm 2 khối)

Ngoài các khối đã có (chính sách, bảng năng lực, giờ trống, kỹ năng, task, lịch sử chat có `structuredData`), thêm:

```
════════ BẢN NHÁP ĐANG MỞ TRONG PHIÊN (chỉ được sửa các key này; key mới phải từ d{next} trở đi)
[p1 · DECOMPOSE · DRAFT] d1 Thiết kế schema (8h, k3≥3, → u2) · d2 API đăng nhập (6h, → u2, sau d1) · d3 …
[p2 · TASK_DRAFT · APPLIED] d7 ✓ ST-31 · d8 ✓ ST-32
next = d9

════════ DANH TÍNH (admin quản lý — chỉ để nhận diện, KHÔNG phải chính sách giao việc)
u1 Nguyễn Thị Lan · PM · Phòng Phát triển · quản lý: —          · alias: "chị Lan", "Lan PM"
u2 Trần Văn Minh   · Backend · Phòng Phát triển · quản lý: u1   · alias: "Minh BE"
u5 Phạm Bảo        · QA · Phòng Kiểm thử · quản lý: u4           · alias: "Bảo QA"
u6 Lê Bảo          · Fullstack · Phòng Phát triển · quản lý: u1  · alias: —
Người đang chat: u1 (Phòng Phát triển)
```

Chính sách chọn người nằm ở **WORKSPACE prompt** (admin sửa trên màn cấu hình AI, bảng `ai_prompt_configs` type `WORKSPACE`), ví dụ: *"Khi tên trùng, ưu tiên người cùng phòng ban với người đang chat; khi giao việc ưu tiên cấp dưới trực tiếp của người chat; nếu vẫn không chắc thì hỏi lại."* Backend chỉ **cấp dữ liệu** (phòng ban, quản lý, alias); việc chọn u5 hay u6 là của LLM; không chắc → `ASK_CLARIFICATION` với options. Master prompt bổ sung một quy tắc: *"Không bao giờ chọn người chỉ vì tên gần giống; phải có căn cứ từ DANH TÍNH hoặc chính sách."*

## 5. API (bổ sung vào [11](11-chot-chuc-nang-va-api.md) mục S9)

| Endpoint | Ghi chú |
|---|---|
| `POST /ai/chat` `{projectId, sessionId?, text, selectedCode?}` | tạo phiên lười nếu thiếu; trả `{sessionId, message, action, validation, proposals}` — `proposals` là **toàn bộ** proposal của phiên sau lượt này (UI thay panel, không merge) |
| `GET /ai/sessions?projectId=` · `POST /ai/sessions` · `PATCH /ai/sessions/:id` (title/archive) · `DELETE /ai/sessions/:id` | tự chủ sở hữu; xoá phiên → proposal DRAFT của phiên → REJECTED, APPLIED giữ (session_id SetNull) |
| `GET /ai/sessions/:id` | `{session, messages[], proposals[]}` — dùng khi mở lại |
| `GET /ai/sessions/:id/proposals` | riêng cho panel/refetch |
| `PATCH /ai/proposals/:id/items/:draftKey` `{patch, version}` | người sửa tay trên panel (không qua LLM); ghi `ai_feedback` EDITED khi duyệt |
| `POST /ai/proposals/:id/apply` `{draftKeys?: [], version}` | duyệt toàn bộ hoặc một phần; trả `{proposal, createdTasks[]}`; phát `ai.proposal.updated` |
| `POST /ai/proposals/:id/reject` `{draftKeys?: []}` | huỷ toàn bộ hoặc một phần |
| `GET/PUT /workspaces/:id/ai/prompt` (WORKSPACE) · `GET/POST/DELETE /workspaces/:id/member-aliases` · `PATCH /workspaces/:id/members/:userId` (department/title/manager) | admin |

Realtime: `ai.proposal.updated {sessionId, proposal}` và `ai.session.updated` tới `user:{id}` — tab thứ hai của cùng người thấy thẻ đổi màu.

## 6. Giao diện (hợp đồng cho `apps/web`)

- Trang `/projects/:key/assistant`: **trái** danh sách phiên (tiêu đề tự đặt từ tin đầu, ngày, số nháp mở, badge kind); **giữa** khung chat; **phải** rail "Bản nháp trong phiên" (ẩn ↔ hiện, ≥1280px mới hiện cạnh nhau; < 1280px là Sheet/tab).
- Rail vẽ **từ `proposals` server trả**, mỗi proposal một Card: tiêu đề theo kind, danh sách item (draftKey, tiêu đề, giờ, người, hạn, badge), nút *Sửa tay* / *Bỏ* từng item, nút **Duyệt** (primary) và *Duyệt các mục đã chọn*.
- Màu theo trạng thái item/proposal, chỉ qua `lib/status.ts`: `DRAFT` viền `info` + badge "AI · chờ duyệt"; `APPLIED` viền/nền `success` (xanh lá) + mã task thật `ST-31` bấm mở Sheet; `DISCARDED` gạch ngang mờ; `EXPIRED` badge `warning`.
- Khi AI trả `UPDATE_TASK_DRAFT` thành công, item vừa đổi nhấp sáng 1 lần (highlight) và cuộn tới; khi `ASK_CLARIFICATION`, chat hiện chip lựa chọn, bấm chip gửi `selectedCode`.
- Không có nút "tạo" nào trong bong bóng chat — tạo thật chỉ ở rail; thẻ trong chat chỉ là bản ghi lịch sử (readonly) và có link "xem ở panel".
- Trạng thái: đang gọi AI (khoá ô nhập + skeleton bong bóng), 409 đang có lượt khác (toast), version conflict (Alert "bản nháp đã đổi ở tab khác — tải lại"), phiên rỗng (EmptyState gợi ý 4 câu lệnh mẫu).
