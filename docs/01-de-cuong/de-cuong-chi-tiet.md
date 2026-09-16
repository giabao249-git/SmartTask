# ĐỀ CƯƠNG CHI TIẾT ĐỒ ÁN CHUYÊN NGÀNH

**Tên đề tài (tiếng Việt):** Xây dựng nền tảng quản trị dự án thông minh và cân bằng tải nhân sự tích hợp AI Agent (SmartTask)
**Tên đề tài (tiếng Anh):** Smart Task & Workload Management Platform with AI Agent
**Học phần:** Đồ án Chuyên ngành — 841476 (04 tín chỉ) · Ngành Công nghệ Thông tin & Kỹ thuật Phần mềm
**Giảng viên hướng dẫn:** ThS. Trần Đình Nghĩa — Khoa CNTT, Trường ĐH Sài Gòn
**Nhóm thực hiện:** «TV1» (nhóm trưởng), «TV2», «TV3», «TV4», «TV5» — xem `danh-sach-nhom.md`
**Thời gian thực hiện:** 12 tuần, 11/09/2026 – 27/11/2026

> Phiên bản: **Draft 2 — Tuần 02** — đủ 10 mục theo mẫu *Đề cương tiểu luận học phần Đồ án chuyên ngành* của Khoa (`Mau_DeCuong.docx`); chờ điền họ tên thành viên và góp ý GVHD (Tuần 03).
> Bản in dựng bằng `scripts/docx/build-de-cuong.js`: bìa theo mẫu Khoa, Times New Roman 13, giãn dòng 1.4, thụt đầu dòng 1,27 cm, lề trên/dưới 2,3 – trái 3,0 – phải 1,5 cm như file mẫu.

---

## 1. Lý do chọn đề tài / tính cấp thiết của vấn đề nghiên cứu

Trong các nhóm phát triển phần mềm quy mô nhỏ và vừa (5–30 người) — phòng phát triển của doanh nghiệp, đội dự án thuê ngoài, nhóm khởi nghiệp, nhóm sinh viên làm đồ án — việc phân công công việc phần lớn dựa vào cảm nhận của người quản lý: ai "có vẻ rảnh", ai "làm nhanh". Hệ quả thường thấy là một vài thành viên gánh phần lớn khối lượng trong khi số khác ít việc; yêu cầu lớn không được bóc tách thành các đầu việc đo được nên tiến độ chỉ được nhận ra là chậm khi đã sát hạn. Nghiên cứu của Maslach và Leiter [1] chỉ ra quá tải kéo dài là yếu tố hàng đầu dẫn đến kiệt sức (burnout), làm giảm chất lượng công việc trước khi làm giảm tiến độ; Brooks [2] từ lâu cũng chỉ ra rằng thêm người vào dự án đang trễ không giải quyết được vấn đề nếu việc không được phân rã và phân bổ đúng.

Các công cụ quản lý dự án phổ biến như Jira, Trello, Asana đã số hoá tốt quy trình Kanban/Scrum, nhưng ở gói miễn phí — mức mà nhóm nhỏ thực sự dùng — không có biểu đồ tải nhân sự, không có ma trận kỹ năng gắn với giao việc, và tính năng AI phân rã việc chỉ có ở gói trả phí (Atlassian Intelligence, Asana AI, ClickUp Brain) [3]–[5]. Khoảng trống này đúng là chỗ một đồ án có thể đóng góp: kết hợp quy trình Agile/Kanban thời gian thực với (a) mô hình đo tải theo giờ có tính đến kỹ năng và lịch sử làm việc, và (b) một tác nhân AI phân rã yêu cầu thành công việc kèm ước lượng, có người xác nhận trước khi ghi dữ liệu.

