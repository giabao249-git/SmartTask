# KẾ HOẠCH KIỂM THỬ TỔNG THỂ (MASTER TEST PLAN)
## HỆ THỐNG QUẢN LÝ CÔNG VIỆC VÀ TẢI THÔNG MINH — SMARTTASK
**Phiên bản:** 2.0 — **Ngày lập:** 15/10/2026  
**Chuẩn tham chiếu:** ISO/IEC/IEEE 29119, Agile Test Quadrants & Hướng dẫn Phát triển Web Hiện đại (/modern-web-guidance)

---

## 1. TỔNG QUAN HỆ THỐNG VÀ LUỒNG DỮ LIỆU CỐT LÕI

### 1.1 Kiến trúc Triển khai & Thành phần
Hệ thống SmartTask được thiết kế theo kiến trúc 3 tầng phân tách rõ ràng với nguyên tắc: **Backend NestJS là nguồn sự thật duy nhất (Single Source of Truth)**. Mọi thao tác từ Web UI, kết nối WebSocket, Cron Job lập lịch, hay AI Executor đều đi qua cùng một tầng Service để đảm bảo tính nhất quán của quy tắc nghiệp vụ.

```
+-----------------------------------------------------------------------------------+
| TRÌNH DUYỆT (Next.js 15 App Router - React 19 - TanStack Query - Zustand - dnd-kit)|
+-----------------------------------------------------------------------------------+
       | (REST /api/v1)              | (WebSocket Socket.io)            | (Signed URL)
       v                             v                                  v
+------------------------------------------------------------------+ +--------------+
| NESTJS 11 BACKEND MONOLITH (SINGLE PROCESS)                      | | SUPABASE     |
| - REST Controllers (class-validator whitelist, JWT/RBAC Guards)  | | STORAGE      |
| - Domain Services (Prisma 6 Client, Pure Math Domain Engines)   | | (Attachments |
| - RealtimeGateway (Socket.io Rooms: project:{id}, user:{id})     | |  <= 10MB)    |
| - ScheduleModule (@nestjs/schedule Cron 00:05, 07:00, 23:30)     | +--------------+
| - EventEmitter2 Internal Bus (Decoupled Event Handling)          |        ^
|   + ActivityLogListener    -> Ghi activity_logs                  |        |
|   + NotificationListener   -> Ghi notifications, Web Push VAPID  |        |
|   + RealtimeListener       -> Phát sự kiện Socket.io             |        |
|   + WorkloadListener       -> Debounce 500ms, tính tải tự động   |        |
| - AI Module: ContextBuilder -> Provider (Gemini/Ollama) ->      |        |
|              ResponseParser -> ActionValidator -> Executor        |        |
+------------------------------------------------------------------+        |
       | (Prisma Connection Pool / Transaction)                             |
       v                                                                    |
+------------------------------------------------------------------+        |
| POSTGRESQL 16 (SUPABASE MANAGED)                                 |        |
| - Multi-tenant Schemas & Row-level Isolation                     |        |
| - Optimistic Concurrency Control (Column 'version' INT)          |        |
+------------------------------------------------------------------+        |
       |                                                                    |
       +--------------------------------------------------------------------+
```

### 1.2 Mô hình Dữ liệu và Ranh giới Xử lý AI
- **Nguyên tắc "Backend chỉ tính, không quyết định":** Backend tổng hợp bảng sự thật (Fact Table: giờ trống theo ngày, hệ số EAR lịch sử, khoảng bận calendar, năng lực sprint, khoảng cách kỹ năng). LLM (Gemini 2.5 Flash / Ollama Qwen2.5:7b) dựa vào sự thật để đề xuất người/giờ.
- **Kiểm soát 2 tầng (Two-pass Validation):**
  1. *Tầng 1 (Structural):* Kiểm tra JSON Schema & Zod Type Safety (`responseSchema`).
  2. *Tầng 2 (Domain Business):* `ActionValidator` kiểm chứng trên CSDL thực tế: thành viên còn trong dự án, không nghỉ trọn khoảng, đủ giờ trống khả dụng, không vượt ngưỡng quá tải (Utilization <= 110%), không có chu trình phụ thuộc vòng (DAG validation).
- **Quyền ghi dữ liệu:** AI không bao giờ ghi trực tiếp vào CSDL. Toàn bộ đề xuất lưu dưới dạng `DRAFT` trong `ai_proposals`. Chỉ khi Quản lý dự án (PM) bấm "Áp dụng", `ExecutorService` mới ủy nhiệm cho `TasksService` tạo việc thật.

---

## 2. MA TRẬN PHÂN QUYỀN VAI TRÒ (RBAC & ZERO-TRUST SECURITY MATRIX)

Hệ thống định nghĩa 7 tác nhân phân cấp từ thấp đến cao:
- **A1: Khách (Guest)** — Chưa đăng nhập.
- **A2: Khách xem (Viewer)** — Thành viên dự án chỉ có quyền đọc.
- **A3: Thành viên (Member)** — Thực hiện task, kéo thả Kanban, log time, chat.
- **A4: Quản lý dự án (PM)** — Quản trị sprint, giao việc, duyệt AI, đánh giá task.
- **A5: Quản trị Workspace (Workspace Owner / Admin)** — Vòng đời workspace, mời thành viên, cấu hình AI, catalog kỹ năng.
- **A6: Quản trị Nền tảng (Platform Super Admin)** — Giám sát toàn hệ thống, bảo trì, ngắt mạch chi phí, khóa tenant.
- **Hệ thống ngoại vi / nội bộ (S1: AI LLM Provider, S2: Scheduler Cron, S3: Storage).**

### 2.1 Ma trận Phân quyền Chức năng Chi tiết

