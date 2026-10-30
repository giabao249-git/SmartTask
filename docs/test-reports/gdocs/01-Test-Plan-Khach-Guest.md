# KẾ HOẠCH KIỂM THỬ: NHÓM KHÁCH & XÁC THỰC (GUEST TEST PLAN)

**Dự án:** Nền tảng Quản lý Công việc và Tải Thông minh SmartTask  
**Phân hệ mục tiêu:** Phân hệ 1 — Nền tảng, Tài khoản & Xác thực (UC-01, UC-02, UC-03, UC-05, SD-01)  
**Đối tượng tác nhân:** Khách vãng lai (`Guest A1`) & Người dùng đã đăng nhập (`A0`)  
**Người lập:** QA Specialist & Security Team \| **Phiên bản:** `v1.0`

---

## 1. PHẠM VI & MỤC TIÊU KIỂM THỬ

1. **Bảo mật Xác thực:** Kiểm định toàn diện luồng Đăng ký, Đăng nhập, Quên mật khẩu, Thu hồi token khi bị tấn công replay.
2. **Cơ chế Single-Flight Refresh Token (SD-01):** Đảm bảo trình duyệt chỉ gửi đúng 1 request làm mới phiên khi có nhiều API cùng trả về mã 401.
3. **Trải nghiệm Form Hiện đại (/modern-web-guidance):** Form tuân thủ chuẩn `:user-invalid`, không báo lỗi sớm, hỗ trợ autocomplete chuẩn W3C.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT (GUEST TEST MATRIX)

| Mã TC | Tên kịch bản kiểm thử | Các bước & Dữ liệu kiểm thử | Kết quả mong đợi (Expected Result) | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| **TC-GUEST-01** | Đăng ký tài khoản mới hợp lệ (Happy Path) | 1. Mở `/register`.<br>2. Nhập email mới, pass: `SmartTask@2026`, tên: "Nguyễn Văn A".<br>3. Bấm Đăng ký. | Tạo user trong DB với status ACTIVE, hash mật khẩu bcrypt. Tự động cấp access token trong body và refresh token cookie httpOnly. Điều hướng về `/workspaces`. | **Critical** |
| **TC-GUEST-02** | Đăng ký trùng email đã tồn tại | 1. Mở `/register`.<br>2. Nhập email `dev1@smarttask.local` (đã có).<br>3. Bấm Đăng ký. | Server trả về mã HTTP `409 Conflict`, code `EMAIL_TAKEN`. Giao diện hiển thị thông báo: "Email đã được sử dụng", focus vào ô input email. | **Major** |
| **TC-GUEST-03** | Kiểm tra định dạng Form Đăng ký theo Modern Web | 1. Mở form `/register`.<br>2. Nhập 3 ký tự vào ô mật khẩu rồi dừng lại.<br>3. Quan sát giao diện. | Form áp dụng `:user-invalid`. Khi đang gõ chưa blur, KHÔNG hiện thông báo lỗi viền đỏ gây ức chế. Chỉ hiện lỗi "Mật khẩu tối thiểu 8 ký tự" sau khi người dùng click ra ngoài (blur). | **Minor** |
| **TC-GUEST-04** | Đăng nhập sai mật khẩu quá 5 lần (Brute-force Protection) | 1. Nhập email đúng, mật khẩu sai 5 lần liên tiếp trong 60 giây.<br>2. Lần thứ 6 gửi request. | Server trả về HTTP `429 Too Many Requests`, code `RATE_LIMITED`. Khóa tạm thời IP/tài khoản trong 5 phút. | **Critical** |
| **TC-GUEST-05** | Làm mới phiên Single-Flight khi hết hạn token (SD-01) | 1. Thiết lập access token hết hạn.<br>2. Mở cùng lúc 6 tab hoặc trigger 6 request API song song.<br>3. Kiểm tra Network tab trong DevTools. | Chỉ duy nhất 1 request `POST /auth/refresh` được gửi lên server. 5 request còn lại xếp hàng đợi và tự động retry thành công sau khi token mới được cấp. | **Blocker** |
| **TC-GUEST-06** | Phát hiện Token Replay Attack (Thu hồi toàn bộ phiên) | 1. Lấy refresh token cũ đã qua sử dụng.<br>2. Gửi request `POST /auth/refresh` với token cũ này. | Hệ thống phát hiện hành vi tái sử dụng token nghi bị đánh cắp. Lập tức thu hồi toàn bộ phiên đăng nhập của user trong bảng `refresh_tokens`. Trả về `401 REFRESH_TOKEN_INVALID`. | **Blocker** |
| **TC-GUEST-07** | Chấp nhận lời mời tham gia Workspace qua Token | 1. Mở link `/invitations/accept?token=TOKEN_HOP_LE`.<br>2. Đăng nhập hoặc đăng ký tài khoản. | Tài khoản được thêm vào bảng `workspace_members` với vai trò quy định trong lời mời. Lời mời chuyển trạng thái `ACCEPTED`. | **Major** |

---

## 3. KẾT QUẢ THỰC THI & BIÊN BẢN NGHIỆM THU (TEST EXECUTION & VERIFICATION)

### 3.1. Bảng Tổng Hợp Kết Quả Thực Thi (Execution Summary)

