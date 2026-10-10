# 14. Tra cứu dữ liệu trong hội thoại (DATA_QUERY)

> Trạng thái: **đã hiện thực** 23/09/2026 — API `POST /ai/query`, action `DATA_QUERY`, bộ khối hiển thị trong Trợ lý AI. Mở rộng 28/09/2026 (đề xuất [02/07](../02-phan-tich/07-cai-tien-sprint-va-intent.md) Phase 15–17): một nguồn số với màn hình, ý định sprint mới, ghi chú khi cắt bộ lọc.
> Liên quan: docs 05 (kiến trúc AI), docs 12 (chat theo phiên), quy tắc nền "LLM suy luận, backend tính/kiểm/ghi".

## 1. Vấn đề

Người dùng hỏi trợ lý những câu **tra cứu** chứ không phải tạo việc: "danh sách thành viên", "tuần này có việc nào đến hạn", "ai đang quá tải", "ai biết NestJS", "tháng này tốn bao nhiêu tiền AI". Nếu để LLM tự trả lời bằng ngữ cảnh, nó sẽ **đọc lại số trong prompt rồi tự cộng trừ** — sai số là chuyện sớm muộn, và đó chính là điều quy tắc nền cấm.

## 2. Cách làm: LLM chọn ý định, backend chạy truy vấn

```
Người dùng ──▶ LLM ──▶ DATA_QUERY { intent, filters }   (KHÔNG có số trong reply)
                          │
                          ▼
              AiQueryService.run()  ── đọc CSDL dưới quyền người hỏi
                          │
                          ▼
              QueryResult { blocks[], source, generatedAt }
                          │
                          ▼
              Web vẽ khối (bảng, agenda, heatmap, biểu đồ…) + nút "Làm mới"
```

- **Một lượt LLM duy nhất.** Không cho LLM đọc lại kết quả để bình luận — đắt gấp đôi và không cần: câu dẫn định tính ("Đây là các việc đến hạn tuần này") viết được ngay từ đầu, con số nằm trong khối do backend tính.
- **`reply` không được chứa số** cho phần tra cứu (ghi rõ trong master prompt, mục CHAT).
- Kết quả được lưu cùng tin nhắn (`chat_messages.structured_data.queryResult`) nên mở lại phiên vẫn thấy.

## 3. Mười chín ý định

> Danh sách, câu mẫu và bộ lọc hợp lệ của từng ý định có **một nguồn** trong `packages/shared/src/data-query.ts` (`QUERY_INTENTS`, `QUERY_INTENT_HINT`, `FILTERS_BY_INTENT`); enum của `responseSchema` và đoạn liệt kê trong master prompt (`queryIntentGuide()`) sinh từ đó — unit test `ai/query/intents.spec.ts` chặn lệch.

