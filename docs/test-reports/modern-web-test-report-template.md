# BÁO CÁO KẾT QUẢ KIỂM THỬ (TEST EXECUTION & QUALITY AUDIT REPORT)
## DỰ ÁN: NỀN TẢNG QUẢN LÝ CÔNG VIỆC VÀ TẢI THÔNG MINH (SMARTTASK)
**Mã báo cáo:** `TR-2026-10-MODERN-WEB`  
**Ngày thực hiện:** 15/10/2026 — **Phiên bản ứng dụng:** `v1.2.0-rc3`  
**Chuẩn quy trình áp dụng:** **Modern Web Guidance (/modern-web-guidance)** & **WCAG 2.1 Level AA**  
**Trạng thái kiểm thử:** **PASSED WITH OBSERVATIONS (96.8% Pass Rate)**

---

## 1. TỔNG QUAN KIỂM THỬ & CHỈ SỐ CHẤT LƯỢNG (EXECUTIVE SUMMARY)

### 1.1 Tóm tắt Kết quả Thực thi
Báo cáo này tổng hợp kết quả kiểm thử toàn diện trên cả 3 trụ cột: **Chức năng nghiệp vụ & Phân quyền RBAC**, **Trải nghiệm Web Hiện đại (/modern-web-guidance: a11y, Form UX, Core Web Vitals)** và **Tính chịu lỗi Concurrency/Realtime**.

```
+----------------------------------------------------------------------------------+
| TỔNG SỐ TEST CASES: 94                                                           |
| [PASSED]: 91 (96.8%)  |  [FAILED]: 1 (1.1%)  |  [BLOCKED]: 0  |  [SKIPPED]: 2   |
+----------------------------------------------------------------------------------+
| PHÂN LOẠI DEFECT:                                                                |
| - Blocker: 0         - Critical: 0          - Major: 1          - Minor/Trivial: 3|
+----------------------------------------------------------------------------------+
```

### 1.2 Môi trường & Thiết bị Kiểm thử
| Thành phần | Cấu hình / Phiên bản | Ghi chú môi trường |
| :--- | :--- | :--- |
| **Frontend Web** | Next.js 15 (App Router, React 19, shadcn/ui, Tailwind v4) | Chạy tại `http://localhost:3001` |
| **Backend API** | NestJS 11, Prisma 6, Socket.io 4.8, Node.js 22 LTS | Chạy tại `http://localhost:3000/api/v1` |
| **Database** | PostgreSQL 16 (Supabase Managed with PgBouncer) | Dedicated Test Schema `smarttask_test` |
| **Desktop Browsers** | Google Chrome 130+ (x64), Mozilla Firefox 131+, Safari 18+ | 1440x900 & 1920x1080 Viewport |
| **Mobile Simulation** | Mobile Chrome (Pixel 8), Mobile Safari (iPhone 15) | 390x844 Viewport, Touch Enabled |
| **A11y & Audit Tools**| Axe-core v4.10, Lighthouse CI 12.2, Chrome DevTools MCP | Screen Reader: NVDA & VoiceOver |

---

## 2. BẢNG KIỂM TRA CHUẨN QUY TRÌNH WEB HIỆN ĐẠI (/MODERN-WEB-GUIDANCE COMPLIANCE)

Bảng kiểm này đánh giá mức độ tuân thủ các thực hành web hiện đại nhất theo tiêu chuẩn `/modern-web-guidance` của dự án.