Về mặt công nghệ, thời điểm hiện tại cho phép làm điều đó với chi phí bằng không: các mô hình ngôn ngữ lớn (Gemini Flash) đã hỗ trợ đầu ra có cấu trúc (JSON schema) đủ tin cậy để tích hợp vào nghiệp vụ [6]; các nền tảng Vercel, Render, Supabase cung cấp gói miễn phí đủ để triển khai một ứng dụng web ba tầng chạy thật trên Internet; NestJS, Next.js, Socket.io là các khung công nghệ trưởng thành, có tài liệu tốt và được dùng rộng rãi trong công nghiệp. Đề tài vì thế vừa giải quyết một vấn đề thực tế có thể quan sát được tại đơn vị khảo sát, vừa cho phép nhóm rèn luyện trọn vẹn chuẩn đầu ra G1–G3 của học phần: khảo sát và xác định yêu cầu, phân tích thiết kế mức 0, hiện thực và triển khai ứng dụng tích hợp AI/Realtime chạy thực tế.

## 2. Lịch sử nghiên cứu vấn đề / tổng quan

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

## 3. Mục đích nghiên cứu

**Mục tiêu tổng quát:** xây dựng và triển khai trên Cloud một ứng dụng web quản trị dự án Agile/Kanban thời gian thực, tích hợp AI Agent phân rã yêu cầu thành công việc và mô hình cân bằng tải nhân sự theo ma trận kỹ năng, chạy được với người dùng thật.

**Mục tiêu cụ thể (đo được khi nghiệm thu):**

1. Hoàn thành 24 use case bắt buộc thuộc 6 phân hệ (nền tảng, dự án & công việc, cộng tác realtime, kỹ năng & tải, trợ lý AI, báo cáo); triển khai công khai trên Vercel + Render + Supabase.
2. Kanban kéo thả đồng bộ thời gian thực: thao tác ở một trình duyệt xuất hiện ở trình duyệt khác trong ≤ 500 ms (mạng nội bộ), không mất thứ tự sau 20 thao tác liên tiếp, xử lý xung đột phiên bản.
3. AI phân rã một yêu cầu 3–5 câu thành 5–15 công việc có ước lượng, kỹ năng yêu cầu và phụ thuộc trong ≤ 15 giây, tỷ lệ phản hồi hợp lệ theo schema ≥ 95%, luôn qua bước người xác nhận.
4. Mô hình tải: tính giờ hiệu dụng theo tuần cho từng người, cảnh báo Cao/Đầy/Quá tải và điểm nguy cơ burnout; có bộ kiểm thử đơn vị ≥ 12 ca cho thuật toán; thời gian tính ≤ 200 ms cho 200 task / 10 người.
5. Burn-down và dự báo ngày hoàn thành sprint bằng vận tốc, kèm giải thích và khuyến nghị do AI sinh.
6. Bộ hồ sơ phân tích thiết kế mức 0 đầy đủ (BFD/BPMN, Use Case, Sequence, ERD 3NF, OpenAPI) và quyển báo cáo 7 chương có số liệu thực nghiệm.

## 4. Nhiệm vụ nghiên cứu

Để đạt các mục đích ở Mục 3, nhóm xác định bảy nhiệm vụ, mỗi nhiệm vụ có sản phẩm kiểm tra được:

