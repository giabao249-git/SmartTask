# WBS 12 tuần — gán người thực hiện

> Thay «TV1»…«TV5» bằng **họ tên thật** trước khi nộp (quy định: không ghi "cả nhóm" cho tác vụ code/thiết kế). Nhóm 4 người: việc của «TV5» chuyển sang «TV2» (hạ tầng, CI) và «TV4» (kiểm thử).
> Bám đúng lộ trình học phần: Tuần 1–6 hồ sơ, Tuần 7–8 lập trình, sau Tuần 8 đóng băng tính năng.

Vai trò: «TV1» Nhóm trưởng / PM & BA · «TV2» Backend Lead · «TV3» Frontend Lead · «TV4» Realtime & AI · «TV5» DevOps & QA.

## Giai đoạn 1 — Khởi tạo & Đề cương (Tuần 01–03)

| Mã | Công việc | Người thực hiện | Bắt đầu | Kết thúc | Sản phẩm | Phụ thuộc |
|---|---|---|---|---|---|---|
| W1.1 | Lập nhóm, bầu nhóm trưởng, đăng ký đề tài 01 với GVHD | «TV1» | 11/09 | 12/09 | DS nhóm | — |
| W1.2 | Khởi tạo Git repo, cấu trúc thư mục, quy tắc nhánh/commit/PR | «TV2» | 11/09 | 13/09 | Repo + `quy-tac-git.md` | W1.1 |
| W1.3 | Họp thảo luận phạm vi, chốt MoSCoW, câu hỏi cho GVHD | «TV1» chủ trì | 12/09 | 14/09 | `pham-vi-de-tai.md` | W1.1 |
| W1.4 | Nháp đề cương Mục 1 (lý do), Mục 3–4 (mục tiêu, phạm vi) | «TV1» | 13/09 | 17/09 | Đề cương v1 | W1.3 |
| W1.5 | Nháp Mục 2 (giải pháp & nghiên cứu liên quan) — khảo sát Jira/Trello/Asana/Linear/ClickUp | «TV4» | 13/09 | 17/09 | Bảng so sánh sản phẩm | — |
| W1.6 | Nháp Mục 5 (phương pháp) | «TV2» | 14/09 | 17/09 | Đề cương v1 | W1.3 |
| W2.1 | Lập WBS 12 tuần gán tên, ước lượng công sức | «TV1» | 18/09 | 19/09 | `wbs-12-tuan.md` | W1.3 |
| W2.2 | Mục 6 điểm mới (AI + tải + kỹ năng) | «TV4» | 18/09 | 20/09 | Đề cương Draft 2 | W1.5 |
| W2.3 | Mục 7 kết quả dự kiến, Mục 9 bố cục 5 chương | «TV3» (7), «TV1» (9) | 18/09 | 20/09 | Đề cương Draft 2 | W2.1 |
| W2.4 | Mục 10 tài liệu tham khảo chuẩn IEEE | «TV5» | 18/09 | 21/09 | Đề cương Draft 2 | W1.5 |
| W2.5 | Môi trường: Docker PostgreSQL, `.env.example`, Makefile | «TV5» | 18/09 | 21/09 | `infra/` | W1.2 |
| W2.6 | Môi trường: cấu hình IDE, nhánh `develop`, CI khung, branch protection | «TV2» | 18/09 | 21/09 | `.github/`, `.vscode/` | W1.2 |
| W2.7 | Dàn trang bản in đề cương (TNR 13, lề, bìa) | «TV3» | 21/09 | 23/09 | File .docx/.pdf | W2.2–W2.4 |
| W2.8 | Gửi Draft 2 cho GVHD, đặt lịch góp ý; biên bản | «TV1» | 23/09 | 24/09 | Biên bản | W2.7 |
| W3.1 | Trình bày đề cương, tiếp thu góp ý (mọi thành viên có mặt) | «TV1» trình bày | 25/09 | 25/09 | Ghi chú góp ý | W2.8 |
| W3.2 | Sửa đề cương theo góp ý, khoanh vùng lại phạm vi | «TV1», «TV4» | 26/09 | 29/09 | Đề cương được duyệt | W3.1 |
| W3.3 | In, ký biên bản đánh giá đề cương có % đóng góp | «TV3» | 29/09 | 01/10 | Biên bản có chữ ký | W3.2 |
| W3.4 | Bảng câu hỏi khảo sát; liên hệ đơn vị khảo sát và 2–3 nhóm sinh viên | «TV1», «TV5» | 26/09 | 01/10 | Bảng hỏi, lịch phỏng vấn | W3.1 |

