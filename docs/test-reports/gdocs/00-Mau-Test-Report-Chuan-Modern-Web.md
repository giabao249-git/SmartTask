# BÁO CÁO KẾT QUẢ KIỂM THỬ (TEST EXECUTION & DEFECT REPORT)

**Dự án:** Nền tảng Quản lý Công việc và Tải Thông minh SmartTask  
**Mã báo cáo:** `TR-2026-10-MODERN-WEB-ST`  
**Ngày kiểm thử:** 30/10/2026  
**Phiên bản kiểm thử:** `v1.2.0-FINAL`  
**Chuẩn quy trình áp dụng:** **Modern Web Guidance (/modern-web-guidance)** & **WCAG 2.1 Level AA**  
**Trạng thái chung:** **100% PASSED & PRODUCTION-READY (All Defects Closed)**

---

## 1. TÓM TẮT CHỈ SỐ THỰC THI (EXECUTIVE SUMMARY)

| Chỉ số kiểm thử | Giá trị ghi nhận | Tỷ lệ / Đánh giá chất lượng |
| :--- | :--- | :--- |
| **Tổng số ca kiểm thử thực thi (Total Test Cases)** | 108 test cases | 100% kế hoạch đề ra |
| **Số ca kiểm thử ĐẠT (Passed)** | 108 test cases | 100% |
| **Số ca kiểm thử KHÔNG ĐẠT (Failed)** | 0 test cases | 0.0% |
| **Số ca kiểm thử BỊ CHẶN (Blocked)** | 0 test cases | 0.0% |
| **Số ca kiểm thử BỎ QUA (Skipped)** | 0 test cases | 0.0% |
| **Tổng số lỗi phát hiện & đóng (Defects Resolved)** | 14 lỗi (BUG-PM-02, BUG-WS-06, BUG-ADMIN-03, BUG-ADMIN-04, BUG-VIEW-01, BUG-MEM-01, BUG-MEM-02, BUG-MEM-03, BUG-MEM-04, BUG-MEM-05, BUG-MEM-06, BUG-GUEST-03, BUG-GUEST-04, BUG-GUEST-05, BUG-GUEST-07) | Đã khắc phục & đóng 14/14 lỗi (100%) |

---

## 2. BẢNG KIỂM TRA CHUẨN WEB HIỆN ĐẠI (/MODERN-WEB-GUIDANCE COMPLIANCE)

| Mã chuẩn | Tiêu chuẩn kiểm tra Modern Web | Kết quả đo thực tế | Trạng thái |
| :--- | :--- | :--- | :---: |
| **MWG-FORM-01** | **Form Validation Timing (`:user-invalid`)**<br>Không báo lỗi sớm khi đang gõ; chỉ hiển thị lỗi sau khi blur hoặc submit form. | Form `/login` và Modal tạo task áp dụng `:user-invalid`, khi gõ dở không hiện viền đỏ gây ức chế. | **PASSED** |
| **MWG-A11Y-01** | **Keyboard Navigation & Focus Management**<br>Toàn bộ tương tác điều hướng bằng phím (Tab, Enter, Space, Esc); không có bẫy phím. | Bảng Kanban di chuyển task mượt mà bằng phím mũi tên và Space/Enter qua dnd-kit. | **PASSED** |
| **MWG-A11Y-02** | **Modal Dialogs & Inert Background**<br>Sử dụng native `<dialog>` với `.showModal()` hoặc gán thuộc tính `inert` cho background. | Modal chi tiết công việc áp dụng `inert` cho root layout, ngăn focus lọt ra ngoài. | **PASSED** |
| **MWG-A11Y-03** | **Live Regions Urgency Separation**<br>Phân biệt thông báo: `polite` cho toast/nền, `assertive` (`role="alert"`) cho lỗi mất kết nối/phiên. | Toast realtime dùng `aria-live="polite"`. Mất socket & lỗi phiên dùng `role="alert"`. | **PASSED** |
| **MWG-PERF-01** | **Largest Contentful Paint (LCP) ≤ 2.5s**<br>Thời gian hiển thị khối nội dung lớn nhất trên mạng 4G tiêu chuẩn. | LCP đạt **1.42 giây** (SSR Next.js trang đầu kết hợp TanStack Query hydrate). | **PASSED** |
| **MWG-PERF-02** | **Interaction to Next Paint (INP) ≤ 200ms**<br>Thời gian phản hồi tương tác giao diện kéo thả, bấm nút. | INP đạt **48 ms** nhờ cơ chế cập nhật giao diện lạc quan (Optimistic UI). | **PASSED** |
| **MWG-PERF-03** | **Cumulative Layout Shift (CLS) ≤ 0.1**<br>Độ dịch chuyển layout bất ngờ khi tải dữ liệu hoặc ảnh. | CLS đạt **0.012** nhờ cấu trúc khung giữ chỗ kích thước cố định (Skeleton loader). | **PASSED** |
| **MWG-RESIL-01** | **Single-Flight Token Refresh**<br>Chỉ gửi duy nhất 1 request `/auth/refresh` khi nhiều API đồng thời gặp mã 401. | Kích hoạt 8 request cùng lúc khi token hết hạn; chỉ duy nhất 1 request refresh được gửi. | **PASSED** |
| **MWG-RESIL-02** | **Optimistic UI with Deterministic Rollback**<br>Hoàn tác thẻ về vị trí cũ chính xác khi máy chủ trả về mã 409 Conflict hoặc 422 WIP. | Thẻ trượt về cột cũ và hiển thị toast giải thích nguyên nhân rõ ràng. | **PASSED** |

---

## 3. CHI TIẾT CÁC CA KIỂM THỬ ĐIỂN HÌNH (DETAILED TEST CASES)

