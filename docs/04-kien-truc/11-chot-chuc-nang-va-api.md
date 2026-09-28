# 11 · Chốt phạm vi chức năng và API endpoint

Bản chốt ngày 15/09/2026 (Tuần 01), dùng làm phạm vi cho đề cương (Mục 4, 7), cho OpenAPI ở Tuần 06 và cho controller ở Tuần 07. Mọi thay đổi sau ngày này phải qua họp nhóm và ghi vào biên bản; **sau 05/11 (hết Tuần 08) không thêm gì**.

## 1. Chức năng — ba mức

### 1.1 Làm chắc (MVP, nghiệm thu) — 24 UC, xong trước Tuần 08

| # | Chức năng | Chi tiết chốt | UC | Người |
|---|---|---|---|---|
| 1 | Tài khoản | Đăng ký email/mật khẩu; đăng nhập JWT access 15' + refresh 7 ngày (cookie); đăng xuất; hồ sơ (tên, ảnh, múi giờ, đổi mật khẩu, kênh thông báo) | 01–03 | «TV2» |
| 2 | Workspace | Tạo/sửa/lưu trữ; chuyển sở hữu; mời qua email hoặc link 7 ngày; vai trò OWNER/ADMIN/MEMBER/VIEWER; cài đặt (giờ chuẩn/tuần, ngày làm việc, ngưỡng tải) | 04–05 | «TV5» |
| 3 | Danh mục kỹ năng | Nhóm kỹ năng; thêm/sửa/ẩn; alias; gộp; bộ mẫu 30 kỹ năng khi tạo workspace | 06 | «TV5» |
| 4 | Dự án | Tạo/sửa/lưu trữ; mã dự án (ST); thành viên dự án, đúng một PM; cột Kanban tuỳ chỉnh + WIP; nhãn; dòng hoạt động | 08 | «TV2» |
| 5 | Sprint | Tạo/sửa; một ACTIVE mỗi dự án; bắt đầu; kết thúc chuyển việc dở về backlog hoặc sprint sau | 09 | «TV2» |
| 6 | Công việc | Task/subtask; tiêu đề, mô tả markdown, **loại (STORY/TASK/BUG — enum cố định, không cấu hình được)**, ưu tiên (mức cao nhất hiển thị "Rất cao" — mức **quan trọng**, khác cờ `isUrgent` là **gấp về thời gian**), độ khó 1–5, nhãn, ngày bắt đầu, hạn, ước lượng giờ, giờ còn lại, tiến độ, kỹ năng yêu cầu (mức tối thiểu), nhiều người thực hiện; mã ST-n; xoá mềm; sao chép; version | 10, 11 (subtask) | «TV2» API · «TV3» UI |
| 7 | Kanban | Cột theo trạng thái; kéo thả đổi cột/thứ tự (vị trí phân số); WIP limit + cảnh báo; **tạo nhanh trong cột (Enter tạo liên tiếp, dán nhiều dòng, cú pháp `@# ! h`)**; lọc người/nhãn/loại/sprint/hạn; tìm kiếm; **chọn nhiều + thao tác hàng loạt ≤ 50**; **nhóm theo người/ưu tiên**; huy hiệu quá hạn/bị chặn/người nhận quá tải | 12 | «TV3» |
| 8 | Danh sách & việc của tôi | Bảng có sắp xếp **và sửa tại chỗ**, bộ lọc lưu trong URL **+ đặt tên lưu lại (localStorage)**, tìm toàn văn; **màn Backlog riêng** (xếp thứ tự, đưa vào sprint hàng loạt); "Việc của tôi" xuyên dự án | 15 | «TV3» |
| 9 | Gantt chỉ đọc | Thanh theo ngày bắt đầu–hạn, nhóm theo sprint, đường hôm nay, quá hạn, thu phóng ngày/tuần/tháng; mũi tên phụ thuộc (nếu UC-11 phụ thuộc kịp) | 13 (đọc) | «TV3» |
| 10 | Realtime | Socket.io phòng dự án và người dùng; sự kiện task/bình luận/thông báo/tải; optimistic + hoàn tác; 409 version; presence; reconnect đồng bộ `since` | 17 | «TV4» |
| 11 | Bình luận & @mention | Markdown nhẹ, sửa/xoá của mình, gợi ý @ từ thành viên dự án, mention → thông báo | 18 | «TV5» API · «TV3» UI |
| 12 | Đính kèm | Upload thẳng Supabase Storage bằng signed URL ≤ 10 MB; xem trước ảnh; tải; xoá | 19 | «TV5» |
| 13 | Thông báo trong ứng dụng | Sự kiện: giao việc, mention, sắp hạn/quá hạn, quá tải, sprint bắt đầu/kết thúc, AI áp dụng; chuông đếm realtime; đọc/đọc tất cả | 20 | «TV5» |
| 14 | Kỹ năng cá nhân & heatmap | Tự khai 1–5, PM xác nhận; heatmap thành viên × kỹ năng theo dự án; cảnh báo bus factor | 22, 23 | «TV3» UI · «TV5» API |
| 15 | Tính tải | Giờ còn lại theo tuần; năng lực hiệu dụng (trừ nghỉ; trừ họp nếu UC-37 kịp); mức sử dụng; biểu đồ theo người × tuần; chi tiết cấu thành; tính lại theo sự kiện | 24 | «TV4» |
| 16 | Cảnh báo quá tải & burnout | Ngưỡng 70/90/110; điểm burnout có breakdown; huy hiệu; thông báo PM + người đó (chống spam 24 h); ghi nhận đã xử lý | 25 | «TV4» |
| 17 | AI phân rã yêu cầu | Form: mô tả + sprint + mức chi tiết → Gemini structured output → validator → bảng xem trước chỉnh tại chỗ → tạo hàng loạt; Ollama dự phòng; hạn mức 20/người/ngày; cache theo hash | 28 | «TV4» |
| 18 | Burn-down & vận tốc | Snapshot 00:05; lý tưởng/thực tế; vận tốc 5 ngày; đánh dấu scope creep | 30 | «TV4» |
| 19 | Dự báo rủi ro trễ hạn | ETA, mức Thấp/TB/Cao, nguyên nhân đo được; nút "Giải thích bằng AI" (RISK_EXPLANATION, cache 6 h); thông báo PM khi tăng | 31 | «TV4» |
| 20 | Dashboard dự án | Thẻ số; việc theo trạng thái/người; tải nhóm tuần này + cảnh báo mở; burn-down thu nhỏ | 33 | «TV3» |
| 21 | Nền tảng kỹ thuật | Swagger `/docs`; health/ready; seed demo; CI; deploy Vercel + Render + Supabase; keep-alive | — | «TV5» |

