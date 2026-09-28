# 07 · Nghiên cứu và đề xuất cải tiến **Sprint** và **tra cứu dữ liệu của Trợ lý AI** (DATA_QUERY)

**Phiên bản:** 1.0 — **Ngày:** 28/09/2026 (Tuần 03) — **Trạng thái:** chờ duyệt, chưa viết dòng mã nào.
**Phạm vi:** UC-09 (Sprint), UC-30 (burn-down & vận tốc), UC-31 (dự báo), UC-33 (Dashboard — phần sprint), UC-38 (chat theo phiên — phần tra cứu), docs [04/14](../04-kien-truc/14-tra-cuu-hoi-dap.md).

> **Quan hệ với đợt 2** ([02/06](06-cai-tien-quan-ly-task-dot-2.md), 25/09, vẫn *chờ duyệt*, chưa có mục nào được code — `seed.ts` vẫn `taskCounter: 10`). Tài liệu này **không lặp lại** mục nào của đợt 2. Ba chỗ chạm nhau được ghi rõ tại chỗ: B2 của đợt 2 (thẻ số Dashboard bấm được) ↔ C4 ở đây; B4 (bảng năng lực khi giao việc) ↔ C1; D2 (seed đủ mô hình) ↔ A6. Đợt 2 dùng số phase 12–14, đợt này dùng **15–17**.

**Ràng buộc giữ nguyên:** ranh giới AI ([04/04 §0](../04-kien-truc/04-cong-thuc-tinh-toan.md), [04/05](../04-kien-truc/05-ai-agent.md)) — **LLM suy luận/chọn ý định, backend tính, kiểm, ghi**; reply của LLM không chứa số cho phần tra cứu · quy ước API [04/11 §2](../04-kien-truc/11-chot-chuc-nang-va-api.md) (mọi `PATCH` task mang `version`; client ghi REST, socket chỉ nhận; VIEWER chỉ GET; start/close là `pj:PM`) · quy ước giao diện [04/10](../04-kien-truc/10-quy-uoc-giao-dien.md) · mốc **16/10** cho mọi thay đổi lược đồ CSDL, **05/11** feature freeze.

---

## 1. Cách nghiên cứu

| Bước | Đã làm |
|---|---|
| Đọc tài liệu | Memory dự án; README; docs 04/{03, 04, 05, 08, 10, 11, 12, 14}; 05/{web-tich-hop, web-cai-tien-task, phase-3, phase-7, phase-8}; 02/{05, 06}; 20 commit gần nhất (đặc biệt `9b4dcab` — thêm `TASK_CANDIDATES` và sửa JSON méo) |
| Đọc mã backend | `sprints/**` (service 287 dòng), `forecast/**` (service 405 dòng + `domain/burndown.ts`), phần `dashboard` trong `projects.service.ts`, `workload.service.ts` (`capacityTable`, `computeUsers`), `activity.listener.ts`, `notifications.listener.ts`, `ai/query/query.service.ts` (1.653 dòng), `packages/shared/src/data-query.ts`, `ai/prompt/master-prompt.ts`, `ai/provider/response-schemas.ts`, `ai/chat/chat.service.ts`, `ai/context/context-builder.service.ts`, `test/ai-query.e2e-spec.ts` |
| Đọc mã web | `features/project-settings/SprintsTab.tsx`, `features/backlog/BacklogView.tsx`, `features/work/{filters, WorkFilterBar, BulkActionBar}.tsx`, `features/dashboard/ProjectDashboardView.tsx`, `features/timeline/TimelineGanttView.tsx`, `components/app/{AppShell, TaskDetailModal}.tsx`, `features/assistant/{QueryBlocks, AssistantView}.tsx`, `features/notifications/NotificationsPanel.tsx` |
| Chạy thật | **Stack riêng**: API `PORT=3100 CORS_ORIGIN=http://localhost:3003 AI_PROVIDER=fake` (ép `fake` vì `apps/api/.env` đang để `AI_PROVIDER=gemini`), web `PORT=3003` trỏ vào 3100. Đã kiểm mọi request thực sự đi tới origin `3100` (không bị `.env.local` đè). Postgres 5434, dữ liệu seed |
| Thao tác thật | Chrome headless 1600×1000 qua `puppeteer-core` của repo, tài khoản `lan@` (PM) và `minh@` (thành viên): tạo sprint, kéo việc từ Backlog vào, bắt đầu sprint thứ hai (409), kết thúc sprint có việc dở, bắt đầu sprint mới, xem Dashboard, thông báo, thành viên thử đưa việc vào sprint; thêm một lượt 375 px |
| Tầng tra cứu | **Không gọi Gemini.** Gọi thẳng `POST /ai/query` (endpoint "Làm mới", 0 token) cho cả 17 ý định, đối chiếu số với `GET /projects/:id/sprints`, `/sprints/:id/{burndown,forecast}`, `/projects/:id/dashboard`. Để chụp cách **vẽ** khối, chèn tạm 5 lượt hỏi–đáp vào một phiên chat thử, mỗi `queryResult` là **đầu ra thật** của `POST /ai/query` |
| Đối chiếu | `psql` trên mọi con số; Jira (Sprint planning, Complete sprint, Sprint report, Velocity chart) và Linear (Cycles) — **chỉ cơ chế** |
| Dọn dẹp | `pg_dump` trước khi đo; đo xong dừng stack riêng và `pg_restore` lại. Đã kiểm: 2 sprint (Sprint 1 ACTIVE, Sprint 2 PLANNED), 12 việc, `task_counter = 12`, activity 8, thông báo 1, phiên chat 1, token log 21 — **đúng như trước khi đo**. Không có phiên song song nào chạy trong lúc đo (cổng 3000–3002 trống) |

> **Một sự cố trong lúc đo, giữ lại làm bằng chứng:** kịch bản định bắt đầu "Sprint 3" nhưng bấm vào nút ▷ cuối bảng — mà bảng xếp theo ngày bắt đầu nên dòng cuối là **Sprint 2**. Nút không hỏi lại, Sprint 2 chạy luôn. Người thật cũng sẽ nhầm như vậy — xem M3.

---

## 2. Những gì đang tốt — không đụng vào

| Thứ | Đo được |
|---|---|
| Một sprint ACTIVE mỗi dự án | Hai lớp chặn: service kiểm trước + partial unique index `sprints_one_active` ở CSDL. Bắt đầu sprint thứ hai → **409 `SPRINT_ALREADY_ACTIVE`**, toast tiếng Việt |
| Đóng sprint là một transaction | Việc dở chuyển đi + `status=CLOSED` trong cùng `$transaction`; `version` của từng việc được tăng nên client đang giữ bản cũ sẽ nhận 409 đúng quy ước |
| Đưa vào sprint hàng loạt | **1 request** (`POST /sprints/:id/tasks`) cho cả lô, 1 GET làm mới — không phải n request |
| Quyền đọc/ghi sprint | Thành viên xem được tab Sprint nhưng không có nút sửa/bắt đầu/kết thúc; API `assertManage` đúng docs 11 |
| Công thức burn-down | `domain/burndown.ts` thuần, có spec (lý tưởng, vận tốc 5 ngày, ETA, 3 mức rủi ro, scope creep, sprint < 3 ngày) — đúng docs 04 §8 |
| Tầng tra cứu nói chung | 16/17 ý định chạy < 60 ms (nặng nhất `CAPACITY_FREE` 96 ms); quyền theo ý định đúng (`AI_USAGE`, `CAPACITY_FREE`, `TASK_CANDIDATES` trả `note` cho thành viên); schema `.strict()`; giới hạn nhịp; cắt payload — 11 rủi ro ở docs 14 §5 vẫn chặn được |
| Khối hiển thị | `stat_row`, `table`, `heatmap`, `people_list` đọc được, có "Số liệu lúc…", **Làm mới** không tốn lượt AI |

---

## 3. Lỗi đo được

### 3.1 Sprint

