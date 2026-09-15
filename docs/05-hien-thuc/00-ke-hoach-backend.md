# Kế hoạch hiện thực backend theo phase

Mỗi phase là một nhánh `feature/be-p<N>-<tên>`, một PR, kết thúc bằng: server chạy, Swagger cập nhật, test xanh, `docs/05-hien-thuc/phase-<N>.md` ghi những gì đã làm và cách thử. Phase sau chỉ bắt đầu khi phase trước đã merge vào `develop`. Bám [04-kien-truc/11](../04-kien-truc/11-chot-chuc-nang-va-api.md) cho đường dẫn API và [08](../04-kien-truc/08-mo-hinh-du-lieu.md) cho schema.

| Phase | Nội dung | Module | Endpoint (theo 11) | Định nghĩa xong | Người |
|---|---|---|---|---|---|
| **0** | Khung monorepo, NestJS 11, Prisma 6 + migration đầy đủ lõi (27 bảng + ràng buộc SQL tay), config zod, filter lỗi, Swagger, health, CI | `common`, `prisma`, `health` | 3.13 | `npm run api:dev` chạy; `/docs`, `/health/ready` OK; migration áp lên Docker Postgres; CI xanh | «TV2» |
| **1** | Xác thực & tài khoản: đăng ký, đăng nhập, refresh xoay vòng (cookie), đăng xuất, hồ sơ, đổi mật khẩu, tuỳ chọn thông báo; guard JWT toàn cục | `auth`, `users` | 3.1 (M) | e2e: đăng ký → đăng nhập → /me → refresh → logout; throttle login | «TV2» |
| **2** | Workspace, thành viên, lời mời, cài đặt; danh mục kỹ năng + alias + gộp + bộ mẫu; kỹ năng cá nhân, xác nhận, heatmap; guard vai trò workspace | `workspaces`, `skills` | 3.2, 3.3 | e2e: tạo ws → mời → chấp nhận → đổi vai → seed kỹ năng → heatmap | «TV5» |
| **3** | Dự án, thành viên dự án (một PM), cột, nhãn; sprint lifecycle; task/subtask CRUD, move có version + WIP, assignees, skills, labels, duplicate, progress, tìm kiếm, việc của tôi, `since`; guard vai trò dự án; sự kiện nội bộ `task.*` | `projects`, `sprints`, `tasks` | 3.4, 3.5 (trừ burndown/forecast), 3.6 (M) | e2e: tạo dự án → sprint → task → move → 409 → close sprint; test đơn vị vị trí phân số | «TV2» |
| **4** | Bình luận + mention; đính kèm (signed URL Supabase, fallback local khi dev); thông báo in-app từ listener; nhật ký hoạt động từ listener | `comments`, `attachments`, `notifications`, `activity` | 3.7, 3.8 (M), 3.4 activity | e2e: bình luận @ → thông báo; upload → download-url | «TV5» |
| **5** | Thuật toán thuần + test ≥ 12 ca: share theo tuần, EAR, EffLoad/EffCap, mức, burnout, giờ trống theo ngày, khớp kỹ năng, Spread; snapshot & cảnh báo; cron; burn-down/vận tốc/ETA/rủi ro | `workload`, `metrics` (lõi), `forecast` | 3.5 burndown/forecast, 3.9 (M) | Jest xanh cho `04-cong-thuc`; `GET /workload` trả đúng ví dụ Minh/Lan; cron chạy | «TV4» |
| **6** | Socket.io gateway: handshake JWT, join phòng theo quyền, presence, listener phát `task:* comment:* notification:new workload:updated`; script socket-loadtest | `realtime` | mục 4 của 11 | 2 client nhận sự kiện; loadtest 20 client giữ đúng thứ tự | «TV4» |
| **7** | AI MVP: `AiProvider` (gemini + ollama), catalog/config tối thiểu từ env, ContextBuilder (tĩnh/động, mã ngắn), PromptAssembler, ResponseParser (zod), ActionValidator, Executor, `decompose` + `apply/reject`, `forecast/explain`, token log, hạn mức, cache kết quả | `ai`, `ai-config` (env) | 3.11 (M) | Phân rã yêu cầu mẫu ≤ 15 s với Gemini và với Ollama; validator có test 7 mã lỗi; apply tạo task qua `TasksService` | «TV4» |
| **8** | Should theo thứ tự ở 11 §1.2: phụ thuộc + vòng; capacity riêng + ngày nghỉ; activity API; **capacity-table**; time entries + reviews + metrics tuần; lịch bận tay/ICS; Web Push | `tasks`, `users`, `workload`, `metrics`, `calendar`, `notifications` | 3.1 S, 3.6 S, 3.9 S, 3.10, 3.8 S | Mỗi mục có e2e riêng; capacity-table trả bảng sự thật không xếp hạng | «TV2» «TV5» |
| **9** | Chat theo phiên, `ASSIGN_PROPOSAL`/`REBALANCE`/`UPDATE_TASK_DRAFT`, memory/habit, quản trị cấu hình AI (catalog, purpose, prompt có phiên bản, cache, sổ token/chi phí) | `ai`, `memory`, `ai-config` | 3.11 S, 3.12 | Kịch bản 7b của 05 chạy được; bộ hồi quy 20 kịch bản | «TV4» |
| **10** | Đóng gói & vận hành: Dockerfile, seed demo 3 tuần, deploy Render + Supabase (`migrate deploy`), keep-alive, k6, security review, README cài đặt | `infra` | — | Link API online; k6 p95 đạt mục tiêu 01 §5 | «TV5» |

Nguyên tắc chung khi code (từ [01](../04-kien-truc/01-kien-truc-he-thong.md) §2 và [05](../04-kien-truc/05-ai-agent.md) §1):

1. Controller chỉ DTO + Swagger; Service chứa nghiệp vụ; hàm tính toán thuần nằm trong `domain/` không đụng Prisma.
2. Service phát sự kiện, listener ở module khác nghe; không import service chéo để phát socket/push.
3. Quyền kiểm theo dữ liệu; identity từ `req.user`.
4. Mọi `PATCH` task mang `version`.
5. AI: backend tính, LLM chọn, Validator kiểm và **không sửa** đề xuất.
6. Mỗi phase: `npm run lint && npm test` xanh trước khi mở PR.
