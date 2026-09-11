# Lộ trình 12 tuần & quy chế học phần 841476

Trích từ "Kế hoạch Giảng dạy & Hướng dẫn Đồ án Chuyên ngành (841476) – 12 Tuần", GVHD ThS. Trần Đình Nghĩa. File gốc: `Downloads/Kế hoạch Giảng dạy Hướng dẫn Đồ án Chuyên ngành (841476) - 12 Tuần.pdf`.

## Cơ cấu điểm

| Thành phần | Tỷ trọng | Ghi chú |
|---|---|---|
| Chuyên cần & báo cáo tiến độ | 10% | Nộp tiến độ đúng hạn, commit Git đều đặn, thái độ nhóm |
| **Đề cương chi tiết** | **40%** | Chấm Tuần 03 (25/09/2026), thang 10 tiêu chí của Khoa |
| Quyển báo cáo tổng kết | 20% | 11 phần, Times New Roman 13, 60–120 trang, bìa kiếng |
| Chất lượng ứng dụng (demo) | 20% | Chạy online trên Cloud, nghiệp vụ cốt lõi không lỗi |
| Vấn đáp & thuyết trình cá nhân | 10% | Mỗi thành viên trình bày phần việc của mình |

## Thang 10 tiêu chí chấm đề cương (Tuần 03)

| # | Tiêu chí | Điểm | Mục đề cương đáp ứng |
|---|---|---|---|
| 1 | Nêu bật lý do chọn đề tài, phù hợp thực tế | 1.0 | Mục 1 |
| 2 | Nêu các giải pháp, nghiên cứu liên quan đã có | 1.0 | Mục 2 |
| 3 | Khoanh vùng đối tượng, phạm vi áp dụng rõ ràng | 1.0 | Mục 4 |
| 4 | Phương pháp nghiên cứu / triển khai phù hợp | 0.5 | Mục 5 |
| 5 | Nêu được điểm mới do nhóm thực hiện | 1.0 | Mục 6 |
| 6 | Kế hoạch thực hiện chi tiết, đầy đủ thông tin (12 tuần) | 1.0 | Mục 8 + WBS |
| 7 | Các chương dự kiến hợp lý, bao quát đủ nội dung | 1.0 | Mục 9 |
| 8 | Các chương tách biệt rõ ràng theo trình tự logic | 1.0 | Mục 9 |
| 9 | Danh mục tài liệu tham khảo (IEEE / APA) | 0.5 | Mục 10 |
| 10 | Trình bày đúng font, cỡ chữ, canh lề, bìa | **2.0** | Bản in: TNR 13, lề trái 3.5 / phải 2.0 / trên–dưới 2.5 cm, giãn dòng 1.3–1.5, bìa kiếng, không lỗi chính tả |

## Lộ trình