| # | Lỗi | Bằng chứng | Mức |
|---|---|---|---|
| **L1** | **Vận tốc phụ thuộc cron snapshot.** Seed có **0** dòng `burndown_snapshots`; cron 00:05 chỉ ghi khi API đang chạy lúc nửa đêm. Vận tốc chỉ đọc từ snapshot → thiếu snapshot thì vận tốc sai: không có bản chụp nào ngoài "hôm nay" mà hôm nay xong 10 h thì ra **10 h/ngày** (đúng phải là 2 h/ngày trên 5 ngày làm việc). *Đính chính sau khi hiện thực A2 (28/09):* trên seed hiện tại, "Rủi ro cao" của Sprint 1 là **đúng** theo công thức — hai việc đã xong hoàn thành 16/09 và 19/09, trong 5 ngày làm việc gần nhất không xong việc nào; bản nháp đầu gọi đây là "báo động giả" là sai. | `GET /sprints/{S1}/burndown` → `actual` 1 điểm (hôm nay), `velocity: 0`. Ảnh: [Dashboard trước khi đổi sprint](anh/cai-tien-sprint-intent/01-dashboard-sprint1-truoc.png) — đường thực tế chỉ là một chấm | 🔴 |
| **L2** | **Sprint đã đóng mất sạch lịch sử.** `close()` không chụp snapshot cuối và chuyển việc dở ra khỏi sprint → sau khi đóng, burn-down trả `actual: []`; forecast báo **`LOW`, còn 0 h, ETA = ngày kết thúc** — trong khi vừa đẩy **7 việc / 30,6 h** sang backlog. | `GET /sprints/{S1}/burndown` sau khi đóng: `"actual":[]`; `forecast`: `"remainingHours":0,"riskLevel":"LOW"` | 🔴 |
| **L3** | **Link thông báo sprint dẫn tới trang 404.** `notifications.listener` ghi `link: /p/ST/sprints` (việc được giao: `/p/ST/t/ST-6`) nhưng web không có route `/p/...`; `NotificationsPanel` ưu tiên `n.link`. | Đăng nhập `minh@`, Cài đặt → Thông báo → bấm "Sprint 1 (ST) đã kết thúc" → `http://localhost:3003/p/ST/sprints` **404**. Ảnh: [404](anh/cai-tien-sprint-intent/19b-bam-thong-bao-sprint-404.png) | 🟠 |
| **L4** | **Chuông trên thanh trên đang hiện thông báo GIẢ.** `AppShell.tsx` vẫn `import { MOCK_NOTIFICATIONS }`; popover hiện "Huy đạt 118%", "Đề xuất cân bằng tải mới từ AI Agent"… Thông báo thật "Sprint 1 đã kết thúc" **không có trong chuông**, chỉ thấy khi vào Cài đặt. Trước hội đồng, số "118%" không khớp bất cứ màn nào. | Ảnh: [chuông hiện dữ liệu giả](anh/cai-tien-sprint-intent/18-chuong-hien-thong-bao-gia.png) so với [trang thông báo thật](anh/cai-tien-sprint-intent/19-trang-thong-bao-that.png) | 🟠 |
| **L5** | **Thành viên được mời bấm "Đưa vào sprint" rồi bị từ chối.** Thanh hàng loạt hiện cho `canEdit` (có MEMBER) nhưng gọi `POST /sprints/:id/tasks` (`pj:PM`). Trong khi đó cùng người ấy **đổi được sprint từng việc** qua `PATCH /tasks/:id` (`pj:MEMBER`) — hai đường, hai luật. | `minh@` chọn 1 việc → Sprint → Sprint 2 → Xác nhận → toast **"Đã đưa vào sprint thất bại · FORBIDDEN"**. Ảnh: [403](anh/cai-tien-sprint-intent/20-thanh-vien-dua-vao-sprint-403.png) | 🟠 |
| **L6** | **Không đưa được việc vào sprint PLANNED từ chi tiết việc.** Ô "Sprint" trong `TaskDetailModal` chỉ liệt kê Backlog, sprint đang chạy và sprint hiện tại của việc — lập kế hoạch sprint sau phải đi đường vòng qua Backlog + thanh hàng loạt. | `TaskDetailModal.tsx` dòng 345–358 | 🟡 |
| **L7** | **Bắt đầu sprint trước ngày bắt đầu làm lệch trục burn-down.** Sprint 2 (29/09→13/10) bắt đầu ngày 28/09 → điểm thực tế đầu tiên nằm **ngoài** đường lý tưởng; trên 375 px trục X bắt đầu từ 09-28. Không có cảnh báo. | Ảnh: [burn-down 375 px](anh/cai-tien-sprint-intent/28b-mobile-burndown.png) | 🟡 |
| **L8** | Thêm việc vào sprint hàng loạt **không để lại dấu vết** trong nhật ký: `addTasks()` chỉ phát `sprint.updated`, mà `activity.listener` không nghe sự kiện này. → không thể biết việc nào được thêm **sau khi sprint bắt đầu** (mục "Added after sprint start" của Jira). | Đọc mã `activity.listener.ts` (chỉ `sprint.started`, `sprint.closed`) | 🟡 |

### 3.2 Tra cứu (DATA_QUERY) — "cùng một câu hỏi, hai nơi ra hai số"

Đo trên cùng một thời điểm, cùng dữ liệu:

| Câu hỏi | Màn hình nói | Tra cứu nói | Vì sao lệch |
|---|---|---|---|
| Sprint 2 có mấy việc? *(sau khi thêm 1 việc con thử)* | Tab Sprint: **2** | `SPRINT_LIST`: **3**; `SPRINT_PROGRESS`: **0/3** | `query.service` đếm `_count.tasks` không lọc `parentId`, `deletedAt`; service sprint thì lọc |
| Sprint 2 còn bao nhiêu giờ? | Dashboard/forecast: **28 h** | `SPRINT_PROGRESS`: **33 h** | Tra cứu tự cộng `remainingHours ‖ estimateHours` kể cả việc con; forecast dùng `remainingOf` chỉ trên việc gốc |
| Ai đang quá tải tuần này? *(lúc bắt đầu đo)* | Dashboard: Huy **0 %** (0/36 h) | `WORKLOAD_WEEK`: Huy **39 %** | Dashboard đọc `workload_snapshots` đã cũ (chỉ cập nhật theo sự kiện/cron); tra cứu tính trực tiếp. Sau khi đóng sprint snapshot mới được tính lại và hai nơi mới khớp |
| Thống kê việc *(`TASK_STATS`, `limit: 3`)* | — | "Công việc **7** · Quá hạn **3** · Chưa giao **1** · Giờ còn lại **10,6 h**" (đúng phải là 7 · 7 · 3 · 30,6) | Thẻ "Công việc" dùng `count()` nhưng các thẻ còn lại và biểu đồ chỉ cộng trên **`limit` dòng đầu**; không có cờ `truncated` |
| Hoạt động lúc nào? | Dashboard: "24/09 **15:24**" | `ACTIVITY_FEED`: "2026-09-24 **08:24**" | Tra cứu in `toISOString()` (UTC) |
| Sprint còn mấy ngày? *(ngày cuối sprint)* | — | "Còn **0** ngày" | Đếm ngày lịch, làm tròn xuống, không tính hôm nay; forecast đếm ngày làm việc |

Ngoài chuyện lệch số:

| # | Lỗi | Bằng chứng | Mức |
|---|---|---|---|
| **Q1** | **Biểu đồ của `SPRINT_PROGRESS` trống trơn.** Khối tự dựng **3 điểm bịa** (ngày bắt đầu = scope ban đầu, hôm nay = còn lại, ngày kết thúc = 0), điểm đầu là `Prisma.Decimal` nên ra **chuỗi `"28"`**, các nhãn không theo thứ tự ngày (`09-29, 09-28, 10-13`) → Recharts không vẽ được đường nào. `source.endpoint` ghi `GET /sprints/:id/burndown` nhưng không gọi endpoint đó. | JSON: `"points":[{"label":"2026-09-29","value":"28"},{"label":"2026-09-28","value":28},…]`. Ảnh: [biểu đồ trống](anh/cai-tien-sprint-intent/21-chat-sprint-progress-bieu-do-trong.png) | 🔴 |
| **Q2** | **"Làm mới" vỡ trên phiên chỉ có tra cứu.** `codesOfSession` lấy bảng mã từ `ai_proposals.code_map` mới nhất của phiên — nhưng lượt `DATA_QUERY` **không tạo proposal** → phiên nào chỉ hỏi–đáp tra cứu thì mọi mã `s`/`u`/`t` trong truy vấn đều không giải được. | Bấm **Làm mới** trên khối `SPRINT_PROGRESS` có `sprint: "s2"` → toast **"Mã tham chiếu không có trong ngữ cảnh · UNKNOWN_CODE"**. Ảnh: [Làm mới lỗi mã](anh/cai-tien-sprint-intent/26-chat-lam-moi-loi-ma.png) | 🔴 |
| **Q3** | **Không hỏi được về sprint đã đóng.** `ContextBuilder` chỉ cấp mã `s` cho sprint PLANNED/ACTIVE → LLM không có mã để nói "Sprint 1". Thêm nữa, mã được cấp **theo thứ tự trong tập đó**, nên đóng một sprint là **mọi mã `s` dịch đi một bậc** — truy vấn cũ lưu trong lịch sử trỏ sang sprint khác. | `context-builder.service.ts` dòng 115–118, 151 | 🟠 |
| **Q4** | **Bộ lọc bị bỏ lặng lẽ.** `pruneQuerySpec` cắt field không thuộc ý định mà không báo: "hoạt động **của tôi**" (`ACTIVITY_FEED` + `user`) trả cả nhóm; "tiến độ sprint **của tôi**" (`SPRINT_PROGRESS` + `assignee`) trả cả sprint; "ai còn giờ trống **trong sprint này**" (`CAPACITY_FREE` + `sprint`) trả cửa sổ 28 ngày; `SPRINT_PROGRESS` + `sprint: "__all"` lặng lẽ trả sprint đang chạy. | 4 lời gọi `POST /ai/query` đều **200**, không `note` nào | 🟠 |
| **Q5** | **Khối khó đọc.** `SPRINT_LIST`/`SPRINT_PROGRESS` in trạng thái thô `ACTIVE`/`CLOSED`; `ACTIVITY_FEED` in mã hành động `task.updated`, `sprint.closed` (không tên sprint, không số việc bị đẩy); `SPRINT_LIST` không có giờ, không % xong. Màn Dashboard thì in "Lan cập nhật ST-6 · tiến độ". | Ảnh: [activity mã thô, giờ UTC](anh/cai-tien-sprint-intent/23-chat-activity-ma-tho-gio-utc.png), [danh sách sprint](anh/cai-tien-sprint-intent/24-chat-sprint-list.png) | 🟡 |
| **Q6** | **Hỏi "có kịp không" trong chat là lỗ hổng ranh giới AI.** Prompt CHAT bảo "Hỏi về rủi ro sprint → `RISK_EXPLANATION` (riskLevel PHẢI trùng số backend **nếu có trong ngữ cảnh**)" — nhưng ngữ cảnh CHAT **không nạp** số forecast (chỉ mục đích EXPLAIN nạp) và `ChatService.stage()` **không kiểm** `RISK_EXPLANATION` (chỉ nhánh `POST /sprints/:id/forecast/explain` gọi `validateExplain`). Tức là LLM có thể tự chọn mức rủi ro và nó được hiển thị như sự thật. Ô nhập của Trợ lý còn gợi ý đúng câu *"sprint này có kịp không?"*. | Đọc mã `master-prompt.ts` (mục CHAT), `context-builder.service.ts` dòng 259–271, `chat.service.ts` (nhánh cuối `stage()` trả `validation: null`). **Chưa chạy với Gemini thật** — cần anh cho phép | 🔴 |
| **Q7** | **Danh sách ý định viết tay ở ba nơi** (`QUERY_INTENTS` trong shared, enum trong `response-schemas.ts`, câu liệt kê trong master prompt). Thêm một ý định mà quên một chỗ thì Gemini bị `responseSchema` chặn hoặc không biết mà chọn. | `data-query.ts`, `response-schemas.ts` dòng 108–128, `master-prompt.ts` | 🟡 |

