# ĐỀ CƯƠNG CHI TIẾT ĐỒ ÁN CHUYÊN NGÀNH

**Tên đề tài (tiếng Việt):** Xây dựng nền tảng quản trị dự án thông minh và cân bằng tải nhân sự tích hợp AI Agent (SmartTask)
**Tên đề tài (tiếng Anh):** Smart Task & Workload Management Platform with AI Agent
**Học phần:** Đồ án Chuyên ngành — 841476 (04 tín chỉ) · Ngành Công nghệ Thông tin & Kỹ thuật Phần mềm
**Giảng viên hướng dẫn:** ThS. Trần Đình Nghĩa — Khoa CNTT, Trường ĐH Sài Gòn
**Nhóm thực hiện:** «TV1» (nhóm trưởng), «TV2», «TV3», «TV4», «TV5» — xem `danh-sach-nhom.md`
**Thời gian thực hiện:** 12 tuần, 11/09/2026 – 27/11/2026

> Phiên bản: **v1 — Tuần 01 (11/09/2026)** — hoàn thành Mục 1–5; Mục 6–10 hoàn thiện ở Tuần 02.
> Bản in nộp Tuần 02–03 định dạng theo tiêu chí 10: Times New Roman 13, giãn dòng 1.3–1.5, lề trên/dưới 2.5 cm, trái 3.5 cm, phải 2.0 cm, bìa kiếng.

---

## 1. Lý do chọn đề tài

Trong các nhóm phát triển phần mềm quy mô nhỏ và vừa (5–30 người) — phòng phát triển của doanh nghiệp, đội dự án thuê ngoài, nhóm khởi nghiệp, nhóm sinh viên làm đồ án — việc phân công công việc phần lớn dựa vào cảm nhận của người quản lý: ai "có vẻ rảnh", ai "làm nhanh". Hệ quả thường thấy là một vài thành viên gánh phần lớn khối lượng trong khi số khác ít việc; yêu cầu lớn không được bóc tách thành các đầu việc đo được nên tiến độ chỉ được nhận ra là chậm khi đã sát hạn. Nghiên cứu của Maslach và Leiter [1] chỉ ra quá tải kéo dài là yếu tố hàng đầu dẫn đến kiệt sức (burnout), làm giảm chất lượng công việc trước khi làm giảm tiến độ; Brooks [2] từ lâu cũng chỉ ra rằng thêm người vào dự án đang trễ không giải quyết được vấn đề nếu việc không được phân rã và phân bổ đúng.

Các công cụ quản lý dự án phổ biến như Jira, Trello, Asana đã số hoá tốt quy trình Kanban/Scrum, nhưng ở gói miễn phí — mức mà nhóm nhỏ thực sự dùng — không có biểu đồ tải nhân sự, không có ma trận kỹ năng gắn với giao việc, và tính năng AI phân rã việc chỉ có ở gói trả phí (Atlassian Intelligence, Asana AI, ClickUp Brain) [3]–[5]. Khoảng trống này đúng là chỗ một đồ án có thể đóng góp: kết hợp quy trình Agile/Kanban thời gian thực với (a) mô hình đo tải theo giờ có tính đến kỹ năng và lịch sử làm việc, và (b) một tác nhân AI phân rã yêu cầu thành công việc kèm ước lượng, có người xác nhận trước khi ghi dữ liệu.

Về mặt công nghệ, thời điểm hiện tại cho phép làm điều đó với chi phí bằng không: các mô hình ngôn ngữ lớn (Gemini Flash) đã hỗ trợ đầu ra có cấu trúc (JSON schema) đủ tin cậy để tích hợp vào nghiệp vụ [6]; các nền tảng Vercel, Render, Supabase cung cấp gói miễn phí đủ để triển khai một ứng dụng web ba tầng chạy thật trên Internet; NestJS, Next.js, Socket.io là các khung công nghệ trưởng thành, có tài liệu tốt và được dùng rộng rãi trong công nghiệp. Đề tài vì thế vừa giải quyết một vấn đề thực tế có thể quan sát được tại đơn vị khảo sát, vừa cho phép nhóm rèn luyện trọn vẹn chuẩn đầu ra G1–G3 của học phần: khảo sát và xác định yêu cầu, phân tích thiết kế mức 0, hiện thực và triển khai ứng dụng tích hợp AI/Realtime chạy thực tế.