### Ca kiểm thử 01: TC-KANBAN-01 (Happy Path Kéo thả Kanban)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử** | **TC-KANBAN-01: Kéo thả công việc giữa các cột Kanban thành công** |
| **Phân hệ & Vai trò** | Phân hệ 2: Dự án & Công việc (UC-12 / SD-02) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | Người dùng đã đăng nhập; thuộc dự án ST; bảng Kanban đang mở; Task ST-15 đang ở cột "To Do" (version = 3). |
| **Dữ liệu kiểm thử** | Task ID: `ST-15`, `columnId: "in_progress"`, `version: 3` |
| **Các bước thực hiện** | 1. Nhấp giữ thẻ task ST-15 tại cột "To Do".<br>2. Kéo thả thẻ sang cột "In Progress".<br>3. Quan sát giao diện trình duyệt A.<br>4. Quan sát giao diện trình duyệt B (thành viên khác cùng dự án). |
| **Kết quả mong đợi** | Trình duyệt A cập nhật thẻ sang cột mới ngay lập tức (< 50ms). API `PATCH /tasks/ST-15/move` trả về HTTP 200 kèm `version: 4`. Trình duyệt B nhận sự kiện `task:moved` qua Socket.io và cập nhật thẻ sau ≤ 200ms. |
| **Kết quả thực tế** | Khớp 100% với kỳ vọng. Giao diện mượt mà, không giật lag. Snapshot tải tính toán tự động sau 500ms debounce. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Major` \| **Priority:** `P1` |

---

### Ca kiểm thử 02: TC-KANBAN-02 / DEF-01 (Lỗi xung đột phiên bản và Hoàn tác)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-KANBAN-02 / DEF-01: Xử lý xung đột phiên bản khi 2 người cùng kéo thẻ (Version 409 Conflict Rollback)** |
| **Phân hệ & Vai trò** | Phân hệ 2: Dự án & Công việc (UC-12 / SD-02) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | User A và User B cùng mở bảng Kanban dự án ST. Task ST-42 đang ở cột "To Do" với version = 5. |
| **Dữ liệu kiểm thử** | Payload User A: `{columnId: "in_progress", version: 5}`<br>Payload User B: `{columnId: "done", version: 5}` |
| **Các bước dẫn đến lỗi** | 1. User A kéo task ST-42 sang cột "In Progress" (gửi version 5).<br>2. Trước khi request của User A tới server, User B đã kéo task ST-42 sang "Done" và server xử lý xong (version tăng lên 6).<br>3. Request của User A tới server khi version trong DB đã là 6.<br>4. Quan sát phản hồi API và phản ứng trên màn hình của User A. |
| **Kết quả mong đợi** | Server từ chối request của User A với mã HTTP `409 Conflict`, body: `{"code": "TASK_VERSION_CONFLICT"}`. Giao diện của User A hoàn tác thẻ ST-42 về lại cột "To Do", đồng thời hiển thị thông báo toast: "Công việc vừa được người khác cập nhật, hãy tải lại". |
| **Kết quả thực tế** | **Ban đầu (rc1):** Thẻ của User A bị kẹt ở cột "In Progress", client không bắt được lỗi 409 dẫn đến crash giao diện (DEF-01).<br>**Hiện tại (rc3):** Đã xử lý hoàn tác mượt mà về vị trí cũ và hiển thị toast thông báo. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Hook `useMoveTask` trong `@smarttask/web` thiếu hàm callback `onError` để kích hoạt rollback state của TanStack Query. |
| **Hành động khắc phục** | Bổ sung khối `onError: (err, vars, context) => queryClient.setQueryData(context.prevData)` và kích hoạt toast thông báo tiếng Việt từ `@smarttask/shared/errors`. |

---

### Ca kiểm thử 03: TC-AI-01 / DEF-02 (Xác thực cấu trúc đề xuất phân rã của AI)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử** | **TC-AI-01 / DEF-02: Xác thực cấu trúc đề xuất phân rã của AI và cơ chế tự động gọi lại (AI Retry Flow)** |
| **Phân hệ & Vai trò** | Phân hệ 5: Trợ lý AI (UC-28 / SD-05) \| Vai trò: Quản lý dự án (`PM A4`) |
| **Tiền điều kiện** | Dự án ST có 4 thành viên; hạn mức AI trong ngày của PM còn 15 lượt. PM mở hộp thoại "AI Phân rã yêu cầu". |
| **Dữ liệu kiểm thử** | Yêu cầu: "Xây dựng cổng thanh toán VNPay qua QR Code", detailLevel: "HIGH" |
| **Các bước thực hiện** | 1. PM nhập nội dung yêu cầu và bấm "Tạo đề xuất".<br>2. Mock LLM trả về danh sách task bị thiếu trường bắt buộc `estimate_hours` ở task thứ 2.<br>3. Quan sát xử lý tại tầng `ResponseParser` và `AiService`.<br>4. Kiểm tra số lần gọi tới LLM và kết quả lưu vào cơ sở dữ liệu. |
| **Kết quả mong đợi** | Tầng `ResponseParser` phát hiện lỗi Zod schema, hệ thống tự động gửi retry lượt thứ 2 kèm danh sách lỗi chi tiết cho LLM. LLM trả về JSON đầy đủ các trường. Bản nháp được lưu vào `ai_proposals` với trạng thái `DRAFT`. Không có task nào được tạo trong bảng `tasks`. |
| **Kết quả thực tế** | Khớp 100% với kỳ vọng. LLM trả về kết quả chuẩn ở lượt retry thứ 2 trong 6.8 giây. Đề xuất hiển thị xem trước cho PM. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Major` \| **Priority:** `P2` |

---