**Độ phủ kiểm thử của 17 ý định** (`apps/api/test/ai-query.e2e-spec.ts`, 20 ca):

| Ý định | Câu hỏi mẫu | Filter nhận | Khối trả về | e2e | Kết quả chạy thật 28/09 |
|---|---|---|---|---|---|
| `TASK_LIST` | "còn việc nào chưa giao" | assignee, status, taskType, priority, dueRange, unassignedOnly, q | `task_list` | ✔ nhiều ca | 7 việc mở của Sprint 1 — đúng |
| `TASK_AGENDA` | "hôm nay tôi làm gì" | như trên | `agenda` | ✔ | `assignee:["me"]` của Lan → rỗng — đúng (Lan không có việc) |
| `TASK_DETAIL` | "ST-6 thế nào" | task | `person_card` | ✘ | Không gọi được ngoài phiên (cần mã `t`) |
| `TASK_STATS` | "mỗi cột bao nhiêu việc" | như TASK_LIST | `stat_row` `bar_chart` `table` | ✔ 1 ca, không thử `limit` | **Sai khi `limit` < tổng** (bảng trên) |
| `TASK_BLOCKED` | "việc nào bị chặn" | assignee, status, taskType, priority, q | `task_list` | ✘ | Rỗng — đúng (seed 0 phụ thuộc) |
| `MEMBER_LIST` | "danh sách thành viên" | — | `people_list` | ✔ | 6 người — đúng |
| `MEMBER_PROFILE` | "Huy đang làm gì" | user | `person_card` `task_list` | ✔ | Đúng |
| `WORKLOAD_WEEK` | "ai quá tải" | — (bỏ `sprint`) | `stat_row` `heatmap` | ✔ chỉ đếm dòng | Lệch Dashboard 39 % vs 0 % |
| `CAPACITY_FREE` | "ai còn giờ trống" | — (bỏ `sprint`) | `note` `table` | ✔ | Cửa sổ 28 ngày cố định, không theo sprint |
| `WHO_KNOWS_SKILL` | "ai biết NestJS ≥ 4" | skill, minLevel | `people_list` | ✔ | Đúng |
| `TASK_CANDIDATES` | "ai làm được t7" | task, draft | `note` `table` | ✔ 4 ca | Không đo (cần mã phiên) |
| `BUS_FACTOR` | "kỹ năng nào chỉ 1 người biết" | minLevel | `note` `table` | ✔ | 22 kỹ năng — đúng |
| `SPRINT_LIST` | "có mấy sprint" | — | `table` | ✔ tên sprint | **Đếm cả việc con/việc đã xoá**; trạng thái thô |
| `SPRINT_PROGRESS` | "sprint còn mấy ngày" | — (bỏ `assignee`) | `stat_row` `line_chart` | ✔ chỉ ô "Xong" | **Biểu đồ trống; giờ lệch forecast; không ETA/rủi ro** |
| `ACTIVITY_FEED` | "hôm qua ai sửa gì" | — (bỏ `user`, không có lọc ngày) | `activity_list` | ✔ chỉ `source` | **Giờ UTC; mã thô; "hôm qua" bị bỏ** |
| `NOTIFICATION_LIST` | "tôi có thông báo gì" | — | `stat_row` `activity_list` | ✔ | Đúng |
| `AI_USAGE` | "tháng này tốn bao nhiêu AI" | groupUsageBy | `stat_row` `table` | ✔ | Đúng; thành viên nhận `note` |

---

## 4. Thiếu so với phạm vi **đã chốt**

Không phải ý tưởng mới — đều đã ghi trong [04/03](../04-kien-truc/03-use-case.md) hoặc [04/11](../04-kien-truc/11-chot-chuc-nang-va-api.md).

| # | Đã chốt ở đâu | Hiện trạng |
|---|---|---|
| T1 | UC-09 "kéo backlog vào **[ĐV]**; kết thúc, **chuyển việc dở [DB]**" | Kéo vào có (qua Backlog + thanh hàng loạt). Kết thúc: hộp thoại chỉ có ô chọn đích, không cho biết **bao nhiêu việc / việc nào** sẽ bị chuyển |
| T2 | UC-30 "**vận tốc** [ĐR]" · 04/11 §1.1 mục 18 "Burn-down & vận tốc" | "Vận tốc" hiện chỉ là **giờ xong/ngày trong một sprint**. Không có vận tốc **giữa các sprint** (cam kết vs hoàn thành) — thứ mà người ta hỏi khi nói "vận tốc 3 sprint gần nhất" và thứ duy nhất giúp lập kế hoạch sprint sau |
| T3 | UC-30 "đánh dấu **scope creep** [ĐR]" | Backend tính `scopeCreepDays`, nhưng Dashboard **không vẽ** và nguyên nhân chỉ hiện dạng chip mã `SCOPE_CREEP ×n` |
| T4 | UC-28 luồng chính "tổng giờ **so với năng lực còn lại sprint**" | Chỉ AI phân rã nhìn thấy năng lực sprint (trong prompt). Người lập kế hoạch bằng tay **không có chỗ nào** thấy giờ cam kết so với năng lực |
| T5 | UC-33 "burn-down thu nhỏ" | `burndownMini` của `/dashboard` lấy `lastSnapshot` (đang `null` vì 0 snapshot) nên Dashboard phải gọi thêm burndown + forecast; không xem được sprint nào khác ngoài sprint đang chạy |
| T6 | 04/11 §2 "`POST /sprints/:id/close` nhận `Idempotency-Key`" | Chưa hiện thực (chỉ `apply` của AI có). Bấm "Kết thúc" hai lần do mạng chậm → lần hai `409 SPRINT_NOT_ACTIVE` thay vì trả lại kết quả cũ |
| T7 | 04/14 §5 "Số cũ trong lịch sử chat → Làm mới" | Vỡ ở phiên chỉ có tra cứu (Q2) |

---

## 5. Ma sát khi dùng thật

**Lập kế hoạch một sprint mới** (tạo → kéo việc từ Backlog → xem tổng giờ so với năng lực → bắt đầu), đo bằng cú bấm thật với *k* việc:

| Bước | Màn | Cú bấm | Request |
|---|---|---|---|
| Dashboard → "Cấu hình dự án" | Cấu hình | 1 | 1 GET |
| "Tạo sprint" → gõ tên, mục tiêu → "Lưu" | Cấu hình (hộp thoại) | 2 | 1 POST + **4 GET** (`/sprints` bị gọi **2 lần**) |
| Sidebar "Công việc" → tab "Backlog" | Công việc | 2 | 3 GET |
| Chọn *k* việc | Backlog | *k* | 0 |
| "Sprint" → chọn sprint → "Xác nhận" | Backlog (menu + hộp thoại) | 3 | 1 POST + 1 GET |
| Xem tổng giờ so với năng lực | — | **không có chỗ nào** | — |
| Sidebar "Cấu hình" → ▷ "Bắt đầu" | Cấu hình | 2 | 1 POST + 3 GET |
| **Tổng** | **3 lần đổi màn** | **10 + *k*** | |

Đối chiếu: Jira làm cả việc này trên **một** màn Backlog — sprint nằm ngay trên backlog, kéo việc lên, đầu sprint hiện tổng ước lượng, nút "Start sprint" ở đó. Linear hiện "capacity" của cycle tính từ **vận tốc 3 cycle trước**.

