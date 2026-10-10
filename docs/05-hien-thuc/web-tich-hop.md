# Tích hợp apps/web ↔ API thật

> Trạng thái: **hoàn tất bước 0–8** trên `main` (23/09/2026). Bước 8 = đợt cải tiến tạo/quản lý task theo
> [02/05](../02-phan-tich/05-cai-tien-quan-ly-task.md) — chi tiết ở [web-cai-tien-task](web-cai-tien-task.md).
> Không còn mock nào trong `src/mocks` (chuông thông báo gắn API thật 28/09 — xem §4).
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
| `/projects/:id/work` | `?view=board` \| `list` \| `timeline` \| `eisenhower` \| `backlog` | `/board`, `/tasks`, `/timeline`, `/eisenhower` |
| `/projects/:id/people` | `?tab=workload` \| `balance` \| `skills` \| `mine` | `/workload`, `/rebalance`, `/skills` |

- **Bộ lọc dùng chung** (`features/work/filters.tsx`): sprint, người, **loại**, từ khoá, lọc nhanh (Tất cả / Việc của tôi / Chưa giao) và **nhóm** nằm trong URL `?view=&sprint=&assignee=&type=&q=&quick=&group=&task=` → đổi cách nhìn không mất lọc, F5 và chia sẻ link ra đúng khung nhìn.
- **Một lần gọi API cho cả màn**: 5 view dùng chung khoá TanStack Query `["projects", id, "tasks", filters]`; đo thực tế đổi 3 tab = **0 request** thêm. Màn Backlog ép `backlog=true` nên có khoá riêng, và ẩn ô lọc sprint.
- **Lựa chọn nhiều dùng chung** (`features/work/selection.tsx`) và **chế độ tập trung** (`features/work/focus.tsx`) cũng đặt ở tầng này, nên đổi giữa Bảng ↔ Danh sách ↔ Backlog không mất những gì đang chọn.
- **Đường cũ không chết**: 7 route cũ chuyển hướng sang tab tương ứng và **giữ nguyên `?task=`** — thông báo, ⌘K, link đã chia sẻ và ảnh trong tài liệu vẫn mở đúng công việc.
- Màn hẹp (< 640px) đổi tab bằng `Select` thay cho `TabsList`.
- Giữ riêng: Dashboard (điểm vào), Trợ lý AI (layout 3 cột), Cấu hình dự án (đã là tabs).

## 1c. Điều hướng vào dự án (23/09/2026)

- Đăng nhập xong và mở `/` đều đi thẳng tới **dự án mở gần nhất**; nếu chỉ có đúng một workspace và một dự án ACTIVE thì vào thẳng dự án đó (`src/lib/landing.ts`). Trước đây luôn dừng ở `/workspaces` dù thanh trên đã hiện workspace, khiến người dùng phải bấm "Mở dự án" thêm một lần.
- `?next=` khi bị middleware chặn vẫn được ưu tiên, nên link chia sẻ mở đúng màn.
- Dự án trong đường dẫn không còn (ví dụ vừa seed lại CSDL): hiện lỗi `NOT_FOUND` kèm nút **"Về danh sách dự án"**, đồng thời xoá `localStorage st.lastProject` để lần sau không quay lại id chết.
- Seed dùng **id cố định** cho 6 tài khoản, workspace và dự án ST (`apps/api/prisma/seed.ts`), nên chạy `prisma db seed` lại không làm chết đường dẫn `/projects/<id>/…` đang mở.

## 2. Bảng màn ↔ endpoint ↔ trạng thái

Ký hiệu: ✅ nối API thật · 🟡 tính trên web từ dữ liệu API (không có endpoint riêng) · ⏳ chờ backend.