1. **Khảo sát hiện trạng và xác định yêu cầu:** phỏng vấn đơn vị khảo sát, mô hình hoá quy trình giao việc hiện tại (AS-IS) và mong muốn (TO-BE); lập danh sách yêu cầu chức năng và phi chức năng theo ISO/IEC/IEEE 29148 [20]. Sản phẩm: bản mô tả hiện trạng, BFD, BPMN, bảng FR/NFR.
2. **Tổng hợp cơ sở lý thuyết:** Agile/Kanban, ước lượng Use Case Points, xếp lịch có ràng buộc tài nguyên, mô hình burnout, đầu ra có cấu trúc của mô hình ngôn ngữ lớn (Mục 2). Sản phẩm: Chương 2 của báo cáo.
3. **Phân tích và thiết kế hệ thống mức 0:** sơ đồ Use Case, đặc tả use case cốt lõi, Sequence, kiến trúc, ERD chuẩn 3NF, đặc tả API theo OpenAPI 3, wireframe. Sản phẩm: hồ sơ thiết kế (Tuần 06).
4. **Xây dựng phần mềm:** backend NestJS + Prisma + PostgreSQL, frontend Next.js + shadcn/ui, đồng bộ thời gian thực bằng Socket.io; 24 use case bắt buộc. Sản phẩm: mã nguồn GitHub có CI, tài liệu Swagger.
5. **Hiện thực giải thuật lõi:** mô hình tải hiệu dụng theo kỹ năng và lịch sử làm việc, điểm nguy cơ burnout, thuật toán ghép người – việc – thời gian, dự báo ngày hoàn thành; kèm bộ kiểm thử đơn vị. Sản phẩm: mô-đun thuật toán có test.
6. **Tích hợp AI Agent:** lớp trừu tượng nhà cung cấp (Gemini/Ollama), xây dựng ngữ cảnh, schema đầu ra, lớp kiểm tra hợp lệ, bước xác nhận của người dùng, nhật ký token. Sản phẩm: chức năng phân rã yêu cầu và giải thích dự báo.
7. **Kiểm thử, đo đạc, triển khai và viết báo cáo:** kiểm thử đơn vị/tích hợp/đầu cuối/tải; đo số liệu thực nghiệm; triển khai Vercel + Render + Supabase; viết quyển báo cáo, slide và video demo. Sản phẩm: liên kết chạy thật, báo cáo kiểm thử, quyển báo cáo.

**Kết quả dự kiến khi hoàn thành các nhiệm vụ:**

- **Sản phẩm phần mềm:** ứng dụng web SmartTask chạy công khai (Vercel + Render + Supabase) gồm 24 use case bắt buộc; mã nguồn GitHub có README cài đặt, CI, tag `v1.0.0`; tài liệu API Swagger; script dữ liệu mẫu (2 dự án, 6 người, ~80 task, 3 tuần lịch sử).
- **Hồ sơ phân tích thiết kế:** bản mô tả hiện trạng; BFD, BPMN; sơ đồ Use Case tổng quát và phân hệ; đặc tả 5 use case cốt lõi; 6 sequence diagram; ERD chuẩn 3NF và từ điển dữ liệu; đặc tả OpenAPI 3; wireframe 8 màn hình; kế hoạch và báo cáo kiểm thử.
- **Số liệu thực nghiệm (Chương 6):** độ trễ đồng bộ realtime; thời gian phản hồi API (p95); thời gian phản hồi và tỷ lệ hợp lệ của AI phân rã; sai số ước lượng AI so với ước lượng của người trên tập task mẫu; độ chính xác cảnh báo quá tải trên kịch bản dựng sẵn; kết quả kiểm thử tải 20 người dùng ảo và 20 kết nối socket.
- **Quyển báo cáo** 60–120 trang, 7 chương, kèm đề cương đã duyệt; slide 15–20 trang; video demo dự phòng.

## 5. Đối tượng nghiên cứu và phạm vi nghiên cứu

**Đối tượng nghiên cứu:** quy trình giao việc, theo dõi tiến độ và phân bổ khối lượng công việc trong nhóm phát triển phần mềm quy mô nhỏ và vừa; phương pháp ước lượng, đo tải và phân rã yêu cầu bằng mô hình ngôn ngữ lớn.

**Đối tượng sử dụng:** quản lý dự án / trưởng nhóm; thành viên thực hiện; quản trị workspace. Đơn vị khảo sát hiện trạng dự kiến (Tuần 04): một nhóm phát triển phần mềm tại doanh nghiệp ở TP.HCM và 2–3 nhóm sinh viên làm đồ án (xác nhận với GVHD ở Tuần 03).

**Phạm vi chức năng (theo MoSCoW, chi tiết trong `pham-vi-de-tai.md`):**