## Giai đoạn 2 — Phân tích & Thiết kế mức 0 (Tuần 04–06)

| Mã | Công việc | Người thực hiện | Bắt đầu | Kết thúc | Sản phẩm | Phụ thuộc |
|---|---|---|---|---|---|---|
| W4.1 | Phỏng vấn 2–3 quản lý và 4–6 thành viên; ghi biên bản, tổng hợp pain point | «TV1», «TV5» | 02/10 | 05/10 | Biên bản khảo sát | W3.4 |
| W4.2 | Bản mô tả hiện trạng AS-IS và mong muốn TO-BE | «TV1» | 05/10 | 08/10 | `02-phan-tich/hien-trang.md` | W4.1 |
| W4.3 | Sơ đồ phân rã chức năng BFD (6 phân hệ) | «TV2» | 04/10 | 07/10 | BFD | W4.1 |
| W4.4 | BPMN luồng giao việc, theo dõi tải AS-IS / TO-BE | «TV4» | 04/10 | 08/10 | BPMN | W4.1 |
| W4.5 | Bảng yêu cầu chức năng (FR) phân loại theo mẫu; bảng chức năng → use case | «TV3» | 05/10 | 08/10 | Bảng FR | W4.2 |
| W4.6 | Yêu cầu phi chức năng (NFR) đo được | «TV5» | 06/10 | 08/10 | Bảng NFR | W4.2 |
| W5.1 | Use Case tổng quát + 6 sơ đồ phân hệ | «TV3» | 09/10 | 12/10 | Sơ đồ UC | W4.5 |
| W5.2 | Đặc tả UC-28 AI phân rã, UC-31 dự báo rủi ro | «TV4» | 09/10 | 13/10 | Đặc tả UC | W5.1 |
| W5.3 | Đặc tả UC-12/17 Kanban realtime | «TV2» | 09/10 | 13/10 | Đặc tả UC | W5.1 |
| W5.4 | Đặc tả UC-24/25 tính tải & cảnh báo; UC-10 công việc | «TV1» (24/25), «TV5» (10) | 09/10 | 13/10 | Đặc tả UC | W5.1 |
| W5.5 | Sequence: đăng nhập, tạo task, kéo thả realtime | «TV2» | 12/10 | 15/10 | Sequence | W5.3 |
| W5.6 | Sequence: AI phân rã, tính tải, burn-down | «TV4» | 12/10 | 15/10 | Sequence | W5.2 |
| W5.7 | Tổng hợp, rà soát chéo, gửi GVHD | «TV1» | 15/10 | 15/10 | Bộ UC & Sequence mức 0 | W5.2–W5.6 |
| W6.1 | ERD chuẩn 3NF (27 bảng lõi) + từ điển dữ liệu | «TV2» | 16/10 | 20/10 | ERD, từ điển | W5.7 |
| W6.2 | OpenAPI 3: auth, workspace, project, task | «TV2» | 18/10 | 21/10 | `openapi.yaml` | W6.1 |
| W6.3 | OpenAPI 3: workload, AI, sự kiện socket | «TV4» | 18/10 | 21/10 | `openapi.yaml` | W6.1 |
| W6.4 | OpenAPI 3: notifications, attachments; Postman collection | «TV5» | 18/10 | 21/10 | Postman | W6.1 |
| W6.5 | Wireframe/mockup 8 màn hình chính (Figma) | «TV3» | 16/10 | 21/10 | Mockup | W5.1 |
| W6.6 | Kế hoạch kiểm thử (phạm vi, loại test, tiêu chí đạt) | «TV5» | 19/10 | 22/10 | Test plan | W4.6 |
| W6.7 | Tổng hợp bộ hồ sơ thiết kế mức 0, gửi GVHD, biên bản | «TV1» | 22/10 | 22/10 | **Hồ sơ mức 0** | W6.1–W6.6 |

