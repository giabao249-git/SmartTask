# Phase 3 — Dự án, sprint, công việc

Nhánh `feature/be-p3-projects-tasks`. 15/09/2026. Endpoint theo [11 §3.4–3.6](../04-kien-truc/11-chot-chuc-nang-va-api.md).

## Đã làm

| Nhóm | Endpoint | Ghi chú |
|---|---|---|
| Dự án | `GET/POST /workspaces/:wsId/projects`, `GET/PATCH /projects/:id`, `POST …/archive`, `GET/PUT /projects/:id/members`, `DELETE …/members/:userId`, `GET/PUT …/columns`, `GET/POST …/labels`, `PATCH/DELETE /labels/:id`, `GET …/dashboard` | Tạo (OWNER/ADMIN ws) = mã in hoa `ST` + PM + **4 cột mặc định** (Cần làm / Đang làm / Kiểm thử / Hoàn thành); PUT members đúng một PM (422 `PROJECT_PM_REQUIRED`), người bị gỡ mất assignee; PUT columns thay toàn bộ theo thứ tự mảng, cột bị bỏ phải trống, đúng một cột `isDone` |
| Sprint | `GET/POST /projects/:id/sprints`, `GET/PATCH /sprints/:id`, `POST …/start`, `POST …/close`, `POST …/tasks` | `start`: chỉ PLANNED, một ACTIVE mỗi dự án (409 `SPRINT_ALREADY_ACTIVE`; partial unique index bắt cả race), chốt `scope_hours_initial`; `close`: việc dở → backlog hoặc sprint PLANNED/ACTIVE khác, trả `movedTaskIds` (kể cả subtask) |
| Task | `GET/POST /projects/:id/tasks`, `GET /tasks/:id`, `GET /tasks/by-key/:key/:n`, `PATCH /tasks/:id`, `DELETE`, `PATCH …/move`, `PATCH …/progress`, `PUT …/assignees`, `PUT …/skills`, `PUT …/labels`, `POST …/subtasks`, `POST …/duplicate`, `GET /me/tasks`, `GET /workspaces/:wsId/tasks/search` | Mã `ST-n` cấp bằng `task_counter` tăng trong transaction; **mọi PATCH mang `version`** → `UPDATE … WHERE version` 0 dòng = 409 `TASK_VERSION_CONFLICT { current, sent }`; `move`: WIP (422), vào cột `isDone` → `completed_at`, `progress 100`, `remaining 0`; ra khỏi → mở lại; vào IN_PROGRESS → `started_at`; vị trí số thực, đánh số lại khi khe < 1e-6; subtask một cấp, tiến độ cha = trung bình subtask; xoá mềm kèm subtask |
| Đồng bộ | `GET …/tasks?since=` | Trả `{ items, deletedIds, serverTime }` — client dùng sau reconnect (UC-17) |
| Sự kiện | `task.created/updated/moved/deleted/assigned`, `sprint.started/closed/updated`, `project.member.removed` | Payload có `affectedUserIds`, `diff { field: { from, to } }`, `version`, `source` — Phase 4 (activity, thông báo), 5 (tải), 6 (socket) nghe |

Khác so với bảng 11: danh sách task trả object `{ items, deletedIds, serverTime }` thay vì mảng trần để một dạng cho cả hai chế độ; kỹ năng cá nhân ở `/workspaces/:wsId/me/skills` (Phase 2).

## Kiểm quyền dự án (`ProjectAccessService`)
- Đọc: mọi thành viên workspace (kể cả VIEWER). Sửa task: thành viên dự án hoặc OWNER/ADMIN workspace. Quản lý (sprint, cột, thành viên, xoá task người khác): PM hoặc OWNER/ADMIN.
- Cập nhật tiến độ: người thực hiện hoặc PM. Xoá task: người tạo hoặc PM.
- Gỡ thành viên workspace (Phase 2 để lại): gỡ assignee + `project_members` MEMBER trong workspace; người đang là PM phải được đổi PM trước.

## Kiểm thử
- Unit: `position.spec.ts` (3 ca: chèn giữa, cần đánh số lại sau ~60 lần chèn cùng khe, đánh số lại giữ thứ tự).
- E2E `projects-tasks.e2e-spec.ts` (10 ca; tổng 28): tạo dự án/409 mã trùng/4 cột → PUT members 422/404 → WIP → task ST-1/ST-2, 422 `ASSIGN_NOT_MEMBER`, VIEWER 403 → PATCH version 409 → move: started_at, WIP 422, DONE completed_at, mở lại → subtask một cấp, tiến độ cha 25% → since + deletedIds + duplicate → sprint start/409/close về backlog → việc của tôi, ⌘K, by-key, dashboard, gỡ thành viên mất assignee.
- Swagger: 52 đường dẫn / 71 operation.

## Để lại
- Phụ thuộc task (`PUT /tasks/:id/dependencies`, kiểm vòng) — S1, Phase 8.
- Dashboard: `workloadWeek`, `openAlerts`, `burndownMini` đang rỗng — Phase 5.
- `skill-matrix?projectId=` — chưa lọc theo dự án.