### 1.2 Làm nếu kịp trước 05/11 — theo đúng thứ tự này, làm xong cái trên mới sang cái dưới

| Thứ tự | Chức năng | UC | Lý do xếp thứ tự |
|---|---|---|---|
| 1 | Phụ thuộc "bị chặn bởi" + phát hiện vòng + mũi tên trên Gantt | 11 (phụ thuộc) | Nhỏ, làm Gantt và AI phân rã đúng nghĩa |
| 2 | Năng lực giờ/tuần riêng + ngày nghỉ | 07 | Đầu vào trực tiếp của tính tải |
| 3 | Nhật ký hoạt động trong chi tiết task | 16 | Dữ liệu đã có từ listener, chỉ thiếu UI |
| 4 | Bảng năng lực khi giao việc (khớp kỹ năng, giờ trống, U) cạnh Combobox | 26 | Chuẩn bị cho AI phân công; không xếp hạng |
| 5 | Giờ làm thực tế (nhập tay + cycle time) và đánh giá task sau hoàn thành | 35, 36 | Bắt đầu tích luỹ EAR/rating sớm cho demo |
| 6 | Lịch bận nhập tay + ICS | 37 (tay, ICS) | Trừ giờ họp vào năng lực — điểm nhấn demo |
| 7 | Ma trận Eisenhower | 14 | Đề bài nêu; dùng lại query task |
| 8 | Web Push | 21 | Đề bài nêu; cần HTTPS, chỉ Chrome |
| 9 | Chat với trợ lý theo phiên + AI đề xuất phân công (ASSIGN_PROPOSAL) | 38, 39 | Câu chuyện chính khi bảo vệ, nhưng phụ thuộc 4–6 |
| 10 | Quản trị cấu hình AI (catalog, purpose, prompt có phiên bản, sổ token) | 40, 32 | Có thể thay bằng biến môi trường nếu không kịp |
| 11 | Gantt kéo giãn | 13 (kéo) | Tốn công nhất so với điểm |

### 1.3 Không làm trong đồ án (ghi "hướng phát triển")

Cân bằng lại tải bằng kéo thả trên biểu đồ (27); AI ước lượng lại (29); xuất CSV/PDF (34); check-in tuần (41); adapter Table_Calendar (37 adapter); OAuth/SSO; mobile; workflow tuỳ biến; đa ngôn ngữ; thanh toán.

## 2. Quy ước API chung