| Nhóm chức năng / Hành động | Khách (A1) | Viewer (A2) | Member (A3) | PM (A4) | WS Owner/Admin (A5) | Super Admin (A6) | Mã lỗi khi vi phạm |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Đăng ký, Đăng nhập, Quên MK** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `401 UNAUTHENTICATED` |
| **Xem Kanban, Gantt, Backlog** | ❌ | ✅ | ✅ | ✅ | ✅ (nếu là member) | ❌ (Zero-Trust) | `403 FORBIDDEN` |
| **Tạo / Sửa / Xóa công việc** | ❌ | ❌ | ✅ (việc mình/cho phép) | ✅ | ✅ | ❌ | `403 FORBIDDEN` |
| **Kéo thả chuyển cột Kanban** | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | `403 FORBIDDEN` |
| **Lập kế hoạch, Start/Close Sprint** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | `403 PROJECT_PM_REQUIRED` |
| **Phân công việc (Assignees)** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | `403 FORBIDDEN` |
| **Gọi AI phân rã & Gợi ý phân công**| ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | `403 FORBIDDEN` |
| **Đánh giá Task hoàn thành (Review)**| ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | `403 FORBIDDEN` |
| **Xem ma trận kỹ năng / Tải nhóm** | ❌ | ❌ | ❌ (chỉ xem của mình)| ✅ | ✅ | ❌ | `403 FORBIDDEN` |
| **Cấu hình Workspace & Mời thành viên**| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | `403 FORBIDDEN` |
| **Cấu hình Model AI & Quota dự án** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | `403 FORBIDDEN` |
| **Quản trị nền tảng `/admin/*`** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `403 PLATFORM_ADMIN_REQUIRED`|
| **Đình chỉ Workspace / Global Ban** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `403 PLATFORM_ADMIN_REQUIRED`|

### 2.2 Kịch bản Kiểm thử Ranh giới Bảo mật (Security RBAC Test Cases)
- **TC-RBAC-01 (Vertical Privilege Escalation):** Thành viên A3 gọi `POST /api/v1/workspaces/:id/members` để thêm người vào workspace -> Kỳ vọng: `403 FORBIDDEN`.
- **TC-RBAC-02 (Horizontal Privilege Escalation - IDOR):** PM của Dự án A gọi `PATCH /api/v1/tasks/:id/move` của một task thuộc Dự án B trong cùng workspace -> Kỳ vọng: `ProjectAccessService.assertEdit` từ chối `403 FORBIDDEN`.
- **TC-RBAC-03 (Tenant Isolation):** User thuộc Workspace X dùng token của mình gọi `GET /api/v1/workspaces/:id_Y/projects` -> Kỳ vọng: `403 FORBIDDEN` hoặc `404 NOT_FOUND`.
- **TC-RBAC-04 (Zero-Trust Super Admin):** Super Admin A6 cố tình gọi API đọc task nghiệp vụ `GET /api/v1/projects/:id/tasks` -> Kỳ vọng: `403 FORBIDDEN` (Super Admin không có quyền can thiệp vào dữ liệu nội dung dự án của khách hàng).
- **TC-RBAC-05 (Viewer Protection):** Viewer A2 gửi payload `PATCH /api/v1/tasks/:id/move` với version hợp lệ -> Kỳ vọng: `403 FORBIDDEN`, UI không kích hoạt kéo thả.

---

## 3. TEST PLAN CHI TIẾT THEO TỪNG USE CASE (UC-01 ĐẾN UC-42)

### Phân hệ 1: Nền tảng và Không gian Làm việc (Workspace & Platform)

#### UC-01: Đăng ký tài khoản
- **Mục tiêu:** Xác minh luồng đăng ký người dùng mới, kiểm tra trùng lặp và tính toàn vẹn dữ liệu.
- **Tiền điều kiện:** Email chưa tồn tại trên hệ thống.
- **Test Scenarios:**
  - `TC-UC01-01 (Happy Path):` Nhập email hợp lệ, mật khẩu mạnh (>= 8 ký tự, chữ hoa, số, ký tự đặc biệt), họ tên -> Tạo user trong DB với status `ACTIVE`, mã hash bcrypt, trả về access token & set cookie refresh token.
  - `TC-UC01-02 (Trùng email):` Nhập email đã tồn tại -> Trả về mã lỗi `409 EMAIL_TAKEN`.
  - `TC-UC01-03 (Validation):` Email sai định dạng, mật khẩu < 8 ký tự -> Trả về `400 VALIDATION_FAILED` kèm danh sách trường lỗi.

#### UC-02: Đăng nhập, Đăng xuất, Làm mới phiên
- **Mục tiêu:** Kiểm tra cơ chế cấp phát JWT (15 phút), refresh token (7 ngày), cơ chế xoay vòng (token rotation) và single-flight refresh.
- **Test Scenarios:**
  - `TC-UC02-01 (Đăng nhập đúng):` Gửi đúng credentials -> Cấp access token trong body và refresh token trong httpOnly cookie `rt`.
  - `TC-UC02-02 (Sai thông tin):` Sai email hoặc mật khẩu -> Trả về `401 INVALID_CREDENTIALS`. Sau 5 lần thử liên tiếp trong 1 phút -> Trả về `429 RATE_LIMITED`.
  - `TC-UC02-03 (Tài khoản bị khóa):` User có `is_active = false` -> Trả về `403 ACCOUNT_LOCKED`.
  - `TC-UC02-04 (Làm mới token hợp lệ):` Gửi cookie refresh token hợp lệ -> Xoay vòng refresh token mới, thu hồi token cũ, cấp access token mới.
  - `TC-UC02-05 (Phát hiện token bị đánh cắp):` Dùng lại một refresh token đã bị thu hồi trước đó -> Hệ thống kích hoạt cảnh báo bảo mật, lập tức thu hồi toàn bộ phiên hoạt động của user đó, trả về `401 REFRESH_TOKEN_INVALID`.
  - `TC-UC02-06 (Đăng xuất):` Gọi `POST /auth/logout` -> Xóa refresh token trong DB, xóa cookie `rt`.

#### UC-03: Quản lý hồ sơ cá nhân
- **Mục tiêu:** Xác thực chức năng cập nhật profile, đổi mật khẩu, avatar.
- **Test Scenarios:**
  - `TC-UC03-01:` Cập nhật tên hiển thị, múi giờ (`Asia/Ho_Chi_Minh`), kênh nhận thông báo -> DB cập nhật, trả về `200 OK`.
  - `TC-UC03-02:` Đổi mật khẩu nhập sai mật khẩu cũ -> Trả về `400 PASSWORD_MISMATCH`.

#### UC-04: Quản lý không gian làm việc
- **Mục tiêu:** Tạo, sửa, lưu trữ workspace và quy tắc duy nhất của slug.
- **Test Scenarios:**
  - `TC-UC04-01:` Owner tạo workspace mới -> Sinh slug tự động hoặc người dùng nhập, gán vai trò Owner cho người tạo.
  - `TC-UC04-02:` Tạo workspace trùng slug -> Trả về `409 WORKSPACE_SLUG_TAKEN`.
  - `TC-UC04-03:` Rời workspace khi là Owner duy nhất -> Bị chặn với mã `400 LAST_OWNER`.