| # | Ma sát | Đo được |
|---|---|---|
| **M1** | Sprint là một **tab trong "Cấu hình dự án"** — với PM là việc hằng tuần, với thành viên là chỗ duy nhất xem danh sách sprint. Không có trang sprint riêng, không có đường nào từ huy hiệu "Sprint 2" trên thanh trên | 3 lần đổi màn/lượt lập kế hoạch (bảng trên) |
| **M2** | **Không thấy năng lực khi lập kế hoạch.** Cột "Giờ ước / còn" có, năng lực thì không; bảng năng lực (`CapacityTable`) chỉ có ở tab Cân bằng và chỉ cho **sprint đang chạy** | 0 chỗ |
| **M3** | **"Bắt đầu" một cú là chạy, không hỏi lại.** Bảng xếp theo ngày bắt đầu nên sprint vừa tạo nằm giữa; hai sprint PLANNED có hai nút ▷ giống hệt nhau. Kịch bản đo đã bấm nhầm Sprint 2 | Ảnh: [bấm nhầm](anh/cai-tien-sprint-intent/13-bam-nham-bat-dau-sprint2.png) |
| **M4** | **Toast 409 không nói sprint nào đang chạy** dù API trả `details.active {id, name}`; không có nút "Kết thúc Sprint 1 trước" | Ảnh: [409](anh/cai-tien-sprint-intent/10-bat-dau-sprint-thu-hai-409.png) |
| **M5** | **Ngày mặc định khi tạo sprint chồng lên sprint kế tiếp** (28/09→11/10 trong khi Sprint 2 là 29/09→13/10); không cảnh báo chồng ngày; ngày tính bằng `toISOString()` nên trước 7 giờ sáng giờ VN sẽ ra **hôm qua** | Ảnh: [hộp thoại tạo](anh/cai-tien-sprint-intent/03-hop-thoai-tao-sprint.png) |
| **M6** | **Đóng sprint "mù".** Hộp thoại chỉ nói "30.6 h còn lại" — không nói **7 việc**, không liệt kê; toast "Đã kết thúc sprint" không có số. Sang Backlog thấy "7 việc · tổng ước lượng **51h**" — **hai con số khác nhau** cho cùng "việc dở" (còn lại vs ước lượng), và không việc nào mang dấu "từ Sprint 1" | Ảnh: [hộp thoại kết thúc](anh/cai-tien-sprint-intent/11-hop-thoai-ket-thuc-sprint.png), [Backlog sau khi đóng](anh/cai-tien-sprint-intent/15-backlog-nhan-7-viec-do.png) |
| **M7** | **Sprint đã đóng là ngõ cụt.** Dòng CLOSED không có nút nào, không bấm được; Dashboard chỉ có sprint đang chạy → không xem lại được burn-down, việc đã xong, việc bị đẩy đi | Ảnh: [sau khi kết thúc](anh/cai-tien-sprint-intent/12-sau-khi-ket-thuc.png) |
| **M8** | **Nguyên nhân rủi ro là mã máy.** `OVERDUE ×7`, `UNASSIGNED ×3` — không tiếng Việt, không bấm được để ra đúng 7 việc (API đã trả sẵn `taskIds`) | Ảnh: [Dashboard](anh/cai-tien-sprint-intent/14-dashboard-sau-khi-doi-sprint.png) |
| **M9** | **Mục tiêu sprint (goal) gần như vô hình**: một dòng 10 px bị cắt trong tab Cấu hình; Dashboard, Kanban, thanh trên đều không hiện | Ảnh: [tab Sprint](anh/cai-tien-sprint-intent/02-tab-sprint-trong-cau-hinh.png) |
| **M10** | Trạng thái in tiếng Anh `ACTIVE/PLANNED/CLOSED` ở tab Sprint, ô lọc, thanh hàng loạt ("Sprint 2 · PLANNED"), khối chat | Mọi ảnh |
| **M11** | **375 px:** bảng sprint mất cột thao tác (không sửa/bắt đầu/kết thúc được); Dashboard cuộn ngang (**`scrollWidth` 481** > 375) | Ảnh: [tab Sprint 375](anh/cai-tien-sprint-intent/27-mobile-tab-sprint.png), [Dashboard 375](anh/cai-tien-sprint-intent/28-mobile-dashboard.png) |
| **M12** | Không có phím tắt nào cho sprint (đúng thôi — nhưng nếu có màn lập kế hoạch thì cần tối thiểu: chọn + đưa vào sprint bằng bàn phím, theo quy tắc 04/10 §6.1) | — |

**Bốn trạng thái theo 04/10:** tab Sprint có đủ (Skeleton, ErrorState, EmptyState, bảng). Thẻ burn-down trên Dashboard thì trạng thái "rỗng" là một dòng chữ nhỏ, và trạng thái "có dữ liệu nhưng chỉ 1 điểm" (L1) trông như rỗng mà không nói vì sao.

---

## 6. Đề xuất

Ký hiệu công sức: **S** ≤ nửa ngày · **M** 1–2 ngày · **L** 3+ ngày. Mỗi mục nêu: endpoint mới hay không, có đụng `version`/realtime không, có đổi lược đồ CSDL không.

> **Tin tốt về lược đồ:** không mục nào *bắt buộc* đổi lược đồ. Mọi thứ cần cho báo cáo sprint và vận tốc đã có chỗ chứa: `burndown_snapshots` (số cuối sprint), `sprints.scope_hours_initial` (cam kết), `activity_logs.diff` JSON (việc bị đẩy đi — `sprint.closed` **đã** ghi `movedTaskIds`). Chỉ có **một lựa chọn tuỳ chọn** (C2-b) thêm cột — nếu chọn thì phải xong trước **16/10**.

### Nhóm A — Số liệu đúng trước đã (rẻ, làm trước mọi thứ)

#### A1 · Một nguồn số cho mọi câu hỏi về sprint 🔴 — **M**

- **Vấn đề:** L1, L2, Q1, bảng §3.2. Nguyên nhân chung: `query.service` **tự cộng lại** thay vì gọi đúng service mà màn hình dùng.
- **Cách làm:** `SPRINT_LIST` gọi `SprintsService.list()`; `SPRINT_PROGRESS` gọi `ForecastService.burndown()` + `forecast()` (và C1 `summary()` khi có) — không còn câu `findMany` riêng nào cho sprint trong `query.service`. `line_chart` lấy đúng `ideal[]`/`actual[]` của burndown (hết 3 điểm bịa, hết chuỗi `"28"`). `TASK_STATS` đếm bằng `groupBy`/`count` trên **toàn bộ** tập khớp lọc, chỉ danh sách mới bị `limit`. Số ngày còn lại = **ngày làm việc** theo lịch workspace, tính cả hôm nay.
- **Kiểm thử "một câu hỏi, một số"** (e2e mới): `SPRINT_PROGRESS.remaining == forecast.remainingHours`; `SPRINT_LIST.tasks == GET /sprints[].taskCount` (kể cả khi có việc con và việc đã xoá); `TASK_STATS` với `limit: 1` vẫn ra đúng tổng; `WORKLOAD_WEEK` khớp `GET /projects/:id/workload`.
- **Endpoint / version / realtime / lược đồ:** không đổi gì.
- **Rủi ro:** thấp. Đây là việc **xoá mã** nhiều hơn viết.

#### A2 · Burn-down có số thật ngay cả khi thiếu snapshot 🔴 — **S**

- **Vấn đề:** L1 (vận tốc phụ thuộc cron), L2 (sprint đóng mất lịch sử).
- **Cách làm:**
  1. **Vận tốc tính từ `completedAt` của việc**, không từ snapshot. Định nghĩa trong 04/04 §8 là "Completed(d) = giờ hoàn thành trong ngày" — mà giờ hoàn thành trong ngày *chính là* Σ ước lượng của việc có `completedAt` rơi vào ngày đó. Cùng công thức, bỏ được sự phụ thuộc vào cron. Sửa một chỗ trong `ForecastService`, giữ nguyên `domain/burndown.ts`.
  2. **Chụp snapshot lúc bắt đầu và lúc kết thúc** — lúc kết thúc chụp **bên trong transaction, trước khi chuyển việc dở**, để số cuối sprint (scope, còn lại, đã xong) được giữ lại.
  3. **Forecast của sprint CLOSED** trả số từ snapshot cuối (còn lại lúc đóng, đã xong) và `riskLevel: "CLOSED"` hoặc bỏ trống — không trả `LOW` nữa.
  4. Khi thiếu snapshot giữa chừng, đường "thực tế" nối các điểm có thật và **ghi rõ** "thiếu số liệu ngày X–Y" trên biểu đồ thay vì vẽ như rỗng.
- **Endpoint / lược đồ:** không. **Cần sửa docs 04/04 §8** một dòng (nguồn của Completed).
- **Rủi ro:** thấp; `burndown.spec.ts` giữ nguyên, thêm ca "không có snapshot vẫn có vận tốc".

#### A3 · "Làm mới" không vỡ và mã sprint không trôi 🔴 — **S**

- **Vấn đề:** Q2, Q3.
- **Cách làm:** (a) `ChatService` lưu `codeMap` **ngay trong** `structured_data` của tin nhắn `DATA_QUERY`; `codesOfSession` đọc tin nhắn trước, proposal sau. (b) `ContextBuilder` cấp mã `s` cho **mọi** sprint của dự án theo thứ tự ổn định (ngày bắt đầu, rồi ngày tạo), chỉ **hiển thị** trong prompt các sprint PLANNED/ACTIVE + **3 sprint CLOSED gần nhất** (để khỏi phình prompt). Mã một sprint không đổi suốt đời dự án.
- **Endpoint / lược đồ:** không. **Ảnh hưởng cache prompt:** phần "DỰ ÁN & SPRINT" nằm trong khối tĩnh — đổi khi có sprint mới, như hiện nay.
- **Rủi ro:** thấp. E2e: "phiên chỉ có tra cứu vẫn Làm mới được", "đóng sprint xong, mã s cũ vẫn trỏ đúng sprint".

#### A4 · Chat không được tự quyết mức rủi ro 🔴 — **S**

- **Vấn đề:** Q6 — lỗ hổng ranh giới AI.
- **Cách làm:** (a) Sửa mục CHAT của master prompt: câu "có kịp không / còn bao nhiêu giờ / rủi ro thế nào" → `DATA_QUERY` `SPRINT_PROGRESS` (khối do backend tính, có ETA và mức rủi ro — xem D1). "Giải thích vì sao / nên làm gì" mới là `RISK_EXPLANATION`. (b) `ChatService.stage()` gặp `RISK_EXPLANATION` thì nạp forecast của sprint đang chọn và chạy `validateExplain` như nhánh EXPLAIN; lệch mức → validation lỗi, **không** hiển thị mức của LLM.
- **Endpoint / lược đồ:** không.
- **Rủi ro:** thấp. **Cần gọi Gemini thật để kiểm** — sẽ hỏi anh trước (câu 5 ở §10).

#### A5 · Thông báo sprint đi đúng chỗ và chuông hiện thông báo thật 🟠 — **S**