| Mục | Quy ước |
|---|---|
| Tiền tố | `/api/v1`; JSON UTF-8; thời gian ISO 8601 UTC; ngày `YYYY-MM-DD` |
| Xác thực | `Authorization: Bearer <access>`; refresh qua cookie httpOnly `rt` trên `POST /auth/refresh`; socket gửi access token trong `auth` khi handshake |
| Định danh | UUID trong API; web dùng `wsSlug`, `projectKey`, `taskKey` (ST-12) cho URL và gọi `GET /tasks/by-key/:projectKey/:number` khi cần |
| Quyền | Guard theo dữ liệu: WORKSPACE(role) → PROJECT(PM/MEMBER); VIEWER chỉ GET; không tin `workspaceId`/`projectId` trong body |
| Phân trang | `?page=1&limit=50` (tối đa 200) → `{ items, total, page, limit }`; danh sách task theo dự án không phân trang (≤ 1.000, lọc server) |
| Lọc & sắp xếp | `?sprintId=&assigneeId=&labelId=&status=&priority=&type=&dueFrom=&dueTo=&q=&sort=dueDate:asc` |
| Đồng thời | Mọi `PATCH` trên task mang `version`; lệch → `409 TASK_VERSION_CONFLICT { current }` |
| Lỗi | `{ code, message, details? }`; `code` liệt kê ở `packages/shared/errors.ts`; 400 validation (`details.fields`), 401, 403, 404, 409, 422 nghiệp vụ, 429 hạn mức, 503 AI/không sẵn sàng |
| Idempotency | `POST /ai/proposals/:id/apply`, `POST /sprints/:id/close` nhận `Idempotency-Key` (tuỳ chọn) — lặp trả kết quả cũ |
| Giới hạn tần suất | 100 req/phút/IP; `POST /auth/login` 10/phút; AI theo hạn mức người/ngày |
| Tài liệu | Swagger tự sinh tại `/docs`; mọi DTO có `@ApiProperty` và ví dụ |

## 3. Danh mục endpoint

Cột **Mức**: M = MVP (1.1) · S = làm nếu kịp (1.2, số thứ tự) . Cột **Quyền**: `auth` = đã đăng nhập; `ws:ADMIN` = OWNER/ADMIN của workspace; `pj:PM`, `pj:MEMBER` = vai trong dự án; `self` = chính mình.

### 3.1 Auth & tài khoản

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `POST /auth/register` | — | `{ email, password, fullName }` | `201 { user, accessToken }` + cookie rt | M | 01 |
| `POST /auth/login` | — | `{ email, password }` | `{ user, accessToken }` + cookie | M | 02 |
| `POST /auth/refresh` | cookie | — | `{ accessToken }` (xoay rt) | M | 02 |
| `POST /auth/logout` | auth | — | `204` (thu hồi rt) | M | 02 |
| `GET /me` | auth | — | `{ user, workspaces[] }` | M | 03 |
| `PATCH /me` | auth | `{ fullName?, shortName?, avatarUrl?, timezone? }` | `user` | M | 03 |
| `PATCH /me/password` | auth | `{ currentPassword, newPassword }` | `204` | M | 03 |
| `PUT /me/notification-prefs` | auth | `{ inApp: {...}, push: {...} }` | `prefs` | M | 03 |
| `PUT /me/capacity` | auth | `{ weeklyCapacityHours }` | `user` | S2 | 07 |
| `GET · POST /me/time-off` · `DELETE /me/time-off/:id` | auth | `{ fromDate, toDate, kind, hoursPerDay? }` | `timeOff[]` | S2 | 07 |

### 3.2 Workspace, thành viên, lời mời, cài đặt

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /workspaces` | auth | — | `workspace[]` (của tôi, kèm role) | M | 04 |
| `POST /workspaces` | auth | `{ name, slug? }` | `201 workspace` (nạp cột mặc định, 30 kỹ năng mẫu) | M | 04, 06 |
| `GET · PATCH /workspaces/:wsId` | member · ws:ADMIN | `{ name?, logoUrl? }` | `workspace` | M | 04 |
| `POST /workspaces/:wsId/archive` | OWNER | — | `204` | M | 04 |
| `POST /workspaces/:wsId/transfer-ownership` | OWNER | `{ userId }` | `workspace` | M | 04 |
| `GET · PATCH /workspaces/:wsId/settings` | member · ws:ADMIN | `{ defaultCapacityHours, workdays[], holidays[], workload: { thresholds, weights }, ai: { dailyLimitPerUser } }` | `settings` | M | 04, 25 |
| `GET /workspaces/:wsId/members?role=&q=` | member | — | `member[]` (user, role, joinedAt) | M | 05 |
| `PATCH /workspaces/:wsId/members/:userId` | ws:ADMIN | `{ role }` | `member` | M | 05 |
| `DELETE /workspaces/:wsId/members/:userId` | ws:ADMIN | — | `204` | M | 05 |
| `GET · POST /workspaces/:wsId/invitations` | ws:ADMIN | `{ email?, role, expiresInDays? }` | `invitation` (`token`, link) | M | 05 |
| `DELETE /workspaces/:wsId/invitations/:id` | ws:ADMIN | — | `204` | M | 05 |
| `GET /invitations/:token` | — | — | `{ workspaceName, role, inviter }` | M | 05 |
| `POST /invitations/:token/accept` | auth | — | `member` | M | 05 |

### 3.3 Kỹ năng

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /workspaces/:wsId/skills?includeInactive=` | member | — | `skill[]` (category, aliases) | M | 06 |
| `POST /workspaces/:wsId/skills` | ws:ADMIN | `{ name, category, aliases[]? }` | `201 skill` | M | 06 |
| `PATCH /skills/:id` | ws:ADMIN | `{ name?, category?, isActive?, aliases[]? }` | `skill` | M | 06 |
| `POST /skills/:id/merge` | ws:ADMIN | `{ intoSkillId }` | `skill` (chuyển user_skills, task_skills, alias) | M | 06 |
| `GET /me/skills` · `PUT /me/skills` | auth | `[{ skillId, level }]` | `userSkill[]` | M | 22 |
| `PATCH /users/:userId/skills/:skillId/verify` | pj:PM (chung dự án) | `{ level }` | `userSkill` (verifiedBy) | M | 22 |
| `GET /workspaces/:wsId/skill-matrix?projectId=&minLevel=` | member | — | `{ users[], skills[], cells[][], busFactor[] }` | M | 23 |

