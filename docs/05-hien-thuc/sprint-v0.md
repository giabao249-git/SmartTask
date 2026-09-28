# Sprint v0 — Sprint, tra cứu AI, hồ sơ kỹ năng từ bằng chứng, tab Nhân sự

**Nhánh:** `sprint_v0` (tên cũ `sprint_v1`, đổi 28/09/2026 cho khớp quy tắc tên nhánh `sprint_vN`) · **Tách từ:** `main` · **Thời gian:** 28/09/2026 (Tuần 03) · **Trạng thái:** đã đẩy lên GitHub, **chưa mở PR vào `main`**.
**Quy trình:** mỗi mục một nhánh `feature/UC-xx-…` (hoặc `chore/…`), mỗi mục một commit, gộp vào `sprint_v0` bằng `merge --no-ff` — xem [quy tắc git](../00-quy-che/quy-tac-git.md).

Tài liệu nguồn của từng phần:

| Phần | Đề xuất / thiết kế | Tài liệu kiến trúc đã cập nhật |
|---|---|---|
| Sprint & tra cứu dữ liệu của Trợ lý AI | [02/07](../02-phan-tich/07-cai-tien-sprint-va-intent.md) (Phase 15–17, F1–F6) | [04/04 §8](../04-kien-truc/04-cong-thuc-tinh-toan.md), [04/11](../04-kien-truc/11-chot-chuc-nang-va-api.md), [04/12](../04-kien-truc/12-chat-phien-va-ban-nhap.md), [04/14](../04-kien-truc/14-tra-cuu-hoi-dap.md) |
| Hồ sơ kỹ năng từ bằng chứng, tab Nhân sự | [02/08](../02-phan-tich/08-ho-so-ky-nang-tu-bang-chung.md) | [04/04 §2b, §6, §7](../04-kien-truc/04-cong-thuc-tinh-toan.md), [04/05](../04-kien-truc/05-ai-agent.md), [04/08](../04-kien-truc/08-mo-hinh-du-lieu.md), [04/11](../04-kien-truc/11-chot-chuc-nang-va-api.md) |
| Màn hình ↔ endpoint | — | [web-tich-hop.md](web-tich-hop.md) |

---

## 1. Tính năng mới

### 1.1 Sprint (UC-09, 16, 20, 30, 31, 33)

- **Trang Sprint** `/projects/:id/sprints`: lập kế hoạch Backlog ↔ Sprint trên một màn, thanh cam kết/năng lực nhóm, burn-down + ETA/rủi ro cho sprint đang chạy, **báo cáo sprint đã đóng** (đã xong, bị chuyển đi lúc đóng, thêm sau khi bắt đầu, chuyển vào từ sprint trước), **vận tốc** cam kết/hoàn thành các sprint đã đóng.
- **Bắt đầu sprint** là hộp thoại quyết định (mục tiêu, ngày, cam kết so với năng lực, cảnh báo, tên sprint đang chạy). **Kết thúc sprint** nói trước việc nào xong / việc dở chuyển đi đâu, cho tạo luôn "Sprint mới…", chống bấm đúp bằng `Idempotency-Key`.
- **Số liệu đúng:** vận tốc tính từ `completedAt` (không phụ thuộc cron), chụp snapshot lúc bắt đầu/kết thúc, sprint đã đóng giữ số cuối; Dashboard chọn được sprint, nguyên nhân rủi ro thành câu tiếng Việt bấm ra đúng việc/người.
- Thông báo trỏ đúng route; chuông trên AppShell đọc thông báo thật; nhật ký ghi `sprint.tasks_added`, `sprint.closed`.

### 1.2 Trợ lý AI — tra cứu dữ liệu (UC-38)

- **19 ý định** `DATA_QUERY` (thêm `SPRINT_REPORT`, `SPRINT_VELOCITY`), danh sách ý định **một nguồn** trong `packages/shared` sinh cả prompt lẫn `responseSchema`.
- Tra cứu sprint gọi đúng service của màn hình → "một câu hỏi, một con số". "Làm mới" giải được mã của phiên chỉ có tra cứu.
- Ghi chú khi bộ lọc bị cắt (không báo nhầm với giá trị mặc định); `ACTIVITY_FEED` lọc người + hôm nay/hôm qua/tuần này; "hôm nay tôi làm gì" gồm cả việc chưa xong đã quá hạn.
- **Khối kết quả dễ đọc:** rỗng một dòng, ngày `25/09`, giờ `13,6 h`, số `397.111`, nhãn tiếng Việt, bảng > 8 dòng thu gọn, chữ 12 px.
- **Hiện dần kiểu Gemini:** khối/dòng hiện lần lượt, mờ → rõ; khung chat **bám đáy** cuộn theo nội dung, người dùng cuộn lên thì không bị giật và có nút "Xuống tin mới nhất".

### 1.3 Trợ lý AI — đề xuất việc (UC-28)