- **Vấn đề:** L3, L4.
- **Cách làm:** `notifications.listener` sinh link theo route web thật (`/projects/:id/sprints/:sprintId` khi có C1, tạm thời `/projects/:id/settings?tab=sprints`; việc: `/projects/:id/tasks/ST-n`). Web thêm một route nhỏ `/p/[key]/...` chuyển hướng cho các thông báo **đã lưu** với link cũ. Chuông trong `AppShell` đọc `GET /notifications` (hook `useBellCount`/`NotificationsPanel` đã có) thay cho `MOCK_NOTIFICATIONS`, rồi xoá `src/mocks/notifications.ts`.
- **Endpoint / lược đồ:** không. Realtime: chuông đã có sự kiện `notification:new`.
- **Rủi ro:** `AppShell.tsx` là tệp phiên Antigravity từng viết lại — **cần anh xác nhận** họ không đang sửa nó (câu 4).

#### A6 · Sửa các chỗ nhỏ có thật 🟠 — **S** (gộp)

- **L5** Thanh hàng loạt: người **không** phải PM thì "Đưa vào sprint" đi đường `PATCH` từng việc (mang `version`, đúng quyền `pj:MEMBER` hiện có) thay vì gọi endpoint `pj:PM` rồi 403 — *hoặc* ẩn hẳn, tuỳ câu 3.
- **L6** Ô Sprint trong chi tiết việc liệt kê mọi sprint chưa đóng.
- **L8** `activity.listener` nghe `sprint.updated` có `movedTaskIds` → ghi `sprint.tasks_added { sprintId, taskIds, afterStart }`. Đây là nguồn của "thêm sau khi bắt đầu" ở C3.
- **Q5** Nhãn trạng thái sprint và nhãn hành động nhật ký tiếng Việt, **dùng chung** một bảng trong `packages/shared` cho cả `ActivityList` và `query.service`; giờ in theo múi giờ người dùng (`users.timezone`, mặc định `Asia/Ho_Chi_Minh`); dòng `sprint.closed` ghi "Lan kết thúc Sprint 1 · 7 việc chuyển về Backlog".
- **M10** `lib/status.ts` thêm `sprintStatusLabel/Variant`.
- **Seed (gộp vào D2 của đợt 2):** thêm một **Sprint 0 đã đóng** có snapshot từng ngày và nhật ký `sprint.closed` kèm việc bị đẩy — để Dashboard, báo cáo sprint (C3), vận tốc (C2) và ý định mới có dữ liệu khi demo. Không được chạy seed khi phiên song song đang chạy.

### Nhóm B — Bắt đầu và kết thúc sprint như một quyết định, không phải một cú bấm

#### B1 · Hộp thoại "Bắt đầu sprint" 🟠 — **S**

- **Vấn đề:** M3, M4, M5, L7.
- **Cách làm:** ▷ mở hộp thoại: tên, **mục tiêu**, ngày bắt đầu (mặc định **hôm nay** nếu ngày đã đặt đã qua hoặc chưa tới — hỏi rõ), ngày kết thúc; tóm tắt "n việc · x h ước lượng · y h năng lực nhóm" (từ C1). Cảnh báo (không chặn): 0 việc, chồng ngày với sprint khác, giờ cam kết > năng lực. Đang có sprint ACTIVE thì hộp thoại **nói tên nó** và có nút "Kết thúc Sprint 1 trước". Sprint mới mặc định bắt đầu **ngày sau khi sprint cuối kết thúc**, cùng độ dài; ngày tính theo giờ địa phương.
- **Endpoint:** không — `PATCH /sprints/:id` (ngày, goal) rồi `POST /start`, trong hộp thoại. Không đụng version task.
- **Rủi ro:** thấp.

#### B2 · Hộp thoại "Kết thúc sprint" nói trước điều sẽ xảy ra 🟠 — **S**

- **Vấn đề:** M6, T1, T6.
- **Cách làm (theo cơ chế "Complete sprint" của Jira):** "**2 việc xong (20 h) · 7 việc dở (30,6 h còn lại / 51 h ước lượng)**", liệt kê 7 việc dở (mã, tên, người, còn lại), chọn đích: Backlog · sprint kế tiếp · "**Sprint mới…**" (tạo ngay trong hộp thoại). Sau khi đóng: toast "Đã kết thúc Sprint 1 — 7 việc chuyển về Backlog" kèm nút **"Xem báo cáo"** (C3). `Idempotency-Key` cho `close` như docs 11 đã hứa.
- **Endpoint:** không thêm đường dẫn; `close` trả thêm `movedTaskIds` (đã có) và số giờ.
- **Rủi ro:** thấp.

### Nhóm C — Trang Sprint riêng: lập kế hoạch, theo dõi, xem lại

#### C1 · Trang `/projects/:id/sprints` với khung lập kế hoạch 🔴 giá trị — **M** (web) + **M** (API)

- **Vấn đề:** M1, M2, M7, T4 — và là **câu trả lời có số** cho "lập kế hoạch mất bao nhiêu thao tác".
- **Cách làm:** mục mới trên sidebar (và huy hiệu "Sprint 2" trên thanh trên dẫn tới đây). Trái: danh sách sprint (trạng thái tiếng Việt, mục tiêu, ngày, `xong/tổng`, giờ). Chọn một sprint PLANNED → hai cột **Backlog | Sprint**: chọn việc (chuột hoặc `X`) rồi "Đưa vào sprint" (hoặc kéo), đầu cột Sprint hiện **thanh cam kết: Σ giờ ước lượng / năng lực hiệu dụng của nhóm trong cửa sổ sprint**, kèm dòng "vận tốc trung bình 3 sprint trước: *v* h" (C2) — **chỉ là số để PM nhìn, không có gợi ý chọn việc nào**. Bảng nhỏ theo người: giờ đã nhận trong sprint / năng lực của người đó trong cửa sổ.
- **API mới:** `GET /sprints/:id/summary` (`pj:MEMBER`) → `{ committedHours, completedHours, remainingHours, capacityHours, byAssignee[{ userId, tasks, remainingHours, capacityHours }], carriedOut[], addedAfterStart[] }`. `capacityHours` dùng **đúng** hàm năng lực hiệu dụng của `WorkloadService` (docs 04 §3: trừ nghỉ, lễ; cùng số với màn Nhân sự). Đây cũng là nguồn của D1, C3 — **một endpoint, ba nơi dùng**.
- **Đo mục tiêu:** lập kế hoạch với *k* việc từ **10 + *k*** xuống **≤ 3 + *k*** cú bấm, **1** màn thay vì 3.
- **Version / realtime:** "Đưa vào sprint" vẫn là `POST /sprints/:id/tasks` (PM) hoặc `PATCH` mang `version` (A6); trang nghe `sprint:updated` + `task:*` như Backlog đang nghe.
- **Chạm đợt 2:** B4 của đợt 2 là năng lực **từng người khi giao một việc**; C1 là năng lực **cả sprint khi lập kế hoạch** — cùng hàm tính, hai góc nhìn, không trùng.
- **Rủi ro:** trung bình — trang mới nhiều trạng thái. Tab Sprint trong Cấu hình giữ lại dạng tối giản (hoặc chuyển thành đường dẫn sang trang mới).

#### C2 · Vận tốc giữa các sprint 🟠 — **S** (API) + **S** (web)

- **Vấn đề:** T2. Không ai trả lời được "3 sprint gần nhất làm được bao nhiêu".
- **Cách làm (theo cơ chế Velocity chart của Jira, số sprint theo Linear):** mỗi sprint CLOSED có **cam kết** = `scope_hours_initial` (đã chốt lúc bắt đầu) và **hoàn thành** = Σ ước lượng của việc có `completedAt ≤ closedAt` còn nằm trong sprint (việc xong không bị chuyển khi đóng). Trả thêm hai trường này trong `GET /projects/:id/sprints` cho sprint CLOSED, và `velocityAvg3` cho dự án. Web: biểu đồ cột "cam kết vs hoàn thành" trên trang Sprint.
- **Lựa chọn lược đồ (câu 2):**
  - **(a) Không đổi lược đồ** *(đề xuất)*: tính lúc đọc như trên; số lúc đóng lấy từ snapshot cuối (A2).
  - **(b) Thêm `sprints.closed_summary jsonb`** ghi một lần lúc đóng (cam kết, hoàn thành, số việc bị đẩy, giờ bị đẩy). Chắc hơn nếu sau này việc xong bị sửa ước lượng hay bị xoá. **Nếu chọn phải migrate trước 16/10.**
- **Ranh giới AI:** là số backend tính, LLM chỉ đọc.
- **Rủi ro:** thấp.

#### C3 · Báo cáo sprint (xem lại sprint đã đóng) 🟠 — **M**

- **Vấn đề:** M7, câu hỏi "sprint CLOSED còn xem lại được không".
- **Cách làm (theo các mục của Sprint report Jira):** bấm một sprint CLOSED trên trang C1 → burn-down từ snapshot, **Đã xong**, **Chuyển đi lúc đóng** (từ `sprint.closed.movedTaskIds` — đã có trong nhật ký), **Thêm sau khi bắt đầu** (từ A6-L8, chỉ có cho sprint đóng sau khi làm A6), cam kết vs hoàn thành (C2). Nguồn: `GET /sprints/:id/summary`.
- **Endpoint:** dùng lại C1. **Lược đồ:** không.
- **Rủi ro:** thấp. Sprint đã đóng trước khi làm A2/A6 sẽ thiếu một phần — ghi rõ trên màn, không đoán.

#### C4 · Dashboard: chọn sprint, nguyên nhân đọc được 🟡 — **S**

