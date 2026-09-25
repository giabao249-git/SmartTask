# 14. Tra cứu dữ liệu trong hội thoại (DATA_QUERY)

> Trạng thái: **đã hiện thực** 23/09/2026 — API `POST /ai/query`, action `DATA_QUERY`, 16 ý định, bộ khối hiển thị trong Trợ lý AI.
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

## 3. Mười bảy ý định

| Nhóm | intent | Câu hỏi ví dụ | Khối trả về |
|---|---|---|---|
| Công việc | `TASK_LIST` | "còn việc nào chưa giao" | `task_list` |
| | `TASK_AGENDA` | "hôm nay tôi làm gì", "task tuần này" | `agenda` (nhóm theo ngày) |
| | `TASK_DETAIL` | "ST-6 đang thế nào" | `person_card` (thẻ việc) |
| | `TASK_STATS` | "mỗi cột bao nhiêu việc" | `stat_row` + `bar_chart` + `table` |
| | `TASK_BLOCKED` | "việc nào đang bị chặn" | `task_list` (kèm "chờ ST-x") |
| Con người | `MEMBER_LIST` | "danh sách thành viên" | `people_list` |
| | `MEMBER_PROFILE` | "Huy đang làm gì" | `person_card` + `task_list` |
| | `WORKLOAD_WEEK` | "ai đang quá tải" | `stat_row` + `heatmap` |
| | `CAPACITY_FREE` | "ai còn giờ trống" | `note` + `table` |
| | `WHO_KNOWS_SKILL` | "ai biết NestJS ≥ 4" | `people_list` |
| | `TASK_CANDIDATES` | "ai có thể làm task này", "ai rảnh nhận d2" | `note` + `table` |
| | `BUS_FACTOR` | "kỹ năng nào chỉ 1 người biết" | `note` + `table` |
| Tiến độ | `SPRINT_LIST` | "có mấy sprint" | `table` |
| | `SPRINT_PROGRESS` | "sprint còn mấy ngày" | `stat_row` + `line_chart` |
| | `ACTIVITY_FEED` | "hôm qua ai sửa gì" | `activity_list` |
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
| Kiểm thử | `apps/api/test/ai-query.e2e-spec.ts` (17 ca) |

## 7. Chưa làm

- Tra cứu **xuyên dự án** ("tất cả việc của tôi ở mọi dự án") — hiện bó trong dự án của phiên chat.
- Ý định cho bình luận/đính kèm (tìm theo nội dung bình luận).
- Ghim khối kết quả lên Dashboard như một widget (`POST /ai/query` đã sẵn sàng cho việc này).
