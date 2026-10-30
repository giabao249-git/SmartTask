# KẾ HOẠCH KIỂM THỬ: QUẢN TRỊ WORKSPACE (WORKSPACE ADMIN TEST PLAN)

**Dự án:** Nền tảng Quản lý Công việc và Tải Thông minh SmartTask  
**Phân hệ mục tiêu:** Phân hệ 1 (Quản trị Workspace, Thành viên, Danh mục Kỹ năng, Cấu hình AI)  
**Đối tượng tác nhân:** Quản trị viên / Chủ sở hữu Workspace (`Owner / Admin A5`)  
**Phiên bản:** `v1.0`

---

## 1. PHẠM VI & MỤC TIÊU KIỂM THỬ

1. **Vòng đời & Toàn vẹn Workspace (UC-04, UC-05):** Kiểm tra tính duy nhất của slug, ràng buộc không thể rời workspace nếu là Owner cuối (`LAST_OWNER`).
2. **Quản trị Kỹ năng & Gộp trùng lặp (UC-06):** Kiểm định tính toàn vẹn dữ liệu khi gộp 2 kỹ năng và chuyển đổi alias.
3. **Quản trị Cấu hình & Ngân sách AI (UC-40, UC-32):** Bảo mật khóa API với mã hóa AES-256, quản lý hạn mức gọi token theo người dùng.
4. **Theo dõi Ma trận Kỹ năng & Bus Factor (UC-23):** Phát hiện nguy cơ thiếu hụt nhân sự khi kỹ năng trọng yếu chỉ có 1 người đảm nhiệm.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT

| Mã TC | Tên kịch bản kiểm thử | Các bước & Dữ liệu kiểm thử | Kết quả mong đợi (Expected Result) | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| **TC-WS-01** | Rời Workspace khi là Owner duy nhất (Ràng buộc toàn vẹn) | 1. Workspace chỉ có 1 Owner duy nhất.<br>2. Owner bấm "Rời khỏi Workspace". | Hệ thống từ chối với mã HTTP `400 Bad Request`, code `LAST_OWNER`. Yêu cầu chuyển quyền Owner cho thành viên khác trước khi rời. | **Critical** |
| **TC-WS-02** | Gộp kỹ năng trùng lặp và chuyển đổi bí danh (Alias) | 1. Có 2 kỹ năng: `ReactJS` (có 5 task) và `React` (chuẩn).<br>2. Admin thực hiện gộp `ReactJS` vào `React`. | Toàn bộ liên kết task_skills của `ReactJS` được trỏ về `React`. Kỹ năng `ReactJS` bị xóa và trở thành alias của `React`. Không mất mát dữ liệu. | **Major** |
| **TC-WS-03** | Lưu API Key AI khi chưa cấu hình khóa mã hóa APP_KEY | 1. Server thiếu biến môi trường `APP_KEY`.<br>2. Admin nhập API key Gemini và bấm Lưu. | Server từ chối lưu để tránh lộ khóa dưới dạng plain-text, trả về mã HTTP `500 Internal`, code `AI_KEY_ENCRYPTION_MISSING`. | **Blocker** |
| **TC-WS-04** | Vượt hạn mức Token AI trong ngày của Workspace | 1. Admin đặt quota 50,000 tokens/ngày.<br>2. Tổng token gọi trong ngày đạt 50,050 tokens.<br>3. User gọi AI tiếp theo. | API chặn request với mã HTTP `429 Too Many Requests`, code `AI_QUOTA_EXCEEDED` kèm thời gian mở lại vào 00:00 ngày hôm sau. | **Major** |
| **TC-WS-05** | Cảnh báo Bus Factor = 1 trong Ma trận Kỹ năng | 1. Mở trang Ma trận kỹ năng nhóm.<br>2. Kỹ năng "DevOps" chỉ có đúng 1 người đạt Level ≥ 3. | Hệ thống hiển thị huy hiệu cảnh báo vàng: "Bus Factor = 1: Rủi ro phụ thuộc vào nhân sự duy nhất". | **Minor** |
| **TC-WS-06** | Gỡ thành viên đang phụ trách công việc mở trong dự án | 1. Member Lan đang có 3 task In Progress.<br>2. Admin thực hiện gỡ Lan khỏi workspace. | Lan bị xóa khỏi danh sách thành viên. Các task được tự động bỏ người được giao (unassigned) hoặc giữ nguyên kèm cờ cảnh báo, tải nhóm tính lại. | **Major** |