- **Vấn đề:** M8, M9, T3, T5.
- **Cách làm:** ô chọn sprint trên thẻ burn-down (mặc định sprint đang chạy; chọn được sprint đã đóng); mục tiêu sprint dưới tiêu đề; nguyên nhân rủi ro thành câu tiếng Việt ("7 việc quá hạn") và **bấm được** → mở màn Công việc với đúng các việc đó; vẽ vạch ngày scope creep. `burndownMini` của `/dashboard` bỏ trường `lastSnapshot` (đang `null`, web đã không dùng).
- **Chạm đợt 2:** B2 của đợt 2 làm **thẻ số** bấm được qua bộ lọc hợp nhất (B1 đợt 2). Chip nguyên nhân ở đây nên đi **cùng cơ chế lọc đó** — làm sau B1 đợt 2 nếu đợt 2 được duyệt, còn không thì lọc theo danh sách `taskIds`.
- **Dashboard tải tuần này (lệch 0 % vs 39 %):** Dashboard gọi cùng `WorkloadService` với màn Nhân sự và tra cứu, hoặc tính lại snapshot khi cũ hơn 1 giờ. **Đề xuất cách thứ hai** (rẻ, Dashboard vẫn nhanh).
- **Endpoint:** không.

### Nhóm D — Ý định tra cứu cho sprint

Mọi ý định mới: schema zod trong `packages/shared`, filter có trong `FILTERS_BY_INTENT`, quyền theo người hỏi (`read`), e2e (số khớp màn hình + quyền + mã sai → 422), và cập nhật bảng ở docs 04/14.

#### D1 · `SPRINT_PROGRESS` trả lời được "còn bao nhiêu giờ, có kịp không, ai gánh nhiều nhất" 🔴 — **S** (sau A1, C1)

- **Khối:** `stat_row` (xong/tổng, giờ còn lại, **ngày làm việc còn lại, vận tốc, ETA, mức rủi ro** — nguyên văn từ `ForecastService`), `line_chart` (lý tưởng vs thực tế, thật), `note` nguyên nhân tiếng Việt, `table` theo người (việc, giờ còn lại, năng lực trong cửa sổ — **xếp theo giờ còn lại chỉ để đọc cho dễ**, không có cột điểm, không có chữ "nên").
- **Filter:** `sprint` (mọi mã, kể cả sprint đã đóng nhờ A3; `__all` → trả `note` "hãy chọn một sprint" thay vì lặng lẽ lấy sprint đang chạy), `assignee` (lọc bảng theo người).
- **Câu hỏi phủ được:** "sprint này còn bao nhiêu giờ", "có kịp không", "ai đang gánh nhiều nhất sprint này", "sprint của tôi còn gì".

#### D2 · Ý định mới `SPRINT_REPORT` 🟠 — **S** (sau C3)

- **Câu hỏi:** "việc nào bị đẩy từ sprint trước", "Sprint 1 làm được gì", "sprint trước thêm việc giữa chừng không".
- **Filter:** `sprint` (mặc định: sprint CLOSED gần nhất). **Khối:** `stat_row` (cam kết, hoàn thành, bị đẩy) + ba `task_list` (Đã xong · Chuyển đi lúc đóng · Thêm sau khi bắt đầu). Nguồn: `GET /sprints/:id/summary`.

#### D3 · Ý định mới `SPRINT_VELOCITY` 🟠 — **S** (sau C2)

- **Câu hỏi:** "vận tốc 3 sprint gần nhất", "nhóm làm được bao nhiêu giờ mỗi sprint".
- **Filter mới:** `lastN` (1–10, mặc định 3). **Khối:** `line_chart` có `compare` (cam kết vs hoàn thành — kiểu khối đã hỗ trợ `compare`) + `table` + `stat_row` trung bình. LLM không được nhận xét bằng số.

#### D4 · Không bỏ bộ lọc lặng lẽ, và thêm vài bộ lọc đáng có 🟠 — **S**

- `pruneQuerySpec` trả thêm danh sách field đã cắt; `AiQueryService` gắn một khối `note` "Không áp dụng *của tôi* cho loại câu hỏi này" khi danh sách không rỗng.
- Thêm filter có nghĩa: `ACTIVITY_FEED` ← `user`, `range` (`TODAY`, `YESTERDAY`, `THIS_WEEK`) — để "hôm qua Huy sửa gì" đúng như câu mẫu ở docs 14; `CAPACITY_FREE` ← `sprint` (cửa sổ = sprint, dùng `capacityTable({ sprintId })` đã hỗ trợ sẵn).
- **Không** thêm `sprint` cho `WORKLOAD_WEEK` — tải là theo tuần xuyên dự án (docs 04 §3); câu "ai gánh nhiều nhất sprint này" đi D1.

#### D5 · Danh sách ý định một nguồn 🟡 — **S**

- `response-schemas.ts` và câu liệt kê trong master prompt **sinh từ** `QUERY_INTENTS`/`FILTERS_BY_INTENT` thay vì viết tay; unit test "prompt và responseSchema chứa đủ mọi ý định". Thêm D2, D3 chỉ phải sửa một chỗ.
- Prompt CHAT thêm câu mẫu cho D1–D3 và câu phân biệt D1 ("có kịp không") với `RISK_EXPLANATION` ("vì sao, nên làm gì") — xem A4.

#### D6 · Bù kiểm thử 🟡 — **S**

- E2e cho `TASK_DETAIL`, `TASK_BLOCKED` (hiện 0 ca); bộ "một câu hỏi, một số" của A1; "Làm mới trên phiên chỉ có tra cứu" (A3); "mã sprint không trôi sau khi đóng" (A3); "RISK_EXPLANATION trong chat bị kiểm" (A4 — dùng `AI_PROVIDER=mock`, không cần Gemini).

### Nhóm E — Màn hẹp (làm nếu kịp)

- **E1** Tab/trang Sprint dưới 768 px chuyển bảng thành danh sách thẻ, nút thao tác trong `DropdownMenu`; sửa tràn ngang 481 px của Dashboard (hàng hoạt động dài). **S**.

---

## 7. Những thứ **không** làm, và vì sao

| Thứ | Vì sao |
|---|---|
| Nhiều sprint ACTIVE cùng lúc (parallel sprints của Jira) | Mâu thuẫn chốt UC-09 "một ACTIVE" và index `sprints_one_active`; burn-down, dự báo, tải đều giả định một sprint |
| Chu kỳ tự động (Linear Cycles: tự bắt đầu, tự cuộn việc dở sang cycle sau) | Đổi ngữ nghĩa UC-09 (PM quyết định bắt đầu/kết thúc); cron tự ghi dữ liệu nghiệp vụ là thứ khó giải thích trước hội đồng. B2 "Sprint mới…" lấy được phần lợi (một cú là có sprint sau) |
| Story point | Mô hình dữ liệu dùng giờ ước lượng xuyên suốt (tải, EAR, burn-down). Vận tốc C2 tính bằng giờ |
| AI "lập kế hoạch sprint giúp" / tự chọn việc cho sprint | Vi phạm ranh giới nếu backend chọn; nếu LLM chọn thì đã có `ASSIGN_PROPOSAL`/`DECOMPOSE_PROPOSAL` trong chat. C1 chỉ đưa số |
| Điểm "khả năng hoàn thành" hay dự báo xác suất (Monte Carlo) | Thêm một công thức phải bảo vệ; ETA theo vận tốc đã có trong 04/04 §8 |
| Xuất báo cáo sprint CSV/PDF (UC-34) | Đã ở "không làm" từ 04/11 §1.3 |
| Kéo việc giữa các sprint trên Kanban | Kanban lọc theo một sprint; kéo giữa sprint thuộc về trang C1 |
| Tra cứu xuyên dự án, tìm theo nội dung bình luận, ghim khối lên Dashboard | Đã ghi "chưa làm" ở docs 04/14 §7 — giữ nguyên |
| Cho LLM đọc lại kết quả tra cứu để bình luận | Docs 04/14 §2 đã chốt một lượt LLM; bình luận bằng số là đường vòng để LLM tự cộng trừ |

---

## 8. Xếp ưu tiên

| Hạng | Mã | Tên | Công sức | Vì sao xếp ở đây |
|---|---|---|---|---|
| 1 | **A2** | Burn-down có số thật | S | 🔴 Vận tốc và sprint đã đóng sai/mất số ở mọi CSDL không chạy cron — hội đồng sẽ thấy đầu tiên |
| 2 | **A1** | Một nguồn số cho sprint | M | 🔴 Hai nơi hai số là lỗi; nền cho D1–D3 |
| 3 | **A3** | Làm mới không vỡ, mã sprint không trôi | S | 🔴 Tính năng đã quảng cáo trong docs 14 đang hỏng |
| 4 | **A4** | Chat không tự quyết mức rủi ro | S | 🔴 Lỗ hổng ranh giới AI — thứ đề tài lấy làm trục |
| 5 | **A5** | Thông báo đúng chỗ, chuông thật | S | 🟠 404 và số giả trên thanh trên, thấy ở mọi màn |
| 6 | **A6** | Các chỗ nhỏ (403 thành viên, ô sprint, nhật ký, nhãn, giờ, seed sprint đóng) | S | 🟠 Rẻ, gỡ nhiều ma sát cùng lúc |
| 7 | **B2** | Hộp thoại kết thúc nói trước | S | 🟠 Chốt T1 của UC-09 |
| 8 | **B1** | Hộp thoại bắt đầu | S | 🟠 Chặn đúng lỗi kịch bản đo đã mắc |
| 9 | **C1** | Trang Sprint + khung lập kế hoạch + `summary` | M+M | 🔴 giá trị — 10+*k* → ≤3+*k* cú bấm, và là chỗ duy nhất thấy năng lực sprint |
| 10 | **C2** | Vận tốc giữa các sprint | S+S | 🟠 Chốt T2 của UC-30 |
| 11 | **D1** | `SPRINT_PROGRESS` đủ ý | S | 🔴 Câu hỏi hay gặp nhất về sprint |
| 12 | **C3** | Báo cáo sprint đã đóng | M | 🟠 |
| 13 | **D2, D3** | `SPRINT_REPORT`, `SPRINT_VELOCITY` | S+S | 🟠 |
| 14 | **D4, D5, D6** | Bộ lọc không lặng lẽ, enum một nguồn, bù test | S×3 | 🟡 |
| 15 | **C4** | Dashboard chọn sprint, nguyên nhân bấm được | S | 🟡 Sau B1/B2 của đợt 2 nếu được duyệt |
| 16 | **E1** | Màn hẹp | S | 🟡 |

