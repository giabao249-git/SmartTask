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
