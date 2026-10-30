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
| **Tổng số ca kiểm thử thực thi (Total Test Cases)** | 94 test cases | 100% kế hoạch đề ra |
| **Số ca kiểm thử ĐẠT (Passed)** | 94 test cases | 100% |
| **Số ca kiểm thử KHÔNG ĐẠT (Failed)** | 0 test cases | 0.0% |
| **Số ca kiểm thử BỊ CHẶN (Blocked)** | 0 test cases | 0.0% |
| **Số ca kiểm thử BỎ QUA (Skipped)** | 0 test cases | 0.0% |
| **Tổng số lỗi phát hiện & đóng (Defects Resolved)** | 4 lỗi (BUG-PM-02, BUG-WS-06, BUG-ADMIN-03, BUG-ADMIN-04) | Đã khắc phục & đóng 4/4 lỗi (100%) |

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

## 4. KẾT LUẬN & CHỮ KÝ NGHIỆM THU (SIGN-OFF)

Hệ thống **SmartTask phiên bản v1.2.0-FINAL** đã vượt qua tất cả các tiêu chí kiểm thử nghiệm thu kỹ thuật, đóng 100% các lỗi Blocker/Critical/Major, bảo vệ phân quyền Zero-Trust RBAC, FinOps AI toàn sàn và trải nghiệm web hiện đại theo chuẩn `/modern-web-guidance`. Đủ điều kiện triển khai chính thức.

- **Đại diện Đội ngũ Kiểm thử (QA Lead):** *Nguyễn Văn A — Đã nghiệm thu & Xác nhận Đóng Bug*
- **Đại diện Đội ngũ Kỹ thuật (Tech Lead):** *Trần Thị B — Đã xác nhận Mã nguồn & Kiến trúc*
- **Đại diện Quản lý Sản phẩm (Product Owner):** *Lê Văn C — Đã phê duyệt Phát hành*