#### UC-05: Quản lý thành viên và lời mời
- **Mục tiêu:** Quy trình gửi email mời, chấp nhận lời mời, thay đổi vai trò (Owner, Admin, Member, Viewer) và gỡ thành viên.
- **Test Scenarios:**
  - `TC-UC05-01:` Admin gửi lời mời qua email -> Tạo bản ghi `invitations` có token và hạn 7 ngày.
  - `TC-UC05-02:` Chấp nhận lời mời khi đã hết hạn -> Trả về `400 INVITATION_EXPIRED`.
  - `TC-UC05-03:` Gỡ thành viên đang có task OPEN trong dự án -> Thành viên bị loại khỏi workspace, các task giữ nguyên trạng thái, trigger `WorkloadListener` tính lại tải nhóm.

#### UC-06: Quản lý danh mục kỹ năng
- **Mục tiêu:** Quản trị kỹ năng theo nhóm, tạo alias, gộp kỹ năng trùng lặp.
- **Test Scenarios:**
  - `TC-UC06-01:` Thêm kỹ năng mới kèm alias (ví dụ: `Node.js`, alias: `node`, `nodejs`) -> Lưu thành công.
  - `TC-UC06-02:` Gộp kỹ năng A vào kỹ năng A -> Trả về `400 SKILL_MERGE_SAME`.
  - `TC-UC06-03:` Gộp kỹ năng B vào A -> Mọi liên kết `task_skills`, `user_skills` trỏ về B được chuyển sang A, kỹ năng B được chuyển vào alias của A.

#### UC-07: Khai báo giờ làm mỗi tuần và ngày nghỉ
- **Mục tiêu:** Thiết lập năng lực chuẩn (Base capacity) và lịch nghỉ lễ/nghỉ phép.
- **Test Scenarios:**
  - `TC-UC07-01:` User đăng ký nghỉ phép ngày X -> Lưu vào `user_time_off`, `EffCap` của tuần chứa ngày X tự động giảm trừ.

#### UC-40: Quản trị cấu hình AI
- **Mục tiêu:** Cấu hình catalog model (Gemini, Ollama), prompt phiên bản và hạn mức gọi AI theo vai trò.
- **Test Scenarios:**
  - `TC-UC40-01:` Admin lưu API Key Gemini khi chưa cấu hình `APP_KEY` mã hóa trên server -> Trả về `500 AI_KEY_ENCRYPTION_MISSING`.
  - `TC-UC40-02:` Admin tắt mục đích `DECOMPOSE` -> Khi PM gọi phân rã yêu cầu, trả về `403 AI_PURPOSE_DISABLED`.

#### UC-42: Quản trị nền tảng (Super Admin)
- **Mục tiêu:** Đình chỉ workspace, bật chế độ bảo trì, FinOps AI.
- **Test Scenarios:**
  - `TC-UC42-01:` Super Admin đình chỉ Workspace W -> Toàn bộ kết nối Socket.io của W bị ngắt với code 4403, mọi API gọi vào W trả về `403 WORKSPACE_SUSPENDED`.
  - `TC-UC42-02:` Bật Maintenance Mode toàn nền tảng -> Mọi API trả về `503 MAINTENANCE_MODE`, ngoại trừ các route của Super Admin `/admin/*`.

---

### Phân hệ 2: Dự án và Công việc (Projects & Tasks)

#### UC-08: Quản lý dự án
- **Mục tiêu:** Tạo dự án, quy định mã tiền tố (Project Key), bổ sung thành viên và gán PM.
- **Test Scenarios:**
  - `TC-UC08-01:` Tạo dự án mới với Project Key `ST` -> Khởi tạo sẵn các cột mặc định của Kanban (Backlog, To Do, In Progress, Review, Done).
  - `TC-UC08-02:` Tạo dự án trùng Project Key trong cùng Workspace -> Báo lỗi `409 PROJECT_KEY_TAKEN`.
  - `TC-UC08-03:` Tạo dự án không chỉ định Quản lý dự án (PM) -> Báo lỗi `400 PROJECT_PM_REQUIRED`.

#### UC-09: Lập kế hoạch, bắt đầu và kết thúc Sprint
- **Mục tiêu:** Đảm bảo nguyên tắc Scrum: duy nhất 1 sprint ACTIVE tại một thời điểm, bảo toàn số liệu khi kết thúc sprint.
- **Test Scenarios:**
  - `TC-UC09-01 (Start Sprint thành công):` Khởi động sprint PLANNED khi chưa có sprint ACTIVE nào -> Sprint chuyển sang `ACTIVE`, tự động chụp snapshot burn-down ngày đầu tiên.
  - `TC-UC09-02 (Start Sprint khi đã có sprint chạy):` Dự án đã có Sprint 1 đang ACTIVE, PM cố tình bấm Bắt đầu Sprint 2 -> Báo lỗi `409 SPRINT_ALREADY_ACTIVE`.
  - `TC-UC09-03 (Close Sprint với Idempotency):` Đóng sprint gửi kèm header `Idempotency-Key` -> Giao dịch thực hiện: Chụp snapshot số liệu cuối kỳ -> Chuyển việc dở sang Backlog hoặc Sprint tiếp theo -> Đặt trạng thái `CLOSED`. Nếu bấm lặp lại cùng key -> Trả kết quả cũ, không chạy lại giao dịch.
  - `TC-UC09-04 (Close Sprint không ACTIVE):` Cố tình đóng sprint đang PLANNED hoặc CLOSED -> Trả về `409 SPRINT_NOT_ACTIVE`.

#### UC-10: Quản lý công việc (Story, Task, Bug)
- **Mục tiêu:** Tạo, sửa, xóa mềm task; tự sinh mã ST-n; kiểm soát version.
- **Test Scenarios:**
  - `TC-UC10-01:` Tạo task mới -> Sinh mã tự tăng `ST-1`, `version = 1`, `source = MANUAL`.
  - `TC-UC10-02:` Cập nhật tiến độ `progress = 100%` nhưng không đổi cột -> `remaining_hours` tự động về 0.
  - `TC-UC10-03:` Xóa mềm task -> Đánh dấu `deleted_at`, task biến mất khỏi Kanban và Backlog, tự động trừ tải trong snapshot workload.