### 3.4 Dự án, cột, nhãn

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /workspaces/:wsId/projects?status=` | member | — | `project[]` (kèm số việc, sprint ACTIVE) | M | 08 |
| `POST /workspaces/:wsId/projects` | ws:ADMIN | `{ key, name, description?, startDate?, endDate?, pmUserId }` | `201 project` | M | 08 |
| `GET · PATCH /projects/:id` | pj:MEMBER · pj:PM | `{ name?, description?, startDate?, endDate?, status? }` | `project` | M | 08 |
| `POST /projects/:id/archive` | pj:PM | — | `204` | M | 08 |
| `GET /projects/:id/members` | pj:MEMBER | — | `member[]` (role, kỹ năng tóm tắt) | M | 08 |
| `PUT /projects/:id/members` | pj:PM | `[{ userId, role }]` (đúng một PM) | `member[]` | M | 08 |
| `DELETE /projects/:id/members/:userId` | pj:PM | — | `204` (task của người đó → chưa giao) | M | 08 |
| `GET · PUT /projects/:id/columns` | pj:MEMBER · pj:PM | `[{ id?, name, statusKey, position, wipLimit? }]` | `column[]` | M | 12 |
| `GET · POST /projects/:id/labels` · `PATCH · DELETE /labels/:id` | pj:MEMBER · pj:PM | `{ name, color }` | `label[]` | M | 10 |
| `GET /projects/:id/dashboard` | pj:MEMBER | — | `{ counts, byStatus[], byType[], byAssignee[], workloadWeek[], openAlerts[], burndownMini }` | M | 33 |
| `GET /projects/:id/activity?page=&taskId=` | pj:MEMBER | — | `activity[]` | S3 | 16 |

### 3.5 Sprint, burn-down, dự báo

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /projects/:id/sprints` | pj:MEMBER | — | `sprint[]` (status, số việc, giờ) | M | 09 |
| `POST /projects/:id/sprints` | pj:PM | `{ name, goal?, startDate, endDate }` | `201 sprint` | M | 09 |
| `GET · PATCH /sprints/:id` | pj:MEMBER · pj:PM | `{ name?, goal?, startDate?, endDate? }` | `sprint` | M | 09 |
| `POST /sprints/:id/start` | pj:PM | — | `sprint` (409 `SPRINT_ALREADY_ACTIVE`) | M | 09 |
| `POST /sprints/:id/close` | pj:PM | `{ moveOpenTo: "backlog" \| sprintId }` + header `Idempotency-Key` (tuỳ chọn, hiện thực 28/09 — khoá lưu trong nhật ký `sprint.closed`) | `sprint` + `{ movedTaskIds, movedTo }` | M | 09 |
| `POST /sprints/:id/tasks` | pj:PM | `{ taskIds[] }` (kéo từ backlog) | `task[]` | M | 09 |
| `GET /sprints/:id/summary` | pj:MEMBER | — | `{ sprint, window, taskCount, doneCount, committedHours, scopeHours, completedHours, remainingHours, capacityHours, byAssignee[{ userId, tasks, remainingHours, capacityHours }], unassigned, completed[], open[], carriedOut[], carriedIn[], addedAfterStart[] }` — số backend tính, không xếp hạng (thêm 28/09, đề xuất 02/07 C1) | M | 09, 30 |
| `GET /sprints/:id/burndown` | pj:MEMBER | — | `{ ideal[], actual[], velocity, scopeCreepDays[] }` | M | 30 |
| `GET /sprints/:id/forecast` | pj:MEMBER | — | `{ eta, riskLevel, remainingHours, velocity, causes[] }` (backend tính) | M | 31 |
| `POST /sprints/:id/forecast/explain` | pj:PM | — | `{ action: RISK_EXPLANATION, cachedUntil }` | M | 31 |