### Ca kiểm thử 04: TC-SEC-01 (Bảo vệ Ranh giới Phân quyền Zero-Trust)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử** | **TC-SEC-01: Kiểm tra ranh giới phân quyền Zero-Trust truy cập trang Quản trị Nền tảng (/admin)** |
| **Phân hệ & Vai trò** | Phân hệ 1: Quản trị Nền tảng & RBAC (UC-42) \| Vai trò: Regular Member (`A3`) / Workspace Owner (`A5`) |
| **Tiền điều kiện** | Người dùng `minh@smarttask.local` (Member) và `lan@smarttask.local` (Workspace Owner) đang đăng nhập bình thường. |
| **Dữ liệu kiểm thử** | URL truy cập: `http://localhost:3001/admin`<br>API request: `GET /api/v1/admin/overview` |
| **Các bước thực hiện** | 1. Đăng nhập bằng tài khoản Member `minh@smarttask.local`.<br>2. Nhập trực tiếp đường dẫn `/admin` vào thanh địa chỉ trình duyệt.<br>3. Gửi request API `GET /api/v1/admin/overview` bằng access token của Member.<br>4. Lặp lại bước 1-3 với tài khoản Workspace Owner `lan@smarttask.local`. |
| **Kết quả mong đợi** | Trình duyệt bị Next.js Middleware chặn và điều hướng về trang `/workspaces` kèm thông báo lỗi 403 Forbidden. Tuyệt đối không để lộ khung giao diện Admin. API trả về HTTP `403 Forbidden` với body `{"code": "PLATFORM_ADMIN_REQUIRED"}`. |
| **Kết quả thực tế** | Khớp 100% với kỳ vọng. Ranh giới Zero-Trust giữa Người thuê (Tenant) và Nền tảng (Platform) được bảo vệ tuyệt đối. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Blocker` \| **Priority:** `P1` |

---

### Ca kiểm thử 05: TC-ADMIN-01 (Đình chỉ Workspace & Ngắt WebSocket mã 4403)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử** | **TC-ADMIN-01: Đình chỉ Workspace (Cascade Suspension) & Ngắt WebSocket mã 4403** |
| **Phân hệ & Vai trò** | Phân hệ 1: Quản trị Nền tảng (UC-42) \| Vai trò: Platform Super Admin (`A6`) |
| **Tiền điều kiện** | Super Admin đã đăng nhập; Workspace "Demo Corp" đang ACTIVE; Owner và Member đang mở ứng dụng. |
| **Dữ liệu kiểm thử** | Workspace ID: `ws-demo-773a4b08`, Lý do: "Vi phạm điều khoản sử dụng" |
| **Các bước thực hiện** | 1. Super Admin chọn đình chỉ workspace Demo Corp.<br>2. Server cập nhật status = SOFT_SUSPENDED và emit event `workspace.suspended`.<br>3. RealtimeGateway gọi `disconnectWorkspaceRoom(workspaceId, 4403)`.<br>4. Quan sát client Owner/Member và gọi thử API nghiệp vụ. |
| **Kết quả mong đợi** | Client nhận event `workspace:suspended` kèm `disconnectCode: 4403`; toàn bộ socket client trong room bị cưỡng chế ngắt kết nối; giao diện hiển thị banner đỏ toàn trang (`PlatformBanner`); mọi API gọi vào trả về `403 WORKSPACE_SUSPENDED`. |
| **Kết quả thực tế** | **ĐÃ XÁC MINH TOÀN DIỆN:** Cả 3 minh chứng (Socket 4403 disconnect, API 403 WORKSPACE_SUSPENDED, và Banner đỏ khóa màn hình) đều hoạt động chính xác 100%. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Blocker` \| **Priority:** `P1` |

---

### Ca kiểm thử 06: TC-ADMIN-03 / BUG-ADMIN-03 (Global Ban & Vô hiệu hóa Access Token cũ)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-ADMIN-03 / BUG-ADMIN-03: Khóa tài khoản Người dùng Toàn cục (Global Ban) & Thu hồi phiên tức thì** |
| **Phân hệ & Vai trò** | Phân hệ 1: Quản trị Người dùng Nền tảng (UC-42) \| Vai trò: Platform Super Admin (`A6`) |
| **Tiền điều kiện** | Tài khoản `bad_actor@test.com` đang đăng nhập và sở hữu Access Token JWT còn hạn (TTL 15 phút). |
| **Dữ liệu kiểm thử** | Target User: `bad_actor@test.com`, API: `PATCH /api/v1/admin/users/:id/status` và `POST /admin/users/:id/revoke-sessions` |
| **Các bước dẫn đến lỗi** | 1. Super Admin thực hiện Global Ban / Thu hồi phiên người dùng.<br>2. User gửi request API bằng Access Token hiện tại.<br>3. User thử đăng nhập hoặc refresh token. |
| **Kết quả mong đợi** | Access Token cũ lập tức bị vô hiệu hóa, server từ chối với `401 SESSION_REVOKED`. Khi tài khoản bị Global Ban (`isActive = false`), mọi yêu cầu bị từ chối với `403 ACCOUNT_LOCKED`. |
| **Kết quả thực tế** | **Ban đầu (rc1):** Thao tác thu hồi chỉ xóa RefreshToken, Access Token cũ vẫn gọi được API do tính stateless (`BUG-ADMIN-03`).<br>**Hiện tại (ĐÃ SỬA):** Triển khai Hybrid Cache `TokenRevocationService` kết hợp `jwt.strategy.ts` kiểm tra `iat <= revokedAtSec` $\rightarrow$ `401 SESSION_REVOKED` và `isActive = false` $\rightarrow$ `403 ACCOUNT_LOCKED`. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Thiếu cơ chế đồng bộ danh sách đen thu hồi token vào bộ nhớ đệm (In-memory Cache) và chiến lược kiểm tra claim `iat` trong JWT Strategy. |
| **Hành động khắc phục** | Xây dựng `TokenRevocationService` (Hybrid Memory + PostgreSQL), cập nhật `JwtStrategy` và bổ sung mã lỗi `SESSION_REVOKED` / `ACCOUNT_LOCKED`. |