| Nhóm | intent | Câu hỏi ví dụ | Khối trả về |
|---|---|---|---|
| Công việc | `TASK_LIST` | "còn việc nào chưa giao" | `task_list` |
| | `TASK_AGENDA` | "hôm nay tôi (cần) làm gì", "task tuần này" — việc PHẢI làm | `agenda` (nhóm theo ngày). Với TODAY/THIS_WEEK và trạng thái mở, **gồm cả việc chưa xong đã quá hạn** (nhóm "Quá hạn · dd/mm") |
| | `TASK_DETAIL` | "ST-6 đang thế nào" | `person_card` (thẻ việc) |
| | `TASK_STATS` | "mỗi cột bao nhiêu việc" | `stat_row` + `bar_chart` + `table` |
| | `TASK_BLOCKED` | "việc nào đang bị chặn" | `task_list` (kèm "chờ ST-x") |
| Con người | `MEMBER_LIST` | "danh sách thành viên" | `people_list` |
| | `MEMBER_PROFILE` | "Huy đang làm gì" | `person_card` + `task_list` |
| | `WORKLOAD_WEEK` | "ai đang quá tải" | `stat_row` + `heatmap` |
| | `CAPACITY_FREE` | "ai còn giờ trống (trong sprint này)" — có mã `s` thì cửa sổ = sprint | `note` + `table` |
| | `WHO_KNOWS_SKILL` | "ai biết NestJS ≥ 4" | `people_list` |
| | `TASK_CANDIDATES` | "ai có thể làm task này", "ai rảnh nhận d2" | `note` + `table` |
| | `BUS_FACTOR` | "kỹ năng nào chỉ 1 người biết" | `note` + `table` |
| Tiến độ | `SPRINT_LIST` | "có mấy sprint" | `table` (trạng thái tiếng Việt, xong/tổng, giờ còn lại — **cùng nguồn** `SprintsService.list`) |
| | `SPRINT_PROGRESS` | "sprint còn bao nhiêu giờ, có kịp không, ai gánh nhiều nhất sprint này" (lọc `assignee`) | `stat_row` (xong, còn lại, vận tốc, ngày làm việc còn, ETA, rủi ro, quá hạn) + `line_chart` (thực tế vs lý tưởng) + `note` nguyên nhân + `table` theo người (giờ còn lại / năng lực, cùng nguồn trang Sprint) — **nguyên văn** `ForecastService`, `SprintsService.summary` |
| | `SPRINT_REPORT` | "sprint trước làm được gì, việc nào bị đẩy" (mặc định sprint đóng gần nhất) | `stat_row` + các `task_list` có tiêu đề: đã xong · bị chuyển đi lúc đóng · thêm sau khi bắt đầu · chuyển vào từ sprint trước |
| | `SPRINT_VELOCITY` | "vận tốc 3 sprint gần nhất" (lọc `lastN` 1–10) | `stat_row` + `bar_chart` cột đôi cam kết/hoàn thành + `table` |
| | `ACTIVITY_FEED` | "hôm qua ai sửa gì", "hôm nay tôi **đã** làm gì" (lọc `user`, `range` TODAY/YESTERDAY/THIS_WEEK theo múi giờ người hỏi) | `activity_list` — nhãn dùng chung với màn hình (`packages/shared/activity.ts`), giờ theo múi giờ người hỏi, dòng sprint có tên + số việc |
| Khác | `NOTIFICATION_LIST` | "tôi có thông báo gì" | `stat_row` + `activity_list` |
| | `AI_USAGE` | "tháng này tốn bao nhiêu tiền AI" | `stat_row` + `table` |

## 4. Hợp đồng dữ liệu

**LLM trả về** (`packages/shared/src/data-query.ts`, nằm trong `structuredActionSchema`):

```jsonc
{
  "type": "DATA_QUERY",
  "reply": "Đây là các việc đến hạn tuần này.",      // KHÔNG có số
  "query": {
    "intent": "TASK_AGENDA",
    "sprint": "s2",                                   // hoặc "__all" | "__backlog"
    "filters": { "assignee": ["me"], "dueRange": { "preset": "THIS_WEEK" } },
    "groupBy": "DUE_DATE",
    "limit": 25
  }
}
```

**`TASK_CANDIDATES` — "ai làm được việc này?"** dùng `filters.task` (`tN`, task thật) **hoặc** `filters.draft`
(`dN`, bản nháp đang mở trong phiên — việc chưa ghi nên không có trong CSDL task). Backend gọi
`WorkloadService.candidatesFor` để dựng bảng sự thật từng người: khớp kỹ năng (kèm kỹ năng còn thiếu), giờ hiệu
dụng phải bỏ ra (EAR × độ khó × thiếu kỹ năng), giờ trống trước hạn, mức dùng tuần này. **Không lọc bớt ai và
không chấm điểm ai**; xếp theo (khớp kỹ năng, giờ trống) chỉ để đọc cho dễ — chọn người vẫn là việc của LLM và
người dùng. Sau khi xem bảng, người nói "giao cho X" thì mới sinh `ASSIGN_PROPOSAL` / `UPDATE_TASK_DRAFT`.

**Backend trả về** (`QueryResult`): `blocks[]` + `source { endpoint, params, rowCount }` + `generatedAt` + `truncated?`.
Khối hiện có: `stat_row`, `task_list`, `agenda`, `people_list`, `person_card`, `table`, `heatmap`, `bar_chart`, `line_chart`, `activity_list`, `note`, `empty`. Mỗi item mang `ref { type, id, key }` để bấm mở đúng việc/người.