### 3.6 Công việc

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /projects/:id/tasks?sprintId=&assigneeId=&labelId=&status=&priority=&type=&dueFrom=&dueTo=&q=&parentId=&since=` | pj:MEMBER | — | `task[]` (rút gọn; `since` trả phần chênh + `deletedIds[]`) | M | 10, 12, 13, 15, 17 |
| `POST /projects/:id/tasks` | pj:MEMBER | `{ title, description?, type?, priority?, difficulty?, labelIds[], startDate?, dueDate?, estimateHours?, sprintId?, columnId?, parentId?, assigneeIds[], requiredSkills[{ skillId, minLevel }] }` | `201 task` (số ST-n) | M | 10 |
| `GET /tasks/:id` | pj:MEMBER | — | `task` đầy đủ (subtasks, assignees, skills, deps, labels, counts) | M | 10 |
| `GET /tasks/by-key/:projectKey/:number` | pj:MEMBER | — | `task` | M | 10 |
| `PATCH /tasks/:id` | pj:MEMBER | `{ version, ...trường sửa }` — gồm `type` (STORY/TASK/BUG) | `task` (409 khi lệch) | M | 10 |
| `DELETE /tasks/:id` | pj:MEMBER (tạo) · pj:PM | — | `204` (xoá mềm) | M | 10 |
| `PATCH /tasks/:id/move` | pj:MEMBER | `{ version, columnId, position, sprintId? }` | `task` (422 `WIP_LIMIT_EXCEEDED`) | M | 12 |
| `PATCH /tasks/:id/progress` | assignee · pj:PM | `{ version, progress? , remainingHours? }` | `task` | M | 10 |
| `PUT /tasks/:id/assignees` | pj:MEMBER | `{ version, userIds[] }` | `task` | M | 10 |
| `PUT /tasks/:id/skills` | pj:MEMBER | `{ version, skills[{ skillId, minLevel }] }` | `task` | M | 10 |
| `PUT /tasks/:id/labels` | pj:MEMBER | `{ version, labelIds[] }` | `task` | M | 10 |
| `POST /tasks/:id/subtasks` | pj:MEMBER | `{ title, estimateHours?, assigneeIds[]? }` | `201 task` (parentId) | M | 11 |
| `POST /tasks/:id/duplicate` | pj:MEMBER | `{ withSubtasks? }` | `201 task` | M | 10 |
| `GET · PUT /tasks/:id/dependencies` | pj:MEMBER | `{ version, dependsOnIds[] }` | `dependency[]` (422 `DEPENDENCY_CYCLE`) | S1 | 11 |
| `GET /me/tasks?status=&dueTo=` | auth | — | `task[]` xuyên dự án | M | 15 |
| `GET /workspaces/:wsId/tasks/search?q=&limit=` | member | — | `task[]` (⌘K) | M | 15 |
| `GET · POST /tasks/:id/time-entries` · `PATCH · DELETE /time-entries/:id` | assignee · pj:PM | `{ workDate, hours, note? }` | `{ entries[], totalHours, estimateHours }` — **đã làm 28/09**; không ghi ngày tương lai, ≤ 24 h/người/ngày, sửa/xoá: người ghi · PM | S5 | 35 |
| `GET · PUT /tasks/:id/review` | GET: pj:MEMBER · PUT: pj:PM | `{ rating, difficultyActual, actualHoursConfirmed?, comment? }` | `{ visible, canReview, done, review }` — **đã làm 28/09**; chỉ việc đã xong; nội dung chỉ người được giao và PM thấy | S5 | 36 |

### 3.7 Bình luận, đính kèm

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /tasks/:id/comments?page=` | pj:MEMBER | — | `comment[]` (mentions) | M | 18 |
| `POST /tasks/:id/comments` | pj:MEMBER | `{ body, mentionUserIds[] , parentId? }` | `201 comment` | M | 18 |
| `PATCH · DELETE /comments/:id` | tác giả · pj:PM | `{ body }` | `comment` / `204` | M | 18 |
| `POST /tasks/:id/attachments/sign` | pj:MEMBER | `{ fileName, mime, sizeBytes }` (≤ 10 MB) | `{ uploadUrl, storagePath, expiresAt }` | M | 19 |
| `POST /tasks/:id/attachments` | pj:MEMBER | `{ storagePath, fileName, mime, sizeBytes }` | `201 attachment` | M | 19 |
| `GET /tasks/:id/attachments` | pj:MEMBER | — | `attachment[]` | M | 19 |
| `GET /attachments/:id/download-url` | pj:MEMBER | — | `{ url, expiresAt }` (15 phút) | M | 19 |
| `DELETE /attachments/:id` | người tải · pj:PM | — | `204` | M | 19 |