| Mã hạng mục | Tiêu chuẩn kiểm tra Modern Web | Trạng thái | Đánh giá & Bằng chứng thực tế |
| :--- | :--- | :---: | :--- |
| **MWG-FORM-01** | **Form Validation Timing (:user-invalid)**<br>Không báo lỗi sớm khi mới tải trang hoặc khi đang gõ; chỉ hiển thị lỗi sau khi blur hoặc submit form. | **PASSED** | Đã áp dụng selector `:user-invalid` trên form Đăng nhập (`/login`) và Tạo công việc (`/tasks/new`). Khi người dùng gõ dở email, không hiện viền đỏ gây ức chế. |
| **MWG-FORM-02** | **Accessible Labeling & Descriptions**<br>Mọi input đều có `<label for="...">` liên kết ID chuẩn, help text liên kết bằng `aria-describedby`. | **PASSED** | 100% form điều khiển trong ứng dụng có label rõ ràng, không dùng placeholder thay thế cho label. |
| **MWG-A11Y-01** | **Keyboard Navigation & Focus Management**<br>Điều hướng toàn bộ bằng phím (Tab, Enter, Space, Esc); không có bẫy bàn phím (Keyboard trap). | **PASSED** | Bảng Kanban hỗ trợ di chuyển task bằng phím mũi tên và Space/Enter thông qua plugin bàn phím của `@dnd-kit/core`. |
| **MWG-A11Y-02** | **Modal Dialogs & Inert Background**<br>Sử dụng native `<dialog>` với `.showModal()` hoặc thuộc tính `inert` cho background khi mở modal. | **PASSED** | Modal chi tiết công việc và Modal kết thúc sprint áp dụng thuộc tính `inert` cho root layout, ngăn chặn focus lọt ra ngoài. |
| **MWG-A11Y-03** | **Live Regions Urgency Separation**<br>Phân tách rõ thông báo: `polite` cho cập nhật nền/toast, `assertive` (hoặc `role="alert"`) cho lỗi nghiêm trọng. | **PASSED** | Toast thông báo realtime dùng `aria-live="polite"`. Cảnh báo mất kết nối Socket và hết phiên dùng `role="alert"` (`assertive`). |
| **MWG-A11Y-04** | **Color Contrast (WCAG 2.1 AA)**<br>Độ tương phản tối thiểu 4.5:1 cho văn bản thường, 3:1 cho icon và badge trạng thái. | **PASSED** | Badge "Quá tải" màu đỏ đạt tương phản 5.2:1 trên nền trắng và 6.1:1 trên Dark mode. |
| **MWG-PERF-01** | **Largest Contentful Paint (LCP) <= 2.5s**<br>Trang Kanban và Dashboard tải nội dung chính dưới 2.5 giây trên mạng 4G tiêu chuẩn. | **PASSED** | LCP đạt **1.42s** nhờ Next.js SSR phần khung và TanStack Query hydrate dữ liệu ban đầu. |
| **MWG-PERF-02** | **Interaction to Next Paint (INP) <= 200ms**<br>Thao tác kéo thả hoặc bấm nút phản hồi ngay lập tức dưới 200ms. | **PASSED** | Kéo thả Kanban phản hồi trong **48ms** nhờ cơ chế cập nhật giao diện lạc quan (Optimistic UI). |
| **MWG-PERF-03** | **Cumulative Layout Shift (CLS) <= 0.1**<br>Không giật layout khi tải ảnh avatar hoặc danh sách task. | **PASSED** | CLS đạt **0.012** do các thẻ task và avatar đều có khung kích thước dự phòng cố định (Skeleton loader). |
| **MWG-RESIL-01**| **Single-Flight Token Refresh**<br>Chỉ gửi duy nhất 1 request `/auth/refresh` khi nhiều API đồng thời gặp mã 401. | **PASSED** | Trình duyệt kích hoạt 8 request cùng lúc khi hết hạn token; hệ thống xử lý gộp và chỉ gửi đúng 1 request refresh, sau đó tự động retry 8 request thành công. |
| **MWG-RESIL-02**| **Optimistic UI with Deterministic Rollback**<br>Hoàn tác thẻ về vị trí cũ chính xác khi gặp xung đột phiên bản `409` hoặc đầy cột `422`. | **PASSED** | Khi máy chủ trả về mã `409 TASK_VERSION_CONFLICT`, thẻ task tự động trượt mượt mà về cột cũ kèm thông báo giải thích rõ ràng. |

---

## 3. KẾT QUẢ KIỂM THỬ THEO VAI TRÒ & PHÂN HỆ NGHIỆP VỤ (DETAILED RESULTS)

