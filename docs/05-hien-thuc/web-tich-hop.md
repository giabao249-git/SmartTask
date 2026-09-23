# Tích hợp apps/web ↔ API thật

> Trạng thái: **hoàn tất bước 0–7** trên `main` (18/09/2026). Mock chỉ còn `src/mocks/notifications.ts` (AppShell bản đang sửa dở của phiên khác vẫn import — xem §4).
> Quy ước giữ nguyên docs 10: chỉ `components/ui`, màu qua `lib/status.ts`, TypeScript strict không `any`, mỗi màn 4 trạng thái (loading / empty / error theo mã / data) từ dữ liệu thật.

## 1. Hạ tầng (bước 0)

| Thành phần | File | Ghi chú |
|---|---|---|
| Fetch wrapper | `src/lib/api.ts` | `NEXT_PUBLIC_API_URL`; Bearer từ bộ nhớ (`tokenStore`), 401 → `POST /auth/refresh` (cookie `rt`, single-flight) rồi thử lại **một** lần; `ApiError {code,status,details}` theo `ERROR_CODES` của `@smarttask/shared`; `describeError()` cho UI |
| TanStack Query | `src/lib/query.tsx` | staleTime 15 s, không retry 4xx |
| Auth | `src/lib/auth.tsx`, `src/middleware.ts`, `src/lib/auth-cookie.ts` | `AuthProvider` nạp `GET /me` khi có token/refresh được; cờ `st_session` (không httpOnly) để middleware chuyển hướng `/login?next=` |
| Socket | `src/lib/socket.ts` | `io(origin, {auth:{token}})`, tự kết nối lại khi token đổi; `joinProject(projectId, view)` trả hàm rời phòng |
| Định tuyến dự án | `/projects/[projectId]/…` (UUID), `ProjectProvider` (`src/lib/hooks/use-project.tsx`) | key (ST) chỉ để hiển thị; dự án mở gần nhất lưu `localStorage st.lastProject` |
| Lint / build | `eslint.config.mjs`, `package.json` | `next/core-web-vitals + typescript + unused-imports`; `npm run web:build` dùng `NEXT_DIST_DIR=.next-build` để không phá `.next` của dev server |
| `.env.example` | `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`, `NEXT_PUBLIC_USE_MOCK=0` | Cờ mock hiện không còn màn nào dùng (giữ để tương thích) |

## 1b. Gộp màn thành tab (23/09/2026)

Sidebar dự án từ 8 mục còn 4. Hai nhóm được gộp vì **cùng một nguồn dữ liệu**, không phải để cho gọn menu:

| Màn mới | Tab | Màn cũ (vẫn redirect) |
|---|---|---|
| `/projects/:id/work` | `?view=board` \| `list` \| `timeline` \| `eisenhower` | `/board`, `/tasks`, `/timeline`, `/eisenhower` |
| `/projects/:id/people` | `?tab=workload` \| `balance` \| `skills` \| `mine` | `/workload`, `/rebalance`, `/skills` |

- **Bộ lọc dùng chung** (`features/work/filters.tsx`): sprint, người, từ khoá, lọc nhanh (Tất cả / Việc của tôi / Chưa giao) nằm trong URL `?view=&sprint=&assignee=&q=&quick=&task=` → đổi cách nhìn không mất lọc, F5 và chia sẻ link ra đúng khung nhìn.
- **Một lần gọi API cho cả màn**: 4 view dùng chung khoá TanStack Query `["projects", id, "tasks", filters]`; đo thực tế đổi 3 tab = **0 request** thêm.
- **Đường cũ không chết**: 7 route cũ chuyển hướng sang tab tương ứng và **giữ nguyên `?task=`** — thông báo, ⌘K, link đã chia sẻ và ảnh trong tài liệu vẫn mở đúng công việc.
- Màn hẹp (< 640px) đổi tab bằng `Select` thay cho `TabsList`.
- Giữ riêng: Dashboard (điểm vào), Trợ lý AI (layout 3 cột), Cấu hình dự án (đã là tabs).

## 2. Bảng màn ↔ endpoint ↔ trạng thái

Ký hiệu: ✅ nối API thật · 🟡 tính trên web từ dữ liệu API (không có endpoint riêng) · ⏳ chờ backend.