| Tuần | Thời gian | Nội dung | Sản phẩm / cột mốc |
|---|---|---|---|
| 01 | 11/09 – 17/09 | Giới thiệu CĐR, quy chế; lập nhóm 4–5 SV, bầu nhóm trưởng, chọn đề tài; khởi tạo Git repo, thảo luận phạm vi, viết nháp Mục 1–5 | Bản thảo đề cương v1 + DS nhóm |
| 02 | 18/09 – 24/09 | Phân rã WBS gán tên thành viên từng tuần, xác định điểm mới; hoàn thiện 10 mục đề cương; cài môi trường phát triển (IDE, Database Server, Git branching) | Đề cương chi tiết hoàn chỉnh (Draft 2) |
| 03 | 25/09 – 01/10 | GVHD góp ý, sửa logic, khoanh vùng phạm vi; chấm 10 tiêu chí; ký biên bản có % đóng góp | **Đề cương được duyệt (40% quá trình)** |
| 04 | 02/10 – 08/10 | Khảo sát hiện trạng, phỏng vấn quy trình tại cơ sở mẫu; vẽ BFD và BPMN; danh sách FR, NFR | Bản mô tả hiện trạng + bộ sơ đồ BFD |
| 05 | 09/10 – 15/10 | Use Case tổng quát & phân hệ; đặc tả 3–5 UC cốt lõi; Sequence cho chức năng phức tạp | Sơ đồ Use Case & Sequence mức 0 |
| 06 | 16/10 – 22/10 | ERD chuẩn 3NF; API Specification (Swagger/Postman); Wireframe/UI mockup | **Bộ hồ sơ thiết kế mức 0 hoàn chỉnh** |
| 07 | 23/10 – 29/10 | Cấu hình Backend (NestJS), kết nối CSDL; JWT + RBAC; giải thuật lõi | Backend API chạy ổn định, có Swagger |
| 08 | 30/10 – 05/11 | Frontend (Next.js) kết nối API; Realtime (Socket.io); chạy thử với mock data thực tế | **Báo cáo demo MVP với GVHD** — hết Tuần 8 phải có sản phẩm chạy được |
| 09 | 06/11 – 12/11 | Đóng băng tính năng; test cases, unit & integration test; Docker Compose; deploy Vercel/Render/Supabase | Link ứng dụng online + báo cáo test cases |
| 10 | 13/11 – 19/11 | Nạp dữ liệu thực tế kiểm nghiệm giải thuật (sai số, response time, test tải); viết Chương 1–3; ảnh minh chứng, từ điển dữ liệu | Bản thảo quyển báo cáo (Draft 1) |
| 11 | 20/11 – 26/11 | Rà soát bản in thử với GVHD; in 2 mặt, bìa kiếng, gộp đề cương đã duyệt ở Mục 3; dọn Git, README, video demo dự phòng; slide 15–20 trang | **Nộp 11h30 Thứ Hai 23/11/2026**: quyển in + PDF + link GitHub |
| 12 | 27/11 | Thuyết trình 10' → demo trực tiếp trên Cloud 10' → vấn đáp 10' (CSDL, race condition, lý do chọn công nghệ, thuật toán AI, % đóng góp) | Bảo vệ; áo sơ mi, có mặt trước 15', hotspot 4G + video dự phòng |

## Quy định kỷ luật tiến độ

- Nhóm **phải chủ động liên hệ GVHD** trong từng giai đoạn để được hướng dẫn chỉnh sửa; nhóm không liên hệ **không được nhận tiến độ và không được bảo vệ**.
- Kênh quản lý: GitHub repository (commit log thể hiện đóng góp từng thành viên theo tuần) + họp Google Meet/trực tiếp định kỳ.
- WBS phải ghi **họ tên người thực hiện** cho từng việc; không ghi "cả nhóm" cho tác vụ code/thiết kế.
- Biên bản nộp ghi rõ **% đóng góp** có chữ ký từng thành viên; điểm cá nhân tính theo % thực tế.
- **Feature freeze từ sau Tuần 8**: tuyệt đối không thêm tính năng mới; sai lầm cần tránh là code thêm sát ngày nộp làm hỏng demo.

## Cấu trúc quyển báo cáo (11 phần)

1. Trang bìa chính (giấy cứng, logo SGU) · 2. Biên bản chấm báo cáo · 3. **Đề cương chi tiết đã duyệt** · 4. Lời cam đoan · 5. Lời cảm ơn · 6. Mục lục · 7. Danh mục chữ viết tắt, bảng, hình · 8. Trang bìa phụ · 9. Nội dung Chương 1–5 · 10. Tài liệu tham khảo (IEEE/APA) · 11. Phụ lục.

Định dạng: Times New Roman 13; giãn dòng 1.3–1.5; lề trên 2.5, dưới 2.5, trái 3.5, phải 2.0 cm; justified; 60–120 trang; A4 in 2 mặt; đánh số bảng/hình theo chương (Hình 2.1, Bảng 3.2 có nguồn).