#### UC-11: Công việc con (Subtask) và Phụ thuộc (Dependencies)
- **Mục tiêu:** Tính toán tiến độ việc cha từ con, kiểm tra chu trình phụ thuộc vòng (Circular Dependency).
- **Test Scenarios:**
  - `TC-UC11-01:` Tạo 3 subtask, hoàn thành 2/3 -> Tiến độ task cha cập nhật thành 67%.
  - `TC-UC11-02 (Phụ thuộc vòng lặp):` Thiết lập Task A chặn Task B, Task B chặn Task C, PM cố tình thêm Task C chặn Task A -> `ActionValidator` phát hiện chu trình DAG, từ chối với mã lỗi `400 DEPENDENCY_CYCLE`.
  - `TC-UC11-03 (Huy hiệu bị chặn):` Task A bị chặn bởi Task B (chưa xong) -> Task A hiển thị badge "Blocked" màu đỏ trên bảng Kanban.

#### UC-12: Kéo thả trên bảng Kanban (Kanban Board)
- **Mục tiêu:** Kiểm tra kéo thả vị trí, khóa lạc quan (Optimistic Concurrency), giới hạn WIP.
- **Test Scenarios:**
  - `TC-UC12-01 (Happy Path):` Kéo thả task từ "To Do" sang "In Progress", gửi đúng `version` -> CSDL cập nhật `column_id`, tăng `version = version + 1`, phát realtime cho mọi client khác.
  - `TC-UC12-02 (Vượt giới hạn WIP):` Cột "In Progress" có `wip_limit = 3`, hiện đang có 3 việc gốc. Kéo thêm 1 việc vào -> Server trả về `422 WIP_LIMIT_EXCEEDED`, client lập tức hoàn tác (rollback) thẻ về cột cũ.
  - `TC-UC12-03 (Xung đột phiên bản - 409 Conflict):` User A và User B cùng mở bảng. User B kéo task (version tăng từ 5 lên 6). User A kéo cùng task đó (vẫn gửi version 5) -> Server trả về `409 TASK_VERSION_CONFLICT`, client của User A hoàn tác thẻ, tự động refetch dữ liệu mới nhất.
  - `TC-UC12-04 (Chuyển sang Done):` Kéo thẻ vào cột Done -> Tự động điền trường `completed_at = NOW()`. Kéo ngược từ Done về In Progress -> Đặt `completed_at = NULL` và tăng biến đếm `reopen_count`.

#### UC-13 & UC-14 & UC-15: Gantt, Eisenhower & Bộ lọc danh sách
- **Mục tiêu:** Hiển thị trực quan theo thời gian, 4 góc phần tư khẩn cấp/quan trọng và lọc việc của tôi.
- **Test Scenarios:**
  - `TC-UC15-01:` Lọc theo `assignee = current_user` và `is_overdue = true` -> Trả về đúng danh sách công việc quá hạn của cá nhân.
  - `TC-UC14-01:` Kéo thẻ trên ma trận Eisenhower từ góc "Khẩn cấp & Không quan trọng" sang "Khẩn cấp & Quan trọng" -> Cập nhật độ ưu tiên `priority = HIGH` và `is_urgent = true`.

#### UC-35: Ghi giờ làm thực tế (Worklog)
- **Mục tiêu:** Nhập giờ thực tế theo ngày, tính toán hệ số ước lượng cá nhân EAR.
- **Test Scenarios:**
  - `TC-UC35-01:` Nhập worklog 4 giờ kèm ghi chú -> Bản ghi `time_entries` được tạo, tính lại tổng giờ thực tế `actual_hours` của task.

#### UC-36: Đánh giá công việc khi hoàn thành
- **Mục tiêu:** PM đánh giá chất lượng (rating 1-5 sao, độ khó thực tế) khi task vào Done để tích lũy bằng chứng kỹ năng.
- **Test Scenarios:**
  - `TC-UC36-01:` PM đánh giá task hoàn thành với rating 5 sao, độ khó 4 -> Hệ thống ghi nhận một bằng chứng kỹ năng thành công cho người thực hiện (tác động đến hồ sơ kỹ năng UC-23).

---

### Phân hệ 3: Cộng tác Thời gian Thực (Realtime Collaboration)

#### UC-16: Xem nhật ký hoạt động (Activity Log)
- **Mục tiêu:** Ghi nhận sự kiện diff chi tiết (trường cũ, trường mới) mỗi khi task thay đổi.
- **Test Scenarios:**
  - `TC-UC16-01:` Đổi assignee và hạn hoàn thành của task -> `ActivityLogListener` ghi bản ghi JSON diff chi tiết người thay đổi, thời gian và giá trị trước/sau.

#### UC-17: Đồng bộ thời gian thực qua WebSocket (Socket.io)
- **Mục tiêu:** Kiểm tra tham gia phòng `project:{id}`, phân phối sự kiện, xử lý mất kết nối và đồng bộ bù chênh lệch.
- **Test Scenarios:**
  - `TC-UC17-01 (Phát sóng sự kiện):` Client A kéo thả task -> RealtimeGateway phát sự kiện `task:moved` đến toàn bộ client trong phòng `project:{id}` (loại trừ chính Client A).
  - `TC-UC17-02 (Kiểm tra quyền vào phòng):` User không thuộc dự án cố tình emit event `join_room` vào phòng `project:X` -> Socket Gateway từ chối, ngắt kết nối hoặc không gửi bản tin.
  - `TC-UC17-03 (Đồng bộ sau khi mất mạng):` Client B bị đứt kết nối mạng 30 giây trong khi nhiều task bị di chuyển -> Khi có mạng lại, socket reconnect thành công và gọi `GET /tasks?since=<timestamp>` để lấy toàn bộ sự kiện đã bỏ lỡ.

#### UC-18: Bình luận và Nhắc tên (@mention)
- **Mục tiêu:** Hỗ trợ định dạng Markdown, gợi ý danh sách thành viên khi gõ `@`, bắn thông báo realtime cho người được nhắc.
- **Test Scenarios:**
  - `TC-UC18-01:` Viết bình luận có `@Minh` -> `NotificationListener` tạo bản ghi thông báo trong DB và phát socket `notification:new` tới phòng cá nhân `user:{minh_id}`.