## 2. Tổng quan các giải pháp và nghiên cứu liên quan

### 2.1. Sản phẩm thương mại

| Tính năng | Jira | Trello | Asana | Linear | ClickUp |
|---|---|---|---|---|---|
| Kanban kéo thả, sprint | ✓ | ✓ / plugin | ✓ | ✓ (Cycles) | ✓ |
| Gantt / Timeline | trả phí | trả phí | trả phí | ✓ | trả phí |
| Cập nhật thời gian thực đa người dùng | một phần | ✓ | ✓ | ✓ (chuẩn ngành) | ✓ |
| Biểu đồ tải nhân sự (Workload) | trả phí | ✗ | trả phí | ✗ | trả phí |
| Ma trận kỹ năng gắn giao việc | ✗ (plugin) | ✗ | ✗ | ✗ | ✗ |
| AI phân rã yêu cầu thành task | trả phí | trả phí | trả phí | trả phí | trả phí |
| Burn-down, dự báo hoàn thành | ✓ / trả phí | ✗ | trả phí | ✓ | ✓ |
| Ma trận Eisenhower | ✗ | template | template | ✗ | trả phí |

Nguồn: tài liệu chính thức của các sản phẩm [3]–[5], [7], [8], khảo sát tháng 09/2026. Nhận xét: Kanban/Sprint/Timeline đã là chuẩn; workload và AI thuộc gói trả phí; ma trận kỹ năng gắn với giao việc gần như không sản phẩm nào có. Linear là tham chiếu tốt nhất cho độ mượt realtime và "ngày hoàn thành dự kiến".

### 2.2. Cơ sở lý thuyết và nghiên cứu liên quan

- **Quy trình Agile:** Scrum Guide [9] định nghĩa sprint, backlog, burn-down; Anderson [10] hệ thống hoá Kanban với giới hạn WIP — hai khung này là nền cho phân hệ quản trị công việc.
- **Ước lượng và phân loại use case:** phương pháp Use Case Points của Karner [11] và hướng dẫn xác định chi phí phần mềm nội bộ của Bộ TT&TT [12] phân loại tác nhân (đơn giản/trung bình/phức tạp) và use case theo số giao dịch — nhóm dùng để lập bảng chức năng → use case và ước lượng công sức trong đề cương.
- **Xếp lịch có ràng buộc tài nguyên:** bài toán RCPSP là NP-khó; Kolisch và Hartmann [13] tổng kết các heuristic xếp lịch theo danh sách ưu tiên (list scheduling) cho kết quả tốt ở quy mô nhỏ — cơ sở cho thuật toán ghép người–việc–thời gian của đề tài.
- **Quá tải và kiệt sức:** Maslach và Leiter [1] xác định khối lượng công việc vượt năng lực kéo dài là yếu tố đầu tiên trong sáu yếu tố dẫn đến burnout; đề tài chuyển thành mô hình điểm nguy cơ dựa trên mức sử dụng nhiều tuần liên tiếp, việc quá hạn và tỷ lệ việc khẩn.
- **Ma trận ưu tiên Eisenhower:** được Covey [14] phổ biến (quan trọng × khẩn cấp); đề tài hiện thực như một chế độ xem của cùng dữ liệu task.
- **Mô hình ngôn ngữ lớn trong phân rã nhiệm vụ:** kỹ thuật prompt theo chuỗi suy luận [15] và đầu ra có cấu trúc theo schema [6] cho phép LLM sinh danh sách công việc kiểm chứng được bằng máy; các hệ thống thực tế đặt LLM ở vai trò đề xuất và giữ lớp kiểm tra xác định ở phía backend — cách tiếp cận đề tài kế thừa.
- **Kiến trúc và công nghệ:** NestJS [16], Next.js [17], Prisma [18], Socket.io [19] là các thư viện mã nguồn mở có tài liệu chính thức được dùng làm tham chiếu kỹ thuật; đặc tả yêu cầu theo ISO/IEC/IEEE 29148 [20].