### 4.2 Không bỏ bộ lọc lặng lẽ (28/09/2026)

`pruneQuerySpec` vẫn cắt bộ lọc không thuộc ý định (LLM hay điền `tN`, `u0` cho field không dùng — cắt im). Nhưng nếu phần bị cắt là bộ lọc **có nghĩa** với người hỏi (`assignee`, `user`, `status`, `taskType`, `priority`, `dueRange`, `q`, `range`, `sprint`), spec được gắn `ignoredFilters` và kết quả có thêm khối `note` "Loại câu hỏi này không lọc được theo … — kết quả dưới đây chưa áp dụng điều kiện đó". Khối `table`/`task_list` có `title` tuỳ chọn; `bar_chart` có cột `compare` + `compareLabel`.

Bổ sung 28/09/2026 (đo với Gemini thật, đề xuất 02/07 F4–F6):
- Bộ lọc `null` bị bỏ trước khi kiểm: `responseSchema` của Gemini **bắt buộc nêu** `minLevel`, `range`, `user` (được null) vì model hay bỏ sót dù câu hỏi có nêu ("mức 4", "hôm nay", "tôi đã làm gì").
- Không ghi chú "không lọc được" cho giá trị không mang ý người hỏi: `status` khác `DONE`; `assignee`/`user` = `me` với ý định vốn chỉ về người hỏi (`NOTIFICATION_LIST`, `AI_USAGE`).
- Chữ trong khối do backend dựng theo kiểu Việt: ngày `25/09`, giờ `13,6 h`, số `397.111`; nhãn mục đích AI tiếng Việt; `BUS_FACTOR` xếp "chỉ 1 người" trước "chưa ai"; `TASK_CANDIDATES` nói rõ khi hạn đã qua. Web: khối rỗng gọn một dòng, bảng > 8 dòng thu gọn, số căn phải bằng `tabular-nums` (không font mono), nhãn trục ngày `dd/mm`.

### 4.1 Một câu hỏi, một số (bổ sung 28/09/2026)

Ý định nào trùng câu hỏi với một màn hình thì **gọi đúng service của màn hình đó**, không tự đếm lại: `SPRINT_LIST` ← `SprintsService.list` (tab Sprint), `SPRINT_PROGRESS` ← `ForecastService.burndown/forecast` (Dashboard). `TASK_STATS` đếm trên **toàn bộ** tập khớp lọc — `limit` chỉ cắt danh sách hiển thị — và giờ còn lại dùng `remainingOf` như burn-down. Có ca e2e "một câu hỏi, một số" đối chiếu hai nơi, kể cả khi có việc con. `SPRINT_PROGRESS` với `sprint: "__all"`/`"__backlog"` trả `note` thay vì lặng lẽ lấy sprint đang chạy. Kiểu `line_chart.points[].value` nhận `null` (ngày thiếu số liệu, web nối qua).

## 5. Mười một rủi ro và cách chặn