### 3.8 Thông báo, Web Push

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /notifications?unread=&page=` | auth | — | `notification[]` | M | 20 |
| `GET /notifications/unread-count` | auth | — | `{ count }` | M | 20 |
| `PATCH /notifications/:id/read` · `POST /notifications/read-all` | self | — | `204` | M | 20 |
| `GET /push/vapid-public-key` | auth | — | `{ key }` | S8 | 21 |
| `POST /push/subscriptions` · `DELETE /push/subscriptions/:id` | self | `{ endpoint, keys: { p256dh, auth }, userAgent }` | `201` / `204` | S8 | 21 |

### 3.9 Tải, cảnh báo, chỉ số, bảng năng lực

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /workspaces/:wsId/workload?from=&weeks=4&projectId=` | ws:ADMIN · pj:PM (của dự án mình) | — | `{ users[{ userId, weeks[{ weekStart, loadHours, effLoadHours, capacityHours, effCapacityHours, utilization, level, riskScore }] }] }` | M | 24 |
| `GET /projects/:id/workload?from=&weeks=` | pj:MEMBER | — | như trên, phạm vi dự án | M | 24 |
| `GET /users/:userId/workload/details?week=` | self · pj:PM | — | `{ tasks[{ task, hoursInWeek, hoursEff }], meetingHours, timeOffHours, riskBreakdown }` | M | 24, 25 |
| `GET /workspaces/:wsId/workload/alerts?open=` | ws:ADMIN · pj:PM | — | `alert[]` | M | 25 |
| `POST /workload/alerts/:id/ack` | pj:PM | `{ note? }` | `alert` | M | 25 |
| `POST /projects/:id/workload/recompute` | pj:PM | — | `202` (chạy lại, phát `workload:updated`) | M | 24 |
| `GET /projects/:id/capacity-table?sprintId=&taskIds=` | pj:PM | — | **bảng sự thật**: `{ members[{ userId, skills[], utilizationBefore, freeByDay[{ date, freeHours, focusBlocks }], metrics{ ear, onTimeRate, sampleSize }, projectsOpen }], tasks[{ taskId, hoursEff per user, skillMatch per user }] }` — không xếp hạng | S4 | 26, 39 |
| `GET /projects/:id/skill-profiles` | pj:MEMBER (đọc) | — | `[{ id, fullName, role, skills[{ skillId, name, level, confidence, tasks, passed, failed, reviewed, verified, lastAt, declared, evidence }], performance | null }]` — mức **từ bằng chứng** ([02/08](../02-phan-tich/08-ho-so-ky-nang-tu-bang-chung.md)); `performance` (đúng hạn, rating, EAR, mở lại) chỉ cho chính người đó và PM | S5 | 23, 26 |
| `GET /projects/:id/skill-profiles/:userId/evidence?skillId=` | pj:MEMBER (đọc) | — | các việc làm nên mức: `{ task, required, demonstrated, passed, weight, rating (ẩn với người khác), reopened, bugs, at }[]` | S5 | 23 |
| `GET /users/:userId/metrics?weeks=8` | self · pj:PM | — | `metricsWeekly[]` | S5 | 35, 36 |

