# 07 · Cache prompt, sổ token và tính tiền

Kế thừa `~/Table_Calendar/doc/cache-phan-tinh-prompt.md`, `apps/api/src/ai-config/che-do-cache.ts`, `gemini-prompt-cache.service.ts`, `smart-scheduler/tach-prompt.ts`, cột `AiTokenLog.cachedInputTokens/promptHash`, và bảng phân tích giá model trong `Kế hoạch Lịch thông minh/BẢNG PHÂN TÍCH`.

## 1. Vì sao phải cắt prompt tĩnh/động

Đo ở Table_Calendar (204 nhân sự, 80 cuộc họp): prompt ~36.900 token/lượt, **~76% là phần tĩnh** (luật, danh bạ, phòng ban, danh mục) và giống nhau 100% giữa hai lượt của cùng người, ~78% giữa hai người khác nhau. SmartTask nhỏ hơn (≤ 30 người, ≤ 100 task mở) nhưng cấu trúc y hệt: Master/Workspace prompt + danh bạ + danh mục kỹ năng + dự án là tĩnh; task mở, bảng năng lực, memory, lịch sử là động.

Ước tính SmartTask (30 người, 80 task, 20 tin lịch sử): tĩnh ≈ 3.500 token, động ≈ 7.500 token. Tỷ lệ tĩnh thấp hơn Table_Calendar (≈ 30%) vì bảng năng lực theo ngày là động và lớn — nên cache chỉ đáng bật khi workspace ≥ 20 người hoặc khi dùng model tính phí.

## 2. Cấu trúc prompt cố định để cache ăn

```
[Khối tĩnh — sắp theo mã ổn định, không theo thời điểm]
Master prompt (v) → Workspace prompt (v) → Danh bạ (u1..uN theo mã) → Danh mục kỹ năng + alias (k1..) → Dự án & sprint
════════ DỮ LIỆU HAY THAY ĐỔI            ← mốc cắt (MOC_PHAN_DONG), là tiêu đề có sẵn trong prompt
[Khối động]
Task mở → Bảng năng lực → Khớp kỹ năng → Memory → Thói quen → Sở thích → Lịch sử phiên → Yêu cầu hiện tại
```

Quy tắc giữ phần tĩnh **ổn định từng ký tự** (nhà cung cấp khớp cache theo tiền tố):

- Sắp hàng theo mã/tên, không theo thứ tự truy vấn (bài học `getAvailabilityContext`: một cuộc họp 8h với người mới làm cả khối NGƯỜI đổi văn bản).
- Không chèn thời gian hiện tại vào khối tĩnh; "hôm nay" nằm ở khối động.
- Mã ngắn u/t/k cấp theo thứ tự ổn định (tạo trước → số nhỏ) để danh bạ không đổi giữa các lượt.
- Băm phần tĩnh (`sha256` 32 ký tự đầu) làm khoá cache; đổi Master prompt, thêm thành viên → băm đổi → cache mới tự tạo, cũ tự hết hạn.
- `tachPromptTinhDong()` không tìm thấy mốc hoặc mốc ở đầu → gửi nguyên, không cache (không bao giờ cắt bừa).

## 3. Ba cơ chế cache — khai theo model, không đoán theo tên

| `ai_model_catalog.cache_mode` | Nhà cung cấp | Cách hoạt động | Phí lưu | Ghi chú |
|---|---|---|---|---|
| `NONE` | DeepSeek, OpenAI đời cũ, Ollama | Cache tự động hoặc không có; `usage` vẫn báo `cached_tokens` nếu có | Không | Mặc định cho model chưa thử thật |
| `GEMINI_CACHED_CONTENTS` | Gemini | Tạo đối tượng `cachedContents` có tên, `ttl`; request sau tham chiếu tên | **Theo giờ, kể cả lúc không ai dùng** | `ttlSeconds` đặt theo khung giờ làm việc (mặc định 3.600 s, sàn 60, trần 24 h); `minStaticChars` 8.000 |
| `OPENAI_BREAKPOINT` | OpenAI GPT-5.6+ | `prompt_cache_breakpoint` trong request, `prompt_cache_options.mode = "explicit"` | Không | Chế độ explicit tắt mốc tự động → phần lịch sử mất cache tự động, đổi lại phần tĩnh chắc chắn |

Guard: `hopVoiNhaCungCap(provider, cacheMode)` chặn khai `OPENAI_BREAKPOINT` cho model Gemini — sai một lần là hỏng cả lượt chat.

Bật ở `ai_configs.advanced_params.promptCache = { enabled, ttlSeconds, minStaticChars }`; mặc định **tắt**. Mọi nhánh hỏng (tạo cache lỗi, hạn mức, cache chết giữa chừng) đều **quay về gửi nguyên prompt**, nghỉ 5 phút rồi thử lại — cache là tối ưu, không phải điều kiện.

## 4. Sổ token (`ai_token_logs`)