#### UC-19: Đính kèm tệp (Attachments)
- **Mục tiêu:** Cấp signed upload URL từ Supabase Storage, chặn tệp > 10MB.
- **Test Scenarios:**
  - `TC-UC19-01:` Tải lên tệp dung lượng 8MB -> Cấp signed URL, upload thành công, lưu metadata vào DB.
  - `TC-UC19-02:` Tải lên tệp dung lượng 15MB -> Bị chặn ngay từ tầng validate với mã lỗi `400 ATTACHMENT_TOO_LARGE`.

#### UC-20 & UC-21: Trung tâm thông báo và Web Push
- **Mục tiêu:** Đếm thông báo chưa đọc theo thời gian thực, đánh dấu đã đọc, đẩy Web Push VAPID qua Service Worker.
- **Test Scenarios:**
  - `TC-UC20-01:` Bấm "Đánh dấu tất cả đã đọc" -> Toàn bộ thông báo chuyển `is_read = true`, badge đếm chưa đọc về 0.
  - `TC-UC21-01:` Trình duyệt đóng tab nhưng Service Worker đang chạy -> Nhận được Web Push khi có ai đó giao task mới.

---

### Phân hệ 4: Kỹ năng và Cân bằng Tải (Skills & Workload Balancing)

#### UC-22 & UC-23: Hồ sơ kỹ năng từ bằng chứng & Ma trận kỹ năng nhóm
- **Mục tiêu:** Tính toán mức kỹ năng thực tế (1-5) dựa trên lịch sử hoàn thành task (không dùng mức tự khai), tính Bus Factor của nhóm.
- **Test Scenarios:**
  - `TC-UC23-01:` Member hoàn thành 5 task có yêu cầu kỹ năng React với rating >= 4, không bị reopen -> Hệ thống nâng mức kỹ năng React lên Level 4 với độ tin cậy "High".
  - `TC-UC23-02 (Bus Factor):` Xem ma trận kỹ năng nhóm -> Nếu một kỹ năng cốt lõi chỉ có 1 người đạt Level >= 3, cảnh báo Bus Factor = 1 (Rủi ro thiếu hụt nhân sự).

#### UC-24: Tính khối lượng công việc (Workload Calculation Engine)
- **Mục tiêu:** Kiểm thử hàm thuần tính toán tải: `EffCap`, `HoursEff`, `EffLoad`, `Utilization` theo công thức chuẩn:
  - $EffCap = Base - Meeting - TimeOff - (10\% \times Base)$
  - $HoursEff = Remaining \times EAR \times Diff \times SkillGap$
  - $EffLoad = Switch \times \sum (HoursEff \times share)$
  - $Utilization = EffLoad / EffCap$
- **Test Scenarios:**
  - `TC-UC24-01 (Ca kiểm thử chuẩn Minh):` 32 giờ còn lại, EAR 0.9, Diff 1.0, 1 dự án (Switch = 1.0), họp 3h, không nghỉ -> $EffLoad = 28.8h$, $EffCap = 33.0h$ -> $Utilization = 87.3\%$ (Mức CAO 70-90%).
  - `TC-UC24-02 (Ca kiểm thử quá tải Lan):` 32 giờ còn lại, EAR 1.4, Diff 1.1, 3 dự án (Switch = 1.1), họp 11h -> $EffLoad = 54.2h$, $EffCap = 25.0h$ -> $Utilization = 216.8\%$ (Mức QUÁ TẢI > 110%).
  - `TC-UC24-03 (Nghỉ trọn tuần):` Thành viên nghỉ phép cả tuần -> $EffCap \le 0$ -> $Utilization = \infty$, tự động gán nhãn QUÁ TẢI.

#### UC-25: Cảnh báo quá tải và nguy cơ kiệt sức (Burnout Alert)
- **Mục tiêu:** Tính điểm nguy cơ Burnout (0-100), tạo cảnh báo và kích hoạt cơ chế chống spam thông báo 24 giờ.
- **Test Scenarios:**
  - `TC-UC25-01:` Điểm Burnout >= 70 điểm liên tục 2 tuần -> Tạo bản ghi `workload_alerts`, gửi thông báo cho PM và nhân sự đó.
  - `TC-UC25-02 (Chống spam 24h):` Task tiếp tục thay đổi làm tăng tải trong cùng một ngày -> Bản ghi alert cập nhật số liệu mới nhưng KHÔNG bắn thêm thông báo notification lặp lại.
  - `TC-UC25-03:` PM bấm "Đã xử lý" (Acknowledge) trên giao diện cảnh báo -> Đóng alert với trạng thái `ACKNOWLEDGED`.

#### UC-26: Bảng năng lực khi giao việc (Capacity Table)
- **Mục tiêu:** Hiển thị sự thật về kỹ năng và giờ trống của các ứng viên cạnh dropdown giao việc — TUYỆT ĐỐI KHÔNG XẾP HẠNG.
- **Test Scenarios:**
  - `TC-UC26-01:` Mở combobox giao việc của một task 8 giờ -> Hiển thị bảng danh sách thành viên kèm: mức kỹ năng phù hợp, số giờ trống còn lại trước hạn hoàn thành và mức Utilization hiện tại. Không hiển thị điểm số tổng hợp hay gợi ý "Top 1".

#### UC-37: Kết nối lịch bận (External Calendar / ICS)
- **Mục tiêu:** Đồng bộ khung giờ bận từ tệp ICS hoặc API ngoại vi, chỉ lấy khung thời gian, không đọc nội dung chi tiết cuộc họp.
- **Test Scenarios:**
  - `TC-UC37-01:` Import link ICS -> Trích xuất các khoảng bận trong tuần làm việc, gộp các khoảng thời gian bị đè nhau, cộng vào `MeetingHours`.

---

### Phân hệ 5: Trợ lý AI (AI Copilot & Multi-turn Chat)