## Giai đoạn 3 — Core Backend & Demo MVP (Tuần 07–08)

| Mã | Công việc | Người thực hiện | Bắt đầu | Kết thúc | Sản phẩm | Phụ thuộc |
|---|---|---|---|---|---|---|
| W7.1 | Khởi tạo monorepo, NestJS + Prisma, kết nối Supabase, `schema.prisma` từ ERD, seed | «TV2» | 23/10 | 24/10 | API chạy, migrate được | W6.1 |
| W7.2 | Auth JWT (access/refresh), RBAC guards — UC-01, 02, 03 | «TV2» | 24/10 | 26/10 | API + Swagger | W7.1 |
| W7.3 | Workspace, thành viên, lời mời, danh mục kỹ năng — UC-04, 05, 06 | «TV5» | 24/10 | 27/10 | API | W7.1 |
| W7.4 | Dự án, sprint, task, subtask, move có version — UC-08, 09, 10, 11, 15 | «TV2» | 26/10 | 29/10 | API | W7.2 |
| W7.5 | WorkloadCalculator + burn-down/forecast thuần, test đơn vị ≥ 12 ca — UC-24, 25, 30, 31 (lõi) | «TV4» | 23/10 | 28/10 | Module + test | W6.3 |
| W7.6 | Next.js + shadcn/ui, token giao diện, AppShell, trang đăng nhập/đăng ký | «TV3» | 23/10 | 27/10 | Web skeleton | W6.5 |
| W7.7 | Swagger đầy đủ, CI lint/test/build, deploy API lên Render + Supabase lần đầu | «TV5» | 27/10 | 29/10 | Link API online | W7.2 |
| W8.1 | Kanban dnd-kit, danh sách & bộ lọc, chi tiết task (Sheet) — UC-12, 15, 10 (FE) | «TV3» | 30/10 | 03/11 | Giao diện | W7.4 |
| W8.2 | Socket.io gateway + client, optimistic update, xử lý 409 — UC-17 | «TV4» | 30/10 | 02/11 | Realtime | W7.4 |
| W8.3 | Bình luận @mention, đính kèm, thông báo — UC-18, 19, 20 | «TV5» (API), «TV3» (FE) | 31/10 | 04/11 | Tính năng | W7.4 |
| W8.4 | AI phân rã (Gemini structured output, validator, xem trước) — UC-28; API burn-down/forecast + AI giải thích — UC-30, 31 | «TV4» | 01/11 | 05/11 | Tính năng | W7.5 |
| W8.5 | Ma trận kỹ năng, biểu đồ tải, cảnh báo trên Kanban, dashboard, Gantt chỉ đọc — UC-22, 23, 24, 25, 33, 13 (FE) | «TV3» (FE), «TV2» (API) | 02/11 | 05/11 | Tính năng | W7.5 |
| W8.6 | Deploy web lên Vercel; dữ liệu mock thực tế; kịch bản demo; **Báo cáo demo MVP với GVHD** | «TV1», «TV5» | 04/11 | 05/11 | **MVP online** | W8.1–W8.5 |
| W8.7 | Should-UC nếu còn thời gian trong Tuần 08 (Eisenhower, Web Push, gợi ý người làm) — sau Tuần 08 không thêm | «TV3», «TV4» | 04/11 | 05/11 | — | W8.1 |

## Giai đoạn 4 — Hoàn tất, nộp, bảo vệ (Tuần 09–12)