- **Thẻ đề xuất rõ ràng:** sprint đích nổi bật, giờ so với năng lực sprint, lỗi/cảnh báo bằng lời trên đúng việc (không in mã máy), chỉ duyệt được việc không lỗi; bong bóng chat liệt kê việc + nút "Xem và duyệt".
- Chat dùng sprint người dùng nêu ("cho sprint 2") thay vì sprint đang xem.
- **Đầu ra Gemini:** trường quyết định bắt buộc-được-null (`sprint`, `targetDraftKeys`, `patch`, `minLevel`, `range`, `user`), thứ tự thuộc tính; `CHAT_RESPONSE` nói "đã cập nhật" mà không làm gì → gọi lại một lần, vẫn thiếu thì trả lời thật; dành chỗ token cho JSON khi Gemini 2.5 "suy nghĩ" (hết lỗi 503).

### 1.4 Hồ sơ kỹ năng từ bằng chứng (UC-23, 26, 35, 36)

- **Quyết định của nhóm:** AI chia việc theo hồ sơ tính từ việc đã làm, **không** theo mức tự khai.
- Engine `metrics/domain/skill-evidence.ts`: việc đã xong có yêu cầu kỹ năng + đánh giá PM + mở lại + bug gốc + PM xác nhận → mức, độ tin cậy, số việc, số lần làm lại. "Chưa đủ bằng chứng" là trung tính; thiếu kỹ năng chỉ là **cảnh báo** kèm bằng chứng.
- **Ghi giờ làm** (tab "Giờ làm" trong chi tiết việc), **đánh giá khi xong** (PM chấm chất lượng, độ khó thực tế, giờ thực tế), **bug gắn việc gốc** (ô "Sinh ra từ việc").
- Validator, ngữ cảnh AI, bảng năng lực, ứng viên, "ai biết X", "kỹ năng nào chỉ một người biết", danh sách thành viên đều đọc từ engine.

### 1.5 Tab Nhân sự & Dashboard (UC-24, 25, 26, 27)

- Nhân sự còn **3 tab**: **Nhóm** (thẻ từng người: tải tuần này, kỹ năng từ bằng chứng, hiệu suất chỉ bản thân/PM; bấm mở hồ sơ xem "vì sao mức 3" tới từng việc; hồ sơ của chính mình có mục sửa tự khai) · **Tải & giờ trống** (tải 4 tuần + giờ trống/ứng viên, chọn sprint) · **Kỹ năng** (ma trận theo bằng chứng, PM xác nhận ô tự khai).
- Người chỉ xem (Viewer của workspace) không còn là ứng viên nhận việc; PM của dự án chung được xác nhận kỹ năng.
- **Dashboard** có thẻ "việc đã xong chờ bạn đánh giá" cho PM.

## 2. API

| Loại | Endpoint |
|---|---|
| Mới | `GET /sprints/:id/summary` · `GET·POST /tasks/:id/time-entries` · `PATCH·DELETE /time-entries/:id` · `GET·PUT /tasks/:id/review` · `GET /projects/:id/reviews/pending` · `GET /projects/:id/skill-profiles` · `GET /projects/:id/skill-profiles/:userId/evidence` |
| Sửa | `POST /sprints/:id/close` nhận `Idempotency-Key` · `GET /projects/:id/sprints` có `doneCount`, `completedHours` · burndown có `gaps`, forecast có `final`, `workdaysLeft` · `POST/PATCH /tasks` nhận `originTaskId` (BUG); chi tiết việc có `origin`, `derivedBugs` · `PATCH /users/:id/skills/:skillId/verify` cho PM dự án chung · `capacity-table` bỏ Viewer, kỹ năng theo bằng chứng · view đề xuất có `detail`, `issues`, `generalIssues` · `POST /ai/query` nhận `messageId` |

## 3. CSDL

Một migration, trước mốc chốt lược đồ 16/10: **`20260928100000_task_origin`** — `tasks.origin_task_id UUID NULL` (FK tự tham chiếu, `ON DELETE SET NULL`, có chỉ mục). CSDL cũ: `npm run db:deploy`.

Seed: `prisma/seed.ts` sửa bộ đếm mã việc (trước để 10 cho 12 việc → mọi lệnh tạo việc 409) và gọi `prisma/seed-history.ts` (2 sprint đã đóng, 18 việc có đánh giá/giờ làm, 1 bug gốc, 1 lần mở lại). Chỉ thêm lịch sử vào CSDL đang có: `npm run prisma:seed:history -w apps/api`.

## 4. Kiểm thử và đo

| Hạng mục | Kết quả cuối sprint |
|---|---|
| Unit API | 133/133 |
| E2E API | 124/124 (ca `admin` chuỗi HMAC đôi khi đỏ theo thứ tự chạy — lỗi có từ trước, đã tách việc riêng) |
| Web | `tsc --noEmit` + ESLint sạch |
| Trình duyệt thật | puppeteer-core + Chrome headless 1600 px và 375 px, tài khoản PM `lan@` và thành viên `huy@`/`minh@`; ảnh trước/sau ở [`anh/sprint-v0/`](anh/sprint-v0/) |
| Gemini thật | rà 19 ý định (22 câu, chọn đúng 22/22) + luồng đề xuất; tổng các đợt đo ≈ 0,3 USD ước tính |