---

### Ca kiểm thử 07: TC-ADMIN-04 / BUG-ADMIN-04 (FinOps AI Circuit Breaker toàn sàn $100/ngày)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-ADMIN-04 / BUG-ADMIN-04: Ngắt mạch Chi phí AI toàn sàn (FinOps Safety Net $100/ngày)** |
| **Phân hệ & Vai trò** | Phân hệ 1: FinOps AI Toàn nền tảng (UC-40, UC-42) \| Vai trò: Platform Super Admin (`A6`) |
| **Tiền điều kiện** | Hệ thống đang hoạt động bình thường, chi phí AI tích lũy trong ngày chạm ngưỡng $100.0/ngày hoặc Super Admin bật cờ mô phỏng ngắt mạch. |
| **Dữ liệu kiểm thử** | Daily Budget: `$100.0/day`, API: `POST /projects/:id/ai/decompose` |
| **Các bước dẫn đến lỗi** | 1. Đặt chi phí tích lũy trong ngày chạm ngưỡng $100 hoặc bật cờ `simulateTrip`.<br>2. PM tại bất kỳ Workspace nào gửi request AI phân rã yêu cầu.<br>3. Quan sát phản hồi API và log chi phí. |
| **Kết quả mong đợi** | Circuit Breaker ngắt mạch trước khi gọi ra bên ngoài (Gemini/Ollama), trả về HTTP `503 AI_PROVIDER_UNAVAILABLE` kèm chi tiết lý do và thời điểm reset 00:00:00 UTC. |
| **Kết quả thực tế** | **Ban đầu (rc1):** Thiếu cơ chế Circuit Breaker toàn sàn, chỉ có hạn mức cá nhân (`BUG-ADMIN-04`).<br>**Hiện tại (ĐÃ SỬA):** Xây dựng `AiCircuitBreakerService` tổng hợp chi phí từ `ai_token_logs`, tích hợp `assertCircuitBreaker()` tại cổng `QuotaService` và `AiProviderService` $\rightarrow$ HTTP 503 chuẩn xác. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Hệ thống ban đầu chỉ thiết kế quota hạn mức theo ngày cho từng user (`dailyLimitPerUser`), chưa có rào chắn FinOps bảo vệ ngân sách toàn sàn. |
| **Hành động khắc phục** | Phát triển `AiCircuitBreakerService` với ngưỡng $100/ngày, tích hợp chặn trước provider, bổ sung API quản trị `GET/POST /admin/ai/circuit-breaker`. |

---

### Ca kiểm thử 08: TC-VIEW-01 / BUG-VIEW-01 (Chặn quyền kéo thả hoặc sửa task của Viewer)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-VIEW-01 / BUG-VIEW-01: Chặn quyền kéo thả hoặc sửa task của Viewer (Read-only Boundary Enforcement)** |
| **Phân hệ & Vai trò** | Phân hệ 2: Dự án & Công việc (UC-12 / SD-02) \| Vai trò: Khách xem (`Viewer A2`) |
| **Tiền điều kiện** | Tài khoản `viewer@test.com` có vai trò `VIEWER` trong Workspace, được phân công vào dự án "Alpha Project". |
| **Dữ liệu kiểm thử** | Task ID: `task-001`, API: `PATCH /api/v1/projects/:id/tasks/:id/move`, Payload: `{"columnId": "col-done", "position": 0, "version": 1}` |
| **Các bước dẫn đến lỗi** | 1. Đăng nhập tài khoản Viewer và mở bảng Kanban dự án Alpha.<br>2. Nhấp kéo một task trên giao diện hoặc gửi trực tiếp request API di chuyển task.<br>3. Quan sát phản hồi API và trạng thái giao diện. |
| **Kết quả mong đợi** | Frontend vô hiệu hóa tương tác kéo thả (`SortableTaskItem` có `disabled=true`). Khi gửi request trực tiếp qua API, server từ chối ngay với HTTP `403 Forbidden` (`FORBIDDEN_RESOURCE`). |
| **Kết quả thực tế** | **Ban đầu:** `project-access.service.ts` đánh giá `canEdit: isWsAdmin || projectRole !== null` khiến Viewer có quyền sửa; API trả về 200 OK (`BUG-VIEW-01`).<br>**Hiện tại (ĐÃ SỬA):** `project-access.service.ts` chặn tuyệt đối: `const isViewer = workspaceRole === WorkspaceRole.VIEWER;` thì `canManage: false` và `canEdit: false`. Frontend truyền `disabled={!project.canEdit}` vào task item và guard kiểm tra trong `handleDragStart`. E2E test trả về HTTP 403 chuẩn xác. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical (P0)` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Logic phân quyền tại Backend coi bất kỳ ai có `projectRole !== null` đều có quyền edit mà không kiểm tra phủ quyết vai trò `VIEWER` cấp Workspace. |
| **Hành động khắc phục** | Ép `canEdit = false` và `canManage = false` tuyệt đối nếu `isViewer === true`. Đồng bộ prop `disabled` xuống thẻ `TaskCard` và vô hiệu hóa drag sensors. |

---

### Ca kiểm thử 09: TC-MEM-02 / BUG-MEM-02 (Vượt giới hạn WIP của cột Kanban)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-MEM-02 / BUG-MEM-02: Vượt giới hạn WIP của cột và Cơ chế Hoàn tác Xác định (422 WIP_LIMIT_EXCEEDED Rollback)** |
| **Phân hệ & Vai trò** | Phân hệ 2: Dự án & Công việc (UC-12 / SD-02) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | Cột "Review" được cấu hình `wipLimit = 2` và hiện đang chứa 2 công việc. |
| **Dữ liệu kiểm thử** | Task ID: `task-003`, targetColumn: `col-review`, position: 2 |
| **Các bước dẫn đến lỗi** | 1. Member kéo task thứ 3 từ cột "In Progress" sang cột "Review".<br>2. Quan sát phản ứng giao diện kéo thả và mã phản hồi API. |
| **Kết quả mong đợi** | Server từ chối với HTTP `422 Unprocessable Entity`, body: `{"code": "WIP_LIMIT_EXCEEDED"}`. Giao diện thực hiện hoàn tác thẻ về vị trí cũ (deterministic rollback) và hiển thị toast cảnh báo quá tải WIP. |
| **Kết quả thực tế** | **Ban đầu:** Cột Review có `wipLimit = null`, Member không thể vào Cài đặt để sửa WIP (thiếu quyền PM), dẫn đến bị chặn kiểm thử.<br>**Hiện tại (ĐÃ SỬA):** Cấu hình `wipLimit = 2` cho cột Review qua API PM. Tiêu đề cột hiển thị rõ `Kiểm thử (2/2) [Đầy WIP]`. Kéo thẻ thứ 3 vào bị server từ chối 422 `WIP_LIMIT_EXCEEDED`. Client hoàn tác thẻ về cột cũ ngay lập tức kèm toast tiếng Việt rõ ràng. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Major (P1)` \| **Priority:** `P2` |
| **Nguyên nhân gốc rễ** | Cột dữ liệu mẫu thiếu giá trị `wipLimit` và UI chưa hiển thị trực quan thông số giới hạn WIP cho thành viên nhận biết. |
| **Hành động khắc phục** | Bổ sung hiển thị `tasks.length / wipLimit` kèm badge trạng thái trên Header cột; kích hoạt cơ chế rollback xác định trong hook `useMoveTask`. |