---

## 9. Bảng chốt — anh tick vào đây

| ✔ | Mã | Việc | Công sức | Lược đồ CSDL | Endpoint mới | Quyết định (MVP 06/11 · nếu kịp · để sau · bỏ) | Đã làm |
|---|---|---|---|---|---|---|---|
| ☑ | A1 | Tra cứu sprint gọi đúng service màn hình; `TASK_STATS` không cộng trên `limit`; e2e "một câu hỏi, một số" | M | — | — | MVP | ✔ 28/09 `feature/UC-38-tra-cuu-mot-nguon-so` — có việc con: tab/SPRINT_LIST/SPRINT_PROGRESS cùng 2/9 · 30,6 h (trước 2 · 3 · 0/3 · 33 h); `TASK_STATS` limit 3 = limit 25. Phát hiện thêm khi đo: biểu đồ trong chat vô hình vì `var(--chart-1)` thiếu `hsl()` — đã sửa. [Ảnh](../05-hien-thuc/anh/sprint-v1/a1-sau-chat-sprint-progress.png) |
| ☑ | A2 | Vận tốc từ `completedAt`; snapshot lúc bắt đầu/kết thúc; forecast sprint đóng | S | — | — | MVP | ✔ 28/09 `feature/UC-30-burndown-so-that` — vận tốc 10→2 h/ngày khi chỉ có snapshot hôm nay; sprint đóng giữ `final`; Dashboard báo ngày thiếu số liệu. [Ảnh](../05-hien-thuc/anh/sprint-v1/a2-sau-van-toc-tu-completedat.png) |
| ☑ | A3 | `codeMap` lưu trong tin `DATA_QUERY`; mã `s` ổn định, có sprint đã đóng | S | — | — | MVP | ✔ 28/09 `feature/UC-38-lam-moi-ma-sprint` — Làm mới 422 `UNKNOWN_CODE` → 200 (gửi `messageId`); mã sprint giữ nguyên sau khi thêm/đóng sprint (e2e). [Ảnh](../05-hien-thuc/anh/sprint-v1/a3-sau-lam-moi-thanh-cong.png) |
| ☑ | A4 | Prompt CHAT tách "có kịp không" / "vì sao"; kiểm `RISK_EXPLANATION` trong chat | S | — | — | MVP | ✔ 28/09 `feature/UC-31-chat-kiem-muc-rui-ro` — ngữ cảnh CHAT có mức rủi ro backend; chat kiểm `validateExplain`, lệch → gọi lại, vẫn lệch thì thẻ không in mức của AI (e2e bằng mock). **Chưa thử Gemini thật.** [Ảnh](../05-hien-thuc/anh/sprint-v1/a4-sau-the-rui-ro-khong-khop.png) |
| ☑ | A5 | Link thông báo đúng route (+ chuyển hướng link cũ); chuông đọc thông báo thật | S | — | — | MVP | ✔ 28/09 `feature/UC-20-thong-bao-sprint` — bấm "Sprint 1 đã kết thúc" → tab Sprint, bấm thông báo cũ `/p/ST/t/ST-6` → trang ST-6 (trước: 404); chuông hiện thông báo thật, xoá `mocks/notifications.ts`. Link cảnh báo tải (`/me/workload`) còn chưa có route — ngoài phạm vi. [Ảnh](../05-hien-thuc/anh/sprint-v1/a5-sau-chuong-thong-bao-that.png) |
| ◐ | A6 | 403 thành viên; ô Sprint trong chi tiết; nhật ký `sprint.tasks_added`; nhãn/giờ tiếng Việt; seed sprint đã đóng | S | — | — | MVP | Phần web ✔ 28/09 `feature/UC-09-sprint-cho-nho` — thành viên đưa vào sprint hàng loạt: 403 → "Đã đưa vào sprint — 1 công việc" (PATCH từng việc); ô Sprint trong chi tiết có mọi sprint chưa đóng; nhãn trạng thái tiếng Việt (`sprintStatusLabel`). [Ảnh](../05-hien-thuc/anh/sprint-v1/a6-sau-o-sprint-chi-tiet.png) · Phần nhật ký ✔ 28/09 `feature/UC-16-nhat-ky-sprint` — ghi `sprint.tasks_added` (kèm `afterStart`); nhãn nhật ký dùng chung `packages/shared/activity.ts`; chat in giờ theo múi giờ người hỏi (09:14 UTC → 16:14, khớp Dashboard); dòng sprint có tên + số việc. **Còn lại: seed sprint đã đóng — gộp với A1/D2 của đợt 2 (seed đang có lỗi `taskCounter`, và không được chạy seed khi có phiên song song).** [Ảnh](../05-hien-thuc/anh/sprint-v1/a6-sau-nhat-ky-sprint-dashboard.png) |
| ☑ | B1 | Hộp thoại bắt đầu sprint (goal, ngày, tóm tắt, cảnh báo, tên sprint đang chạy) | S | — | — | MVP | ✔ 28/09 `feature/UC-09-hop-thoai-bat-dau` — không còn bắt đầu một cú; đang có sprint chạy thì nói tên + nút mở nó; ngày bắt đầu mặc định hôm nay nên burn-down khớp điểm thực tế (L7). [Ảnh](../05-hien-thuc/anh/sprint-v1/b1-hop-thoai-bat-dau.png) · [Đang có sprint chạy](../05-hien-thuc/anh/sprint-v1/b1-dang-co-sprint-chay.png) |
| ☑ | B2 | Hộp thoại kết thúc liệt kê việc dở, "Sprint mới…", `Idempotency-Key` | S | — | — | MVP | ✔ 28/09 `feature/UC-09-hop-thoai-ket-thuc` — hộp thoại nói trước "2 việc xong · 7 việc chưa xong (30,6 h còn lại / 51 h ước lượng)" kèm danh sách; chuyển sang "Sprint mới…" tạo sprint rồi đóng (2 request); toast "7 việc chưa xong đã chuyển về Sprint 3"; `Idempotency-Key` lưu trong nhật ký `sprint.closed` (e2e). [Ảnh](../05-hien-thuc/anh/sprint-v1/b2-chon-sprint-moi.png) |
| ☑ | C1 | Trang `/projects/:id/sprints` + khung lập kế hoạch + thanh cam kết/năng lực | M+M | — | `GET /sprints/:id/summary` | MVP | ✔ 28/09 `feature/UC-09-sprint-summary-api` + `feature/UC-09-trang-sprint` — lập kế hoạch 10 + k → 5 + k cú bấm (k = 1: 6 so với 11), 3 màn → 1; năng lực nhóm tính bằng `capacityInRange` (cùng EffCap, bỏ người VIEWER); soi UX bằng ảnh: sửa tràn hàng do `ScrollArea`, thanh theo người đổi màu theo mức tải, gộp người chưa nhận việc. [Ảnh](../05-hien-thuc/anh/sprint-v1/c1-sau-lap-ke-hoach.png) |
| ☑ | C2 | Vận tốc cam kết vs hoàn thành — **(a)** tính lúc đọc · **(b)** cột `closed_summary jsonb` | S+S | (a) — không đổi lược đồ | — (thêm `completedHours` vào `GET /projects/:id/sprints`, `velocity` vào `summary`) | MVP | ✔ 28/09 `feature/UC-30-van-toc-sprint` — biểu đồ cam kết/hoàn thành các sprint đã đóng; khi lập kế hoạch hiện vận tốc TB 3 sprint gần nhất và mức chênh (chỉ số, không gợi ý). [Ảnh](../05-hien-thuc/anh/sprint-v1/c2-van-toc.png) |
| ☑ | C3 | Báo cáo sprint đã đóng | M | — | dùng C1 | MVP | ✔ 28/09 `feature/UC-30-bao-cao-sprint` — burn-down (số lúc đóng), đã xong, bị chuyển đi lúc đóng, thêm sau khi bắt đầu, chuyển vào từ sprint trước; sprint đang chạy có burn-down + ETA/rủi ro trên trang Sprint. "Thêm sau khi bắt đầu" chỉ dựa vào nhật ký (so `createdAt` với `startedAt` từng nhận nhầm việc seed). [Ảnh](../05-hien-thuc/anh/sprint-v1/c3-bao-cao-sprint-burndown.png) |
| ☑ | C4 | Dashboard chọn sprint, goal, nguyên nhân bấm được, snapshot tải không cũ quá 1 h | S | — | — | MVP | ✔ 28/09 `feature/UC-33-dashboard-sprint` — ô chọn sprint (xem cả sprint đã đóng; nút giải thích AI chỉ cho sprint đang chạy); mục tiêu dưới tiêu đề; nguyên nhân thành câu tiếng Việt, bấm ra đúng việc/người; snapshot tải cũ hơn 1 h được tính lại → Dashboard 39 % khớp Trợ lý (trước 0 %). [Ảnh](../05-hien-thuc/anh/sprint-v1/c4-dashboard-nguyen-nhan.png) |
| ☑ | D1 | `SPRINT_PROGRESS` có ETA/rủi ro/vận tốc/biểu đồ thật/bảng theo người | S | — | — | MVP | ✔ 28/09 (ETA/rủi ro/biểu đồ từ A1) + `feature/UC-38-tien-do-sprint-theo-nguoi` — bảng theo người cùng nguồn trang Sprint, lọc `assignee`, khối có tiêu đề; e2e tổng giờ khớp forecast. [Ảnh](../05-hien-thuc/anh/sprint-v1/d1-sprint-progress-theo-nguoi.png) |
| ☑ | D2 | Ý định `SPRINT_REPORT` | S | — | — | MVP | ✔ 28/09 `feature/UC-38-y-dinh-bao-cao-sprint` — mặc định sprint đóng gần nhất; cam kết/hoàn thành/bị chuyển đi/thêm giữa chừng + các danh sách có tiêu đề; nguồn `summary`. Soi ảnh: bỏ mã việc lặp, ô số cảnh báo dùng icon (chữ vàng không đạt AA). [Ảnh](../05-hien-thuc/anh/sprint-v1/d2-sprint-report.png) |
| ☑ | D3 | Ý định `SPRINT_VELOCITY` (filter `lastN`) | S | — | — | MVP | ✔ 28/09 `feature/UC-38-y-dinh-van-toc` — cam kết/hoàn thành N sprint đóng gần nhất (cùng nguồn thẻ Vận tốc), khối `bar_chart` nay có cột so sánh + chú thích (đường với 1 sprint chỉ là một chấm — đổi sau khi soi ảnh); `lastN` > 10 → 400. [Ảnh](../05-hien-thuc/anh/sprint-v1/d3-sprint-velocity.png) |
| ☑ | D4 | `note` khi cắt bộ lọc; `ACTIVITY_FEED` ← user/range; `CAPACITY_FREE` ← sprint | S | — | — | MVP | ✔ 28/09 `feature/UC-38-bo-loc-tra-cuu` — `pruneQuerySpec` ghi `ignoredFilters` (chỉ bộ lọc có nghĩa; mã rác vẫn cắt im) → khối ghi chú; `ACTIVITY_FEED` lọc người + hôm nay/hôm qua/tuần này theo múi giờ người hỏi; `CAPACITY_FREE` cửa sổ = sprint khi có mã s. [Ảnh](../05-hien-thuc/anh/sprint-v1/d4-ghi-chu-bo-loc.png) |
| ☑ | D5 | Enum ý định một nguồn cho responseSchema + prompt | S | — | — | MVP | ✔ 28/09 `feature/UC-38-y-dinh-mot-nguon` — `QUERY_INTENT_HINT` + `queryIntentGuide()` trong shared sinh phần liệt kê của prompt (kèm bộ lọc hợp lệ từng ý định); enum responseSchema lấy từ `QUERY_INTENTS`; unit test chặn lệch. |
| ☐ | D6 | E2e `TASK_DETAIL`, `TASK_BLOCKED`, Làm mới, mã sprint, rủi ro trong chat | S | — | — | | |
| ☑ | E1 | Sprint/Dashboard ở 375 px | S | — | — | nếu kịp | ✔ 28/09 `feature/UC-09-sprint-ux-polish` — trang Sprint 375 px không tràn (cột lập kế hoạch ẩn huy hiệu/avatar); Dashboard 481 → 375 px (tiêu đề việc trong nhật ký xuống dòng thay vì `truncate` trên phần tử inline); cảnh báo dùng icon `--warning`, chữ giữ màu thường để đạt AA ở cả sáng/tối. [Ảnh tương phản](../05-hien-thuc/anh/sprint-v1/ux-tuong-phan-sang-toi.png) |

