# Phạm vi đề tài — kết quả thảo luận Tuần 01

> Bản chốt chi tiết hơn (ba mức, thứ tự làm-nếu-kịp, danh mục API): [docs/04-kien-truc/11-chot-chuc-nang-va-api.md](../04-kien-truc/11-chot-chuc-nang-va-api.md).

Tài liệu này chốt "làm gì / không làm gì" để viết Mục 4 của đề cương và làm căn cứ khi GVHD khoanh vùng phạm vi ở Tuần 03. Chi tiết 41 use case (bảng chuyển đổi chức năng → UC) nằm trong Hồ sơ kiến trúc SmartTask (bản trực tuyến); ở đây chỉ giữ mức chốt phạm vi.

## 1. Bài toán

Nhóm dự án phần mềm quy mô 5–30 người phân việc theo cảm tính: không biết ai đang quá tải, ai có kỹ năng phù hợp; yêu cầu lớn không được bóc tách thành việc đo được, nên trễ hạn chỉ lộ ra khi đã muộn. Các công cụ phổ biến (Jira, Trello, Asana) ở gói miễn phí không có biểu đồ tải nhân sự, không có ma trận kỹ năng, không có AI phân rã việc.

## 2. Sản phẩm bàn giao (theo đề bài)

Ứng dụng web chạy thực tế trên Cloud miễn phí; luồng kéo thả Kanban realtime mượt; demo thành công AI phân rã việc và biểu đồ đo tải nhân sự.

## 3. Phạm vi chức năng theo MoSCoW

### Must — bắt buộc cho MVP (Tuần 08) và nghiệm thu

| Phân hệ | Chức năng |
|---|---|
| A. Nền tảng | Đăng ký, đăng nhập JWT, hồ sơ cá nhân; workspace, mời/gỡ thành viên, vai trò OWNER/ADMIN/MEMBER/VIEWER; danh mục kỹ năng |
| B. Dự án & công việc | Dự án, sprint/phase; task với ưu tiên, nhãn, hạn, ước lượng giờ, kỹ năng yêu cầu, người thực hiện; subtask; Kanban kéo thả có WIP limit; danh sách & bộ lọc; Gantt **chỉ đọc** |
| C. Cộng tác realtime | Đồng bộ trạng thái task cho mọi người đang mở dự án (Socket.io); bình luận có @mention; đính kèm tệp; trung tâm thông báo trong ứng dụng |
| D. Kỹ năng & tải | Khai báo kỹ năng cá nhân mức 1–5; heatmap kỹ năng nhóm; tính giờ còn lại theo tuần so với năng lực; cảnh báo Cao / Đầy / Quá tải và điểm nguy cơ burnout |
| E. Trợ lý AI | Phân rã yêu cầu thành task + subtask + ước lượng + kỹ năng (structured output, người xác nhận trước khi tạo); burn-down sprint; dự báo ngày hoàn thành và mức rủi ro trễ hạn, AI giải thích |
| F. Báo cáo | Dashboard dự án (trạng thái, quá hạn, tải nhóm, burn-down thu nhỏ) |

### Should — làm trước feature freeze (12/11) nếu nền vững

Năng lực giờ/tuần và ngày nghỉ; Gantt kéo giãn; ma trận Eisenhower; nhật ký hoạt động; Web Push; gợi ý người thực hiện theo kỹ năng × tải; nhật ký & hạn mức gọi AI; giờ làm thực tế; đánh giá task sau hoàn thành; kết nối lịch bận (ICS / nhập tay); chat với trợ lý AI theo phiên; AI đề xuất phân công & lịch làm; quản trị cấu hình AI.

### Could — ghi vào "hướng phát triển"

Cân bằng lại tải bằng kéo thả trên biểu đồ; AI ước lượng lại task có sẵn; xuất báo cáo CSV/PDF; check-in tuần; adapter lịch Table_Calendar.

### Won't — ngoài phạm vi 12 tuần

Ứng dụng di động, offline; SSO/LDAP, OAuth; tích hợp Google Calendar/Slack/GitHub; time tracking theo thời gian thực; workflow engine tuỳ biến; đa ngôn ngữ; thanh toán/gói dịch vụ; huấn luyện mô hình học máy riêng; Datadog, Pusher, AWS RDS (chỉ nêu như phương án doanh nghiệp).

## 4. Phạm vi kỹ thuật & dữ liệu

- Web, tối ưu cho Chrome desktop ≥ 1024 px; giao diện tiếng Việt.
- Hạ tầng miễn phí: Vercel (web), Render (API), Supabase (PostgreSQL + Storage), Gemini API free tier.
- Dữ liệu: dữ liệu mẫu do nhóm tạo (2 dự án, 6 người, ~80 task, 3 tuần lịch sử) + dữ liệu khảo sát ẩn danh ở Tuần 04. Không lưu dữ liệu cá nhân thật ngoài email tài khoản.
- Realtime chứng minh với 3 trình duyệt đồng thời; AI phân rã trả kết quả ≤ 15 giây.

## 5. Ràng buộc

12 tuần; 4–5 sinh viên; feature freeze sau Tuần 08; nộp 11h30 23/11/2026; bảo vệ 27/11/2026; mã nguồn công khai trên GitHub khi nộp.

## 6. Câu hỏi cần chốt với GVHD (Tuần 02–03)

1. Đơn vị ước lượng là **giờ** (đề xuất) hay story point?
2. Gantt chỉ đọc có được chấp nhận là hoàn thành yêu cầu "Gantt Chart động" không, hay bắt buộc kéo giãn?
3. Realtime bằng Socket.io (theo Tuần 08 của lộ trình) — có chấp nhận Supabase Realtime làm phương án thay thế không?
4. Đề bài ghi Gemini 1.5 Flash (đã ngừng phục vụ) — dùng Gemini 2.5 Flash; có cần demo thêm Ollama chạy cục bộ?
5. Đối tượng khảo sát hiện trạng Tuần 04: nhóm phát triển tại doanh nghiệp (dự kiến một nhóm tại VNPT TP.HCM qua quan hệ của thành viên — cần xác nhận) hay nhóm sinh viên làm đồ án?
