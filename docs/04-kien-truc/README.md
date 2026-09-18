# 04 · Kiến trúc hệ thống & thiết kế AI — SmartTask

Bộ tài liệu kỹ thuật dùng chung cho hồ sơ thiết kế (Tuần 05–06) và cho lập trình (Tuần 07–08). Viết theo bộ `docs/ai-scheduling-architecture/` của dự án Lịch thông minh (Table_Calendar, VNPT TP.HCM) và dùng lại các cách làm đã chạy thật ở đó; chỗ nào tham chiếu mã nguồn bên ấy sẽ ghi đường dẫn `~/Table_Calendar/...`.

## Nguyên tắc chi phối toàn bộ phần AI

> **LLM suy luận. Backend chỉ tính và kiểm tra. Backend không được quyết định.**
>
> Đã xác nhận với nhóm (13/09/2026): mọi phép tính được backend **tính trước** rồi đưa vào ngữ cảnh cho LLM đọc; LLM không tự tính lại, chỉ cân nhắc và chọn.

| Backend được làm | Backend không được làm |
|---|---|
| Tính chỉ số: giờ còn lại, năng lực hiệu dụng, mức sử dụng, EAR, vận tốc, ngày hoàn thành dự kiến, giờ trống theo ngày, mức rủi ro theo ngưỡng cấu hình | Xếp hạng ứng viên, chấm "điểm phù hợp" tổng hợp rồi đưa top-N |
| Nạp ngữ cảnh 4 tầng (chính sách, sự thật, ý định, danh tính) từ DB mỗi lượt | Chạy bộ tối ưu xếp lịch, thuật toán chọn người hộ LLM |
| Kiểm tra đề xuất của LLM trên dữ liệu sống: quyền, tồn tại, năng lực còn đủ, ngày hợp lệ, phụ thuộc không vòng | Xếp hạng lại / thay người / thay giờ trong đề xuất của LLM; phân tích ý định bằng regex |
| Trả lỗi kiểm tra có số liệu để LLM (hoặc người) sửa | Âm thầm chọn phương án khác khi kiểm tra thất bại |
| Thực thi đúng service mà giao diện dùng, chỉ sau khi người xác nhận | Ghi dữ liệu trực tiếp từ đầu ra LLM |

Nguồn: `~/Table_Calendar/docs/ai-scheduling-architecture/01-target-architecture.md` ("Governing principle", "No backend pre-resolution pipeline"). Chi tiết áp dụng cho SmartTask: [05-ai-agent.md](05-ai-agent.md).

## Thứ tự đọc

| File | Nội dung | Dùng cho |
|---|---|---|
| [01-kien-truc-he-thong.md](01-kien-truc-he-thong.md) | Kiến trúc triển khai, tầng, quyết định công nghệ (ADR), realtime | Chương 2 mục 2.6; Tuần 07 |
| [02-module.md](02-module.md) | Danh sách module backend/frontend, trách nhiệm, sự kiện, phụ thuộc | Tuần 07–08, phân công WBS |
| [03-use-case.md](03-use-case.md) | 41 use case theo 7 phân hệ, đặc tả 4 UC trọng tâm | Tuần 05; Chương 2 mục 2.3–2.4 |
| [04-cong-thuc-tinh-toan.md](04-cong-thuc-tinh-toan.md) | Mọi công thức backend tính: tải, năng lực, burnout, EAR, vận tốc, giờ trống, công bằng | Tuần 07 (test đơn vị); Chương 3 |
| [05-ai-agent.md](05-ai-agent.md) | Ranh giới LLM/backend, prompt 4 tầng, structured action, hiển thị JSON, đoán mention, tạo task từ chat, giờ trống | Tuần 08; Chương 3 mục 3.5 |
| [06-tri-nho-ai.md](06-tri-nho-ai.md) | Trí nhớ cá nhân, trí nhớ sắp lịch/sắp việc/năng lực, thói quen: quyền sở hữu, vòng đời, cách vào prompt | Tuần 08 (Should) |
| [07-cache-va-chi-phi.md](07-cache-va-chi-phi.md) | Cắt prompt tĩnh/động, ba cơ chế cache, sổ token, tính tiền, hạn mức | Tuần 08–10; số liệu Chương 3 |
| [08-mo-hinh-du-lieu.md](08-mo-hinh-du-lieu.md) | ERD lõi + bảng AI/chat/lịch/lịch sử, ràng buộc SQL tay | Tuần 06 (ERD 3NF); Tuần 07 `schema.prisma` |
| [09-cong-nghe.md](09-cong-nghe.md) | Danh mục công nghệ theo lớp, phiên bản, lý do, thay thế; miễn phí ↔ doanh nghiệp; lệnh cài đặt Tuần 07 | Đề cương Mục 5; Chương 1.6; Tuần 07 |
| [10-quy-uoc-giao-dien.md](10-quy-uoc-giao-dien.md) | shadcn/ui là nguồn duy nhất: ba tầng component, cấm/bắt buộc, token, variant, ESLint chặn phần tử thô, thứ tự việc Frontend Lead | Tuần 06 mockup; Tuần 07–08 |
| [11-chot-chuc-nang-va-api.md](11-chot-chuc-nang-va-api.md) | **Bản chốt** phạm vi 3 mức (MVP 24 UC / làm nếu kịp theo thứ tự / không làm), quy ước API, 146 operation REST, sự kiện socket, mã lỗi | Đề cương Mục 4, 7; OpenAPI Tuần 06; controller Tuần 07 |
| [12-chat-phien-va-ban-nhap.md](12-chat-phien-va-ban-nhap.md) | Chat theo phiên: danh mục intent, bản nháp lưu server theo phiên (sửa nhiều lượt, duyệt từng phần → xanh lá), khoá chống lạc/chồng lượt, danh tính + chính sách chọn người, API S9, hợp đồng UI rail bản nháp | Backend Phase 8 (chat), màn Trợ lý AI |

## Quy ước

- Tên bảng `snake_case` số nhiều; mã UC `UC-nn`; sự kiện nội bộ `task.updated`; sự kiện socket `task:updated`.
- Sơ đồ viết bằng Mermaid ngay trong Markdown (VS Code: extension *Markdown Preview Mermaid Support*); xuất ảnh cho quyển báo cáo bằng mermaid.live.
- Mọi hằng số (ngưỡng, trọng số) là **tham số cấu hình workspace**, giá trị mặc định ghi trong [04-cong-thuc-tinh-toan.md](04-cong-thuc-tinh-toan.md).