### 2.3. Khoảng trống mà đề tài giải quyết

(1) Không có sản phẩm miễn phí nào gắn kỹ năng cá nhân với khối lượng công việc để cảnh báo quá tải; (2) các tính năng AI hiện có phân rã việc nhưng không kết nối với tải và kỹ năng của người nhận; (3) dự báo trễ hạn thường là "hộp đen" — đề tài tách phần tính toán xác định (có thể kiểm thử) khỏi phần giải thích bằng AI.

## 3. Mục tiêu đề tài

**Mục tiêu tổng quát:** xây dựng và triển khai trên Cloud một ứng dụng web quản trị dự án Agile/Kanban thời gian thực, tích hợp AI Agent phân rã yêu cầu thành công việc và mô hình cân bằng tải nhân sự theo ma trận kỹ năng, chạy được với người dùng thật.

**Mục tiêu cụ thể (đo được khi nghiệm thu):**

1. Hoàn thành 24 use case bắt buộc thuộc 6 phân hệ (nền tảng, dự án & công việc, cộng tác realtime, kỹ năng & tải, trợ lý AI, báo cáo); triển khai công khai trên Vercel + Render + Supabase.
2. Kanban kéo thả đồng bộ thời gian thực: thao tác ở một trình duyệt xuất hiện ở trình duyệt khác trong ≤ 500 ms (mạng nội bộ), không mất thứ tự sau 20 thao tác liên tiếp, xử lý xung đột phiên bản.
3. AI phân rã một yêu cầu 3–5 câu thành 5–15 công việc có ước lượng, kỹ năng yêu cầu và phụ thuộc trong ≤ 15 giây, tỷ lệ phản hồi hợp lệ theo schema ≥ 95%, luôn qua bước người xác nhận.
4. Mô hình tải: tính giờ hiệu dụng theo tuần cho từng người, cảnh báo Cao/Đầy/Quá tải và điểm nguy cơ burnout; có bộ kiểm thử đơn vị ≥ 12 ca cho thuật toán; thời gian tính ≤ 200 ms cho 200 task / 10 người.
5. Burn-down và dự báo ngày hoàn thành sprint bằng vận tốc, kèm giải thích và khuyến nghị do AI sinh.
6. Bộ hồ sơ phân tích thiết kế mức 0 đầy đủ (BFD/BPMN, Use Case, Sequence, ERD 3NF, OpenAPI) và quyển báo cáo 5 chương có số liệu thực nghiệm.

## 4. Đối tượng và phạm vi

**Đối tượng nghiên cứu:** quy trình giao việc, theo dõi tiến độ và phân bổ khối lượng công việc trong nhóm phát triển phần mềm quy mô nhỏ và vừa; phương pháp ước lượng, đo tải và phân rã yêu cầu bằng mô hình ngôn ngữ lớn.

**Đối tượng sử dụng:** quản lý dự án / trưởng nhóm; thành viên thực hiện; quản trị workspace. Đơn vị khảo sát hiện trạng dự kiến (Tuần 04): một nhóm phát triển phần mềm tại doanh nghiệp ở TP.HCM và 2–3 nhóm sinh viên làm đồ án (xác nhận với GVHD ở Tuần 03).

**Phạm vi chức năng (theo MoSCoW, chi tiết trong `pham-vi-de-tai.md`):**

- *Bắt buộc:* tài khoản và workspace; dự án, sprint, task/subtask; Kanban kéo thả, danh sách, Gantt chỉ đọc; realtime, bình luận @mention, đính kèm, thông báo; ma trận kỹ năng, tính tải, cảnh báo quá tải; AI phân rã, burn-down, dự báo rủi ro; dashboard.
- *Nên có:* Gantt kéo giãn, ma trận Eisenhower, Web Push, gợi ý người thực hiện, giờ làm thực tế, đánh giá task, kết nối lịch bận, chat với trợ lý AI, quản trị cấu hình AI.
- *Ngoài phạm vi:* ứng dụng di động, SSO/OAuth, tích hợp Google Calendar/Slack, workflow engine tuỳ biến, đa ngôn ngữ, thanh toán, huấn luyện mô hình riêng.