- *Bắt buộc:* tài khoản và workspace; dự án, sprint, task/subtask; Kanban kéo thả, danh sách, Gantt chỉ đọc; realtime, bình luận @mention, đính kèm, thông báo; ma trận kỹ năng, tính tải, cảnh báo quá tải; AI phân rã, burn-down, dự báo rủi ro; dashboard.
- *Nên có:* Gantt kéo giãn, ma trận Eisenhower, Web Push, gợi ý người thực hiện, giờ làm thực tế, đánh giá task, kết nối lịch bận, chat với trợ lý AI, quản trị cấu hình AI.
- *Ngoài phạm vi:* ứng dụng di động, SSO/OAuth, tích hợp Google Calendar/Slack, workflow engine tuỳ biến, đa ngôn ngữ, thanh toán, huấn luyện mô hình riêng.

**Phạm vi kỹ thuật:** ứng dụng web tiếng Việt, tối ưu Chrome desktop; kiến trúc API-First ba tầng; hạ tầng miễn phí (Vercel, Render, Supabase, Gemini API free tier); dữ liệu mẫu do nhóm tạo cộng dữ liệu khảo sát ẩn danh; không xử lý dữ liệu cá nhân nhạy cảm.

## 6. Phương pháp nghiên cứu

1. **Nghiên cứu tài liệu:** tài liệu chính thức của các sản phẩm và thư viện; các công trình về Agile, Use Case Points, RCPSP, burnout, LLM structured output (Mục 2).
2. **Khảo sát hiện trạng (Tuần 04):** phỏng vấn bán cấu trúc 2–3 người quản lý và 4–6 thành viên tại đơn vị khảo sát theo bảng câu hỏi; mô hình hoá quy trình hiện tại (AS-IS) và mong muốn (TO-BE) bằng BFD và BPMN; rút ra yêu cầu chức năng (FR) và phi chức năng (NFR).
3. **Phân tích và thiết kế hướng đối tượng (Tuần 05–06):** sơ đồ Use Case tổng quát và phân hệ; đặc tả 3–5 use case cốt lõi theo mẫu (luồng chính, luồng thay thế, tiền/hậu điều kiện, quy tắc nghiệp vụ); Sequence cho các luồng phức tạp (kéo thả realtime, AI phân rã, tính tải, dự báo); ERD chuẩn 3NF; đặc tả API theo OpenAPI 3 (Swagger) trước khi lập trình (API-First); wireframe các màn hình chính.
4. **Phát triển theo Scrum rút gọn (Tuần 07–08):** sprint 1 tuần, họp kế hoạch đầu tuần và demo nội bộ cuối tuần; ưu tiên theo MoSCoW; mã nguồn trên GitHub với nhánh feature theo use case, Pull Request có review, CI tự động lint/test/build; đóng băng tính năng sau Tuần 08.
5. **Hiện thực giải thuật lõi:** mô hình tải hiệu dụng và điểm burnout; thuật toán ghép người–việc–thời gian theo heuristic xếp lịch danh sách; dự báo ngày hoàn thành theo vận tốc; tích hợp LLM qua lớp trừu tượng nhà cung cấp với schema đầu ra, lớp kiểm tra hợp lệ và bước xác nhận của người dùng.
6. **Kiểm thử và đánh giá thực nghiệm (Tuần 09–10):** kiểm thử đơn vị cho thuật toán (Jest), kiểm thử tích hợp API (Supertest), kiểm thử đầu cuối một luồng vàng (Playwright), kiểm thử tải (k6, 20 người dùng ảo; 20 kết nối socket); đo trên dữ liệu mẫu: độ trễ realtime, thời gian phản hồi API, thời gian và tỷ lệ hợp lệ của AI, sai số ước lượng AI so với ước lượng của người, độ chính xác cảnh báo quá tải trên kịch bản dựng sẵn.
7. **Công cụ:** Next.js 15 + TypeScript + shadcn/ui; NestJS 11 + Prisma 6; PostgreSQL (Supabase); Socket.io; Gemini API (Ollama cục bộ khi phát triển); Docker Compose; GitHub Actions; draw.io / Mermaid cho sơ đồ; Figma cho mockup.