#### UC-28: AI Phân rã yêu cầu thành công việc (Decompose)
- **Mục tiêu:** Chuyển đổi ngôn ngữ tự nhiên thành danh sách task có ước lượng, kỹ năng và phụ thuộc; qua 2 tầng kiểm tra; chỉ ghi vào DB khi PM duyệt.
- **Test Scenarios:**
  - `TC-UC28-01 (Happy Path):` PM nhập yêu cầu "Xây dựng tính năng đăng nhập SSO Google" -> Gemini trả về 4 task hợp lệ -> `ActionValidator` kiểm tra mã kỹ năng tồn tại, phụ thuộc không vòng -> Lưu `DRAFT` vào `ai_proposals`.
  - `TC-UC28-02 (Hạn mức AI Quota):` User đã gọi 20 lượt AI trong ngày -> Gọi phân rã tiếp -> Báo lỗi `429 AI_QUOTA_EXCEEDED` kèm thời gian reset.
  - `TC-UC28-03 (Gemini trả về sai cấu trúc):` LLM trả về chuỗi markdown thay vì JSON đúng `responseSchema` -> Hệ thống tự động gửi retry lượt 2 kèm lỗi. Nếu vẫn lỗi -> Trả về `503 AI_RESPONSE_INVALID`, không lưu rác vào DB.
  - `TC-UC28-04 (Áp dụng bản nháp - Apply):` PM duyệt bản nháp -> `ExecutorService` gọi `TasksService.create` tạo từng task thật với `source = AI`. Nếu task thứ 3 bị lỗi DB -> Tự động xóa mềm (rollback) 2 task đã tạo, giữ nguyên bản nháp ở trạng thái DRAFT.
  - `TC-UC28-05 (Chống bấm duyệt 2 lần):` Gửi 2 request Apply liên tiếp cùng `Idempotency-Key` -> Request 2 nhận kết quả của request 1, không sinh thêm task trùng.

#### UC-38: Chat với trợ lý theo phiên (Multi-turn Session)
- **Mục tiêu:** Quản lý hội thoại có ngữ cảnh theo dự án, khóa phiên đơn lượt (Single-turn Lock).
- **Test Scenarios:**
  - `TC-UC38-01:` Gửi tin nhắn mới khi tin nhắn trước đó đang được AI xử lý -> Nhận mã lỗi `409 AI_TURN_IN_PROGRESS`.
  - `TC-UC38-02:` Tham chiếu ngữ cảnh "Phương án 2 ở câu trước đổi thành 6 giờ" -> AI nhận diện đúng DraftKey và cập nhật bản nháp tương ứng.

#### UC-39: AI Gợi ý phân công công việc (Smart Assignment)
- **Mục tiêu:** Backend chuẩn bị bảng sự thật -> LLM chọn người và khung giờ -> Validator kiểm tra nghiêm ngặt 5 điều kiện phân công.
- **Test Scenarios:**
  - `TC-UC39-01 (Gợi ý hợp lệ):` LLM đề xuất giao Task A cho Member Minh (đủ giờ trống, đủ kỹ năng) -> Validator thông qua -> PM duyệt và áp dụng thành công.
  - `TC-UC39-02 (Chặn quá tải):` LLM cố tình đề xuất giao task 16h cho Member Lan (đang quá tải 130%) -> `ActionValidator` chặn dòng đề xuất này với lỗi `ASSIGN_OVERLOAD {free: 4, need: 16}`, không cho phép PM tích chọn dòng đó trừ khi có cờ đặc biệt.
  - `TC-UC39-03 (Chặn người nghỉ phép):` Đề xuất giao task cho người đang nghỉ phép trọn thời gian diễn ra task -> Chặn với lỗi `ASSIGN_ON_LEAVE`.

#### UC-32: Ghi sổ token và kiểm soát chi phí (Token Accounting & FinOps)
- **Mục tiêu:** Ghi nhận chính xác số prompt token, candidate token, thời gian phản hồi và kiểm toán ngân sách.
- **Test Scenarios:**
  - `TC-UC32-01:` Mỗi lần gọi AI hoàn thành -> Tạo bản ghi trong `ai_token_logs` gồm `input_tokens`, `output_tokens`, `latency_ms`, `purpose`, `user_id`.

---

### Phân hệ 6: Báo cáo & Dự báo (Reporting & Forecasting)

#### UC-30: Burn-down và Vận tốc (Burn-down & Velocity)
- **Mục tiêu:** Chụp snapshot số liệu lúc 00:05 hàng ngày, tính toán đường lý tưởng vs thực tế, phát hiện phình phạm vi (Scope Creep).
- **Test Scenarios:**
  - `TC-UC30-01:` Giữa sprint PM thêm 3 task mới (tổng 24 giờ) -> Biểu đồ burn-down vẽ bậc thang tăng vọt giờ còn lại và gắn nhãn "Scope Creep".

#### UC-31: Dự báo rủi ro trễ hạn và Giải thích bằng AI
- **Mục tiêu:** Tính toán ETA dựa trên vận tốc 5 ngày làm việc gần nhất, phân loại rủi ro (Low, Medium, High) và gọi AI giải thích.
- **Test Scenarios:**
  - `TC-UC31-01 (Dự báo rủi ro cao):` Giờ còn lại là 120h, thời gian sprint còn 2 ngày, vận tốc nhóm 20h/ngày -> Hệ thống gắn cờ Rủi ro CAO (High Risk), liệt kê nguyên nhân: 4 task quá hạn, 2 nhân sự bị quá tải.
  - `TC-UC31-02 (AI giải thích nhất quán):` Bấm "Giải thích bằng AI" -> Backend gửi số liệu thô cho Gemini -> AI trả về giải thích 3-5 câu. `ActionValidator` kiểm tra: `riskLevel` trong văn bản của AI BẮT BUỘC phải khớp với mức `HIGH` của hệ thống. Nếu AI trả về "Rủi ro thấp" -> Gọi lại lượt 2 kèm lỗi.
  - `TC-UC31-03 (Cache 6 giờ):` Bấm giải thích lần 2 trong vòng 6 giờ khi số liệu sprint không đổi -> Trả về kết quả từ Cache ngay lập tức (< 50ms), không tốn token gọi Gemini.

#### UC-33: Bảng điều khiển dự án (Project Dashboard)
- **Mục tiêu:** Thẻ số tổng quan KPI, tiến độ sprint thu nhỏ, cảnh báo nóng trong dự án.
- **Test Scenarios:**
  - `TC-UC33-01:` Dashboard hiển thị đúng số task hoàn thành, tỉ lệ on-time delivery và danh sách các task đang gặp rủi ro trễ hạn.

---

## 4. TEST PLAN CHO CÁC LUỒNG SEQUENCE NGHIỆP VỤ XƯƠNG SỐNG (SD-01 ĐẾN SD-07)