| Màn (route) | Feature | Endpoint | Realtime | Trạng thái |
|---|---|---|---|---|
| Đăng nhập / đăng ký `/login` | `(auth)/login/page.tsx` | `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `POST /auth/logout` | — | ✅ |
| AppShell (tên, workspace, vai, đăng xuất) | `components/app/AppShell.tsx` | `GET /me`, `GET /projects/:id`, `GET /workspaces/:wsId/tasks/search?q=` (bảng lệnh) | — | ✅ — bảng lệnh Ctrl/Super + K tìm việc **xuyên dự án** và có nhóm lệnh "Tạo"; nhãn phím theo hệ điều hành (`lib/hooks/use-mod-key.ts`), không còn ký hiệu ⌘ (chuông thông báo: xem §4) |
| Workspace & dự án `/workspaces` | `workspaces/page.tsx` | `GET /workspaces`, `POST /workspaces`, `GET /workspaces/:id/projects`, `POST /workspaces/:id/projects`, `GET /workspaces/:id/members`, `POST /workspaces/:id/invitations` | — | ✅ |
| Trợ lý AI `/projects/:id/assistant` | `features/assistant/*` | `GET/POST/PATCH/DELETE /ai/sessions[/:id]`, `GET /ai/sessions/:id/proposals`, `POST /ai/chat`, `PATCH /ai/proposals/:id/items/:draftKey`, `POST /ai/proposals/:id/apply {draftKeys?, version}`, `POST …/reject {draftKeys?}`, `GET /ai/quota`, `GET /sprints/:id/summary` (năng lực sprint đích trên thẻ đề xuất) | `ai:proposal:updated`, `ai:session:updated` | ✅ — 409 `AI_TURN_IN_PROGRESS`/429 → toast; 503 `AI_PROVIDER_UNAVAILABLE` → Alert; 409 `PROPOSAL_VERSION_CONFLICT` → Alert "đã đổi ở tab khác" + tải lại; item duyệt xanh lá với key task thật |
| Cài đặt › Trợ lý AI | `features/settings/AiPolicyView.tsx` | `GET/PUT /workspaces/:id/ai/prompt`, `GET/POST/DELETE /workspaces/:id/member-aliases`, `PATCH /workspaces/:id/members/:userId/identity` | — | ✅ (409 alias trùng, 422 quản lý là chính mình) |
| AI phân rã `/projects/:id/ai-decompose` | `features/ai-decompose/AIDecomposeView.tsx` | `POST /projects/:id/ai/decompose`, `GET /ai/proposals/:id`, `POST …/apply`, `POST …/reject` | — | ✅ — form một lượt; sửa từng mục chuyển sang Trợ lý AI (nút "Chat nhiều lượt" mang prompt) |
| Công việc › Bảng `/projects/:id/work?view=board` | `features/board/*` | `GET /projects/:id/tasks {items, deletedIds, serverTime}`, `POST /projects/:id/tasks` (đủ trường: `type`, nhãn, kỹ năng, độ khó, nhiều người), `PATCH /tasks/:id` , `PATCH /tasks/:id/move {columnId, position, version}`, `PUT /tasks/:id/assignees`, `POST /tasks/:id/duplicate`, `DELETE /tasks/:id`, `GET /projects/:id/sprints` | `task:*` (bỏ qua actorId của mình, debounce 300 ms) | ✅ — 409 `TASK_VERSION_CONFLICT`/422 WIP → hoàn tác + toast; tạo nhanh trong cột, dán nhiều dòng, cú pháp `@# ! h`, phím tắt J/K/N/P/Enter/I/A/X/C/Q/F, swimlane theo người/ưu tiên, hoàn tác |
| Công việc › Backlog `?view=backlog` | `features/backlog/BacklogView.tsx` | `GET /projects/:id/tasks?backlog=true`, `PATCH /tasks/:id/move {position, version}` (xếp thứ tự), `POST /sprints/:id/tasks {taskIds}` (đưa vào sprint hàng loạt) | `task:*` | ✅ — danh sách phẳng việc chưa vào sprint, kéo xếp thứ tự bền qua F5 |
| Chi tiết task — **trang riêng** `/projects/:id/tasks/ST-n` | `app/(dashboard)/projects/[projectId]/tasks/[taskKey]/page.tsx` | `GET /tasks/by-key/:projectKey/:number` + mọi endpoint của modal | `task:*` | ✅ — dùng chung `TaskDetailBody` với modal (`variant="page"`); vào từ icon trên thẻ/dòng, hoặc nút phóng to trong modal |
| Thao tác hàng loạt (Bảng / Danh sách / Backlog) | `features/work/BulkActionBar.tsx` | `PUT /tasks/:id/assignees`, `PATCH /tasks/:id`, `PATCH /tasks/:id/move`, `PUT /tasks/:id/labels`, `DELETE /tasks/:id` — **tuần tự ≤ 50, mỗi việc mang `version` riêng**; riêng đổi sprint dùng `POST /sprints/:id/tasks` (1 request) | `task:*` | ✅ — 409 giữa lô không dừng cả lô, báo "n−k đã đổi · k vừa được người khác sửa" |
| Chi tiết task (**modal**) | `components/app/TaskDetailModal.tsx` | `GET/PATCH/DELETE /tasks/:id` (mọi PATCH kèm `version`, gồm `isUrgent`), `PUT /tasks/:id/assignees`, `PUT /tasks/:id/labels`, `PUT /tasks/:id/skills`, `PUT /tasks/:id/dependencies` (mới — 422 `DEPENDENCY_CYCLE`), `PATCH /tasks/:id/progress`, `POST /tasks/:id/subtasks`, `GET/POST/PATCH/DELETE /tasks/:id/comments`, `GET /projects/:id/members/suggest?q=`, `GET/POST /tasks/:id/attachments` (sign → PUT → confirm), `GET /attachments/:id/download-url`, `DELETE /attachments/:id`, `GET /projects/:id/activity?taskId=` (tab Hoạt động) | `comment:*` | ✅ — `Dialog` giữa màn (đổi từ `Sheet`, docs 10 §4), hai cột nội dung/thuộc tính, ghi qua hàng đợi tuần tự nên sửa nhiều trường liên tiếp không khoá cả màn |
| Công việc › Danh sách `?view=list` | `features/tasks/TaskListView.tsx` | `GET /projects/:id/tasks` (lọc/sắp xếp trong URL), `PATCH /tasks/:id`, `PATCH /tasks/:id/move`, `PUT /tasks/:id/assignees` | `task:*` | ✅ — sửa tại chỗ 4 cột (cột, ưu tiên, người, hạn), chọn nhiều + Shift-click |
| Công việc › Timeline `?view=timeline` | `features/timeline/TimelineGanttView.tsx` | `GET /projects/:id/tasks`, `GET /projects/:id/sprints`, `PATCH /tasks/:id {startDate, dueDate, version}` | `task:*` | ✅ Gantt vẽ trên web; kéo thanh dời ngày, kéo mép phải đổi hạn (409 → tải lại) |
| Công việc › Eisenhower `?view=eisenhower` | `features/eisenhower/EisenhowerMatrixView.tsx` | `GET /projects/:id/tasks?sprintId=` | `task:*` | 🟡 4 ô tính trên web: khẩn = `isUrgent` hoặc hạn ≤ 3 ngày; quan trọng = ưu tiên HIGH/URGENT hoặc độ khó ≥ 4 |
| Dashboard `/projects/:id/dashboard` | `features/dashboard/ProjectDashboardView.tsx` | `GET /projects/:id/dashboard`, `GET /sprints/:id/burndown`, `GET /sprints/:id/forecast`, `POST /sprints/:id/forecast/explain`, `GET /projects/:id/activity` | — | ✅ (thẻ RISK_EXPLANATION parse zod; thẻ Hoạt động gần đây UC-16; nút Cấu hình dự án); 28/09: chọn sprint cho burn-down, mục tiêu sprint, nguyên nhân rủi ro tiếng Việt bấm ra việc/người, snapshot tải cũ > 1 h tự tính lại · PM: thẻ "việc đã xong chờ đánh giá" (`GET /projects/:id/reviews/pending`) |
| Nhân sự › Nhóm `/projects/:id/people` (mặc định; `?member=<userId>` mở hồ sơ; `?tab=mine` cũ = hồ sơ của mình) | `features/people/{TeamView,MemberProfile}.tsx` + `DeclaredSkillsEditor` | `GET /projects/:id/skill-profiles`, `GET …/skill-profiles/:userId/evidence?skillId=`, `GET /projects/:id/workload?weeks=1`, `GET·PUT /workspaces/:id/me/skills` | — | ✅ 28/09 — kỹ năng **từ bằng chứng**; thẻ của bạn đứng đầu; hiệu suất chỉ bản thân/PM; Viewer "Chỉ xem" |
| Nhân sự › Tải & giờ trống `?tab=load` (cũ: `workload`, `balance`) | `features/workload/WorkloadView.tsx` (+ `CapacityTable`) | `GET /projects/:id/workload?weeks=`, `GET /users/:id/workload/details?week=`, `GET /projects/:id/sprints`, `GET /projects/:id/capacity-table?sprintId=` (PM), `POST …/workload/recompute` | `workload:updated` | ✅ — tải 4 tuần + giờ trống/ứng viên trên một màn; chọn khoảng sprint; Viewer không là ứng viên |
| Nhân sự › Kỹ năng `?tab=skills` | `features/people/TeamSkillsView.tsx` | `GET /projects/:id/skill-profiles`, `PATCH /users/:id/skills/:skillId/verify` (OWNER/ADMIN hoặc PM dự án chung) | — | ✅ — ma trận theo bằng chứng; ô chỉ có tự khai hiện mờ, PM bấm để xác nhận |
| Cài đặt › Thông báo `/settings` | `features/notifications/*` | `GET /notifications?unreadOnly=`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` | `notification:new` (toast + invalidate) | ✅ — bấm mở `link` hoặc `/projects/:pid/board?task=` |
| Cài đặt › Danh mục kỹ năng | `features/settings/SkillsCatalogTab.tsx` | `GET /workspaces/:id/skills?includeInactive=`, `POST /workspaces/:id/skills`, `PATCH /skills/:id`, `POST /skills/:id/merge` | — | ✅ — thêm/sửa tên–nhóm–alias, ẩn, gộp; chỉ OWNER/ADMIN sửa, thành viên khác chỉ xem |
| Cài đặt › Thành viên | `features/settings/MembersTab.tsx` | `GET /workspaces/:id/members`, `PATCH …/members/:userId {role}`, `DELETE …/members/:userId`, `GET/POST/DELETE /workspaces/:id/invitations[/:id]` | — | ✅ (OWNER/chính mình khoá; link mời chép clipboard) |
| Cài đặt › Tham số | `features/settings/WorkspaceSettingsTab.tsx` | `GET/PATCH /workspaces/:id/settings` | — | ✅ (năng lực, ngày/giờ làm, ngưỡng tải, spread, hạn mức & mục đích AI). Ngày lễ, trọng số burnout, retention: chỉ qua API |
| Cài đặt › Tài khoản | `features/settings/ProfileTab.tsx` | `PATCH /me`, `PATCH /me/password`, `PUT /me/notification-prefs` | — | ✅ (push chỉ lưu tuỳ chọn — web push ngoài phạm vi) |
| Nhận lời mời `/invitations/:token` | `features/invitations/InvitationView.tsx` | `GET /invitations/:token` (công khai), `POST /invitations/:token/accept` | — | ✅ (403 email khác, hết hạn/đã dùng → thông báo rõ) |
| Sprint `/projects/:id/sprints?sprint=` (28/09) | `features/sprints/*` | `GET/POST /projects/:id/sprints`, `PATCH /sprints/:id`, `GET /sprints/:id/summary`, `POST /sprints/:id/start`, `POST /sprints/:id/close {moveOpenTo}`, `GET /projects/:id/tasks?backlog=true` + `?sprintId=`, `POST /sprints/:id/tasks` (PM) / `PATCH /tasks/:id` mang version (thành viên, về backlog) | `task:*` → làm mới tóm tắt | ✅ danh sách sprint · thanh cam kết/năng lực (màu theo mức tải) · theo người · lập kế hoạch Backlog ↔ Sprint trên một màn; mục sidebar + huy hiệu sprint trên thanh trên dẫn tới đây |
| Cấu hình dự án `/projects/:id/settings` | `features/project-settings/*` | Sprint: chuyển sang trang Sprint (tab chỉ còn lối dẫn, giữ cho link cũ `?tab=sprints`) · Cột: `PUT /projects/:id/columns` · Nhãn: `POST /projects/:id/labels`, `PATCH/DELETE /labels/:id` · Thành viên: `PUT /projects/:id/members` (đúng một PM) · Chung: `PATCH /projects/:id`, `POST /projects/:id/archive` | — | ✅ (vào từ Dashboard → "Cấu hình dự án"; mục sidebar chờ AppShell) |

## 3. Cách xử lý lỗi thống nhất

- `describeError(e)` → `{code, message}`; `ErrorState code=… onRetry` cho trạng thái lỗi màn; toast `sonner` kèm `description: code` cho thao tác.
- 401 sau refresh thất bại → `AuthProvider` xoá phiên, middleware đưa về `/login?next=`.
- Xung đột version (task 409, proposal 409) → không ghi đè: hoàn tác local + `refetch`.
- Khoá input trong lúc gọi AI (`isPending`) — không gửi chồng lượt.

## 4. Chờ backend / chưa nối

| Hạng mục | Tình trạng | Việc cần |
|---|---|---|
| ~~Chuông thông báo trên AppShell~~ | ✅ **Đã gắn 28/09** (`feature/UC-20-thong-bao-sprint`): chuông dùng `useBellCount()` + Popover `NotificationsPanel compact`; `src/mocks/notifications.ts` đã xoá. Link thông báo do backend sinh theo route web thật (`notifications/web-links.ts`); link cũ `/p/KEY/...` đã lưu được `NotificationsPanel` đổi sang `/projects/:id/...` | Còn lại: cảnh báo tải vẫn mang link `/me/workload`, `/workload?user=` chưa có route — xử lý cùng màn Nhân sự |
| ~~Tìm kiếm theo task trong bảng lệnh~~ | ✅ **xong 23/09** — `TaskSearchGroup` đã nhúng vào `CommandDialog`, và đổi sang `GET /workspaces/:wsId/tasks/search` nên tìm **xuyên dự án** chứ không chỉ dự án đang mở | Còn lại: tìm thành viên trong bảng lệnh (⏳ backend chưa có endpoint) |
| Mục sidebar "Cấu hình dự án" | Trang `/projects/:id/settings` đã có, vào từ Dashboard | Thêm nav item khi AppShell ổn định |
| ~~Kéo task vào sprint hàng loạt~~ | ✅ **xong 23/09** — chọn nhiều ở Bảng / Danh sách / Backlog rồi dùng thanh thao tác; đổi sprint đi đúng 1 request `POST /sprints/:id/tasks` | — |
| Cấu hình AI provider/model | API `ai-config/*` (admin hệ thống); web không có màn | Ngoài phạm vi đồ án (đổi qua `.env`) |
| Ghi nhớ (`MEMORY_PROPOSAL`) | Chỉ hiển thị thẻ; API ghi memory chưa có | ⏳ backend |
| Khôi phục task đã xoá mềm | Xoá đi qua `AlertDialog` và **không hứa hoàn tác**, vì API chưa có đường khôi phục | `POST /tasks/:id/restore` — xếp ở hướng phát triển ([02/05 §B4](../02-phan-tich/05-cai-tien-quan-ly-task.md)) |
| Kết quả xử lý (huỷ / không làm) | Việc bỏ giữa chừng hiện chỉ có hai đường: kéo sang Hoàn thành (sai burn-down) hoặc xoá mềm (mất dấu vết) | Mục E4 — hướng phát triển, vì kéo theo `completedAt`, `recomputeParentProgress`, `BurndownSnapshot` |

## 5. Cách chạy & tự kiểm

```bash
docker compose up -d postgres            # 5434
npm run api:dev                          # 3000, AI_PROVIDER=fake (hỏi trước khi bật gemini)
PORT=3001 npm run web:dev                # hoặc cấu hình "web" trong .claude/launch.json
```

Tài khoản seed: `lan@smarttask.local` (OWNER/PM), `minh@`, `huy@` — `Demo@1234`. Sau seed có **12 công việc**: 6 STORY, 4 TASK, 2 BUG.

Chụp màn hình tự động bằng Chrome headless qua `puppeteer-core` có sẵn trong repo (pane trình duyệt trong môi trường này không chụp được). Hai bẫy đã vấp:

- Ô email `/login` **điền sẵn** `lan@smarttask.local` và là input React controlled — `page.type()` sẽ nối chuỗi thành email sai và HTML5 chặn submit. Phải đặt value qua native setter rồi `dispatchEvent(new Event("input",{bubbles:true}))`.
- **`npm run web:build` phá tiến trình `next start` đang chạy** (cùng ghi `apps/web/.next-build`): tiến trình cũ giữ BUILD_ID cũ nên trình duyệt báo `ChunkLoadError` hoặc lặng lẽ phục vụ bundle CŨ. Đối chiếu giờ của `.next-build/BUILD_ID` với `ps -o lstart=` của tiến trình; lệch thì khởi động lại `npm run start -w apps/web` và Ctrl+Shift+R.

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
| **8** sửa lỗi lọc Backlog + lọc rỗng nuốt bảng | `a612661` |
| **8** `TaskType` STORY/TASK/BUG (migration `20260923052501_task_type`) | `a9472d5` |
| **8** dọn `TaskSize` chết, tách nghĩa "Rất cao" ↔ cờ Khẩn | `c7efcb6` |
| **8** cập nhật lạc quan khi tạo & sửa | `f12661a` |
| **8** tạo nhanh trong cột + dán nhiều dòng | `74d81e6` |
| **8** Sheet chi tiết chia hai cột | `517378b` |
| **8** bỏ ký hiệu phím Mac, hiện Ctrl theo hệ điều hành | `c13bafb` |
| **8** form tạo đủ trường (tách `TaskFieldPickers`) | `3100403` |
| **8** thao tác nhanh trên thẻ + bớt request khi mở chi tiết | `4f03b52` |
| **8** trang riêng `/tasks/ST-n` | `83c8c74` |
| **8** chọn nhiều + thao tác hàng loạt | `3dcbd77` |
| **8** bảng lệnh tìm & tạo công việc | `4523ea7` |
| **8** bộ phím tắt trên bảng | `e04568d` |
| **8** hoàn tác | `eed08cc` |
| **8** sửa tại chỗ trên Danh sách | `197681e` |
| **8** chi tiết mở dạng modal + icon mở thẳng trang | `64ccd87` |
| **8** không khoá cả màn khi lưu một trường | `37c3396` |
| **8** cú pháp nhanh `@ # ! h` (parser + 15 unit test) | `8f27631` |
| **8** bộ lọc lưu được | `c199d37` |
| **8** chế độ tập trung (phím F) | `335e77f` |
| **8** swimlane theo người / ưu tiên | `444bb38` |
| **8** màn Backlog riêng | `e6fc66b` |
| **8** sửa mã cột sai trong seed | `91f351d` |
| **F1–F3** thẻ đề xuất rõ ràng (lỗi theo việc, sprint đích, giờ/năng lực, chỉ duyệt việc không lỗi); chat dùng sprint người dùng nêu; đầu ra Gemini không bỏ patch/sprint | nhánh `feature/UC-28-the-de-xuat-ro-rang` |
| **Sprint v0** (28/09/2026) — trang Sprint, tra cứu AI, thẻ đề xuất, hồ sơ kỹ năng từ bằng chứng, ghi giờ/đánh giá, tab Nhân sự, chat hiện dần | nhánh `sprint_v0` — chi tiết [sprint-v0.md](sprint-v0.md) |
