# Rà soát nhóm bảng AI — dư hay đủ?

Ngày 15/09/2026, sau migration `ai_chat_calendar_metrics` (18 bảng). Tiêu chí: (1) có luồng/endpoint nào trong [11](../04-kien-truc/11-chot-chuc-nang-va-api.md) đọc/ghi bảng này không; (2) có trùng dữ liệu với bảng khác không (3NF); (3) có thiếu chỗ chứa cho luồng đã thiết kế ở [05](../04-kien-truc/05-ai-agent.md), [06](../04-kien-truc/06-tri-nho-ai.md), [07](../04-kien-truc/07-cache-va-chi-phi.md) không.

## Kết luận

| Bảng | Kết luận | Hành động |
|---|---|---|
| `ai_model_catalog` | Đủ, đúng vai (năng lực + giá) | Giữ |
| `ai_configs` | **Dư** 4 cột: `provider`, `model` (suy được từ `catalog_id`), `input_price`, `output_price` (chi phí lịch sử đã chốt ở `ai_token_logs.estimated_cost`) | Bỏ 4 cột; `catalog_id` bắt buộc |
| `ai_prompt_configs` | Đủ | Giữ |
| `ai_personal_prompts` | **Dư một bảng**: 1:1 với `users`, chỉ có `content` | Gộp thành cột `users.ai_personal_prompt` |
| `ai_memories` | Đủ (S9) | Giữ |
| `ai_habits` | Đủ (S9); là dữ liệu suy ra nhưng cần lưu vì có `is_visible`, `confidence` | Giữ |
| `chat_sessions`, `chat_messages` | Đủ (S9); `structured_data` trùng `ai_proposals.payload` khi đề xuất đến từ chat — chấp nhận: message giữ bản ghi hội thoại để LLM đọc lại, proposal giữ vòng đời | Giữ, ghi rõ nguồn sự thật là `ai_proposals` |
| `ai_proposals` | Đủ (MVP); **dư** `workspace_id` (suy từ `project_id`) | Bỏ `workspace_id` |
| `ai_feedback` | Đủ (nguồn hiệu chỉnh + số liệu chấp nhận) | Giữ |
| `ai_token_logs` | Đủ; **thiếu** `proposal_id` để tính chi phí theo đề xuất khi gọi từ form (không có message) | Thêm `proposal_id` |
| `ai_usage_daily` | **Dư**: hạn mức 20 lượt/ngày đếm bằng `COUNT(*)` trên `ai_token_logs(user_id, created_at)` là đủ ở quy mô này | Bỏ (thêm lại nếu sau này có gói/subscription như ELPREP) |
| `calendar_connections`, `calendar_events` | Đủ (S6) | Giữ |
| `time_entries`, `task_reviews`, `user_metrics_weekly` | Đủ (S5); `user_metrics_weekly` là vật chất hoá, có thể tính on-the-fly ở quy mô 30 người nhưng cần cho biểu đồ xu hướng trong báo cáo | Giữ |
| `weekly_checkins` | **Dư theo phạm vi**: UC-41 là Could, đã chốt không làm | Bỏ (YAGNI) |
| — | **Thiếu** chỗ lưu kết quả AI để tái sử dụng 6 giờ (07 §5): `raw_response` chỉ ghi khi lỗi/trace, `ai_proposals` chỉ có cho phân rã/phân công, không có cho EXPLAIN | Thêm `ai_response_cache` |
| — | Cache prompt tĩnh Gemini (`cachedContents` name ↔ hash ↔ hạn) | Không cần bảng: một instance, giữ trong bộ nhớ và liệt kê lại qua API khi khởi động (cách `GeminiPromptCacheService` của Table_Calendar) |
| — | Bộ hồi quy 20 kịch bản | File JSON trong repo, không phải bảng |
| — | Idempotency cho `apply` | Chính `ai_proposals.id` + `status` là khoá; không cần bảng |

Sau rà soát: **18 → 16 bảng** nhóm AI (bỏ 3, thêm 1), tổng 44 bảng. Không bảng nào chỉ "có cho đủ bộ".

## Chi tiết từng điểm