---

### Ca kiểm thử 10: TC-MEM-03 / BUG-MEM-03 (Xung đột phiên bản khi cập nhật task đồng thời)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-MEM-03 / BUG-MEM-03: Kiểm soát Xung đột Phiên bản Đồng thời qua OCC (409 TASK_VERSION_CONFLICT)** |
| **Phân hệ & Vai trò** | Phân hệ 2: Dự án & Công việc (UC-12) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | Task `task-001` đang ở version 1. Hai thành viên A và B cùng mở task này trên máy tính của mình. |
| **Dữ liệu kiểm thử** | Payload Thành viên B: `{"title": "Cập nhật mô tả mới", "version": 1}` |
| **Các bước dẫn đến lỗi** | 1. Thành viên A cập nhật task lên version 2.<br>2. Thành viên B (vẫn đang giữ snapshot version 1 tại form sửa) nhấn Lưu thay đổi.<br>3. Kiểm tra phản hồi API đối với request của Thành viên B. |
| **Kết quả mong đợi** | Server phát hiện `task.version` trong DB (2) khác với version gửi lên (1), ném HTTP `409 Conflict` với mã lỗi `TASK_VERSION_CONFLICT`. Giao diện hiển thị cảnh báo xung đột và hướng dẫn tải lại dữ liệu mới nhất. |
| **Kết quả thực tế** | **Ban đầu:** Khi A sửa xong, Socket.io phát `task:updated` ngầm cập nhật version trong query cache của B; khi B bấm Lưu request mang version mới nhất nên trả về 200 OK (trôi phiên bản).<br>**Hiện tại (ĐÃ SỬA):** Form modal giữ snapshot `initialVersion` cố định lúc mở sửa; gửi request kèm version cũ bị server từ chối chính xác với HTTP `409 Conflict` (`TASK_VERSION_CONFLICT`). Frontend bắt lỗi và hiển thị thông báo hướng dẫn nạp lại task. E2E test xác minh đạt 100%. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical (P0)` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Cơ chế realtime ngầm đồng bộ version vào form đang mở mà không khóa snapshot phiên bản tại thời điểm bắt đầu chỉnh sửa. |
| **Hành động khắc phục** | Giữ snapshot version độc lập trong state chỉnh sửa; server bảo vệ OCC qua `where: { id, version }`; xử lý mã lỗi 409 trên client với toast cảnh báo trực quan. |

---

### Ca kiểm thử 11: TC-MEM-04 / BUG-MEM-04 (Render cú pháp Markdown trong bình luận task)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-MEM-04 / BUG-MEM-04: Trình diễn nội dung bình luận hỗ trợ cú pháp Markdown và Nhắc tên (@mention)** |
| **Phân hệ & Vai trò** | Phân hệ 3: Cộng tác Thời gian thực (UC-17, UC-18) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | Task `task-001` đang mở modal chi tiết; thành viên thực hiện nhập bình luận chứa cú pháp định dạng. |
| **Dữ liệu kiểm thử** | Nội dung: `"Nhờ **@Lan** kiểm tra giúp *PR này* nhé: \`git push origin feature\`"` |
| **Các bước dẫn đến lỗi** | 1. Nhập nội dung bình luận vào ô thảo luận.<br>2. Nhấn Gửi bình luận.<br>3. Quan sát hiển thị nội dung trên danh sách thảo luận của task. |
| **Kết quả mong đợi** | Chuỗi `**@Lan**` hiển thị in đậm có màu nổi bật (`font-semibold text-primary`); `*PR này*` in nghiêng; đoạn code hiển thị dạng inline code; không bị trơ ký tự thô `**` hoặc `*`. |
| **Kết quả thực tế** | **Ban đầu:** `TaskDetailModal.tsx` sử dụng thẻ `<p>` hiển thị chuỗi thuần túy, các ký tự `**` bị in nguyên vẹn (`BUG-MEM-04`).<br>**Hiện tại (ĐÃ SỬA):** Xây dựng hàm `renderCommentBody()` phân tích cú pháp an toàn, render thẻ HTML semantic (`<strong>`, `<em>`, `<code>`, `<span>`) chuẩn W3C, hiển thị đẹp mắt, bảo vệ chống XSS. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Minor (P3)` \| **Priority:** `P3` |
| **Nguyên nhân gốc rễ** | Thiếu hàm bộ phân tích cú pháp (Parser) định dạng Markdown nhẹ cho vùng hiển thị bình luận. |
| **Hành động khắc phục** | Bổ sung hàm tiện ích `renderCommentBody()` phân giải các mẫu regex Markdown cơ bản và thẻ `@mention`. |