---

## 10. Các câu anh cần trả lời trước khi chia việc

1. **Thứ tự với đợt 2.** Đợt 2 (doc 06) cũng chưa duyệt. Làm đợt này **trước**, **sau**, hay **xen** (ví dụ A1 của đợt 2 — bộ đếm mã việc — rồi Nhóm A ở đây)? Đề xuất: **A1 đợt 2 → Nhóm A đợt này → phần còn lại theo bảng ưu tiên chung**, vì cả hai Nhóm A đều là lỗi đang lộ trên CSDL seed.
2. **C2 chọn (a) hay (b)?** (a) không đổi lược đồ, tính lúc đọc; (b) thêm `sprints.closed_summary jsonb`, chắc hơn, **phải migrate trước 16/10**. Đề xuất **(a)**.
3. **Thành viên có được đưa việc vào sprint không?** Hiện `PATCH /tasks/:id` cho phép (MEMBER), `POST /sprints/:id/tasks` không (PM). Chọn: **(i)** giữ như API hiện tại, web đi đường `PATCH` cho thành viên; **(ii)** siết: chỉ PM đổi sprint, `PATCH` từ chối field `sprintId` với MEMBER (đổi quyền → cần ghi biên bản vì đụng docs 11). Đề xuất **(i)**.
4. **Có được sửa `AppShell.tsx` không** (A5 — chuông; C1 — mục sidebar)? Tệp này phiên Antigravity từng viết lại. Nếu họ đang sửa thì A5/C1 phải chờ hoặc chỉ sửa đúng mấy dòng liên quan.
5. **Cho phép gọi Gemini thật** để kiểm A4 và D1–D3 khi làm xong Phase 17? Dự kiến **~12 lượt** (6 câu về sprint × 2 lần), dùng `node scripts/ai-smoke.mjs --chat` trên stack riêng. Chỉ chạy khi anh đồng ý.
6. Trang Sprint (C1) thay **hẳn** tab Sprint trong Cấu hình, hay giữ tab đó dạng rút gọn? Đề xuất: tab chỉ còn dòng "Quản lý sprint ở trang Sprint →".

---

## 11. Chia phase và mốc

> Đánh số **15 / 16 / 17**, tiếp sau 12–14 của đợt 2. Không phase nào đổi lược đồ trừ khi câu 2 chọn (b) — khi đó migration nằm ở **đầu Phase 16** và phải merge **trước 16/10**.

| Phase | Tên | Nội dung | Ước lượng | Mốc |
|---|---|---|---|---|
| **Phase 15** | Số liệu đúng | A2 → A1 → A3 → A4 → A5 → A6 | 2–3 ngày | **trước 09/10** |
| **Phase 16** | Trang Sprint | B1 → B2 → *(C2-b migration nếu chọn)* → C1 (`summary` trước, web sau) → C2 → C3 → C4 | 4–5 ngày | API + migration (nếu có) **trước 16/10**; web **trước 24/10** |
| **Phase 17** | Tra cứu sprint | D5 → D1 → D2 → D3 → D4 → D6; cập nhật docs 04/14; kiểm Gemini thật (nếu câu 5 đồng ý) | 2–3 ngày | **trước 31/10** |
| **Vét** | Màn hẹp | E1 | 0,5 ngày | trước **05/11** (freeze) |

**Thứ tự bắt buộc:** A1 trước D1 (D1 đọc cùng nguồn) · A2 trước C2/C3 (cần snapshot lúc đóng) · A3 trước D2/D3 (hỏi được sprint đã đóng) · A6-L8 trước C3 (mục "thêm sau khi bắt đầu") · C1 `summary` trước D1/D2 · D5 trước D2/D3.

**Mỗi mục một commit** (`fix(api)`, `feat(web)`, `docs(...)`), trước commit chạy `npm run api:lint && npm run api:test && npm run api:test:e2e` (nếu đụng API), `npx eslint "src/**/*.{ts,tsx}"` trong `apps/web`, và đo lại mục vừa làm trên stack riêng (ảnh trước/sau). Sau mỗi phase cập nhật `docs/05-hien-thuc/web-tich-hop.md`, `docs/04-kien-truc/14-tra-cuu-hoi-dap.md`, docs 11 (khi thêm `summary`), và cột "Đã làm" của bảng §9.

---

## 12. Cách kiểm chứng lại các con số trong tài liệu này

```bash
# Stack riêng, không đụng tiến trình của phiên song song; ÉP AI_PROVIDER=fake
setsid env PORT=3100 CORS_ORIGIN=http://localhost:3003 AI_PROVIDER=fake npm run api:dev > api.log 2>&1 < /dev/null &
setsid env NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 PORT=3003 npm run web:dev > web.log 2>&1 < /dev/null &
```

- Dự án seed: `33333333-3333-4333-8333-000000000001`; Sprint 1 `…8444-000000000001` (ACTIVE, 14/09→28/09), Sprint 2 `…8444-000000000002` (PLANNED).
- L1: `GET /api/v1/sprints/{S1}/forecast` → `velocity: 0`, `riskLevel: "HIGH"`; `select count(*) from burndown_snapshots` → 0.
- §3.2: `POST /api/v1/ai/query` `{ projectId, query: { intent: "TASK_STATS", limit: 3 } }` so với `limit: 25`.
- Q2: tạo phiên (`POST /ai/sessions`), gọi `POST /ai/query` với `sessionId` đó và `query.sprint: "s1"` → `422 UNKNOWN_CODE`.
- **Trước khi đo phải `pg_dump`, đo xong `pg_restore`** — các bước tạo/bắt đầu/kết thúc sprint không có đường lùi qua API (không có `DELETE /sprints/:id`, không mở lại sprint đã đóng).

---

## 13. Nguồn tham khảo (chỉ cơ chế)

- Jira — [Sprint report](https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-the-sprint-report/): việc đã xong, chưa xong, bị bỏ khỏi sprint, **thêm sau khi bắt đầu** (đánh dấu sao), đường lý tưởng/thực tế → C3, D2.
- Jira — [Velocity chart](https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-the-velocity-chart/): cam kết vs hoàn thành theo từng sprint → C2, D3.
- Jira — Complete sprint: hộp thoại nói số việc xong/dở và cho chọn đích (backlog, sprint sau, sprint mới) → B2.
- Linear — [Cycles](https://linear.app/docs/use-cycles): năng lực cycle *"calculated from the velocity of the previous three completed cycles"*; việc dở tự cuộn sang cycle sau (**không** làm — §7) → con số "vận tốc TB 3 sprint" ở C1.
