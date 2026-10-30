# KẾ HOẠCH KIỂM THỬ: QUẢN LÝ DỰ ÁN (PROJECT MANAGER / PM TEST PLAN)

**Dự án:** Nền tảng Quản lý Công việc và Tải Thông minh SmartTask  
**Phân hệ mục tiêu:** Phân hệ 2 (Sprint & Task), Phân hệ 4 (Cân bằng tải & Giao việc), Phân hệ 5 (Trợ lý AI), Phân hệ 6 (Báo cáo & Dự báo)  
**Đối tượng tác nhân:** Quản lý dự án (Project Manager / `PM A4`)  
**Phiên bản:** `v1.0`

---

## 1. PHẠM VI & MỤC TIÊU KIỂM THỬ

1. **Vòng đời Sprint & Chống bấm lặp (UC-09 / SD-03):** Đảm bảo tính duy nhất của Sprint ACTIVE và giao dịch an toàn khi đóng sprint kèm `Idempotency-Key`.
2. **Hỗ trợ Giao việc & Bảng sự thật (UC-26, UC-39 / SD-06):** Backend cung cấp sự thật năng lực, LLM đề xuất, Validator chặn người quá tải (> 110%) hoặc đang nghỉ.
3. **AI Phân rã yêu cầu 2 tầng (UC-28 / SD-05):** Kiểm tra schema Zod, logic nghiệp vụ, lưu bản nháp `DRAFT`, áp dụng việc thật tuần tự.
4. **Dự báo Rủi ro & Giải thích AI (UC-30, UC-31 / SD-07):** Tính toán burn-down, vận tốc, ETA, AI giải thích nhất quán với mức rủi ro hệ thống.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT

| Mã TC | Tên kịch bản kiểm thử | Các bước & Dữ liệu kiểm thử | Kết quả mong đợi (Expected Result) | Mức độ |
| :--- | :--- | :--- | :--- | :--- |
| **TC-PM-01** | Khởi động Sprint khi đã có Sprint khác đang chạy | 1. Sprint 1 đang ACTIVE.<br>2. PM bấm Bắt đầu Sprint 2. | Server từ chối với mã HTTP `409 Conflict`, code `SPRINT_ALREADY_ACTIVE`. Mỗi dự án chỉ được phép có duy nhất 1 sprint ACTIVE. | **Critical** |
| **TC-PM-02** | Kết thúc Sprint chống bấm lặp bằng Idempotency-Key (SD-03) | 1. PM bấm "Kết thúc Sprint 1", chọn dời việc dở sang Backlog.<br>2. Mạng lag, PM bấm liên tiếp 2 lần. | Giao dịch chỉ thực hiện 1 lần duy nhất: Chụp snapshot số liệu cuối kỳ -> Dời task dở -> Đặt status CLOSED. Lần bấm 2 trả về kết quả cũ, không lỗi. | **Blocker** |
| **TC-PM-03** | Giao việc với Bảng sự thật năng lực (Không xếp hạng) | 1. PM mở combobox giao việc của task 12h.<br>2. Quan sát bảng thông tin ứng viên. | Hiển thị chính xác mức kỹ năng, số giờ trống trước hạn và % tải hiện tại. Tuyệt đối KHÔNG hiển thị điểm tổng hợp hay xếp hạng Top 1. | **Major** |
| **TC-PM-04** | AI Phân rã yêu cầu thành công việc (Two-pass Check - SD-05) | 1. PM nhập yêu cầu tính năng thanh toán QR.<br>2. Bấm "Phân rã bằng AI". | LLM trả về proposal qua kiểm tra Zod và logic thực tế. Bản nháp lưu trạng thái `DRAFT`. Task chưa xuất hiện trên Kanban cho tới khi PM bấm Áp dụng. | **Critical** |
| **TC-PM-05** | Chặn gợi ý AI phân công cho người quá tải (SD-06) | 1. Member Lan đang có mức tải 125%.<br>2. Nhờ AI giao task 8h. | `ActionValidator` chặn dòng đề xuất gán cho Lan với mã lỗi `ASSIGN_OVERLOAD`. Dòng này bị bôi đỏ trên giao diện, PM không thể chọn duyệt. | **Critical** |
| **TC-PM-06** | Dự báo Rủi ro Sprint và Tính Nhất quán của AI (SD-07) | 1. Sprint còn 2 ngày, còn 80h việc (Rủi ro HIGH).<br>2. PM bấm "Giải thích bằng AI". | AI nhận số liệu định lượng (không gửi dữ liệu nhạy cảm). Phản hồi của AI bắt buộc mang nhãn `HIGH` khớp với backend. Cache kết quả 6 giờ. | **Major** |
| **TC-PM-07** | Đánh giá chất lượng task khi hoàn thành (UC-36) | 1. Task vào Done.<br>2. PM chấm 5 sao, độ khó 4 cho member thực hiện. | Bản ghi `task_reviews` được tạo. Hệ thống ghi nhận 1 bằng chứng kỹ năng thành công cho người thực hiện, làm tăng mức kỹ năng thực tế. | **Minor** |