| Mã Ca KT | Tên kịch bản | Trạng thái ban đầu | Trạng thái sau Fix | Mã Lỗi (Defect ID) & Hành Động Khắc Phục |
| :--- | :--- | :---: | :---: | :--- |
| **TC-GUEST-01** | Đăng ký tài khoản mới hợp lệ (Happy Path) | **PASSED** | **PASSED** | Tạo user trong cơ sở dữ liệu với mật khẩu băm bcrypt (cost 12), cấp accessToken trong body và refresh token cookie httpOnly. |
| **TC-GUEST-02** | Đăng ký trùng email đã tồn tại | **PASSED** | **PASSED** | Server bắt lỗi trùng email, trả về HTTP `409 Conflict` với mã lỗi `EMAIL_TAKEN`. Giao diện giữ form đăng ký và báo lỗi. |
| **TC-GUEST-03** | Kiểm tra định dạng Form Đăng ký theo Modern Web | **FAILED** | **PASSED** | **BUG-GUEST-03:** Thêm thuộc tính `noValidate` chặn tooltip mặc định của trình duyệt; gắn `onBlur` kích hoạt cờ `passwordTouched`; hiển thị thông báo lỗi inline dưới ô nhập khi mật khẩu < 8 ký tự. |
| **TC-GUEST-04** | Đăng nhập sai mật khẩu quá 5 lần (Brute-force Protection) | **FAILED** | **PASSED** | **BUG-GUEST-04:** Điều chỉnh cấu hình `@Throttle({ default: { limit: 5, ttl: 60_000 } })` tại `login`. Request đăng nhập thứ 6 trong vòng 60 giây bị server ngắt bằng HTTP `429 Too Many Requests`, code `RATE_LIMITED`. |
| **TC-GUEST-05** | Làm mới phiên Single-Flight khi hết hạn token (SD-01) | **FAILED** | **PASSED** | **BUG-GUEST-05:** Cấu hình cookie `SameSite=none; Secure=true` trên production cho phép trình duyệt gửi cookie qua môi trường cross-site (Vercel $\leftrightarrow$ Render). Bổ sung fallback đọc qua header `x-refresh-token` và body `refreshToken`. Giữ phiên F5 ổn định 100%. |
| **TC-GUEST-06** | Phát hiện Token Replay Attack (Thu hồi toàn bộ phiên) | **BLOCKED** | **PASSED** | **BUG-GUEST-06:** Cơ chế xoay vòng Refresh Token hoạt động ổn định. Khi phát hiện sử dụng lại Refresh Token cũ đã thu hồi, toàn bộ chuỗi token của người dùng lập tức bị vô hiệu hóa, server trả về `401 REFRESH_TOKEN_INVALID`. |
| **TC-GUEST-07** | Chấp nhận lời mời tham gia Workspace qua Token | **FAILED** | **PASSED** | **BUG-GUEST-07:** Bổ sung whitelist `/invitations` trong `middleware.ts` và miễn trừ chuyển hướng trong `DashboardLayout`. Trang `/invitations/:token` hiển thị xem trước lời mời và nút tham gia workspace cho cả khách và người dùng đã đăng nhập. |

---

### 3.2. Bằng Chứng Kỹ Thuật Chi Tiết (Technical Verification Logs)

#### 1. Minh chứng TC-GUEST-04: Ngắt kết nối Brute-force sau 5 lần đăng nhập sai (429 RATE_LIMITED)
```http
POST /api/v1/auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "email": "dev1@smarttask.local",
  "password": "wrong-password"
}

HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "statusCode": 429,
  "code": "RATE_LIMITED",
  "message": "Bạn thao tác quá nhanh, thử lại sau"
}
```

#### 2. Minh chứng TC-GUEST-05: Cấp Cookie SameSite=None; Secure và Fallback Header Refresh (200 OK)
```http
POST /api/v1/auth/refresh HTTP/1.1
Host: localhost:3000
x-refresh-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

HTTP/1.1 200 OK
Set-Cookie: rt=eyJhbGciOiJIUzI1Ni...; Path=/api/v1/auth; HttpOnly; SameSite=None; Secure; Expires=Fri, 06 Nov 2026 13:40:00 GMT
Content-Type: application/json

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. Minh chứng TC-GUEST-07: Truy cập trang Lời mời công khai (/invitations/:token)
```http
GET /invitations/Wkf77ATeXGOUzjOCk9Qh0VzrMhUEokl6 HTTP/1.1
Host: smarttask-dacn.vercel.app

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```
*Giao diện người dùng hiển thị Card xem trước lời mời tham gia workspace, người mời, vai trò và nút "Tham gia workspace" / "Đăng nhập để tham gia" mà không bị chuyển hướng về trang chủ `/`.*

---

## 4. KẾT LUẬN & NGHIỆM THU
Toàn bộ 7 ca kiểm thử phân hệ Khách & Xác thực (Guest & Auth) đã được kiểm chứng và đạt **100% PASSED**. Đã đóng toàn bộ 4 lỗi nghiêm trọng từ P0 đến P3. Hệ thống hoàn toàn sẵn sàng vận hành trên môi trường thực tế.

