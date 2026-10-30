# KẾ HOẠCH KIỂM THỬ: QUẢN TRỊ NỀN TẢNG (PLATFORM SUPER ADMIN TEST PLAN)

**Dự án:** Nền tảng Quản lý Công việc và Tải Thông minh SmartTask  
**Phân hệ mục tiêu:** Phân hệ 1 — Quản trị Nền tảng (Platform Administration / Super Admin / UC-42)  
**Đối tượng tác nhân:** Quản trị viên Nền tảng (`Super Admin A6`)  
**Phiên bản:** `v1.0`

---

## 1. PHẠM VI & MỤC TIÊU KIỂM THỬ

1. **Zero-Trust Security & Tenant Isolation:** Đảm bảo Super Admin tuyệt đối không có backdoor đọc trộm nội dung nghiệp vụ của khách hàng, và người dùng thường không thể chạm tới API admin.
2. **Hiệu ứng Thác (Cascade Effect) khi Đình chỉ Workspace:** Khóa truy cập, ngắt kết nối WebSocket toàn bộ thành viên với mã 4403, từ chối mọi API gửi đến workspace bị khóa.
3. **Chế độ Bảo trì Toàn Hệ thống (System Maintenance Mode):** Middleware chặn toàn bộ request của người dùng thường với mã 503, nhưng cho phép Super Admin tiếp tục bảo trì.
4. **Ngắt mạch Chi phí FinOps AI & System Audit Log:** Tự động khóa gọi LLM khi vượt ngân sách toàn sàn; audit trail bất biến không thể sửa/xóa.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT

| Mã TC | Tên kịch bản kiểm thử | Các bước & Dữ liệu kiểm thử | Kết quả mong đợi (Expected Result) | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| **TC-ADMIN-01** | Đình chỉ một Workspace đang hoạt động (Cascade Suspension) | 1. Super Admin vào `/admin/workspaces`.<br>2. Chọn workspace "Demo Corp" và bấm "Đình chỉ".<br>3. Nhập lý do đình chỉ.<br>4. Quan sát client của Owner và Member. | Bảng `workspaces` đổi status thành SUSPENDED. Socket.io lập tức ngắt toàn bộ kết nối phòng workspace đó với mã 4403. UI người dùng hiển thị banner đỏ toàn trang. API trả về `403 WORKSPACE_SUSPENDED`. | **Blocker** |
| **TC-ADMIN-02** | Kích hoạt Chế độ Bảo trì Toàn Hệ thống (Maintenance Mode) | 1. Super Admin kích hoạt Maintenance Mode qua API `POST /admin/maintenance/toggle`.<br>2. User thông thường gọi API hoặc mở web. | Toàn bộ API hướng tới người dùng thường bị chặn ngay tại middleware với mã HTTP `503 Service Unavailable`, code `MAINTENANCE_MODE`. Super Admin vẫn thao tác bình thường tại `/admin`. | **Blocker** |
| **TC-ADMIN-03** | Khóa tài khoản Người dùng Toàn cục (Global Ban) | 1. Super Admin khóa tài khoản `bad_actor@test.com`.<br>2. User này cố tình gửi request API. | Token của user bị đưa vào blacklist. Mọi request trả về HTTP `403 Forbidden`, code `ACCOUNT_LOCKED`. Tất cả các phiên đăng nhập bị hủy. | **Critical** |
| **TC-ADMIN-04** | Ngắt mạch Chi phí AI (FinOps Circuit Breaker) | 1. Chi phí gọi AI toàn hệ thống chạm ngưỡng ngắt mạch $100/ngày.<br>2. Một PM ở bất kỳ workspace nào gọi AI phân rã. | Hệ thống tự động ngắt mạch, từ chối request với mã HTTP `503 AI_PROVIDER_UNAVAILABLE` kèm thông báo bảo trì dịch vụ AI để chống tràn chi phí API. | **Critical** |
| **TC-ADMIN-05** | Tính Bất biến của Nhật ký Kiểm toán (System Audit Trail) | 1. Super Admin thực hiện đình chỉ workspace hoặc đổi cấu hình.<br>2. Kiểm tra bản ghi trong `platform_audit_logs`.<br>3. Thử gọi API cập nhật hoặc xóa log. | Bản ghi audit log được tạo tự động với đầy đủ IP, admin_id, action, timestamp. Không tồn tại bất kỳ endpoint hoặc quyền nào cho phép sửa/xóa audit log. | **Critical** |