## 5. Còn lại / hạn chế đã biết

- Sửa bản nháp khi đề xuất còn lỗi cũ thì validator gọi lại model một lần (tốn thêm một lượt AI).
- Bảng tải theo tuần vẫn hiện người chỉ xem với 0 % (bảng giờ trống/ứng viên đã loại).
- Đợt cải tiến task lần 2 ([02/06](../02-phan-tich/06-cai-tien-quan-ly-task-dot-2.md)) vẫn là đề xuất, chưa code.
- Chưa mở PR `sprint_v0` → `main`.

## 6. Các nhánh đã gộp (theo thứ tự)

| # | Nhánh | Nội dung |
|---|---|---|
| 1 | `docs/w03-de-xuat-sprint-intent` | Đề xuất 02/07 |
| 2 | `feature/UC-30-burndown-so-that` | Vận tốc từ `completedAt`, snapshot start/close, forecast sprint đóng |
| 3 | `feature/UC-38-tra-cuu-mot-nguon-so` | Tra cứu sprint một nguồn số, sửa màu biểu đồ chat |
| 4 | `feature/UC-38-lam-moi-ma-sprint` | `codeMap` trong tin tra cứu, mã sprint ổn định |
| 5 | `feature/UC-31-chat-kiem-muc-rui-ro` | Chat kiểm `RISK_EXPLANATION` |
| 6 | `feature/UC-20-thong-bao-sprint` | Link thông báo đúng route, chuông thật |
| 7 | `feature/UC-09-sprint-cho-nho` | Thành viên đưa việc vào sprint, ô Sprint trong chi tiết |
| 8 | `feature/UC-16-nhat-ky-sprint` | Nhật ký sprint, nhãn dùng chung |
| 9 | `feature/UC-09-sprint-summary-api` | `GET /sprints/:id/summary` |
| 10 | `feature/UC-09-trang-sprint` | Trang Sprint + lập kế hoạch |
| 11 | `feature/UC-09-hop-thoai-bat-dau` | Hộp thoại bắt đầu sprint |
| 12 | `feature/UC-09-hop-thoai-ket-thuc` | Hộp thoại kết thúc sprint, `Idempotency-Key` |
| 13 | `feature/UC-30-van-toc-sprint` | Vận tốc cam kết/hoàn thành |
| 14 | `feature/UC-30-bao-cao-sprint` | Báo cáo sprint đã đóng |
| 15 | `feature/UC-33-dashboard-sprint` | Dashboard chọn sprint, nguyên nhân bấm được |
| 16 | `feature/UC-09-sprint-ux-polish` | Sprint/Dashboard ở 375 px, tương phản |
| 17 | `feature/UC-38-y-dinh-mot-nguon` | Danh sách ý định một nguồn |
| 18 | `feature/UC-38-tien-do-sprint-theo-nguoi` | `SPRINT_PROGRESS` theo người |
| 19 | `feature/UC-38-y-dinh-bao-cao-sprint` | Ý định `SPRINT_REPORT` |
| 20 | `feature/UC-38-y-dinh-van-toc` | Ý định `SPRINT_VELOCITY` |
| 21 | `feature/UC-38-bo-loc-tra-cuu` | Ghi chú bộ lọc bị cắt, lọc hoạt động |
| 22 | `feature/UC-38-bu-kiem-thu-tra-cuu` | E2E `TASK_BLOCKED`, `TASK_DETAIL` |
| 23 | `feature/UC-28-ai-dau-ra-bi-cat` | Token cho JSON khi Gemini 2.5 suy nghĩ |
| 24 | `feature/UC-28-the-de-xuat-ro-rang` | Thẻ đề xuất, sprint trong chat, đầu ra Gemini (F1–F3) |
| 25 | `feature/UC-38-ra-soat-y-dinh-chat` | Khối tra cứu dễ đọc, bộ lọc Gemini (F4–F6) |
| 26 | `feature/UC-35-ghi-gio-danh-gia` | Ghi giờ, đánh giá, bug gốc, engine hồ sơ kỹ năng, seed lịch sử |
| 27 | `feature/UC-24-tab-nhan-su` | Tab Nhân sự làm lại |
| 28 | `feature/UC-28-chat-hien-dan` | Chat bám đáy, khối hiện dần |
| 29 | `feature/UC-24-gon-tab-nhan-su` | Nhân sự 3 tab, chờ đánh giá sang Dashboard |
| 30 | `chore/sprint-v0-tai-lieu` | Đổi tên nhánh, tài liệu tổng kết, quy tắc git, workflow tên nhánh |