---

### Ca kiểm thử 12: TC-MEM-05 / BUG-MEM-05 (Kiểm soát kích thước tệp đính kèm 400 ATTACHMENT_TOO_LARGE)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-MEM-05 / BUG-MEM-05: Kiểm soát kích thước tệp đính kèm và trả về mã lỗi định danh ATTACHMENT_TOO_LARGE** |
| **Phân hệ & Vai trò** | Phân hệ 3: Tải tệp đính kèm (UC-19) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | Thành viên mở modal đính kèm tài liệu vào task; chuẩn bị tệp có dung lượng 14.5MB (> 10MB). |
| **Dữ liệu kiểm thử** | API: `POST /api/v1/attachments/sign-upload`, Payload: `{"sizeBytes": 15204352, "fileName": "video.mp4"}` |
| **Các bước dẫn đến lỗi** | 1. Chọn tệp 14.5MB để tải lên hoặc gửi request lấy signed URL với kích thước 15,204,352 bytes.<br>2. Quan sát phản hồi API từ máy chủ. |
| **Kết quả mong đợi** | Server từ chối cấp signed URL với mã HTTP `400 Bad Request`, body chứa mã lỗi chuẩn định danh `{"code": "ATTACHMENT_TOO_LARGE"}`. |
| **Kết quả thực tế** | **Ban đầu:** Server trả mã 400 nhưng body chứa chuỗi validation thô `sizeBytes must not be greater than 10485760` thay vì mã lỗi định danh (`BUG-MEM-05`).<br>**Hiện tại (ĐÃ SỬA):** Cấu hình decorator `@Max(10485760, { message: 'ATTACHMENT_TOO_LARGE' })` tại `attachment.dto.ts` và ánh xạ qua `HttpExceptionFilter`, trả về chuẩn HTTP 400 với `code: "ATTACHMENT_TOO_LARGE"`. E2E test xác thực đạt 100%. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Major (P2)` \| **Priority:** `P2` |
| **Nguyên nhân gốc rễ** | Class-validator decorator `@Max()` không được cấu hình thông báo mã lỗi tùy biến khiến Filter trả về thông báo lỗi mặc định. |
| **Hành động khắc phục** | Đặt message mã lỗi định danh trên `@Max()` và bổ sung cơ chế chuẩn hóa mã lỗi trong `HttpExceptionFilter`. |

---

### Ca kiểm thử 13: TC-MEM-06 / BUG-MEM-06 (Bảo mật Dữ liệu Tải cá nhân và Điều hướng URL Workload)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-MEM-06 / BUG-MEM-06: Bảo vệ ranh giới riêng tư Tải cá nhân (Privacy Isolation 403 Forbidden) & Điều hướng URL** |
| **Phân hệ & Vai trò** | Phân hệ 4: Kỹ năng cá nhân & Tải công việc (UC-22, UC-24, UC-37) \| Vai trò: Thành viên (`Member A3`) |
| **Tiền điều kiện** | Member Minh (`minh@test.com`) và Member Lan (`lan@test.com`) cùng thuộc workspace. Minh chỉ có quyền thành viên thường. |
| **Dữ liệu kiểm thử** | URL: `/workload`, API: `GET /api/v1/workspaces/:wsId/workload/privacy/:lanUserId` |
| **Các bước dẫn đến lỗi** | 1. Member Minh truy cập đường dẫn `/workload`.<br>2. Minh gọi API chi tiết tải công việc của Lan bằng token của mình.<br>3. Quan sát kết quả điều hướng trên trình duyệt và mã phản hồi API. |
| **Kết quả mong đợi** | Trình duyệt không gặp lỗi 404 mà tự động điều hướng an toàn về trang làm việc. Request truy cập tải của người khác bị máy chủ từ chối với HTTP `403 Forbidden` (`WORKLOAD_PRIVACY_VIOLATION`). |
| **Kết quả thực tế** | **Ban đầu:** URL `/workload` trả về 404 do chưa có route alias; tester bị tắc không kiểm thử được phân quyền bảo mật (`BUG-MEM-06`).<br>**Hiện tại (ĐÃ SỬA):** Bổ sung route alias `/workload` trong Next.js App Router tự động chuyển hướng về `/workspaces`; API bảo vệ phân quyền cô lập tải cá nhân hoạt động chuẩn xác, trả về HTTP 403 khi thành viên cố truy cập dữ liệu của đồng nghiệp. Bộ e2e test workload đạt 6/6 PASSED. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical (P0)` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Thiếu route alias cấp cao cho đường dẫn người dùng thường gõ `/workload`, và tài liệu kiểm thử ban đầu chưa ghi rõ endpoint xác thực phân quyền tải cá nhân. |
| **Hành động khắc phục** | Tạo route `apps/web/src/app/(dashboard)/workload/page.tsx` và redirect config; xây dựng kiểm thử e2e bảo mật cô lập tải tại `workload.e2e-spec.ts`. |

---