**Phạm vi kỹ thuật:** ứng dụng web tiếng Việt, tối ưu Chrome desktop; kiến trúc API-First ba tầng; hạ tầng miễn phí (Vercel, Render, Supabase, Gemini API free tier); dữ liệu mẫu do nhóm tạo cộng dữ liệu khảo sát ẩn danh; không xử lý dữ liệu cá nhân nhạy cảm.

## 5. Phương pháp nghiên cứu và triển khai

1. **Nghiên cứu tài liệu:** tài liệu chính thức của các sản phẩm và thư viện; các công trình về Agile, Use Case Points, RCPSP, burnout, LLM structured output (Mục 2).
2. **Khảo sát hiện trạng (Tuần 04):** phỏng vấn bán cấu trúc 2–3 người quản lý và 4–6 thành viên tại đơn vị khảo sát theo bảng câu hỏi; mô hình hoá quy trình hiện tại (AS-IS) và mong muốn (TO-BE) bằng BFD và BPMN; rút ra yêu cầu chức năng (FR) và phi chức năng (NFR).
3. **Phân tích và thiết kế hướng đối tượng (Tuần 05–06):** sơ đồ Use Case tổng quát và phân hệ; đặc tả 3–5 use case cốt lõi theo mẫu (luồng chính, luồng thay thế, tiền/hậu điều kiện, quy tắc nghiệp vụ); Sequence cho các luồng phức tạp (kéo thả realtime, AI phân rã, tính tải, dự báo); ERD chuẩn 3NF; đặc tả API theo OpenAPI 3 (Swagger) trước khi lập trình (API-First); wireframe các màn hình chính.
4. **Phát triển theo Scrum rút gọn (Tuần 07–08):** sprint 1 tuần, họp kế hoạch đầu tuần và demo nội bộ cuối tuần; ưu tiên theo MoSCoW; mã nguồn trên GitHub với nhánh feature theo use case, Pull Request có review, CI tự động lint/test/build; đóng băng tính năng sau Tuần 08.
5. **Hiện thực giải thuật lõi:** mô hình tải hiệu dụng và điểm burnout; thuật toán ghép người–việc–thời gian theo heuristic xếp lịch danh sách; dự báo ngày hoàn thành theo vận tốc; tích hợp LLM qua lớp trừu tượng nhà cung cấp với schema đầu ra, lớp kiểm tra hợp lệ và bước xác nhận của người dùng.
6. **Kiểm thử và đánh giá thực nghiệm (Tuần 09–10):** kiểm thử đơn vị cho thuật toán (Jest), kiểm thử tích hợp API (Supertest), kiểm thử đầu cuối một luồng vàng (Playwright), kiểm thử tải (k6, 20 người dùng ảo; 20 kết nối socket); đo trên dữ liệu mẫu: độ trễ realtime, thời gian phản hồi API, thời gian và tỷ lệ hợp lệ của AI, sai số ước lượng AI so với ước lượng của người, độ chính xác cảnh báo quá tải trên kịch bản dựng sẵn.
7. **Công cụ:** Next.js 15 + TypeScript + shadcn/ui; NestJS 11 + Prisma 6; PostgreSQL (Supabase); Socket.io; Gemini API (Ollama cục bộ khi phát triển); Docker Compose; GitHub Actions; draw.io / Mermaid cho sơ đồ; Figma cho mockup.

## 6. Điểm mới do nhóm thực hiện

*(hoàn thiện Tuần 02)*

## 7. Kết quả dự kiến

*(hoàn thiện Tuần 02)*

## 8. Kế hoạch thực hiện chi tiết 12 tuần

*(hoàn thiện Tuần 02 — WBS gán họ tên từng việc, xem `wbs-12-tuan.md`)*

## 9. Bố cục dự kiến của quyển báo cáo

*(hoàn thiện Tuần 02)*

## 10. Tài liệu tham khảo

*(hoàn thiện Tuần 02 — chuẩn IEEE; các số [1]–[20] đã dùng ở Mục 1–2)*