### 4.1 SD-01: Đăng nhập & Làm mới phiên (Single-flight Refresh Token)
```
Browser                     AuthController            AuthService                 PostgreSQL
   |                              |                        |                           |
   |--- 1. POST /auth/login ----->|                        |                           |
   |    {email, password}         |--- 2. login() -------->|                           |
   |                              |                        |--- 3. verify & hash ----->|
   |<-- 4. 200 {access, cookie} --|<-- {access, refresh} --|                           |
   |                              |                        |                           |
   |--- 5. API calls (401 Exp) -->|                        |                           |
   |=== 6. Single-Flight Refresh ======================================================|
   |--- 7. POST /auth/refresh --->|                        |                           |
   |    (Only 1 request sent)     |--- 8. rotateToken() -->|--- 9. Revoke old, issue ->|
   |<-- 10. 200 {new_access} -----|<-- {new_pair} ---------|<-- 11. Transaction OK ---|
   |--- 12. Retry original req -->|                        |                           |
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Single-flight concurrency:* Kích hoạt đồng thời 10 request API khi access token vừa hết hạn -> Chỉ duy nhất 1 request `POST /auth/refresh` được gửi lên máy chủ; 9 request còn lại xếp hàng đợi và tự động retry sau khi có access token mới.
  2. *Token Replay Attack:* Lưu lại refresh token cũ và gửi lên sau khi đã được rotate -> Server phát hiện hành vi tái sử dụng, lập tức thu hồi toàn bộ token của tài khoản, trả về `401 REFRESH_TOKEN_INVALID`.

### 4.2 SD-02: Kéo thả Kanban, Khóa lạc quan & Realtime Sync
```
Client A                API (TasksController/Service)       PostgreSQL         EventEmitter2 / RealtimeGW        Client B
   |                                  |                          |                        |                 |
   |-- 1. Optimistic UI update ------>|                          |                        |                 |
   |-- 2. PATCH /tasks/42/move ------>|                          |                        |                 |
   |      {columnId, pos, version:7}  |-- 3. Check WIP Limit --->|                        |                 |
   |                                  |-- 4. UPDATE WHERE v=7 -->|                        |                 |
   |                                  |   (Success: v=8)         |-- 5. emit(task.moved)->|                 |
   |<-- 6. 200 {task, version:8} -----|                          |                        |-- 7. task:moved>|
   |                                  |                                                   |   (project:id)  |
   |== [ALT] Version Conflict ============================================================|                 |
   |   (If DB version != sent)        |                                                   |                 |
   |<-- 409 TASK_VERSION_CONFLICT ----|                                                   |                 |
   |-- 8. Rollback UI & Refetch ----->|                                                   |                 |
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Optimistic Lock Test:* Client A và Client B kéo cùng một task cùng lúc. Client B đến trước cập nhật `version = 8`. Client A đến sau (gửi version 7) -> Nhận về `409 TASK_VERSION_CONFLICT`, giao diện Client A tự động trả thẻ về vị trí cũ và hiển thị toast thông báo.
  2. *WIP Enforcement:* Kéo task vào cột đầy WIP -> Nhận `422 WIP_LIMIT_EXCEEDED`, rollback tức thì.
  3. *Socket Broadcast Isolation:* Client A không nhận lại sự kiện của chính mình; Client B nhận sự kiện `task:moved` trong <= 300ms và re-render đúng vị trí.

### 4.3 SD-03: Kết thúc Sprint chống bấm lặp (Idempotent Sprint Close)
```
PM / Browser                  SprintsService                  PostgreSQL               Forecast / Workload
   |                                |                              |                            |
   |-- 1. POST /sprints/1/close --->|                              |                            |
   |   Header: Idempotency-Key: X   |-- 2. Check Idempotency Key ->|                            |
   |   Body: {moveOpenTo: "next"}   |-- 3. [BEGIN TRANSACTION] ----|                            |
   |                                |-- 4. Snapshot final stats -->|--- 5. Save final snapshot >|
   |                                |-- 6. Move uncompleted tasks->|                            |
   |                                |-- 7. Set status = CLOSED --->|                            |
   |                                |-- 8. [COMMIT TRANSACTION] ---|                            |
   |<-- 9. 200 {movedTasks} --------|                              |-- 10. Recompute workload ->|
   |== [ALT] Rapid Double Click ================================================================|
   |-- 11. POST /sprints/1/close -->|                              |                            |
   |    (Same Key X)                |-- 12. Key exists & CLOSED -->|                            |
   |<-- 13. 200 Cached Result ------| (No-op, return prev payload) |                            |
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Atomic Transaction:* Mô phỏng lỗi ngắt kết nối DB đúng lúc đang chuyển việc dở dang -> Toàn bộ transaction rollback, sprint vẫn ở trạng thái `ACTIVE`, không có task nào bị chuyển nửa vời.
  2. *Double Click Idempotency:* Nhấp đúp chuột liên tục nút "Kết thúc Sprint" -> Cả 2 request đều trả về mã `200 OK`, số lượng task chuyển không bị nhân đôi, không xảy ra lỗi xung đột trạng thái.

### 4.4 SD-04: Tính tải tự động, Debounce & Cảnh báo Burnout
```
Event Trigger                 WorkloadListener               WorkloadService (Pure Math)       PostgreSQL / Alert
 (task.*, sprint.close)              |                                     |                           |
   |-- 1. emit(task.moved) --------->|                                     |                           |
   |-- 2. emit(task.assigned) ------>|                                     |                           |
   |                                 |-- 3. Debounce 500ms Timer --------->|                           |
   |                                 |   (Group by workspace & users)      |                           |
   |                                 |-- 4. Recompute Workload ----------->|                           |
   |                                 |                                     |-- 5. Read Capacities ---->|
   |                                 |                                     |-- 6. Exec Formula Pure -->|
   |                                 |                                     |-- 7. Upsert Snapshots --->|
   |                                 |                                     |-- 8. Check Overload ----->|
   |                                 |                                     |   (If > 110% & > 24h)     |
   |                                 |<-- 9. emit(workload.alert) ---------|-- 10. Create Alert Record>|
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Debounce Storm:* Thực hiện cập nhật liên tục 50 task trong vòng 200ms -> `WorkloadListener` gom toàn bộ các sự kiện và chỉ thực hiện duy nhất 1 lần tính toán tải sau 500ms im lặng.
  2. *Anti-Spam Alert:* Khi một user chạm ngưỡng quá tải, hệ thống gửi 1 thông báo. Tiếp tục tạo thêm task cho user đó trong ngày -> Snapshot được cập nhật nhưng KHÔNG tạo thông báo mới.