| Màn (route) | Feature | Endpoint | Realtime | Trạng thái |
|---|---|---|---|---|
| Đăng nhập / đăng ký `/login` | `(auth)/login/page.tsx` | `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `POST /auth/logout` | — | ✅ |
| AppShell (tên, workspace, vai, đăng xuất) | `components/app/AppShell.tsx` | `GET /me`, `GET /projects/:id` | — | ✅ (chuông thông báo: xem §4) |
| Workspace & dự án `/workspaces` | `workspaces/page.tsx` | `GET /workspaces`, `POST /workspaces`, `GET /workspaces/:id/projects`, `POST /workspaces/:id/projects`, `GET /workspaces/:id/members`, `POST /workspaces/:id/invitations` | — | ✅ |
| Trợ lý AI `/projects/:id/assistant` | `features/assistant/*` | `GET/POST/PATCH/DELETE /ai/sessions[/:id]`, `GET /ai/sessions/:id/proposals`, `POST /ai/chat`, `PATCH /ai/proposals/:id/items/:draftKey`, `POST /ai/proposals/:id/apply {draftKeys?, version}`, `POST …/reject {draftKeys?}`, `GET /ai/quota` | `ai:proposal:updated`, `ai:session:updated` | ✅ — 409 `AI_TURN_IN_PROGRESS`/429 → toast; 503 `AI_PROVIDER_UNAVAILABLE` → Alert; 409 `PROPOSAL_VERSION_CONFLICT` → Alert "đã đổi ở tab khác" + tải lại; item duyệt xanh lá với key task thật |
| Cài đặt › Trợ lý AI | `features/settings/AiPolicyView.tsx` | `GET/PUT /workspaces/:id/ai/prompt`, `GET/POST/DELETE /workspaces/:id/member-aliases`, `PATCH /workspaces/:id/members/:userId/identity` | — | ✅ (409 alias trùng, 422 quản lý là chính mình) |
| AI phân rã `/projects/:id/ai-decompose` | `features/ai-decompose/AIDecomposeView.tsx` | `POST /projects/:id/ai/decompose`, `GET /ai/proposals/:id`, `POST …/apply`, `POST …/reject` | — | ✅ — form một lượt; sửa từng mục chuyển sang Trợ lý AI (nút "Chat nhiều lượt" mang prompt) |
| Công việc › Bảng `/projects/:id/work?view=board` | `features/board/*` | `GET /projects/:id/tasks {items, deletedIds, serverTime}`, `POST /projects/:id/tasks`, `PATCH /tasks/:id/move {columnId, position, version}`, `GET /projects/:id/sprints` | `task:*` (bỏ qua actorId của mình, debounce 300 ms) | ✅ — 409 `TASK_VERSION_CONFLICT`/422 WIP → hoàn tác + toast |
| Chi tiết task (Sheet) | `components/app/TaskDetailSheet.tsx` | `GET/PATCH/DELETE /tasks/:id` (mọi PATCH kèm `version`, gồm `isUrgent`), `PUT /tasks/:id/assignees`, `PUT /tasks/:id/labels`, `PUT /tasks/:id/skills`, `PUT /tasks/:id/dependencies` (mới — 422 `DEPENDENCY_CYCLE`), `PATCH /tasks/:id/progress`, `POST /tasks/:id/subtasks`, `GET/POST/PATCH/DELETE /tasks/:id/comments`, `GET /projects/:id/members/suggest?q=`, `GET/POST /tasks/:id/attachments` (sign → PUT → confirm), `GET /attachments/:id/download-url`, `DELETE /attachments/:id`, `GET /projects/:id/activity?taskId=` (tab Hoạt động) | `comment:*` | ✅ |
| Công việc › Danh sách `?view=list` | `features/tasks/TaskListView.tsx` | `GET /projects/:id/tasks` (lọc/sắp xếp trong URL) | `task:*` | ✅ |
| Công việc › Timeline `?view=timeline` | `features/timeline/TimelineGanttView.tsx` | `GET /projects/:id/tasks`, `GET /projects/:id/sprints`, `PATCH /tasks/:id {startDate, dueDate, version}` | `task:*` | ✅ Gantt vẽ trên web; kéo thanh dời ngày, kéo mép phải đổi hạn (409 → tải lại) |
| Công việc › Eisenhower `?view=eisenhower` | `features/eisenhower/EisenhowerMatrixView.tsx` | `GET /projects/:id/tasks?sprintId=` | `task:*` | 🟡 4 ô tính trên web: khẩn = `isUrgent` hoặc hạn ≤ 3 ngày; quan trọng = ưu tiên HIGH/URGENT hoặc độ khó ≥ 4 |
| Dashboard `/projects/:id/dashboard` | `features/dashboard/ProjectDashboardView.tsx` | `GET /projects/:id/dashboard`, `GET /sprints/:id/burndown`, `GET /sprints/:id/forecast`, `POST /sprints/:id/forecast/explain`, `GET /projects/:id/activity` | — | ✅ (thẻ RISK_EXPLANATION parse zod; thẻ Hoạt động gần đây UC-16; nút Cấu hình dự án) |
| Nhân sự › Tải theo tuần `/projects/:id/people` | `features/workload/WorkloadView.tsx` | `GET /projects/:id/workload?weeks=`, `GET /users/:id/workload/details?week=`, `GET /projects/:id/capacity-table` (PM), `POST /projects/:id/workload/recompute` | — | ✅ — nút "Xem đề xuất cân bằng" mở Trợ lý AI với tin mồi |
| Nhân sự › Năng lực & cân bằng `?tab=balance` | `features/rebalance/RebalanceView.tsx` | `GET /projects/:id/workload`, `GET /projects/:id/capacity-table`, `POST …/workload/recompute` | — | ✅ — **không có endpoint "đề xuất"**: backend chỉ tính; đề xuất chuyển việc là bản nháp của LLM trong Trợ lý AI, PM duyệt mới ghi (quy tắc AI) |
| Nhân sự › Kỹ năng `?tab=skills` / `?tab=mine` | `features/skills/SkillsMatrixView.tsx` | `GET /workspaces/:id/skill-matrix?projectId=&minLevel=`, `GET /workspaces/:id/skills`, `PUT /workspaces/:id/me/skills`, `PATCH /workspaces/:id/users/:userId/skills/:skillId/verify` | — | ✅ |
| Cài đặt › Thông báo `/settings` | `features/notifications/*` | `GET /notifications?unreadOnly=`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | `notification:new` (toast + invalidate) | ✅ — bấm mở `link` hoặc `/projects/:pid/board?task=` |
| Cài đặt › Thành viên | `features/settings/MembersTab.tsx` | `GET /workspaces/:id/members`, `PATCH …/members/:userId {role}`, `DELETE …/members/:userId`, `GET/POST/DELETE /workspaces/:id/invitations[/:id]` | — | ✅ (OWNER/chính mình khoá; link mời chép clipboard) |
| Cài đặt › Tham số | `features/settings/WorkspaceSettingsTab.tsx` | `GET/PATCH /workspaces/:id/settings` | — | ✅ (năng lực, ngày/giờ làm, ngưỡng tải, spread, hạn mức & mục đích AI). Ngày lễ, trọng số burnout, retention: chỉ qua API |
| Cài đặt › Tài khoản | `features/settings/ProfileTab.tsx` | `PATCH /me`, `PATCH /me/password`, `PUT /me/notification-prefs` | — | ✅ (push chỉ lưu tuỳ chọn — web push ngoài phạm vi) |
| Nhận lời mời `/invitations/:token` | `features/invitations/InvitationView.tsx` | `GET /invitations/:token` (công khai), `POST /invitations/:token/accept` | — | ✅ (403 email khác, hết hạn/đã dùng → thông báo rõ) |
| Cấu hình dự án `/projects/:id/settings` | `features/project-settings/*` | Sprint: `GET/POST /projects/:id/sprints`, `PATCH /sprints/:id`, `POST /sprints/:id/start` (409 `SPRINT_ALREADY_ACTIVE`), `POST /sprints/:id/close {moveOpenTo}` · Cột: `PUT /projects/:id/columns` · Nhãn: `POST /projects/:id/labels`, `PATCH/DELETE /labels/:id` · Thành viên: `PUT /projects/:id/members` (đúng một PM) · Chung: `PATCH /projects/:id`, `POST /projects/:id/archive` | — | ✅ (vào từ Dashboard → "Cấu hình dự án"; mục sidebar chờ AppShell) |

## 3. Cách xử lý lỗi thống nhất

- `describeError(e)` → `{code, message}`; `ErrorState code=… onRetry` cho trạng thái lỗi màn; toast `sonner` kèm `description: code` cho thao tác.
- 401 sau refresh thất bại → `AuthProvider` xoá phiên, middleware đưa về `/login?next=`.
- Xung đột version (task 409, proposal 409) → không ghi đè: hoàn tác local + `refetch`.
- Khoá input trong lúc gọi AI (`isPending`) — không gửi chồng lượt.

## 4. Chờ backend / chưa nối

| Hạng mục | Tình trạng | Việc cần |
|---|---|---|
| Chuông thông báo trên AppShell | `useBellCount()` + `NotificationsPanel compact` đã có (`features/notifications`), **chưa gắn** vì `AppShell.tsx` đang được phiên khác viết lại (sidebar Zen/Arc) — bản đó vẫn import `mocks/notifications.ts` | Khi AppShell ổn định: thay `MOCK_NOTIFICATIONS` bằng `useBellCount()` + Popover `NotificationsPanel compact`, rồi xoá `src/mocks/notifications.ts` |
| Tìm kiếm ⌘K theo task | `features/search/TaskSearchGroup.tsx` đã có (dùng `GET /projects/:id/tasks?q=`, debounce) — **chưa gắn** vào CommandDialog của AppShell (file đang được phiên khác sửa) | Nhúng `<TaskSearchGroup projectId projectKey query onPick />` vào CommandList; tìm thành viên/toàn workspace: ⏳ backend |
| Mục sidebar "Cấu hình dự án" | Trang `/projects/:id/settings` đã có, vào từ Dashboard | Thêm nav item khi AppShell ổn định |
| Kéo task vào sprint hàng loạt | API `POST /sprints/:id/tasks {taskIds}`; web đổi sprint từng task trong Sheet | Chọn nhiều ở danh sách task (làm nếu kịp) |
| Cấu hình AI provider/model | API `ai-config/*` (admin hệ thống); web không có màn | Ngoài phạm vi đồ án (đổi qua `.env`) |
| Ghi nhớ (`MEMORY_PROPOSAL`) | Chỉ hiển thị thẻ; API ghi memory là Phase 9 | ⏳ backend |

## 5. Cách chạy & tự kiểm

```bash
docker compose up -d postgres            # 5434
npm run api:dev                          # 3000, AI_PROVIDER=fake (hỏi trước khi bật gemini)
PORT=3001 npm run web:dev                # hoặc cấu hình "web" trong .claude/launch.json
```

Tài khoản seed: `lan@smarttask.local` (OWNER/PM), `minh@`, `huy@` — `Demo@1234`. Chụp màn hình tự động bằng Playwright headless (script `shot.mjs` trong scratchpad của phiên Claude: đăng nhập lan → mở route → chụp), vì pane trình duyệt trong môi trường này không chụp được.

## 6. Commit theo bước

| Bước | Commit |
|---|---|
| 0 hạ tầng | `de25184` |
| 1 đăng nhập + seed | `907825c` |
| 2 workspace & dự án | `5195a2c` |
| 3 Trợ lý AI + cài đặt AI | `55486a8` (+ `6992879` build dir) |
| 4 Kanban / danh sách / chi tiết task | `9d01979` |
| 5 Dashboard / tải / kỹ năng | `5a31a8d` |
| 6 timeline / Eisenhower / thông báo / cài đặt / cân bằng / phân rã, xoá mock | `48e32a7` |
| 7 cấu hình dự án / tài khoản / lời mời | `3b55da3` |
| 7 dòng hoạt động, ⌘K task group | `9b6f8ab` |
| 7 `PUT /tasks/:id/dependencies` (API) + Sheet sửa nhãn/kỹ năng/phụ thuộc/khẩn | `44b9bfa` |
| 7 Gantt kéo dời ngày / đổi hạn | `9c2149e` |
