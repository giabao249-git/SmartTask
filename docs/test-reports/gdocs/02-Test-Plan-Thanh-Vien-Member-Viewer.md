# KẾ HOẠCH KIỂM THỬ: NHÓM THÀNH VIÊN & KHÁCH XEM (MEMBER & VIEWER TEST PLAN)

**Dự án:** Nền tảng Quản lý Công việc và Tải Thông minh SmartTask  
**Phân hệ mục tiêu:** Phân hệ 2 (Dự án & Task), Phân hệ 3 (Cộng tác Realtime), Phân hệ 4 (Kỹ năng cá nhân & Tải)  
**Đối tượng tác nhân:** Khách xem dự án (`Viewer A2`) & Thành viên thực hiện (`Member A3`)  
**Phiên bản:** `v1.0`

---

## 1. PHẠM VI & MỤC TIÊU KIỂM THỬ

1. **Ranh giới Read-only của Viewer:** Đảm bảo Viewer chỉ xem được dữ liệu (Gantt, Kanban, Backlog, Dashboard), không thể sửa hay kéo thả thẻ.
2. **Kéo thả Kanban & Khóa lạc quan (UC-12 / SD-02):** Kiểm định tính mượt mà dnd-kit, xử lý xung đột `version` 409, giới hạn WIP 422.
3. **Cộng tác Thời gian thực (UC-17, UC-18, UC-19):** Socket.io phòng `project:{id}`, bình luận `@mention`, tải tệp đính kèm.
4. **Xem tải cá nhân & Khai báo kỹ năng (UC-22, UC-24, UC-37):** Thành viên chỉ xem tải của chính mình, bảo mật thông tin cá nhân.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT

| Mã TC | Tên kịch bản kiểm thử | Các bước & Dữ liệu kiểm thử | Kết quả mong đợi (Expected Result) | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| **TC-MEM-01** | Kéo thả thẻ chuyển cột Kanban có kiểm tra WIP | 1. Member kéo task ST-10 vào cột "In Progress".<br>2. Cột "In Progress" có wipLimit = 3, hiện đang có 2 task. | Thẻ chuyển cột thành công, version tăng lên 1 đơn vị. Sự kiện `task:moved` phát tới phòng realtime của dự án. Snapshot tải được tính lại sau 500ms. | **Major** |
| **TC-MEM-02** | Vượt giới hạn WIP của cột (422 WIP_LIMIT_EXCEEDED) | 1. Cột "Review" có wipLimit = 2, hiện đang đủ 2 task.<br>2. Member kéo thêm 1 task vào cột "Review". | Server trả về mã HTTP `422 Unprocessable Entity`, code `WIP_LIMIT_EXCEEDED`. Giao diện hoàn tác thẻ về cột cũ và hiển thị thông báo số lượng việc tối đa. | **Major** |
| **TC-MEM-03** | Xung đột phiên bản khi cập nhật task đồng thời (409 Conflict) | 1. Member A mở modal sửa task ST-05 (version 2).<br>2. Member B chuyển trạng thái task ST-05 (version lên 3).<br>3. Member A bấm Lưu mô tả. | Server trả về HTTP `409 Conflict`, code `TASK_VERSION_CONFLICT`. Giao diện cảnh báo: "Dữ liệu vừa được người khác cập nhật", tự động tải lại dữ liệu mới. | **Critical** |
| **TC-MEM-04** | Bình luận Markdown và Nhắc tên (@mention) | 1. Mở task ST-08.<br>2. Nhập bình luận: "Nhờ `@Lan` kiểm tra giúp PR này nhé".<br>3. Bấm Gửi. | Bình luận hiển thị định dạng markdown chuẩn. User Lan nhận thông báo realtime trong phòng cá nhân `user:{lan_id}` và tăng badge chưa đọc. | **Minor** |
| **TC-MEM-05** | Tải lên tệp đính kèm vượt quá 10MB | 1. Chọn đính kèm tệp video nặng 14.5MB vào task ST-08. | Client chặn ngay từ giao diện hoặc server từ chối cấp signed URL với mã `400 ATTACHMENT_TOO_LARGE`. Tệp không được đẩy lên Supabase Storage. | **Major** |
| **TC-MEM-06** | Bảo mật dữ liệu Tải cá nhân (Privacy Isolation) | 1. Member Minh mở trang Tải công việc `/workload`.<br>2. Thử truy cập API tải của thành viên khác `GET /users/lan_id/workload/details`. | Minh chỉ xem được biểu đồ và task cấu thành tải của chính mình. Gọi API của người khác bị trả về HTTP `403 FORBIDDEN`. | **Critical** |
| **TC-VIEW-01** | Viewer cố tình thực hiện thao tác kéo thả hoặc sửa task | 1. Đăng nhập tài khoản Viewer.<br>2. Kéo thả task trên bảng hoặc gọi API `PATCH /tasks/ST-01/move`. | Thẻ task không có handle kéo thả. Gửi request trực tiếp nhận HTTP `403 FORBIDDEN`. Bảng Kanban ở trạng thái hoàn toàn Read-only. | **Critical** |