### `ai_configs` — bỏ `provider/model/input_price/output_price`
- ELPREP giữ giá trong config để "nhật ký cũ giữ nguyên chi phí lúc đó". SmartTask giải quyết bằng `ai_token_logs.estimated_cost` tính **tại thời điểm gọi** từ giá catalog lúc đó → không cần chụp giá ở config. Giữ hai nơi là hai nguồn sự thật cho cùng một con số.
- `provider/model` lặp lại `ai_model_catalog` qua `catalog_id`; nguyên tắc "AiProviderService bắt buộc tra catalog" nghĩa là config không thể trỏ tới model ngoài catalog — model Ollama tuỳ biến cũng khai vào catalog (provider OLLAMA).
- Giữ: `name`, `purpose`, `api_key_encrypted`, `base_url` (Ollama/OpenAI-compatible), `advanced_params`, `timeout_ms`, `is_default`, `is_active`, `notes`.

### `ai_personal_prompts` → `users.ai_personal_prompt`
1:1, một cột text, không có vòng đời/phiên bản. Table_Calendar tách bảng vì ban đầu lưu trong `ChatMessage` role đặc biệt; SmartTask không có lý do đó. Sở thích cá nhân là của người dùng, không theo workspace.

### `ai_usage_daily` → bỏ
Hạn mức = `COUNT(*) FROM ai_token_logs WHERE user_id = ? AND created_at >= <đầu ngày theo múi giờ>` với index `(user_id, created_at)` đã có; ≤ 20 dòng/người/ngày. ELPREP cần bảng riêng vì đếm theo loại (speaking/writing) cho gói thuê bao — SmartTask không có gói.

### `weekly_checkins` → bỏ
UC-41 ở mức Could và đã chốt "không làm" ([11 §1.3](../04-kien-truc/11-chot-chuc-nang-va-api.md)). Hạng tử check-in trong công thức burnout ([04 §4](../04-kien-truc/04-cong-thuc-tinh-toan.md)) giữ ở dạng "khi bật", giá trị 0 khi không có bảng.

### `ai_response_cache` → thêm
```
ai_response_cache (
  cache_key    text PK      -- sha256(purpose + prompt_hash tĩnh + prompt động chuẩn hoá)
  purpose      AiPurpose
  workspace_id uuid FK
  response     json         -- structured action đã validate
  token_log_id uuid FK?     -- lượt gọi sinh ra nó
  hits         int          -- số lần trả từ cache (số liệu báo cáo)
  expires_at   timestamptz
  created_at   timestamptz
)
```
Dùng cho `POST /sprints/:id/forecast/explain` (6 giờ) và `POST /projects/:id/ai/decompose` (cùng yêu cầu + cùng ngữ cảnh → trả bản nháp cũ). Cron dọn mỗi giờ. Không đưa vào `ai_token_logs` vì log là sổ bất biến, cache là dữ liệu tạm.

### `ai_token_logs.proposal_id` → thêm
Lượt gọi từ form phân rã không có `message_id`; muốn tính "chi phí trung bình một đề xuất" và truy vết lượt lỗi của đề xuất nào thì cần khoá này.

### `ai_proposals.workspace_id` → bỏ
Phụ thuộc bắc cầu qua `project_id` (vi phạm 3NF); truy vấn theo workspace đi qua `projects`.

## Đối chiếu lại với hai dự án tham chiếu

| | Table_Calendar | ELPREP | SmartTask sau rà soát |
|---|---|---|---|
| Cấu hình theo mục đích | `AiConfig.purpose` (null = chung) | `purpose` mặc định GENERAL | enum `AiPurpose`, `GENERAL` là fallback |
| Giá | catalog + config | catalog + config | **chỉ catalog** + `estimated_cost` trong log |
| Cache prompt tĩnh | bộ nhớ + liệt kê API | không | như Table_Calendar |
| Cache kết quả | không | không | `ai_response_cache` (vì free tier Gemini hạn mức thấp) |
| Hạn mức | không | `AiUsage` theo ngày | đếm log |
| Prompt cá nhân | bảng riêng (V2) / `ChatMessage` role (V1) | không | cột trên `users` |
| Memory / Habit | bảng riêng | không | bảng riêng (S9) |
| Runtime config singleton | `AiRuntimeConfig` | không | `ai_configs.advanced_params` + `workspaces.settings.ai` |