## 7. Giả thuyết khoa học / Những đóng góp mới của đề tài

**Giả thuyết khoa học:**

- **H1.** Mô hình tải hiệu dụng có tính đến kỹ năng, hệ số ước lượng cá nhân và lịch họp/nghỉ phát hiện quá tải sớm hơn và ít cảnh báo sai hơn cách so sánh giờ ước lượng với 40 giờ/tuần; kiểm chứng trên các kịch bản dựng sẵn có nhãn (quá tải thật / không quá tải).
- **H2.** Mô hình ngôn ngữ lớn được ràng buộc bằng schema đầu ra, lớp kiểm tra hợp lệ và bước xác nhận của người dùng cho tỷ lệ phản hồi hợp lệ ≥ 95% và sai số ước lượng giờ trong khoảng ±30% so với ước lượng của người trên tập yêu cầu mẫu.
- **H3.** Tách phần tính toán xác định (có kiểm thử đơn vị) khỏi phần giải thích bằng AI vẫn giữ được tính đúng đắn có thể kiểm chứng, đồng thời cho người dùng lời giải thích dễ hiểu hơn so với chỉ hiển thị số liệu.

**Những đóng góp mới của đề tài:**

1. **Ma trận kỹ năng gắn với khối lượng công việc.** Mỗi thành viên khai báo kỹ năng mức 1–5 (PM xác nhận); mỗi task khai kỹ năng yêu cầu. Tải được tính bằng *giờ hiệu dụng*: giờ còn lại × hệ số ước lượng cá nhân (EAR = giờ thực tế ÷ giờ ước lượng, làm mượt Bayes) × hệ số độ khó × hệ số thiếu kỹ năng × phạt chuyển ngữ cảnh, so với *năng lực hiệu dụng* (giờ chuẩn trừ giờ họp và ngày nghỉ). Các sản phẩm phổ biến chỉ so giờ ước lượng với 40 giờ.
2. **Điểm nguy cơ burnout nhiều tuần.** Tổng hợp mức sử dụng tuần hiện tại, số tuần liên tiếp quá 90%, tỷ lệ việc quá hạn, xu hướng chậm dần so với chính mình và tỷ lệ việc khẩn — cảnh báo trước khi tiến độ lộ ra chậm; mọi hệ số hiển thị được cho người bị gắn nhãn.
3. **AI Agent phân rã yêu cầu an toàn và tái lập.** LLM chỉ được gọi với schema đầu ra bắt buộc; backend nạp ngữ cảnh (thành viên, kỹ năng, tải, task hiện có), kiểm tra hợp lệ (kẹp ước lượng, ánh xạ kỹ năng về danh mục, phụ thuộc không vòng), và người dùng xem trước – sửa – xác nhận trước khi ghi. Lớp trừu tượng nhà cung cấp cho phép đổi Gemini ↔ Ollama bằng cấu hình; mọi lượt gọi được ghi token, thời gian, vân tay prompt.
4. **Dự báo trễ hạn tách phần tính khỏi phần giải thích.** Ngày hoàn thành dự kiến và mức rủi ro tính xác định từ snapshot burn-down và vận tốc (có kiểm thử đơn vị); AI chỉ diễn giải nguyên nhân và đề xuất hành động — trả lời được câu hỏi "AI có đáng tin không".
5. **Thuật toán ghép người – việc – thời gian.** Chấm điểm phù hợp (kỹ năng, sẵn sàng, lịch sử, công bằng, liên tục) rồi xếp lịch theo heuristic danh sách vào năng lực còn trống theo ngày; đo độ chênh tải (Spread) và đề xuất cân bằng. Đây là phần "giải thuật lõi" theo yêu cầu Tuần 07.
6. **Ba chế độ xem trên cùng một dữ liệu, đồng bộ thời gian thực.** Kanban, Gantt, Eisenhower đọc cùng một truy vấn task; mọi thay đổi đi qua REST rồi phát qua Socket.io với số phiên bản để phát hiện xung đột; cập nhật lạc quan có hoàn tác.
7. **Toàn bộ chạy trên hạ tầng miễn phí, API-First**, có Swagger, CI, kiểm thử tự động và số liệu thực nghiệm — theo đúng triết lý "không làm phần mềm đồ chơi" của học phần.