| Mã | Công việc | Người thực hiện | Bắt đầu | Kết thúc | Sản phẩm | Phụ thuộc |
|---|---|---|---|---|---|---|
| W9.1 | Đóng băng tính năng; phân loại lỗi, ưu tiên sửa | «TV1» | 06/11 | 06/11 | Danh sách lỗi | W8.6 |
| W9.2 | Test cases theo UC; unit + integration (Jest/Supertest); E2E một luồng vàng (Playwright) | «TV5» điều phối; mỗi dev viết test module mình | 06/11 | 11/11 | Báo cáo test cases | W9.1 |
| W9.3 | Docker Compose đóng gói; deploy chính thức, domain công khai; keep-alive Render, ping Supabase | «TV5» | 07/11 | 10/11 | Link ứng dụng online | W8.6 |
| W9.4 | Sửa lỗi theo ưu tiên, tối ưu tải trang, xử lý ca ngoại lệ | «TV2», «TV3», «TV4» | 07/11 | 12/11 | Bản ổn định | W9.1 |
| W10.1 | Nạp dữ liệu thực tế; đo độ trễ realtime, API p95, thời gian & tỷ lệ hợp lệ AI, sai số ước lượng, k6 20 VU | «TV4» | 13/11 | 16/11 | Bảng số liệu thực nghiệm | W9.3 |
| W10.2 | Chương 1 Tổng quan; Chương 5 Kết luận | «TV1» | 13/11 | 18/11 | Bản thảo | W4.2 |
| W10.3 | Chương 2 Phân tích & thiết kế (UC, ERD, API, UI) | «TV2», «TV3» | 13/11 | 18/11 | Bản thảo | W6.7 |
| W10.4 | Chương 3 Hiện thực & kết quả; Chương 4 Kiểm thử & triển khai | «TV4» (3), «TV5» (4) | 14/11 | 19/11 | Bản thảo | W10.1 |
| W10.5 | Ảnh minh chứng giao diện, từ điển dữ liệu, danh mục hình/bảng | «TV3», «TV2» | 16/11 | 19/11 | Phụ lục | W10.3 |
| W11.1 | Rà soát bản in thử với GVHD (trước 23/11) | «TV1» | 20/11 | 21/11 | Góp ý cuối | W10.2–W10.5 |
| W11.2 | In 2 mặt, bìa kiếng, gộp đề cương đã duyệt vào Mục 3 | «TV3» | 21/11 | 22/11 | Quyển in | W11.1 |
| W11.3 | Dọn Git, README cài đặt, tag `v1.0.0`, video demo dự phòng | «TV2», «TV5» | 20/11 | 22/11 | Repo sạch, video | W9.4 |
| W11.4 | Slide 15–20 trang; mỗi thành viên soạn phần việc của mình | «TV1» tổng hợp | 20/11 | 24/11 | Slide | W10.4 |
| W11.5 | **Nộp 11h30 Thứ Hai 23/11**: quyển in + PDF + link GitHub | «TV1» | 23/11 | 23/11 | Biên bản nộp | W11.2 |
| W11.6 | Diễn tập demo 2 lần trên Cloud thật, kịch bản 10 phút | «TV4» | 24/11 | 26/11 | Kịch bản chốt | W11.3 |
| W12.1 | Đánh thức Render 30' trước; hotspot 4G; kiểm tra máy chiếu | «TV5» | 27/11 | 27/11 | — | W11.6 |
| W12.2 | Bảo vệ: thuyết trình 10' → demo 10' → vấn đáp 10' | Từng thành viên trình bày phần mình | 27/11 | 27/11 | Điểm | W12.1 |

## Ước lượng công sức (giờ/người/tuần ≈ 10–12 giờ ngoài giờ học)

| Giai đoạn | Tuần | Giờ ước lượng | Ghi chú |
|---|---|---|---|
| Khởi tạo & đề cương | 1–3 | 90 | Trọng tâm «TV1» |
| Phân tích & thiết kế | 4–6 | 150 | Chia đều 5 người |
| Backend & MVP | 7–8 | 200 | Cao điểm; mỗi người 20 giờ/tuần |
| Hoàn tất & bảo vệ | 9–12 | 160 | Test, số liệu, báo cáo |

**Rủi ro lịch:** 24 use case bắt buộc phải xong trong Tuần 07–08 (hai tuần) vì feature freeze sau Tuần 08. Nhóm sẽ xin ý kiến GVHD ở Tuần 03 về việc dựng khung mã nguồn (skeleton, auth) song song từ Tuần 05–06; nếu không được, thu hẹp MVP về các UC in đậm trong `pham-vi-de-tai.md`.
