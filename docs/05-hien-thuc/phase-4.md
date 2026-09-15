# Phase 4 — Bình luận, @mention, đính kèm, thông báo, nhật ký

Nhánh `feature/be-p4-collab`. 15/09/2026. Endpoint theo [11 §3.7–3.8](../04-kien-truc/11-chot-chuc-nang-va-api.md).

## Đã làm

| Nhóm | Endpoint | Ghi chú |
|---|---|---|
| Bình luận | `GET/POST /tasks/:id/comments`, `PATCH/DELETE /comments/:id` | Markdown nhẹ (web sanitize), trả lời một cấp, `mentionUserIds` phải là thành viên dự án (422); tác giả sửa, tác giả/PM xoá (xoá mềm kèm trả lời) |
| **Gợi ý @mention** | `GET /projects/:id/members/suggest?q=&limit=` | Trả `{ provider, items[score] }`. **Elasticsearch** khi có `ELASTICSEARCH_URL` (index `smarttask-members`: analyzer `asciifolding` + `edge_ngram`, `multi_match fuzziness AUTO`; đồng bộ lười theo dự án mỗi 60 s); **pg_trgm + unaccent** khi không (migration `mention_fuzzy_search`: hàm `f_unaccent` IMMUTABLE + 3 index gin trgm). ES lỗi → rơi về pg trong 60 s, không chờ timeout mỗi lần gõ |
| Đính kèm | `POST /tasks/:id/attachments/sign` → `PUT <uploadUrl>` → `POST /tasks/:id/attachments`, `GET …`, `GET /attachments/:id/download-url`, `DELETE` | `StorageProvider`: **Supabase** (ký URL, trình duyệt upload thẳng) khi có `SUPABASE_URL` + service key; **local** (đĩa `uploads/`, URL ký HMAC 15 phút qua `PUT/GET /attachments/local/:path`) khi dev/test. `storagePath = ws/project/task/uuid-tên-bỏ-dấu`, xác nhận phải đúng tiền tố và tệp tồn tại; ≤ 10 MB (DTO + CHECK DB + giới hạn body) |
| Thông báo | `GET /notifications?unread=&page=`, `GET …/unread-count`, `PATCH …/:id/read`, `POST …/read-all` | Sinh từ **listener**: `task.assigned/created` → TASK_ASSIGNED cho người mới được giao (trừ người thao tác); `comment.created/updated` → MENTIONED cho người mới được nhắc; `sprint.started/closed` → thành viên dự án; cron 07:30 → TASK_DUE_SOON/OVERDUE. Tôn trọng `users.notification_prefs.inApp`; phát `notification.created` cho socket (Phase 6) |
| Nhật ký | `GET /projects/:id/activity?taskId=&page=`, `GET /tasks/:id/activity` | `ActivityListener` nghe `task.*` (tên sự kiện đi trong payload), `sprint.*`, `comment.created`, `project.member.removed`; ghi `diff` cũ/mới và `source` MANUAL/AI |

## Quyết định
- **Elasticsearch có, nhưng không bắt buộc**: theo yêu cầu nhóm; chạy bằng `make search-up` (Docker, 512 MB heap). Render/Supabase free không chạy được ES nên bản Cloud dùng pg_trgm — cùng API, cùng kết quả cho 6 ca kiểm thử (`hu`, `duc hy`, `Đức Huy`, `thu`, `pham`, đầu email). Muốn ES trên Cloud: Bonsai/Elastic Cloud trả phí, chỉ đổi `ELASTICSEARCH_URL`.
- Hàm/toán tử `pg_trgm` gọi đủ tên `public.similarity`, `OPERATOR(public.%)` vì search_path khi chạy có thể là schema khác (e2e dùng `smarttask_test`).
- Listener không được làm hỏng luồng chính: mọi lỗi chỉ `logger.warn`; e2e chờ (`waitFor`) vì listener chạy async.

## Kiểm thử
- E2E `collab.e2e-spec.ts` (6 ca; tổng 34): gợi ý @mention 6 truy vấn (chạy qua ES; đã chạy lại với ES tắt → pg_trgm, cùng kết quả) → bình luận mention → MENTIONED, tác giả không nhận, đánh dấu đọc → sửa/xoá quyền → giao việc → TASK_ASSIGNED, tắt tuỳ chọn thì không → nhật ký created/assigned/comment có diff → đính kèm ký/PUT/xác nhận/tải/xoá, sai chữ ký 403, quá 10 MB.
- Swagger: 66 đường dẫn.

## Để lại
- Web Push (S8) — Phase 8; `push_subscriptions` chưa dùng.
- Đồng bộ ES tức thời khi đổi hồ sơ/thành viên (hiện lười 60 s) — nối `user.updated` khi cần.