## 8. Dự kiến kế hoạch nghiên cứu (tuần / thực hiện công việc gì)

Bảng WBS đầy đủ (mã việc, người thực hiện, ngày bắt đầu/kết thúc, sản phẩm, phụ thuộc) tại `wbs-12-tuan.md`; tóm tắt theo tuần:

| Tuần | Thời gian | Công việc chính | Người phụ trách chính | Sản phẩm |
|---|---|---|---|---|
| 01 | 11/09 – 17/09 | Lập nhóm, chọn đề tài; khởi tạo Git; thảo luận phạm vi; nháp đề cương Mục 1–5 | «TV1», «TV2», «TV4» | Đề cương v1, DS nhóm |
| 02 | 18/09 – 24/09 | WBS gán tên; Mục 6–10; môi trường phát triển (Docker PostgreSQL, IDE, nhánh Git, CI); dàn trang bản in | «TV1», «TV3», «TV4», «TV5», «TV2» | Đề cương Draft 2 |
| 03 | 25/09 – 01/10 | Trình bày và sửa đề cương theo góp ý; ký biên bản; chuẩn bị khảo sát | «TV1», «TV3», «TV5» | **Đề cương được duyệt** |
| 04 | 02/10 – 08/10 | Phỏng vấn đơn vị khảo sát; hiện trạng AS-IS/TO-BE; BFD; BPMN; FR/NFR | «TV1», «TV2», «TV4», «TV3», «TV5» | Bản mô tả hiện trạng + BFD |
| 05 | 09/10 – 15/10 | Use Case tổng quát/phân hệ; đặc tả 5 UC cốt lõi; 6 sequence | «TV3», «TV4», «TV2», «TV1», «TV5» | UC & Sequence mức 0 |
| 06 | 16/10 – 22/10 | ERD 3NF + từ điển dữ liệu; OpenAPI 3 + Postman; wireframe 8 màn; test plan | «TV2», «TV4», «TV5», «TV3» | **Hồ sơ thiết kế mức 0** |
| 07 | 23/10 – 29/10 | NestJS + Prisma + Supabase; JWT/RBAC; workspace, dự án, task; WorkloadCalculator + test; Next.js skeleton; Swagger, CI, deploy API | «TV2», «TV5», «TV4», «TV3» | Backend API ổn định có Swagger |
| 08 | 30/10 – 05/11 | Kanban, danh sách, chi tiết task; Socket.io realtime; bình luận/đính kèm/thông báo; AI phân rã, burn-down, dự báo; kỹ năng, tải, dashboard, Gantt; deploy Vercel | «TV3», «TV4», «TV5», «TV2», «TV1» | **Demo MVP với GVHD** |
| 09 | 06/11 – 12/11 | Đóng băng; test cases, unit/integration/E2E; Docker Compose; deploy chính thức | «TV1», «TV5», «TV2», «TV3», «TV4» | Link online + báo cáo test |
| 10 | 13/11 – 19/11 | Đo số liệu thực nghiệm; viết Chương 1–5; ảnh minh chứng, từ điển dữ liệu | «TV4», «TV1», «TV2», «TV3», «TV5» | Quyển báo cáo Draft 1 |
| 11 | 20/11 – 26/11 | Rà soát với GVHD; in bìa kiếng; dọn Git, README, video; slide; **nộp 11h30 23/11**; diễn tập demo | «TV1», «TV3», «TV2», «TV5», «TV4» | Hồ sơ nộp |
| 12 | 27/11 | Bảo vệ: thuyết trình, demo trực tiếp trên Cloud, vấn đáp | Cả 5 thành viên trình bày phần mình | Nghiệm thu |