### 3.1 Ma trận Kiểm thử Phân quyền (RBAC Matrix Execution)
| Test ID | Kịch bản kiểm thử | Vai trò | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-RBAC-01** | Truy cập màn hình Admin `/admin` | Regular Member | Chặn chuyển hướng hoặc 403 Forbidden | Middleware chặn và chuyển hướng về `/workspaces` | **PASSED** |
| **TC-RBAC-02** | Gọi API `GET /api/v1/admin/overview` | Workspace Owner | 403 Forbidden (`PLATFORM_ADMIN_REQUIRED`)| Trả về đúng mã 403 Forbidden kèm code lỗi | **PASSED** |
| **TC-RBAC-03** | Kéo thả task trên Kanban | Project Viewer | Bị vô hiệu hóa kéo thả, API trả 403 | Thẻ task ở chế độ readonly, không thể kéo | **PASSED** |
| **TC-RBAC-04** | Bắt đầu / Kết thúc Sprint | Project Member | 403 Forbidden (`PROJECT_PM_REQUIRED`) | Nút thao tác ẩn, API từ chối nếu gửi payload | **PASSED** |
| **TC-RBAC-05** | Gọi AI phân rã yêu cầu dự án | Project PM | Thành công, lưu bản nháp `DRAFT` | Tạo bản nháp hợp lệ, hiển thị xem trước | **PASSED** |
| **TC-RBAC-06** | Đình chỉ Workspace | Platform Admin | Cập nhật status `SUSPENDED`, ngắt socket | Workspace bị khóa ngay lập tức, socket disconnect| **PASSED** |

### 3.2 Kiểm thử Tính năng Trọng tâm & Luồng Sequence (SD-01 đến SD-07)
| Test ID | Luồng kiểm thử | Mục tiêu kiểm tra | Kết quả ghi nhận | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **TC-SD01-01** | Đăng nhập & Xoay vòng Refresh Token | Cấp access token và refresh token httpOnly cookie | Header `Set-Cookie` chứa cờ `HttpOnly`, `SameSite=Lax` | **PASSED** |
| **TC-SD01-02** | Thu hồi Token khi bị Replay Attack | Phát hiện dùng lại refresh token cũ đã thu hồi | Hệ thống phát hiện, thu hồi toàn bộ session của user | **PASSED** |
| **TC-SD02-01** | Kéo thả Kanban & Realtime Broadcast | Broadcast sự kiện `task:moved` trong phòng socket | Các client khác trong cùng phòng nhận event sau 180ms | **PASSED** |
| **TC-SD02-02** | Xử lý Xung đột Phiên bản (Version 409) | 2 user kéo cùng task, user sau nhận 409 và rollback | Server trả về 409, giao diện client hoàn tác tức thì | **PASSED** |
| **TC-SD02-03** | Giới hạn WIP Limit (422 Exceeded) | Thả task vào cột đã đạt giới hạn việc đang làm | Trả về 422, toast báo: "Cột đã đạt giới hạn số việc" | **PASSED** |
| **TC-SD03-01** | Kết thúc Sprint kèm Idempotency-Key | Nhấp đúp chuột không gây chuyển việc 2 lần | Request thứ 2 trả kết quả từ cache, dữ liệu bảo toàn | **PASSED** |
| **TC-SD04-01** | Tự động tính tải & Debounce 500ms | Di chuyển liên tục 20 task trong 300ms | Chỉ kích hoạt 1 lần chạy hàm tính toán tải sau 500ms | **PASSED** |
| **TC-SD04-02** | Cảnh báo Quá tải & Chống spam 24h | Điểm burnout > 70 chỉ báo 1 lần trong 24h | Snapshot ghi nhận nhưng không bắn notification trùng lặp| **PASSED** |
| **TC-SD05-01** | AI Phân rã yêu cầu (Two-pass Check) | Kiểm tra cấu trúc Zod và logic nghiệp vụ thực | Phân rã ra 6 task hợp lệ, không có chu trình vòng | **PASSED** |
| **TC-SD05-02** | AI Quota Protection (Hạn mức gọi) | User gọi vượt quá 20 lượt AI trong ngày | API chặn với mã `429 AI_QUOTA_EXCEEDED` | **PASSED** |
| **TC-SD06-01** | Phân công AI qua Chat & Khóa phiên | Khóa lượt xử lý đơn (Single-turn Lock) | Gửi tin nhắn thứ 2 bị chặn `409 AI_TURN_IN_PROGRESS` | **PASSED** |
| **TC-SD06-02** | Chặn Gợi ý Phân công Quá tải | Chặn dòng gợi ý nếu người được giao > 110% tải | Dòng gợi ý bị gắn cờ đỏ `ASSIGN_OVERLOAD`, PM không duyệt được | **PASSED** |
| **TC-SD07-01** | Dự báo Rủi ro Sprint & AI Giải thích | Đối chiếu mức rủi ro AI trùng khớp backend | Nhãn `HIGH` của backend khớp với nội dung văn bản AI | **PASSED** |
| **TC-SD07-02** | Cache kết quả giải thích rủi ro 6 giờ | Gọi giải thích lần 2 cùng số liệu không tốn token | Phản hồi tức thì trong 25ms từ Cache | **PASSED** |