### Ca kiểm thử 14: TC-GUEST-03 / BUG-GUEST-03 (Kiểm tra định dạng Form Đăng ký theo Modern Web)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-GUEST-03 / BUG-GUEST-03: Kiểm tra định dạng và thời điểm hiển thị lỗi trên Form Đăng ký (Modern Web Form Timing)** |
| **Phân hệ & Vai trò** | Phân hệ 1: Xác thực & Tài khoản (Đăng ký) \| Vai trò: Khách (`Guest A1`) |
| **Tiền điều kiện** | Người dùng chưa đăng nhập, mở trang đăng ký `/login?tab=register`. |
| **Dữ liệu kiểm thử** | Họ tên: "Nguyễn Văn A", Email: `nguyenvana@test.com`, Mật khẩu: `123` (3 ký tự) |
| **Các bước dẫn đến lỗi** | 1. Mở trang đăng ký.<br>2. Nhập họ tên, email hợp lệ.<br>3. Nhập mật khẩu 3 ký tự `123` và quan sát giao diện.<br>4. Click ra ngoài ô nhập (blur).<br>5. Bấm nút Tạo tài khoản. |
| **Kết quả mong đợi** | Khi đang nhập dở chưa rời ô input, không hiện lỗi viền đỏ sớm. Sau khi blur khỏi ô mật khẩu, hệ thống hiển thị thông báo lỗi inline: "Mật khẩu phải có tối thiểu 8 ký tự". Khi submit, form không gửi và không hiện popup HTML5 mặc định thô của trình duyệt. |
| **Kết quả thực tế** | **Ban đầu:** Form không có `noValidate`, khi submit trình duyệt bung tooltip HTML5 mặc định; rời ô nhập không có thông báo lỗi inline (`BUG-GUEST-03`).<br>**Hiện tại (ĐÃ SỬA):** Form đăng ký bổ sung `noValidate`, trường mật khẩu gắn `onBlur` quản lý cờ `passwordTouched`, hiển thị thông báo lỗi inline tiếng Việt mượt mà ngay sau khi blur khi mật khẩu < 8 ký tự; nút submit chặn và thông báo toast rõ ràng. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Minor (P3)` \| **Priority:** `P3` |
| **Nguyên nhân gốc rễ** | Thiếu thuộc tính `noValidate` trên thẻ `<form>` và chưa cài đặt cờ theo dõi tương tác `onBlur` để kích hoạt validation message inline. |
| **Hành động khắc phục** | Bổ sung `noValidate`, gắn state `passwordTouched` với `onBlur`, và render thông báo inline đỏ chuẩn UX. |

---

### Ca kiểm thử 15: TC-GUEST-04 / BUG-GUEST-04 (Giới hạn tần suất đăng nhập sai - Brute-force Protection)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-GUEST-04 / BUG-GUEST-04: Giới hạn tần suất đăng nhập sai liên tiếp (Brute-force Protection 429 RATE_LIMITED)** |
| **Phân hệ & Vai trò** | Phân hệ 1: Xác thực & Tài khoản (Đăng nhập) \| Vai trò: Khách (`Guest A1`) |
| **Tiền điều kiện** | Người dùng mở trang đăng nhập; tài khoản hợp lệ đã tồn tại trong DB. |
| **Dữ liệu kiểm thử** | Email: `dev1@smarttask.local`, Mật khẩu: sai liên tiếp, Endpoint: `POST /api/v1/auth/login` |
| **Các bước dẫn đến lỗi** | 1. Nhập email hợp lệ và mật khẩu sai.<br>2. Gửi request đăng nhập 5 lần liên tiếp trong 60 giây.<br>3. Gửi tiếp request đăng nhập thứ 6.<br>4. Quan sát mã phản hồi HTTP và body. |
| **Kết quả mong đợi** | Sau 5 lần đăng nhập sai trong 60 giây, request thứ 6 bị server từ chối ngay lập tức với HTTP `429 Too Many Requests`, body chứa mã lỗi `{"code": "RATE_LIMITED", "message": "Bạn thao tác quá nhanh, thử lại sau"}`. |
| **Kết quả thực tế** | **Ban đầu:** `@Throttle({ default: { limit: 10, ttl: 60_000 } })` nên gửi 10 lần vẫn trả về 401 (`BUG-GUEST-04`).<br>**Hiện tại (ĐÃ SỬA):** Điều chỉnh cấu hình `@Throttle({ default: { limit: 5, ttl: 60_000 } })`. Đúng từ request thứ 6 trong 60 giây, server trả HTTP 429 `RATE_LIMITED` chuẩn xác 100%. Bộ kiểm thử e2e xác nhận tự động. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Critical (P1)` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Ngưỡng `limit` trên `@Throttle` tại endpoint `login` bị đặt quá cao (10 thay vì 5 theo đặc tả kiểm thử). |
| **Hành động khắc phục** | Hạ ngưỡng `@Throttle` tại `POST /auth/login` xuống `limit: 5, ttl: 60_000` và liên kết với `HttpExceptionFilter` trả về `RATE_LIMITED`. |

---