| Cột | Vì sao có |
|---|---|
| `config_id, provider, model, endpoint, user_id, workspace_id, project_id` | Tách báo cáo chi phí theo workspace/mục đích/người |
| `input_tokens, cached_input_tokens, output_tokens, total_tokens` | Tính tiền đúng: token đã cache rẻ hơn (Gemini ~25% giá thường, OpenAI 50%); nhà cung cấp không báo → ghi 0, không để NULL |
| `duration_ms, status, error_message` | Đo SLA "≤ 15 s", tỷ lệ lỗi |
| `prompt_chars, prompt_hash, prompt_version (master + workspace)` | Chứng minh một thay đổi prompt có tác dụng; hai lượt cùng hash = cùng prompt |
| `user_message` (cắt 2.000 ký tự, **luôn ghi**) | Không có thì log chỉ còn số, không lần ra lượt nào ứng với yêu cầu nào khi bot sai |
| `prompt_text` (chỉ khi bật `trace.enabled`, chỉ phần động) | Phần tĩnh giống nhau, đã có hash |
| `raw_response` (luôn khi ERROR, còn lại chỉ khi trace) | Đọc lại lúc cần tìm nguyên nhân; lượt thành công không cõng hàng chục nghìn ký tự |

Ghi log **không được làm hỏng lượt chat**: bọc `try/catch`, chỉ `logger.warn` khi ghi thất bại.

## 5. Tính tiền

Giá lưu trong `ai_model_catalog` (USD/1M token, cập nhật tay, có ngày hiệu lực) và tỷ giá `settings.usd_vnd` (mặc định 26.263 đ như bảng phân tích Table_Calendar 08/2026 — cập nhật khi in báo cáo):

```
cost_usd(log) = (input_tokens − cached_input_tokens) × input_price
              + cached_input_tokens × cached_input_price          (mặc định = input_price × 0.25 cho Gemini, × 0.5 OpenAI)
              + output_tokens × output_price
              + phí lưu cache theo giờ / số lượt trong giờ đó     (chỉ GEMINI_CACHED_CONTENTS)
cost_vnd      = cost_usd × usd_vnd
```

Ví dụ (giá Gemini 2.5 Flash 1,5 / 9,0 USD per 1M; lượt phân công 11.000 vào, 900 ra): không cache ≈ 0,0165 + 0,0081 = 0,0246 USD ≈ 646 đ; bật cache với 3.500 token tĩnh trúng cache ≈ 0,0113 + 0,0013 + 0,0081 ≈ 0,0207 USD ≈ 544 đ (−16%; ở Table_Calendar tĩnh 76% nên giảm ~57%).

Trên gói **miễn phí** Gemini: chi phí tiền = 0 nhưng **hạn mức** là chi phí thật (~10–15 RPM, vài trăm RPD, thay đổi theo thời điểm). Quy tắc:

- Hạn mức theo người/ngày `settings.ai_daily_limit_per_user` (mặc định 20) và theo workspace/ngày; hết → 429 `AI_QUOTA_EXCEEDED` kèm giờ mở lại.
- Khoá nút trong lúc gọi; debounce gõ.
- Không cache kết quả trong DB (đã cân nhắc và bỏ 15/09): khoá nút khi đang gọi; DRAFT đang mở được trả lại thay vì gọi mới; giải thích rủi ro chỉ gọi khi PM bấm.
- 429 từ nhà cung cấp → báo thời điểm thử lại; không retry dồn dập.
- Demo: `AI_PROVIDER=ollama` chạy trên laptop là kế hoạch B khi mất mạng; kèm video dự phòng theo yêu cầu học phần.

## 6. Màn quản trị (UC-40)

- Bảng chi phí theo ngày/tuần, theo mục đích (DECOMPOSE/ASSIGN/EXPLAIN/CHAT), theo người; tỷ lệ token đã cache; thời gian trung bình; tỷ lệ lỗi; tỷ lệ qua Validator lần đầu.
- Kiểm chứng cache: truy vấn mẫu `SELECT created_at, input_tokens, cached_input_tokens FROM ai_token_logs ORDER BY created_at DESC LIMIT 10` — `cached_input_tokens` vẫn 0 sau khi bật = cache không ăn, xem log `[Cache prompt]`.
- Số liệu này chính là bảng thực nghiệm cho Chương 3 (thời gian, token, chi phí/lượt, tỷ lệ JSON hợp lệ).

## 7. Giảm token ngoài cache

| Biện pháp | Tiết kiệm ước tính | Nguồn |
|---|---|---|
| Mã ngắn thay UUID | ~12% prompt | Table_Calendar đo 205 UUID = 4.000 token |
| Bảng văn bản thay JSON cho dữ liệu vào | ~35% khối dữ liệu | `bang-du-lieu.ts` |
| Chỉ liệt kê khoảng bận, vắng = rảnh; gộp trùng | Bảng năng lực gọn 2–3 lần | `getAvailabilityContext` |
| Trần số dòng: task mở 100, lịch sử 20 tin, memory 50, khoảng bận `limit × 4` | Chặn prompt phình theo mức hoạt động | như trên |
| Chỉ gửi task **chưa giao** + tóm tắt số việc đã giao mỗi người cho `ASSIGN` | ~40% khối task | mới |
| `maxOutputTokens` 4.096; `reply` ≤ 600 ký tự | Đầu ra đắt gấp 6 lần đầu vào | giá Gemini |