Nhịp làm việc: sprint 1 tuần; họp kế hoạch thứ Hai, demo nội bộ và gửi tiến độ GVHD thứ Sáu; commit Git theo tài khoản cá nhân hằng ngày.

## 9. Dự kiến nội dung của tiểu luận

Quyển báo cáo dự kiến 60–120 trang, bố cục theo mẫu của Khoa gồm 7 chương:

**Chương 1: Mở đầu** — 1. Lý do chọn đề tài; 2. Mục tiêu nghiên cứu; 3. Đối tượng và phạm vi nghiên cứu; 4. Giả thuyết khoa học / Những đóng góp mới của đề tài; 5. Phương pháp nghiên cứu; 6. Bố cục báo cáo.

**Chương 2: Cơ sở lý thuyết và tổng quan tài liệu** — 1. Khái niệm quản trị dự án Agile, Kanban, sprint, burn-down; 2. Khối lượng công việc, năng lực, quá tải và kiệt sức (burnout); 3. Ước lượng phần mềm (Use Case Points) và bài toán xếp lịch có ràng buộc tài nguyên; 4. Mô hình ngôn ngữ lớn, đầu ra có cấu trúc và tác nhân AI; 5. Khảo sát các sản phẩm hiện có (Jira, Trello, Asana, Linear, ClickUp); 6. Công nghệ sử dụng (Next.js, NestJS, Prisma, PostgreSQL, Socket.io, Gemini API).

**Chương 3: Phân tích yêu cầu hệ thống** — 1. Khảo sát hiện trạng tại đơn vị (AS-IS) và quy trình mong muốn (TO-BE); 2. Sơ đồ chức năng nghiệp vụ (BFD), BPMN; 3. Yêu cầu chức năng và phi chức năng; 4. Tác nhân và sơ đồ Use Case tổng quát, phân hệ; 5. Đặc tả các use case cốt lõi.

**Chương 4: Thiết kế hệ thống** — 1. Kiến trúc tổng thể ba tầng, API-First và quyết định công nghệ; 2. Sequence diagram các luồng phức tạp (kéo thả realtime, AI phân rã, tính tải, dự báo); 3. Thiết kế cơ sở dữ liệu (ERD 3NF, từ điển dữ liệu); 4. Đặc tả API (OpenAPI 3) và sự kiện thời gian thực; 5. Thiết kế giải thuật lõi (mô hình tải, burnout, ghép người – việc – thời gian, dự báo); 6. Thiết kế lớp AI Agent (ngữ cảnh, prompt, schema, kiểm tra hợp lệ); 7. Thiết kế giao diện (wireframe).

**Chương 5: Triển khai và thực hiện** — 1. Môi trường phát triển và công cụ sử dụng; 2. Xây dựng chức năng xác thực, workspace, dự án và công việc; 3. Xây dựng chức năng Kanban, Gantt, Eisenhower đồng bộ thời gian thực; 4. Xây dựng chức năng cộng tác (bình luận @mention, đính kèm, thông báo); 5. Xây dựng chức năng kỹ năng, tính tải và cảnh báo quá tải; 6. Xây dựng chức năng AI phân rã yêu cầu, burn-down và dự báo rủi ro; 7. Kiểm thử và triển khai Cloud (Vercel, Render, Supabase, CI/CD).

**Chương 6: Kết quả thực hiện** — 1. Ảnh màn hình các luồng chính; 2. Số liệu thực nghiệm (độ trễ realtime, thời gian phản hồi API, tỷ lệ hợp lệ và sai số của AI, độ chính xác cảnh báo quá tải, kiểm thử tải); 3. Đánh giá theo mục đích đo được ở Mục 3 và kiểm chứng các giả thuyết ở Mục 7.

**Chương 7: Kết luận và đề xuất** — 1. Kết quả đạt được; 2. Hạn chế; 3. Hướng phát triển (gợi ý phân công học từ phản hồi, tích hợp lịch doanh nghiệp, ứng dụng di động, SSO); 4. Bài học kinh nghiệm.