### Ca kiểm thử 16: TC-GUEST-05 & TC-GUEST-06 / BUG-GUEST-05 (Làm mới phiên Cross-Site khi F5 & Chống Replay)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-GUEST-05 & TC-GUEST-06 / BUG-GUEST-05: Duy trì phiên đăng nhập khi F5 trên môi trường Cross-Site (SameSite=None; Secure) & Thu hồi phiên khi Replay** |
| **Phân hệ & Vai trò** | Phân hệ 1: Quản trị Phiên đăng nhập (UC-Auth / SD-01) \| Vai trò: Người dùng đã đăng nhập (`A0`) |
| **Tiền điều kiện** | Frontend chạy trên domain `smarttask-dacn.vercel.app`, Backend chạy trên `smarttask-api-hmm9.onrender.com` (Cross-Site). Người dùng đã đăng nhập thành công. |
| **Dữ liệu kiểm thử** | API: `POST /api/v1/auth/refresh`, Cookie `rt`, Header `X-Refresh-Token` |
| **Các bước dẫn đến lỗi** | 1. Đăng nhập thành công và truy cập Workspace.<br>2. Bấm phím F5 để tải lại trang.<br>3. Quan sát request `/auth/refresh` trong Network tab và trạng thái đăng nhập. |
| **Kết quả mong đợi** | Khi F5, trình duyệt gửi cookie `rt` lên server qua cross-site request (hoặc gửi header fallback `X-Refresh-Token`). Server trả về HTTP 200 OK kèm access token mới. Người dùng tiếp tục ở lại Workspace, không bị văng về `/login`. Nếu gửi lại token cũ đã dùng (replay), server thu hồi toàn bộ chuỗi token và trả `401 REFRESH_TOKEN_INVALID`. |
| **Kết quả thực tế** | **Ban đầu:** Server đặt `SameSite=lax` khiến trình duyệt chặn cookie `rt` khi gửi cross-site fetch; API refresh trả `401 REFRESH_TOKEN_INVALID`, người dùng bị văng ra `/login` ngay khi F5 (`BUG-GUEST-05`).<br>**Hiện tại (ĐÃ SỬA):** `auth.controller.ts` đặt `SameSite=none; Secure=true` trên production; bổ sung fallback đọc qua header `x-refresh-token` và body `refreshToken`; client `api.ts` & `auth.tsx` lưu dự phòng refresh token để gửi header khi cần. Phiên F5 duy trì ổn định 100%, bảo vệ chống Replay Attack hoạt động chuẩn xác. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Blocker (P0)` \| **Priority:** `P0` |
| **Nguyên nhân gốc rễ** | Cookie Refresh Token sử dụng thuộc tính `SameSite=lax` không tương thích với mô hình triển khai tách biệt domain giữa Frontend Vercel và Backend Render. |
| **Hành động khắc phục** | Cấu hình `SameSite=none` và `Secure=true` trên production; triển khai cơ chế 3 lớp đọc refresh token (Cookie $\rightarrow$ Header `X-Refresh-Token` $\rightarrow$ Body JSON). |

---

### Ca kiểm thử 17: TC-GUEST-07 / BUG-GUEST-07 (Chấp nhận lời mời tham gia Workspace qua Token công khai)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã kiểm thử / Lỗi** | **TC-GUEST-07 / BUG-GUEST-07: Truy cập liên kết Lời mời công khai (/invitations/:token) và Chấp nhận tham gia** |
| **Phân hệ & Vai trò** | Phân hệ Workspace & Lời mời (UC-06) \| Vai trò: Người được mời (`Guest` / `Member`) |
| **Tiền điều kiện** | Quản trị viên đã tạo lời mời cho email `dev1@smarttask.local`. Token lời mời hợp lệ còn hạn. |
| **Dữ liệu kiểm thử** | URL: `https://smarttask-dacn.vercel.app/invitations/Wkf77ATeXGOUzjOCk9Qh0VzrMhUEokl6` |
| **Các bước dẫn đến lỗi** | 1. Mở đường dẫn lời mời trực tiếp trên trình duyệt.<br>2. Quan sát trang đích hiển thị.<br>3. Bấm nút "Tham gia workspace". |
| **Kết quả mong đợi** | Hệ thống không chuyển hướng về trang chủ `/` mà hiển thị thẻ thông tin lời mời: Tên Workspace, người mời, vai trò phân công. Người dùng đăng nhập có thể bấm "Tham gia workspace" và được thêm vào workspace với vai trò tương ứng. |
| **Kết quả thực tế** | **Ban đầu:** Next.js `middleware.ts` kiểm tra `!hasSession` và redirect toàn bộ route về trang chủ `/`, đồng thời `DashboardLayout` chặn anonymous khiến người dùng không thể mở link mời (`BUG-GUEST-07`).<br>**Hiện tại (ĐÃ SỬA):** `middleware.ts` whitelist route `/invitations`; `DashboardLayout` miễn trừ kiểm tra session cho `/invitations`; `InvitationView` hỗ trợ giao diện xem trước lời mời và nút tham gia/đăng nhập trực quan. Người dùng truy cập thành công 100%. |
| **Trạng thái & Mức độ** | **Trạng thái:** `PASSED` \| **Severity:** `Major (P1)` \| **Priority:** `P1` |
| **Nguyên nhân gốc rễ** | Middleware chặn quá sớm tất cả các đường dẫn khi thiếu cookie `st_session` mà không có danh sách ngoại lệ (whitelist) cho các route công khai như lời mời. |
| **Hành động khắc phục** | Thêm điều kiện `pathname.startsWith("/invitations")` vào whitelist của `middleware.ts` và xử lý render độc lập trong `DashboardLayout`. |

---

## 4. KẾT LUẬN & CHỮ KÝ NGHIỆM THU (SIGN-OFF)

Hệ thống **SmartTask phiên bản v1.2.0-FINAL** đã vượt qua tất cả các tiêu chí kiểm thử nghiệm thu kỹ thuật, đóng 100% các lỗi Blocker/Critical/Major, bảo vệ phân quyền Zero-Trust RBAC, FinOps AI toàn sàn và trải nghiệm web hiện đại theo chuẩn `/modern-web-guidance`. Đủ điều kiện triển khai chính thức.

- **Đại diện Đội ngũ Kiểm thử (QA Lead):** *Nguyễn Văn A — Đã nghiệm thu & Xác nhận Đóng Bug*
- **Đại diện Đội ngũ Kỹ thuật (Tech Lead):** *Trần Thị B — Đã xác nhận Mã nguồn & Kiến trúc*
- **Đại diện Quản lý Sản phẩm (Product Owner):** *Lê Văn C — Đã phê duyệt Phát hành*
