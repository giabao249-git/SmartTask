# Phase 2 — Workspace, thành viên, lời mời, cài đặt, kỹ năng

Nhánh `feature/be-p2-workspaces`. 15/09/2026. Endpoint theo [11 §3.2–3.3](../04-kien-truc/11-chot-chuc-nang-va-api.md).

## Đã làm

| Nhóm | Endpoint | Ghi chú |
|---|---|---|
| Workspace | `GET/POST /workspaces`, `GET/PATCH /workspaces/:wsId`, `POST …/archive` (OWNER), `POST …/transfer-ownership` (OWNER) | Tạo = OWNER + cài đặt mặc định + **30 kỹ năng mẫu có alias** trong một transaction; slug tự sinh bỏ dấu (`Nhóm Đồ Án` → `nhom-do-an`), tự thêm hậu tố nếu trùng; chuyển chủ → chủ cũ thành ADMIN |
| Cài đặt | `GET/PATCH /workspaces/:wsId/settings` | JSON validate bằng **zod** (`workspace-settings.ts`): năng lực mặc định, ngày làm việc, ngày lễ, giờ làm, ngưỡng tải 70/90/110, trọng số burnout, EAR, hạn mức AI, retention; PATCH gộp sâu rồi validate lại toàn bộ |
| Thành viên | `GET /members?role=&q=`, `PATCH /members/:userId` (vai), `DELETE /members/:userId` | OWNER không đổi/gỡ qua đây (`LAST_OWNER` 409) |
| Lời mời | `GET/POST/DELETE /workspaces/:wsId/invitations`, `GET /invitations/:token` (công khai), `POST /invitations/:token/accept` | Đích danh (email phải khớp, dùng một lần) hoặc link chung (dùng nhiều lần tới khi hết hạn); không gửi email — trả token để ghép link. Hết hạn/thu hồi → 410 `INVITATION_EXPIRED` |
| Kỹ năng | `GET/POST /workspaces/:wsId/skills`, `PATCH /skills/:id`, `POST /skills/:id/merge`, `GET /workspaces/:wsId/skill-matrix` | Trùng tên **hoặc alias** → 409; gộp: user_skills giữ mức cao hơn, task_skills giữ mức yêu cầu cao hơn, tên nguồn thành alias đích, xoá nguồn |
| Kỹ năng cá nhân | `GET/PUT /workspaces/:wsId/me/skills`, `PATCH /users/:userId/skills/:skillId/verify` | Đổi mức tự khai → mất xác nhận; OWNER/ADMIN xác nhận (Phase 3 mở cho PM cùng dự án) |

Khác so với bảng 11: kỹ năng cá nhân đặt dưới `/workspaces/:wsId/me/skills` (thay vì `/me/skills`) vì kỹ năng thuộc workspace — một người ở hai workspace có hai hồ sơ kỹ năng.

## Kiểm quyền

- `WorkspaceAccessService` (module global `AccessModule`) là nơi duy nhất trả lời "ai có vai gì ở đâu"; ném **404** khi không phải thành viên (không lộ workspace tồn tại), **403** khi thiếu vai.
- `@WorkspaceRoles('OWNER','ADMIN')` + `WorkspaceRoleGuard` (APP_GUARD) cho route có `:wsId`; route không có `:wsId` (`/skills/:id`) kiểm trong service qua workspace của bản ghi.
- `ZodValidationPipe` cho body JSON sâu; lỗi trả cùng dạng `VALIDATION_FAILED { details.fields }`.

## Kiểm thử
- Unit: `workspace-settings.spec.ts` (4 ca: mặc định, gộp sâu, mảng thay thế, từ chối sai kiểu).
- E2E `workspaces.e2e-spec.ts` (8 ca, 18 tổng): tạo ws → người ngoài 404 → settings gộp/400 → lời mời đích danh (sai email 403, đúng 201, dùng lại 410) → vai trò/LAST_OWNER → kỹ năng trùng alias 409, khai, xác nhận, heatmap bus factor → gộp → chuyển chủ + lưu trữ.
- Swagger: 26 đường dẫn.

## Để lại cho phase sau
- Gỡ thành viên chưa gỡ khỏi `project_members`/`task_assignees` (Phase 3).
- Thông báo in-app khi có lời mời đích danh cho tài khoản đã tồn tại (Phase 4).
- `skill-matrix?projectId=` lọc theo thành viên dự án (Phase 3).