Tài liệu tham khảo (IEEE). Phụ lục: bảng chức năng → use case đầy đủ; đặc tả API; từ điển dữ liệu; biên bản khảo sát; biên bản họp và % đóng góp.

## 10. Danh mục tài liệu tham khảo

[1] C. Maslach and M. P. Leiter, "Understanding the burnout experience: recent research and its implications for psychiatry," *World Psychiatry*, vol. 15, no. 2, pp. 103–111, 2016.
[2] F. P. Brooks, *The Mythical Man-Month: Essays on Software Engineering*, Anniversary ed. Reading, MA, USA: Addison-Wesley, 1995.
[3] Atlassian, "Jira Software documentation," 2026. [Online]. Available: https://support.atlassian.com/jira-software-cloud/. [Accessed: 11-Sep-2026].
[4] Asana, "Asana product guide — Workload," 2026. [Online]. Available: https://help.asana.com/. [Accessed: 11-Sep-2026].
[5] ClickUp, "ClickUp Help Center — Workload view, ClickUp Brain," 2026. [Online]. Available: https://help.clickup.com/. [Accessed: 11-Sep-2026].
[6] Google, "Gemini API — Structured output," 2026. [Online]. Available: https://ai.google.dev/gemini-api/docs/structured-output. [Accessed: 11-Sep-2026].
[7] Atlassian, "Trello guide," 2026. [Online]. Available: https://trello.com/guide. [Accessed: 11-Sep-2026].
[8] Linear, "Linear documentation — Cycles, Projects, Insights," 2026. [Online]. Available: https://linear.app/docs. [Accessed: 11-Sep-2026].
[9] K. Schwaber and J. Sutherland, *The Scrum Guide*, Nov. 2020. [Online]. Available: https://scrumguides.org/.
[10] D. J. Anderson, *Kanban: Successful Evolutionary Change for Your Technology Business*. Sequim, WA, USA: Blue Hole Press, 2010.
[11] G. Karner, "Resource estimation for Objectory projects," Objective Systems SF AB, Sweden, Tech. Rep., 1993.
[12] Bộ Thông tin và Truyền thông, *Công văn số 2589/BTTTT-ƯDCNTT ngày 24/8/2011 hướng dẫn xác định chi phí phát triển, nâng cấp phần mềm nội bộ*, Hà Nội, 2011.
[13] R. Kolisch and S. Hartmann, "Heuristic algorithms for the resource-constrained project scheduling problem: Classification and computational analysis," in *Project Scheduling: Recent Models, Algorithms and Applications*, J. Węglarz, Ed. Boston, MA, USA: Kluwer, 1999, pp. 147–178.
[14] S. R. Covey, *The 7 Habits of Highly Effective People*. New York, NY, USA: Free Press, 1989.
[15] J. Wei et al., "Chain-of-thought prompting elicits reasoning in large language models," in *Proc. 36th Conf. Neural Information Processing Systems (NeurIPS)*, New Orleans, LA, USA, 2022.
[16] NestJS, "NestJS documentation," 2026. [Online]. Available: https://docs.nestjs.com/. [Accessed: 11-Sep-2026].
[17] Vercel, "Next.js documentation — App Router," 2026. [Online]. Available: https://nextjs.org/docs. [Accessed: 11-Sep-2026].
[18] Prisma, "Prisma ORM documentation," 2026. [Online]. Available: https://www.prisma.io/docs. [Accessed: 11-Sep-2026].
[19] Socket.IO, "Socket.IO documentation," 2026. [Online]. Available: https://socket.io/docs/v4/. [Accessed: 11-Sep-2026].
[20] *Systems and software engineering — Life cycle processes — Requirements engineering*, ISO/IEC/IEEE 29148:2018, 2018.

> Ghi chú: các mục [3]–[8], [16]–[19] là tài liệu trực tuyến, cần kiểm tra lại đường dẫn và ngày truy cập khi in; bổ sung tài liệu phỏng vấn/khảo sát (Tuần 04) vào danh mục khi có.