| Rủi ro | Cách chặn | Kiểm bằng |
|---|---|---|
| LLM bịa số | LLM không được trả số; mọi con số do `AiQueryService` đọc CSDL | prompt CHAT + ca e2e đối chiếu số thật |
| Rò dữ liệu dự án khác | `assertRead(userId, projectId)` theo **dự án của phiên chat**, không tin tham số LLM | "người ngoài dự án → 404" |
| Lộ dữ liệu quản trị | `AI_USAGE` chỉ PM/quản trị; thành viên nhận `note` thay vì số | "member nhận note" |
| LLM điền mã giả (`tN`, `u0`) | Bộ lọc không thuộc ý định bị **cắt**; field thuộc ý định mà sai định dạng → `UNKNOWN_CODE`, không đoán | "mã k99 → 422", "field thừa bị cắt vẫn chạy" |
| Field lạ / chèn tham số | Schema `.strict()` — `rawSql` bị từ chối 400 | "chặn đầu vào lạ" |
| Nhồi nghìn dòng vào chat | `limit` mặc định 25, trần 100, kèm `truncated { shown, total }` | "cắt theo limit, báo tổng thật" |
| Số cũ trong lịch sử chat | Hiện "Số liệu lúc HH:mm" + nút **Làm mới** gọi `POST /ai/query` — **0 token, không tính hạn mức AI** | "chạy lại không tốn lượt AI" |
| "Làm mới" không giải được mã `s2`/`u4` (lượt tra cứu không tạo proposal nên trước 28/09 không có bảng mã) | Tin `DATA_QUERY` lưu `codeMap` trong `structured_data`; web gửi `messageId`; backend dùng bảng mã của đúng tin đó → tin tra cứu mới nhất → proposal mới nhất. Mã `s` cấp theo **thứ tự tạo** sprint nên không trôi khi đóng/thêm sprint; prompt hiện sprint đang mở + 3 sprint đã đóng gần nhất (hỏi được "sprint trước") | ai-chat e2e "Làm mới giải được mã của phiên chỉ có tra cứu" |
| Chat thành đường vòng lấy dữ liệu màn hình không cho xem | `INTENT_PERMISSION` khớp từng endpoint: `CAPACITY_FREE`, `TASK_CANDIDATES` và `AI_USAGE` cần `canManage`; thiếu quyền → khối `note`, **không có số** | "thành viên không xem được bảng năng lực qua chat" |
| Hammer nút "Làm mới" làm nặng CSDL | Cửa sổ trượt 60 giây theo người dùng, trần `AI_QUERY_RATE_LIMIT_PER_MINUTE` (mặc định 30) → `429 RATE_LIMITED` | "vượt trần bị chặn 429" (đo thật: 34 lần → 29×200, 5×429) |
| Truy vấn nặng treo lượt chat (đang giữ khoá phiên) | `WORKLOAD_WEEK`/`CAPACITY_FREE`/`TASK_CANDIDATES` chạy dưới trần 8 giây, quá hạn trả `note` gợi ý thu hẹp phạm vi | — |
| Phình bảng `chat_messages` | `trimQueryResult` cắt danh sách dài cho payload ≤ 48 KB, kèm ghi chú đã rút gọn | "kết quả quá dài bị rút gọn" |
| Workspace bị đình chỉ / chỉ đọc | Đi qua `assertRead` nên tuân vòng đời như mọi API: `SOFT_SUSPENDED` → 403 `WORKSPACE_SUSPENDED` | "tra cứu tuân theo vòng đời" |

Ngoài ra, lượt tra cứu lỗi **không làm hỏng cả lượt chat**: `ChatService` bắt lỗi và đính một khối `note` giải thích, phần còn lại của câu trả lời vẫn hiển thị.

## 6. Tệp liên quan

| Vai trò | Tệp |
|---|---|
| Schema dùng chung | `packages/shared/src/data-query.ts` |
| Bộ chạy truy vấn | `apps/api/src/ai/query/query.service.ts` |
| Endpoint chạy lại | `apps/api/src/ai/query/query.controller.ts` (`POST /ai/query`) |
| Dạy LLM | `apps/api/src/ai/prompt/master-prompt.ts` (mục CHAT) + `provider/response-schemas.ts` (enum `type` phải có `DATA_QUERY`, nếu không Gemini bị `responseSchema` chặn) |
| Vẽ khối | `apps/web/src/features/assistant/QueryBlocks.tsx` |
| Kiểm thử | `apps/api/test/ai-query.e2e-spec.ts` (tra cứu, gồm bộ "một câu hỏi, một số", SPRINT_REPORT/VELOCITY, bộ lọc, TASK_BLOCKED) · `ai-chat.e2e-spec.ts` (Làm mới + mã sprint ổn định, RISK_EXPLANATION bị kiểm, TASK_DETAIL qua chat) · `ai/query/intents.spec.ts` (một nguồn) |

## 7. Chưa làm

- Tra cứu **xuyên dự án** ("tất cả việc của tôi ở mọi dự án") — hiện bó trong dự án của phiên chat.
- Ý định cho bình luận/đính kèm (tìm theo nội dung bình luận).
- Ghim khối kết quả lên Dashboard như một widget (`POST /ai/query` đã sẵn sàng cho việc này).