### 4.5 SD-05: AI Phân rã yêu cầu (Two-pass Validation & Multi-item Creation)
```
PM / Browser             AiService / ContextBuilder            Gemini API          ActionValidator        TasksService
   |                                 |                              |                     |                    |
   |-- 1. POST /projects/1/decompose>|                              |                     |                    |
   |      {requirement, sprintId}    |-- 2. Build 4-layer context ->|                     |                    |
   |                                 |-- 3. Call with Schema ------>|                     |                    |
   |                                 |<-- 4. JSON Response ---------|                     |                    |
   |                                 |-- 5. Pass 1: Zod Parse ----->|                     |                    |
   |                                 |-- 6. Pass 2: Domain Check ------------------------>|                    |
   |                                 |      (Skills, Cycles, Limits)                      |                    |
   |                                 |== [ALT] Validation Failed =========================|                    |
   |                                 |-- 7. Retry 1 time with error list ---------------->|                    |
   |<-- 8. 200 {proposal: DRAFT} ----|<-- 9. Store DRAFT proposal ------------------------|                    |
   |-- 10. PM Edits & Apply -------->|                                                    |                    |
   |                                 |-- 11. Execute Batch --------------------------------------------------->|
   |                                 |       (Create tasks sequentially, source = AI)                          |
   |<-- 12. 200 {tasksCreated} ------|<------------------------------------------------------------------------|
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Schema Validation & Retry:* Mock Gemini trả về JSON thiếu trường `estimate_hours` -> Hệ thống tự động kích hoạt lượt gọi sửa lỗi thứ 2 có đính kèm lỗi cấu trúc.
  2. *DRAFT Integrity:* Dữ liệu do AI sinh ra tuyệt đối không xuất hiện trên bảng Kanban khi chưa có hành động `Apply` của PM.

### 4.6 SD-06: Phân công có AI gợi ý qua Chat
```
PM / Browser                 ChatService / AiService               WorkloadService            ActionValidator
   |                                    |                                 |                          |
   |-- 1. POST /ai/chat {msg} --------->|                                 |                          |
   |      (Acquire Turn Lock)           |-- 2. Build Fact Table --------->|                          |
   |                                    |   (No ranking, pure truth)      |                          |
   |                                    |-- 3. LLM Chooses Assignees ---->|                          |
   |                                    |<-- 4. ASSIGN_PROPOSAL ----------|                          |
   |                                    |-- 5. Validate Candidate Lines ---------------------------->|
   |                                    |      (Overload, Leave, Capacity)                           |
   |<-- 6. 200 {Draft with Badges} -----|<-----------------------------------------------------------|
   |-- 7. PM Approves Valid Lines ----->|-- 8. Execute Assignees ----------------------------------->|
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Turn Lock Protection:* Khi AI đang stream hoặc suy nghĩ tin nhắn phân công, PM gửi thêm 1 tin nhắn vào cùng session -> Server trả về `409 AI_TURN_IN_PROGRESS`.
  2. *Line-by-line Validation:* Đề xuất 4 người, trong đó 1 người bị quá tải -> Giao diện đánh dấu đỏ dòng người quá tải kèm giải thích số liệu ("Thiếu 8h"), 3 dòng còn lại hiển thị xanh và cho phép PM bấm duyệt cục bộ.

### 4.7 SD-07: Dự báo rủi ro Sprint & Giải thích bằng AI
```
PM / Browser             ForecastService                     Gemini API                 ActionValidator
   |                            |                                |                             |
   |-- 1. GET /burndown ------->|-- 2. Calc Velocity & Risk ---->|                             |
   |<-- 3. 200 {Risk: HIGH} ----|                                |                             |
   |-- 4. POST /explain ------->|-- 5. Check 6h Cache ---------->|                             |
   |                            |   (Miss)                       |                             |
   |                            |-- 6. Send stats only --------->|                             |
   |                            |<-- 7. 3-5 sentences + Recs ----|                             |
   |                            |-- 8. Assert Risk Level Match ------------------------------->|
   |                            |   (Verify AI level == HIGH)                                  |
   |<-- 9. 200 {explanation} ---|<-------------------------------------------------------------|
```
- **Kịch bản kiểm thử trọng tâm:**
  1. *Risk Level Consistency Assertion:* Nếu backend tính ra `riskLevel = HIGH`, mà phản hồi của AI trả về chứa nhãn `MEDIUM` -> Hệ thống kích hoạt retry ép AI tuân thủ sự thật tính toán của backend.
  2. *Zero Sensitive Leakage:* Kiểm toán payload gửi sang Gemini API đảm bảo không chứa nội dung tên task nhạy cảm hay email khách hàng, chỉ gửi các chỉ số định lượng ẩn danh.

---

## 5. MÔI TRƯỜNG, DỮ LIỆU & QUY TRÌNH THỰC THI KIỂM THỬ

### 5.1 Môi trường Kiểm thử
- **Local / CI Test Environment:**
  - Web: `http://localhost:3001` (Next.js 15, Node.js 22 LTS)
  - API: `http://localhost:3000/api/v1` (NestJS 11)
  - Database: PostgreSQL 16 (Schema `smarttask_test`, chạy migration độc lập mỗi lượt test)
  - Memory / Socket: Single process Node.js EventEmitter2 & Socket.io Test Client
  - Automation Tools: Jest 29, Supertest 7, Puppeteer-core, Axe-core (A11y audits).

### 5.2 Bộ Dữ liệu Mẫu Chuẩn (Seed Data Fixtures)
- `User Fixtures:`
  - `admin@smarttask.local` (Super Admin A6)
  - `owner@smarttask.local` (Workspace Owner A5)
  - `pm@smarttask.local` (Project Manager A4)
  - `dev1@smarttask.local` (Member A3 - Kỹ năng Backend Lv4, EAR 0.9)
  - `dev2@smarttask.local` (Member A3 - Kỹ năng Frontend Lv3, EAR 1.4)
  - `viewer@smarttask.local` (Viewer A2 - Readonly)
- `Sprint & Task Fixtures:`
  - Dự án mẫu `ST` (SmartTask Core), Sprint 1 (ACTIVE), Sprint 2 (PLANNED).
  - 12 công việc mẫu đa dạng trạng thái (Backlog, Todo, In Progress, Done, Overdue, Blocked).