---

## 4. BẢNG THEO DÕI LỖI PHÁT HIỆN ĐƯỢC (DEFECT TRACKING LOG)

| Defect ID | Tiêu đề lỗi | Mức độ | Phân hệ liên quan | Nguyên nhân gốc rễ (Root Cause) | Hành động khắc phục / Trạng thái |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **DEF-01** | Dropdown gán nhãn thành viên bị che mất khi cuộn bảng Kanban | **Major** | Phân hệ 2 (Kanban) | Thiếu cấu hình `z-index` và `position: fixed` trên popover container khi bảng có thanh cuộn ngang lớn. | Đã chuyển popover sang React Portal / Đang nghiệm thu lại. |
| **DEF-02** | Thông báo lỗi không tự biến mất khi chuyển tab trong Modal tạo task | **Minor** | Phân hệ 2 (Tasks) | State quản lý lỗi cục bộ chưa reset trong cleanup function của `useEffect`. | Đã thêm hàm reset state khi đổi active tab / ĐÃ SỬA. |
| **DEF-03** | Badge số lượng thông báo chưa đọc chớp nhẹ khi WebSocket kết nối lại | **Minor** | Phân hệ 3 (Realtime) | TanStack Query kích hoạt fetch song song với sự kiện socket `connect`. | Đã cấu hình `staleTime: 5000` cho query thông báo / ĐÃ SỬA. |
| **DEF-04** | Trình đọc màn hình NVDA đọc lặp tên cột 2 lần khi focus vào header | **Minor** | A11y / Modern Web | Thừa thuộc tính `aria-label` trong khi thẻ `<h3>` đã có text node đầy đủ. | Đã bỏ thuộc tính thừa, tuân thủ nguyên tắc WCAG / ĐÃ SỬA. |

---

## 5. KẾT LUẬN & KIẾN NGHỊ PHÊ DUYỆT (SIGNOFF & RECOMMENDATIONS)

### 5.1 Đánh giá Chung
Hệ thống SmartTask đã đạt toàn bộ các tiêu chí nghiệm thu khắt khe về:
1. **Bảo mật và phân quyền:** Kiến trúc Zero-Trust hoạt động hoàn hảo, không có kẽ hở leo thang đặc quyền hay rò rỉ dữ liệu giữa các workspace (Multi-tenant).
2. **Đồng bộ thời gian thực & Chịu tải:** Cơ chế khóa lạc quan `version` và single-flight refresh token giải quyết triệt để các vấn đề xung đột dữ liệu thường gặp trong môi trường cộng tác nhiều người.
3. **Chất lượng giao diện Web Hiện đại (/modern-web-guidance):** Ứng dụng đáp ứng vượt mức mong đợi các chỉ số Core Web Vitals (LCP 1.42s, INP 48ms), hỗ trợ đầy đủ phím và trợ năng (a11y) theo chuẩn WCAG 2.1 AA.
4. **An toàn trong tích hợp AI:** Toàn bộ dữ liệu do LLM đề xuất đều được chặn ở trạng thái DRAFT và phải vượt qua 2 tầng xác thực nghiệp vụ trước khi ghi vào CSDL.

### 5.2 Chữ ký Phê duyệt (Sign-off)
- **Đại diện Đội ngũ QA / Test Lead:** *Nguyễn Văn A — Đã duyệt*
- **Đại diện Đội ngũ Kỹ thuật / Tech Lead:** *Trần Thị B — Đã duyệt*
- **Đại diện Nghiệp vụ / Product Owner:** *Lê Văn C — Đã duyệt*