### 3.10 Lịch bận

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET · POST /me/calendar-connections` | self | `{ source: "ICS" \| "MANUAL", icsUrl? }` | `connection[]` | S6 | 37 |
| `DELETE /me/calendar-connections/:id` | self | — | `204` (xoá events) | S6 | 37 |
| `POST /me/calendar-connections/:id/sync` | self | — | `202` | S6 | 37 |
| `GET · POST /me/calendar-events?from=&to=` · `DELETE /me/calendar-events/:id` | self | `{ startAt, endAt, isBusy }` (MANUAL) | `event[]` | S6 | 37 |

### 3.11 AI

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `POST /projects/:id/ai/decompose` | pj:PM | `{ requirement, sprintId?, detail: "coarse" \| "normal" \| "fine" }` | `{ proposalId, action: DECOMPOSE_PROPOSAL, validation, cached }` (503 khi AI lỗi, 429 hạn mức) | M | 28 |
| `GET /ai/proposals/:id` | pj:PM | — | `proposal` (payload, validation, status) | M | 28 |
| `POST /ai/proposals/:id/apply` | pj:PM · người tạo (thành viên) | `{ draftKeys?[], version?, edits? }` + `Idempotency-Key?` | `201 { proposal, createdTasks[{draftKey, taskId, key}], createdTaskIds[] }` — duyệt toàn bộ hoặc một phần; 409 `PROPOSAL_VERSION_CONFLICT` / `PROPOSAL_ALREADY_APPLIED` / `DRAFT_ALREADY_APPLIED`; 422 `PROPOSAL_VALIDATION_FAILED` | M (Phase 8: một phần) | 28, 39 |
| `POST /ai/proposals/:id/reject` | pj:PM · người tạo | `{ draftKeys?[], reason? }` | `204` (item → DISCARDED, ghi ai_feedback) | M | 28 |
| `PATCH /ai/proposals/:id/items/:draftKey` | pj:PM · người tạo | `{ patch, version }` (patch theo `draftPatchSchema`) | `proposal` (version + 1; 409 lệch; 422 key lạ) | S9 | 38 |
| `GET /ai/quota` | auth | — | `{ used, limit, resetsAt }` | M | 32 |
| `POST /ai/chat` | pj:MEMBER | `{ projectId, sessionId?, text, selectedCode?, sprintId? }` | `{ sessionId, session, message, action, validation?, proposals[] (toàn bộ của phiên), usage }` — 409 `AI_TURN_IN_PROGRESS` khi chồng lượt | S9 (Phase 8) | 38, 39 |
| `GET /ai/sessions?projectId=&includeArchived=` · `POST /ai/sessions` · `GET /ai/sessions/:id` · `GET /ai/sessions/:id/proposals` · `PATCH /ai/sessions/:id` · `DELETE /ai/sessions/:id` | self | `{ projectId, title? }` · `{ title?, archived? }` | `session[]` (kèm openDrafts) / `{ session, messages[], proposals[] }` / `proposal[]`; xoá → DRAFT của phiên REJECTED, task đã tạo giữ | S9 (Phase 8) | 38 |
| `GET · PUT /workspaces/:wsId/ai/prompt` · `GET · POST · DELETE /workspaces/:wsId/member-aliases[/:id]` · `PATCH /workspaces/:wsId/members/:userId/identity` | ws:ADMIN | `{ content }` · `{ userId, alias }` · `{ department?, title?, managerUserId? }` | WORKSPACE prompt (chính sách chọn người) · alias · danh tính — dữ liệu DANH TÍNH cho LLM nhận diện, không phải chính sách (docs 12 §4) | S9 (Phase 8) | 40 |
| `GET · POST · PATCH · DELETE /me/ai/memories[/:id]` · `POST /me/ai/memories/:id/structure` | self | xem 06 | `memory[]` | S9 | 38 |
| `GET /me/ai/habits` · `PATCH /me/ai/habits/:id` | self | `{ isVisible? , promote? }` | `habit[]` | S9 | 39 |
| `GET · PUT /me/ai/personal-prompt` | self | `{ content }` | `{ content }` | S9 | 38 |

### 3.12 Quản trị AI

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | UC |
|---|---|---|---|---|---|
| `GET /ai-config/models` | ws:ADMIN | — | `modelCatalog[]` | S10 | 40 |
| `GET · POST /workspaces/:wsId/ai-configs` · `PATCH · DELETE /ai-configs/:id` | ws:ADMIN | `{ provider, model, apiKey, baseUrl?, purpose, advancedParams?, isDefault }` (khoá mã hoá, không trả lại) | `config[]` | S10 | 40 |
| `POST /ai-configs/:id/test` | ws:ADMIN | — | `{ ok, latencyMs, model }` | S10 | 40 |
| `GET · PUT /workspaces/:wsId/ai-prompts/:type` | ws:ADMIN | `{ content }` (type WORKSPACE; MASTER chỉ đọc) | `{ content, version }` | S10 | 40 |
| `GET /workspaces/:wsId/ai-usage?from=&to=&groupBy=day\|purpose\|user` | ws:ADMIN | — | `{ rows[], totals{ tokens, cachedTokens, costUsd, costVnd, errorRate, avgMs } }` | S10 | 32, 40 |

### 3.13 Hệ thống

| Phương thức · đường dẫn | Quyền | Trả về | Mức |
|---|---|---|---|
| `GET /health` | — | `{ status, uptime, version }` | M |
| `GET /health/ready` | — | `{ db: "ok" }` / 503 | M |
| `GET /docs` · `GET /docs-json` | — | Swagger UI / OpenAPI JSON | M |

**Tổng:** 146 operation (phương thức × đường dẫn) — 100 MVP, 46 làm nếu kịp; gộp theo tài nguyên còn khoảng 75 đường dẫn.

> **Đối chiếu sau đợt cải tiến task 23/09/2026** ([02/05](../02-phan-tich/05-cai-tien-quan-ly-task.md), [05/web-cai-tien-task](../05-hien-thuc/web-cai-tien-task.md)): **không endpoint mới nào được thêm**, chỉ bổ sung trường `type` vào các DTO của §3.6 và `byType[]` vào payload dashboard. Ba đường dẫn đã có từ Phase 3 mà web chưa từng gọi nay đều dùng tới — `POST /tasks/:id/duplicate` (nút Nhân bản), `GET /tasks/by-key/:projectKey/:number` (trang chi tiết `/projects/:id/tasks/ST-n`), `GET /workspaces/:wsId/tasks/search` (bảng lệnh Ctrl/Super + K). Bổ sung 24/09: ba endpoint §3.3 `POST /workspaces/:wsId/skills`, `PATCH /skills/:id`, `POST /skills/:id/merge` cũng chưa từng được gọi — nay có màn Cài đặt › Danh mục kỹ năng. Hai endpoint hàng loạt từng cân nhắc (`POST /tasks/bulk`, `PATCH /tasks/bulk`) **không cần**: client gửi tuần tự ≤ 50 lời gọi, mỗi lời mang `version` riêng, nên giữ nguyên được khoá lạc quan.

## 4. Sự kiện Socket.io

| Hướng | Sự kiện | Payload | Phòng |
|---|---|---|---|
| C→S | `project:join` / `project:leave` | `{ projectId }` (server kiểm thành viên) | — |
| C→S | `presence:ping` | `{ projectId, view }` | — |
| S→C | `task:created` / `task:updated` / `task:moved` / `task:deleted` | `{ task (rút gọn) \| taskId, version, actorId, at }` | `project:{id}` |
| S→C | `comment:created` / `comment:updated` / `comment:deleted` | `{ comment \| commentId, taskId }` | `project:{id}` |
| S→C | `sprint:updated` | `{ sprint }` | `project:{id}` |
| S→C | `workload:updated` | `{ userId, weekStart, utilization, level, riskScore }` | `project:{id}`, `user:{id}` |
| S→C | `notification:new` | `{ notification }` | `user:{id}` |
| S→C | `presence:update` | `{ projectId, users[{ userId, view }] }` | `project:{id}` |
| S→C | `ai:proposal:applied` | `{ proposalId, taskIds[] }` | `project:{id}` |
| S→C | `ai:proposal:updated` | `{ sessionId, projectId, proposal }` — bản nháp vá/bỏ/duyệt một phần (tab thứ hai thấy thẻ đổi màu) | `user:{id}` |
| S→C | `ai:session:updated` | `{ sessionId, projectId, change }` | `user:{id}` |

Client ghi qua REST; socket chỉ nhận. Sự kiện có `version` nhỏ hơn bản đang giữ thì bỏ qua.

## 5. Mã lỗi nghiệp vụ (packages/shared/errors.ts)

`TASK_VERSION_CONFLICT`, `WIP_LIMIT_EXCEEDED`, `DEPENDENCY_CYCLE`, `SPRINT_ALREADY_ACTIVE`, `SPRINT_NOT_ACTIVE`, `PROJECT_PM_REQUIRED`, `INVITATION_EXPIRED`, `ATTACHMENT_TOO_LARGE`, `SKILL_MERGE_SAME`, `AI_QUOTA_EXCEEDED`, `AI_PROVIDER_UNAVAILABLE`, `AI_RESPONSE_INVALID`, `PROPOSAL_EXPIRED`, `PROPOSAL_ALREADY_APPLIED`, `ASSIGN_NOT_MEMBER`, `ASSIGN_ON_LEAVE`, `ASSIGN_SKILL_GAP`, `ASSIGN_CAPACITY_EXCEEDED`, `ASSIGN_OVERLOAD`, `UNKNOWN_CODE`, `CALENDAR_SYNC_FAILED`, `AI_PURPOSE_DISABLED`, `AI_IN_PROGRESS`, `AI_CONFIG_INVALID`, `PROPOSAL_NOT_DRAFT`, `PROPOSAL_VALIDATION_FAILED`, `AI_TURN_IN_PROGRESS`, `PROPOSAL_VERSION_CONFLICT`, `UNKNOWN_DRAFT_KEY`, `DRAFT_ALREADY_APPLIED`.

## 6. Việc tiếp theo

- Tuần 05: đặc tả UC dựa trên bảng 1.1; Tuần 06: sinh `docs/03-thiet-ke/openapi.yaml` từ mục 3 (mỗi dòng = một operation, DTO từ 08) + Postman collection.
- Tuần 07: controller theo đúng đường dẫn ở đây; Swagger sinh ra phải khớp `openapi.yaml` (so bằng `openapi-diff` trong CI, cảnh báo khi lệch).
