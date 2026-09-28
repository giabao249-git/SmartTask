# 06 · Nghiên cứu và đề xuất cải tiến Tạo task & Quản lý task — **đợt 2**

**Phiên bản:** 1.0 — **Ngày:** 25/09/2026 (Tuần 03) — **Trạng thái:** chờ duyệt, chưa viết dòng mã nào.
**Cập nhật 28/09/2026:** một số mục đã được làm trong [Sprint v0](../05-hien-thuc/sprint-v0.md) theo hướng khác của đề xuất 02/08 — bộ đếm mã việc trong seed (lỗi 409 CONFLICT), ghi giờ thực tế & đánh giá việc (UC-35/36), bảng năng lực khi giao việc có kỹ năng từ bằng chứng (một phần UC-26). Các mục còn lại vẫn chờ duyệt.
**Phạm vi:** UC-10 (công việc), UC-11 (subtask & phụ thuộc), UC-12 (Kanban), UC-14 (Eisenhower), UC-15 (danh sách & bộ lọc), UC-26 (bảng năng lực khi giao việc), UC-35/36 (giờ thực tế & đánh giá).

> **Đây là đợt thứ hai.** Đợt 1 ([02/05](05-cai-tien-quan-ly-task.md), hiện thực ở [05/web-cai-tien-task](../05-hien-thuc/web-cai-tien-task.md)) đã làm xong 26/27 mục trong hai ngày 23–24/09: tạo nhanh trong cột, dán nhiều dòng, cú pháp `@ # ! h`, form tạo đủ trường, chọn nhiều + hàng loạt, sửa tại chỗ, hoàn tác, phím tắt, bảng lệnh, Backlog riêng, swimlane, chi tiết hai cột + trang riêng, `TaskType`. **Tài liệu này không lặp lại những thứ đó** — đã chạy lại và xác nhận chúng vẫn chạy đúng (§2). Nó nói về những gì đợt 1 **chưa chạm tới**.

**Ràng buộc giữ nguyên:** quy ước giao diện [04/10](../04-kien-truc/10-quy-uoc-giao-dien.md) (chỉ `components/ui` + `components/app`, màu qua `lib/status.ts`, đủ 4 trạng thái mỗi màn) · quy ước API [04/11 §2](../04-kien-truc/11-chot-chuc-nang-va-api.md) (mọi `PATCH` task mang `version`; client ghi REST, socket chỉ nhận) · ranh giới AI [04/12](../04-kien-truc/12-chat-phien-va-ban-nhap.md) (**LLM suy luận, backend chỉ tính và kiểm tra**) · feature freeze **05/11/2026**, demo MVP **06/11**.

---

## 1. Cách nghiên cứu

| Bước | Đã làm |
|---|---|
| Đọc mã | `apps/api/src/tasks/**` (controller 16 endpoint · service 1.217 dòng · DTO 322 dòng), `projects.service.ts` (dashboard), `workload.service.ts`, `metrics.service.ts`, `prisma/schema.prisma`, `prisma/seed.ts`; web: `features/board/KanbanBoard.tsx` (nay **1.534** dòng, không còn 550), `features/work/{filters,WorkFilterBar,WorkView,BulkActionBar}.tsx`, `features/tasks/TaskListView.tsx`, `features/eisenhower`, `features/timeline`, `components/app/{TaskCard,TaskDetailModal,TaskFieldPickers}.tsx` |
| Chạy thật | **Stack riêng** để không đụng phiên song song và không đo nhầm bản build cũ: API `PORT=3100 CORS_ORIGIN=http://localhost:3003`, web `PORT=3003` trỏ vào 3100, Postgres 5434 dữ liệu seed |
| Thao tác thật | Chrome headless 1600×1000 qua `puppeteer-core` có sẵn trong repo; đăng nhập `lan@smarttask.local`; tạo việc ở bảng, mở chi tiết, giao người, thêm việc con, bảng lệnh, lọc, tìm, Eisenhower, Timeline, Backlog, màn 375 px |
| Đo quy mô | Tạo thêm **100 việc** qua API rồi đo bảng/danh sách, sau đó **xoá sạch** — CSDL trả về đúng 12 việc như seed |
| Đối chiếu | Dữ liệu trong CSDL (`psql`) để xác minh mọi con số, không chỉ nhìn giao diện |

> **Một thay đổi dữ liệu đã làm trong lúc đo, cần biết:** `projects.task_counter` của dự án ST đang là **10** trong khi đã có 12 việc → mọi lệnh tạo việc đều `409`. Tôi đã đặt lại thành 12 trong CSDL phát triển để đo tiếp được. **Lỗi trong `seed.ts` vẫn còn nguyên** — xem §3 L1.

---

## 2. Đợt 1 chạy lại: còn tốt, không đụng vào

Đo lại bằng thao tác thật, để khỏi sửa nhầm thứ đang đúng:

| Thứ | Đo được |
|---|---|
| Mở màn Công việc | **3 request** (`sprints`, `tasks`, `skills`); đổi qua 5 tab = 0 request thêm |
| Tạo nhanh trong cột | **1 POST**; ô không đóng, con trỏ vẫn nằm trong ô (`document.activeElement` = `TEXTAREA`) |
| Mở chi tiết | **1 GET** `/tasks/:id`; modal 768 px, 4 tab, 23 điều khiển |
| Giao việc từ thẻ | **2 cú bấm**, 1 `PUT /assignees`, toast có nút **Hoàn tác** |
| Kéo thả / WIP | `move` đặt `completedAt`, `progress=100`, `remainingHours=0` khi vào cột hoàn thành; rời cột thì hoàn nguyên — logic đúng |
| Tiến độ cha | Khi đã có việc con thì thanh tiến độ cha **bị khoá đúng** (tiến độ suy ra từ con) |
| Bảng lệnh | Tìm theo **tiêu đề** chạy tốt ("Kanban" → ST-5); có nhóm "Tạo", "Điều hướng nhanh" |

---

## 3. Lỗi đo được — 4 cái, cái đầu là lỗi chặn

| # | Lỗi | Bằng chứng | Mức |
|---|---|---|---|
| **L1** | **Không tạo được công việc nào trên CSDL vừa seed.** `seed.ts` đặt `taskCounter: 10` nhưng chèn **12** việc (hai việc BUG thêm ngày 23/09). `nextNumber()` trả 11 → đụng `@@unique([projectId, number])` → `409 CONFLICT`. Tệ hơn: lỗi làm **transaction rollback**, bộ đếm quay về 10 → lần sau vẫn 11 → **hỏng vĩnh viễn**, không tự khỏi. | `POST /projects/:id/tasks` 3 lần liên tiếp: **409, 409, 409** với `details.fields = ["project_id","number"]`. Sau khi đặt `task_counter = 12`: **201 ST-13**, **201 ST-14**. Ảnh: [tạo việc báo CONFLICT](anh/cai-tien-task-dot-2/l1-tao-task-409-conflict.png) | 🔴 chặn |
| **L2** | **Tìm kiếm không bỏ dấu.** Gõ `bang` → 0 kết quả; gõ `Bảng` → 1. Áp cho **cả** ô "Tìm tiêu đề" trên bảng **và** bảng lệnh Ctrl+K, vì cùng đi qua `title: { contains }`. Người Việt gõ không dấu là chuyện thường ngày. | API: `?q=bang` → `[]`, `?q=Bảng` → `[ST-5]`. Trên bảng: gõ `bang` → **0/9 thẻ còn lại**. Ảnh: [gõ không dấu mất sạch thẻ](anh/cai-tien-task-dot-2/l2-tim-khong-dau.png) | 🟠 |
| **L3** | **Không tìm được theo mã ST-n.** Mã là định danh in trên mọi thẻ, mọi URL, mọi thông báo và là thứ cả nhóm gọi nhau trong họp ("ST-5 xong chưa?"), nhưng `search` chỉ khớp `title`. | Ctrl+K gõ `ST-5` → "Không tìm thấy kết quả phù hợp". API `?q=ST-5` → `[]`. Ảnh: [bảng lệnh không nhận mã](anh/cai-tien-task-dot-2/l3-cmdk-khong-tim-duoc-ma.png) | 🟠 |
| **L4** | Tiêu đề màn Công việc vẫn ghi "**Bốn** cách nhìn" trong khi đã có **năm** tab từ 23/09 (thêm Backlog). | `WorkView.tsx` dòng mô tả; thấy trên mọi ảnh chụp | 🟡 |

**L1 là thứ nguy hiểm nhất trong cả tài liệu này.** Nếu trước buổi demo 06/11 nhóm chạy lại `prisma db seed` cho sạch dữ liệu — đúng việc nên làm — thì thao tác đầu tiên của buổi demo, "tạo một công việc", sẽ báo lỗi đỏ. Bộ e2e không bắt được vì nó chạy trên schema `smarttask_test` với fixture riêng, không dùng `seed.ts`.

---

## 4. Thiếu so với phạm vi **đã chốt** — 5 mục

Đây không phải ý tưởng mới; đều nằm trong [04/11 §1.1–1.2](../04-kien-truc/11-chot-chuc-nang-va-api.md) hoặc bảng UC [04/03](../04-kien-truc/03-use-case.md) mà chưa có mã.

| # | Đã chốt ở đâu | Hiện trạng đo được |
|---|---|---|
| **T1** | docs 11 §1.1 mục 7 và UC-12: thẻ có "huy hiệu quá hạn / **bị chặn** / **người nhận quá tải**" | `TaskCard.tsx` có huy hiệu quá hạn ✅, nhưng phụ thuộc chỉ hiện **số đếm trung tính** (không phân biệt việc chặn đã xong hay chưa) và **không có huy hiệu quá tải** — grep "quá tải" trong `features/board` + `components/app`: 0 kết quả |
| **T2** | docs 11 §1.1 mục 8 (**MVP**) và UC-15: "Việc của tôi **xuyên dự án**" | `GET /me/tasks` đã có từ Phase 3, **web chưa gọi lần nào**; "Việc của tôi" hiện chỉ là bộ lọc client **trong một dự án**. Không có màn nào trả lời "hôm nay tôi phải làm gì" khi người dùng ở 3 dự án |
| **T3** | UC-14: "4 góc [ĐR]; **kéo đổi ưu tiên/khẩn [ĐV]**" | Màn Eisenhower **chỉ đọc**: 0 phần tử kéo được, 0 `data-task-id`. Thêm nữa, quy tắc "khẩn = hạn ≤ 3 ngày" làm ma trận **suy biến vào cuối sprint**: đo ngày 25/09 với sprint kết thúc 28/09 → 7 việc mở rơi hết vào hai ô trái (4 "Làm ngay", 3 "Uỷ quyền"), hai ô phải **trống trơn**. Ảnh: [hai ô rỗng](anh/cai-tien-task-dot-2/t3-eisenhower-hai-o-rong.png) |
| **T4** | docs 11 §1.2 thứ tự **4**, UC-26: "Bảng năng lực khi giao việc (khớp kỹ năng, giờ trống, U) cạnh Combobox — chuẩn bị cho AI phân công" | Giao việc đang **mù**. Menu "Giao cho" là danh sách trần 6 cái tên; `AssigneePicker` trong chi tiết cũng chỉ có tên + vai trò. `GET /projects/:id/capacity-table` **chỉ** được màn Cân bằng gọi. Ảnh: [giao việc mù](anh/cai-tien-task-dot-2/t4-giao-viec-mu.png) |
| **T5** | docs 11 §1.2 thứ tự **5**, UC-35/36, và docs 11 §3.6 đã ghi sẵn `GET·POST /tasks/:id/time-entries` và `PUT /tasks/:id/review` | **0 dòng mã.** Hai bảng `time_entries` và `task_reviews` **đã có trong CSDL** (migration `init_core`) nhưng `grep` toàn bộ `apps/api/src` + `apps/web/src`: không nơi nào đọc/ghi. Hệ quả dây chuyền ở §5 |

### 4.1 Vì sao T5 quan trọng hơn vẻ ngoài của nó

Công thức [04/04](../04-kien-truc/04-cong-thuc-tinh-toan.md) đặt **EAR** (hệ số ước lượng theo người) làm nhân tử của mọi con số tải:

```
HoursEff(u, t) = remaining(t) × EAR(u, cat(t)) × Diff(t) × SkillGap(u, t)
```

Tài liệu ghi `actual` lấy từ **`time_entries` (MANUAL)** hoặc cycle time. Thực tế `MetricsService` chỉ đọc `review.actualHoursConfirmed` (không ai ghi được) rồi rơi về cycle time × hệ số. Nghĩa là:

- EAR **luôn** là ước lượng thô từ ngày bắt đầu → ngày xong, không bao giờ có giờ thật;
- `ContextBuilder` vẫn in `EAR 1.4 (n=6)` vào ngữ cảnh gửi cho LLM như một **sự thật do hệ thống tính** (master prompt điều 1) — ta đang nói với mô hình một con số mà nguồn của nó chưa hiện thực;
- điểm burnout có thành phần `EAR_4tuần − EAR_8tuần` ("đang chậm dần so với chính mình") cũng chỉ là nhiễu của cycle time.

Hội đồng hỏi "số 1,4 này ở đâu ra?" là câu hỏi rất dễ xảy ra, và là câu khó trả lời nhất hiện nay.

---

## 5. Ma sát khi dùng thật — 7 cái

| # | Ma sát | Số đo | Mức |
|---|---|---|---|
| **M1** | **Bộ lọc không đủ chiều, và chia làm hai hệ.** Bộ lọc dùng chung (trong URL) chỉ có: sprint, người, loại, từ khoá, lọc nhanh, nhóm. **Không lọc được theo nhãn, theo hạn (quá hạn / sắp hạn), theo độ khó.** Ưu tiên và cột thì có — nhưng **chỉ ở màn Danh sách**, dưới dạng hàng "Lọc riêng của bảng" không vào URL, không dùng được ở Bảng/Eisenhower/Timeline. Backend `ListTasksQueryDto` **đã nhận** `labelId`, `priority`, `dueFrom`, `dueTo`, `columnId` — web không gửi. | 2 hàng lọc, 2 ngữ nghĩa khác nhau; 5/9 tham số lọc của API không có ô nào gọi tới. Ảnh: [hai hàng lọc](anh/cai-tien-task-dot-2/m1-danh-sach-hai-hang-loc.png) | 🟠 |
| **M2** | **Từ con số không đi tới được việc phải làm.** Dashboard hiện "3 Quá hạn", "7 Chưa giao", biểu đồ theo cột / theo loại / theo người — **không cái nào bấm được** (`Stat` là `Card` thuần, không có `onClick`, không `Link`). Mà kể cả muốn tự đi thì cũng **không có bộ lọc quá hạn** (M1) để tới nơi. "Chưa giao" là chiều duy nhất đi được, nhờ chip lọc nhanh. | `ProjectDashboardView.tsx:247` — `Stat` không có handler nào | 🟠 |
| **M3** | **Việc con là công dân hạng hai.** Dòng việc con trong chi tiết có đúng **1 điều khiển** (ô tick xong/chưa). Không giao được người, không đặt hạn, không mở được chi tiết của chính nó, không xoá, không xếp thứ tự. Form thêm chỉ gửi `title` + `giờ` dù `POST /tasks/:id/subtasks` nhận cả `assigneeIds`. | Tạo ST-15: dòng hiện ra chỉ có `"ST-15 · R2 việc con thử  3h"` + 1 checkbox | 🟠 |
| **M4** | **Giờ của việc con rơi ra ngoài mọi phép tính.** Truy vấn tải (`workload.service.ts` dòng 117, 519) lọc theo `assignees`, **không** lọc `parentId` — nên: việc con không giao được người (M3) ⇒ giờ của nó **biến mất** khỏi tải; còn nếu ai đó giao qua API thì nó **cộng trùng** với giờ của việc cha, vì `recomputeParentProgress` chỉ tính lại `progress` của cha chứ không đụng `remainingHours`. Hai đường đều sai, chỉ khác dấu. | Đọc mã 3 truy vấn `task.findMany` của workload: chỉ truy vấn thứ ba (bảng năng lực) có `parentId: null` | 🟠 |
| **M5** | **Dữ liệu seed không chạm tới nửa mô hình công việc.** CSDL sau seed: **0 việc con, 0 phụ thuộc, 0 nhãn gắn vào việc** (4 nhãn được định nghĩa nhưng không việc nào mang), **0 bình luận, 0 đính kèm**, 0 giờ thực, 0 đánh giá. Nghĩa là đúng các UC mức **M** — UC-11 phụ thuộc, UC-18 bình luận, UC-19 đính kèm — không có gì để chỉ trong buổi demo. Chú thích Gantt ghi "mũi tên = phụ thuộc" mà không bao giờ vẽ được mũi tên nào. | `psql` đếm trực tiếp. Ảnh: [Gantt không có mũi tên nào](anh/cai-tien-task-dot-2/m4-timeline-khong-mui-ten.png) | 🟠 |
| **M6** | **Quy mô chưa được nghĩ tới.** `GET /projects/:id/tasks` trả **toàn bộ** với trần cứng `take: 1000`, không phân trang, không trả tổng số, không báo khi bị cắt. Bảng và Danh sách vẽ **hết** không ảo hoá. | Đo với 109 việc: payload **78 KB** (717 byte/việc), bảng vẽ **109 thẻ / 5.130 nút DOM**, danh sách 109 dòng, không phân trang. API vẫn nhanh (19 ms) — nút thắt nằm ở client. Ảnh: [bảng 109 việc](anh/cai-tien-task-dot-2/m5-bang-109-viec.png) | 🟡 |
| **M7** | **Màn hẹp gần như không dùng được để quản việc**, và **ngày hiển thị sai quy ước.** Ở 375 px, tiêu đề + 7 hàng điều khiển + dải vai trò chiếm ~**750/812 px** trước khi thấy thẻ đầu tiên; chế độ tập trung chỉ bật bằng **phím F** nên máy không bàn phím không dùng được. Ô ngày `input[type=date]` hiện **09/16/2026** (MM/DD) giữa giao diện tiếng Việt vốn hiện 16/09 ở mọi chỗ khác. | Ảnh: [điện thoại](anh/cai-tien-task-dot-2/m6-dien-thoai-bo-loc-chiem-man.png), [danh sách](anh/cai-tien-task-dot-2/m1-danh-sach-hai-hang-loc.png) | 🟡 |

---

## 6. Đề xuất

Ký hiệu công sức: **S** ≤ nửa ngày · **M** 1–2 ngày · **L** 3+ ngày. Mọi đề xuất đều nêu rõ có cần endpoint mới / có đụng `version` và realtime không.

### Nhóm A — Sửa lỗi (rẻ, làm trước mọi thứ)

#### A1 · Chữa bộ đếm mã công việc 🔴 — **S**

- **Sửa gốc:** `seed.ts` đặt `taskCounter` bằng **đúng số việc đã chèn** (hoặc tính `max(number)` sau khi chèn xong thay vì viết số tay — để lần sau thêm việc mẫu không tái phát).
- **Chống tái phát ở tầng dịch vụ:** `nextNumber()` bắt lỗi trùng một lần: khi `P2002` trên `(project_id, number)` thì đặt lại `taskCounter = max(number)` của dự án rồi thử lại **đúng một lần**. Giữ nguyên trong transaction.
- **Chốt bằng kiểm thử:** thêm một ca e2e "chạy seed xong tạo được việc ngay" — hiện e2e không chạm `seed.ts` nên không ai bắt được lớp lỗi này.
- **Endpoint / version / realtime:** không đổi gì.
- **Rủi ro:** không. **Phải làm trong tuần này**, không chờ duyệt cả gói.

#### A2 · Tìm kiếm bỏ dấu và nhận mã ST-n 🟠 — **S**

- **Bỏ dấu:** dùng lại **đúng khuôn mẫu đã có trong repo** — `apps/api/src/comments/search/pg-trgm-member-search.ts` đang dùng `unaccent` + tiền tố + trigram. Hai extension `unaccent`, `pg_trgm` đã cài sẵn trong CSDL. Viết lại `TasksService.search` theo khuôn đó.
- **Nhận mã:** nếu `q` khớp `^([A-Za-z]+)-(\d+)$` thì tra thẳng theo `(projectKey, number)` và đưa kết quả đó lên **đầu** danh sách, rồi mới tới kết quả tìm mờ. `GET /tasks/by-key/:projectKey/:number` đã có sẵn.
- **Áp cho cả hai nơi:** bảng lệnh Ctrl+K và ô "Tìm tiêu đề" của bộ lọc dùng chung (cùng một tham số `q`).
- **Endpoint:** không thêm đường dẫn mới, chỉ đổi phần thân `search` và `list`.
- **Rủi ro:** thấp. Cần chỉ số trigram trên `tasks.title` nếu muốn nhanh ở quy mô lớn — với vài nghìn dòng thì chưa cần, ghi vào ghi chú.

#### A3 · "Bốn cách nhìn" → "Năm cách nhìn" 🟡 — **S**. Một dòng chữ.

### Nhóm B — Biến con số thành việc phải làm (giá trị demo cao nhất)

#### B1 · Một bộ lọc duy nhất, đủ chiều 🟠 — **M**

- Gộp hàng "Lọc riêng của bảng" của màn Danh sách vào **bộ lọc dùng chung** (`features/work/filters.tsx`), để mọi cách nhìn cùng một bộ lọc và bộ lọc nào cũng vào URL.
- Thêm ba chiều mà API **đã nhận sẵn**: **nhãn** (`labelId`), **ưu tiên** (`priority`), **hạn** — ô "Hạn" dạng `Select` với các mốc dựng sẵn: *Quá hạn · 3 ngày tới · Tuần này · Không có hạn*, dịch sang `dueFrom`/`dueTo` phía client (tất định, không đoán).
- Màn hẹp: gói các ô lọc ít dùng vào `Collapsible` "Thêm bộ lọc" (giải luôn một nửa M7).
- **Endpoint:** không thêm. **version/realtime:** không đụng.
- **Rủi ro:** thấp; phải giữ nguyên tương thích với **Bộ lọc đã lưu** của đợt 1 (`localStorage`) — thêm khoá mới, đọc thiếu khoá thì coi như "tất cả".

#### B2 · Thẻ số trên Dashboard bấm được 🟠 — **S**

- "Quá hạn", "Chưa giao", mỗi cột trong biểu đồ "Việc theo cột", mỗi loại, mỗi người → `Link` sang `/projects/:id/work?...` với đúng bộ lọc (dựa trên B1).
- Đây là **mười dòng mã** đổi `Card` thành `Button asChild` + `Link` (đúng [04/10 §2](../04-kien-truc/10-quy-uoc-giao-dien.md): không `<a>` thô), nhưng là thứ hội đồng bấm thử đầu tiên khi nhìn Dashboard.
- **Phụ thuộc:** làm **sau** B1, nếu không thì trỏ tới bộ lọc chưa tồn tại.

#### B3 · Huy hiệu "bị chặn" và "người nhận quá tải" trên thẻ 🟠 — **M**

- **Bị chặn:** thẻ đã có `dependsOnIds`; chỉ cần đối chiếu với các việc đang có trong cache để biết việc chặn **đã xong chưa**. Chưa xong → `Badge variant="warning"` "Bị chặn bởi ST-n"; xong hết → giữ huy hiệu trung tính như hiện nay. Việc chặn nằm ngoài bộ lọc hiện tại thì hiện trạng thái "không rõ" thay vì đoán bừa.
- **Người nhận quá tải:** màn Công việc gọi thêm **một** lần `GET /projects/:id/workload?weeks=1` (đã có, đang dùng ở màn Nhân sự) và chấm dấu cảnh báo lên avatar của người ở mức Cao/Quá tải, màu lấy từ `levelToVariant` trong `lib/status.ts`.
- **Vì sao đáng:** đây là chỗ duy nhất mà "cân bằng tải" — điểm nhấn của đề tài — xuất hiện **ngay trong luồng làm việc hằng ngày**, chứ không phải ở một màn báo cáo riêng.
- **Endpoint:** không thêm. **Rủi ro:** trung bình — phải nhớ *không* chặn thao tác khi quá tải, chỉ cảnh báo (quyết định vẫn của người).

#### B4 · Bảng năng lực ngay lúc giao việc (UC-26) 🔴 giá trị — **M**

- Ghép `GET /projects/:id/capacity-table` (**đã có**, đang dùng ở màn Cân bằng) vào `AssigneePicker` và vào submenu "Giao cho" của thẻ: mỗi dòng người hiện thêm **khớp kỹ năng** với kỹ năng yêu cầu của việc, **giờ trống tuần này**, **mức sử dụng U**.
- **Ranh giới AI phải giữ đúng:** bảng này **không xếp hạng, không gợi ý "người phù hợp nhất"** — chỉ bày số cho người quyết định, đúng như màn Cân bằng đang làm ([05/web-tich-hop §2](../05-hien-thuc/web-tich-hop.md): "backend chỉ tính; đề xuất chuyển việc là bản nháp của LLM, PM duyệt mới ghi"). Muốn có gợi ý thì đi qua Trợ lý AI (`ASSIGN_PROPOSAL` đã có trong executor).
- **Endpoint:** không thêm. **Rủi ro:** thấp; chỉ cần `staleTime` đủ dài để mở menu không gọi lại API mỗi lần.

#### B5 · "Việc của tôi" xuyên dự án (UC-15, MVP) 🟠 — **M**

- Màn mới `/me/work` dùng `GET /me/tasks?status=&dueTo=` — endpoint **có từ Phase 3, chưa màn nào gọi**. Nhóm theo dự án, sắp theo hạn, mở thẳng chi tiết bằng `?task=`.
- Vào từ menu tài khoản và từ bảng lệnh ("Việc của tôi").
- **Endpoint:** không thêm.

### Nhóm C — Việc con và phụ thuộc thành thứ thật

#### C1 · Dòng việc con đủ dùng 🟠 — **M**

- Mỗi dòng thêm: **người thực hiện** (dùng lại `AssigneePicker`), **hạn**, nút **mở chi tiết** (trang `/tasks/ST-n` đã có), nút **xoá**. Form thêm gửi kèm `assigneeIds`.
- **Endpoint:** không thêm — `PATCH /tasks/:id`, `PUT /tasks/:id/assignees`, `DELETE /tasks/:id` áp cho việc con y như việc thường.
- **version/realtime:** mỗi thao tác mang `version` của **chính việc con**; dùng lại đúng hàng đợi tuần tự của đợt 1.

#### C2 · Chốt một quy tắc về giờ của việc con 🔴 — **S** (quyết định) + **S** (mã)

Phải chọn **một** trong hai, vì hiện nay đang sai cả hai đường (M4):

| Phương án | Nội dung | Đánh đổi |
|---|---|---|
| **(a) Cha là tổng của con** *(khuyến nghị)* | Khi việc có việc con: khoá ô ước lượng/giờ còn lại của cha, giá trị = tổng của các con; `recomputeParentProgress` tính luôn `remainingHours`. Tải chỉ đếm việc con. | Nhất quán với cách tiến độ cha đã suy ra từ con; đụng một hàm backend đã có |
| **(b) Việc con không mang giờ** | Bỏ ô "giờ" khỏi form thêm việc con; việc con chỉ là danh sách kiểm. | Rẻ nhất, nhưng mất khả năng chia giờ cho nhiều người trong một việc |

- Dù chọn gì, **truy vấn tải phải nói rõ lập trường** về `parentId` và ghi vào [04/04](../04-kien-truc/04-cong-thuc-tinh-toan.md).
- **Rủi ro:** trung bình với (a) — có công thức, phải có unit test cho `recomputeParentProgress`.

#### C3 · Hiện việc con trong Danh sách 🟡 — **S**

- `ListTasksQueryDto` **đã có** `includeSubtasks`, web chưa bao giờ gửi. Thêm ô bật/tắt "Hiện việc con" ở màn Danh sách, vẽ lồng dưới việc cha.

### Nhóm D — Eisenhower và dữ liệu demo

#### D1 · Eisenhower kéo được, và nói rõ ngưỡng khẩn 🟠 — **M**

- **Kéo thẻ giữa 4 ô** (UC-14 đã chốt là [ĐV]): sang phải/trái đổi **ưu tiên** (Cao ↔ Trung bình), lên/xuống đổi **cờ khẩn** `isUrgent`. Khác với swimlane của đợt 1 — ở đó kéo **không** được ghi ngầm; ở đây kéo **chính là** hành động đổi thuộc tính, nên phải có toast nói rõ đã đổi gì + **Hoàn tác**.
- **Ngưỡng khẩn hiện đang giấu trong mã** (`hạn ≤ 3 ngày`) và làm ma trận suy biến cuối sprint (T3). Thêm ô chọn **1 / 3 / 7 ngày** ngay trên màn, mặc định 3, lưu trong URL như các bộ lọc khác. Rẻ, và trả lời được câu "sao ô này lúc nào cũng rỗng?".
- **Endpoint:** không thêm (`PATCH /tasks/:id {priority, isUrgent, version}`).

#### D2 · Seed chạm tới đủ mô hình 🟠 — **S**

- Thêm vào `seed.ts`: 3–4 **việc con** có người và giờ, 2–3 **phụ thuộc** (để Gantt vẽ được mũi tên và huy hiệu "bị chặn" của B3 có chỗ xuất hiện), gắn **nhãn** cho ~2/3 số việc, 4–5 **bình luận** có @mention, 1–2 **đính kèm** giả.
- Làm **cùng lúc** với A1 (cùng đụng một tệp) và **sau** khi chốt C2 (để giờ của việc con seed cho đúng quy tắc).
- **Rủi ro:** không — chỉ dữ liệu mẫu. Nhớ cập nhật con số "sau seed có 12 công việc" trong [05/web-tich-hop §5](../05-hien-thuc/web-tich-hop.md).

### Nhóm E — Giờ thực tế và đánh giá (UC-35/36) — **quyết định lớn nhất của đợt này**

#### E1 · Ghi giờ làm thực tế — **M** (backend) + **M** (web)

- `GET · POST /tasks/:id/time-entries`, `PATCH · DELETE /time-entries/:id` — **đã ghi sẵn trong [04/11 §3.6](../04-kien-truc/11-chot-chuc-nang-va-api.md)**, quyền `assignee · pj:PM`.
- **Không cần migration:** bảng `time_entries` đã nằm trong `init_core` và đã tồn tại trong CSDL.
- Web: một dòng "Ghi giờ hôm nay" trong nhóm "Thời gian & công sức" của chi tiết + tổng giờ tuần ở màn Nhân sự.

#### E2 · Đánh giá sau hoàn thành — **S** (backend) + **S** (web)

- `PUT /tasks/:id/review {rating, difficultyActual, actualHoursConfirmed?, comment?}` — cũng đã ghi sẵn, bảng `task_reviews` đã có.
- Web: khi PM kéo việc sang cột hoàn thành thì hiện một `Dialog` gọn hỏi 3 ô, **bỏ qua được**.

#### E3 · Nối vào EAR — **S**

- `MetricsService` đọc `time_entries` trước, rồi mới tới `review.actualHoursConfirmed`, rồi mới tới cycle time — **đúng thứ tự tài liệu công thức đã viết**. Nguồn dữ liệu nào đang được dùng phải hiện ra trên giao diện (ví dụ "EAR 1,2 · n=6 · nguồn: giờ khai") để không bao giờ trình bày một con số không rõ gốc.

**Vì sao nên làm dù sát freeze:** đây là mục duy nhất trong tài liệu này làm cho **câu chuyện chính của đồ án** đứng vững — "AI phân công dựa trên lịch sử làm việc thật, không chỉ giờ ước lượng". Không có nó, mọi con số EAR trong ngữ cảnh gửi LLM đều là suy ra từ cycle time. Và chi phí thấp hơn vẻ ngoài: **không migration, endpoint đã thiết kế sẵn, công thức đã viết sẵn** — chỉ thiếu phần hiện thực.

**Nếu anh thấy không kịp:** phương án tối thiểu là chỉ làm **E2 + E3** (đánh giá khi xong, 3 ô, mỗi việc một lần) — rẻ hơn E1 nhiều mà vẫn có `actualHoursConfirmed` thật để nuôi EAR. Trong báo cáo ghi E1 là hướng phát triển.

### Nhóm F — Quy mô và màn hẹp (làm nếu kịp)

| Mã | Việc | Công sức |
|---|---|---|
| **F1** | `list` trả thêm `total` và cờ `truncated` khi chạm trần 1.000; giao diện hiện dải "Đang xem 1.000/1.240 việc — thu hẹp bộ lọc". Chưa cần ảo hoá ở quy mô đồ án, nhưng **phải thôi im lặng cắt dữ liệu**. | S |
| **F2** | Nút "Tập trung" bấm được (không chỉ phím F) + bộ lọc thu gọn trên màn < 640 px | S |
| **F3** | Thay `input[type=date]` bằng `Popover` + `Calendar` của shadcn để ngày hiện **dd/mm/yyyy** thống nhất toàn hệ thống | S |

---

## 7. Cái gì **không** làm trong đợt này

| Thứ | Vì sao |
|---|---|
| Endpoint hàng loạt `POST /tasks/bulk`, `PATCH /tasks/bulk` | Đợt 1 đã đo và kết luận không cần — gọi tuần tự ≤ 50 đủ nhanh mà giữ được khoá lạc quan từng việc. Không mở lại. |
| Epic / cấp phân rã thứ ba | Đã chốt không làm ở [02/05 §E5](05-cai-tien-quan-ly-task.md). Nhóm C ở trên làm **việc con hiện có** cho tử tế, không thêm cấp. |
| Kết quả xử lý (huỷ / không làm) — E4 của đợt 1 | Vẫn để ở hướng phát triển: kéo theo `completedAt`, `recomputeParentProgress`, `BurndownSnapshot` và công thức [04/04](../04-kien-truc/04-cong-thuc-tinh-toan.md). Nếu nhóm C2 đã phải đụng `recomputeParentProgress` thì **có thể cân nhắc lại** — nhưng chỉ sau khi C2 xanh. |
| Ảo hoá danh sách (react-virtual…) | Thêm thư viện thứ hai vào tầng UI, phạm [04/10 §2](../04-kien-truc/10-quy-uoc-giao-dien.md). F1 (nói thật về việc cắt dữ liệu) đủ cho quy mô đồ án. |
| Trường tuỳ biến động, JQL, workflow engine | Đã ở **Won't** từ [04/11 §1.3](../04-kien-truc/11-chot-chuc-nang-va-api.md). |
| Gọi LLM trong ô tạo/tìm việc | Vi phạm ranh giới AI. A2 (bỏ dấu, nhận mã) là xử lý **tất định**, kiểm thử được. |

---

## 8. Xếp ưu tiên

| Hạng | Mã | Tên | Công sức | Vì sao xếp ở đây |
|---|---|---|---|---|
| 1 | **A1** | Chữa bộ đếm mã công việc | S | 🔴 Đang chặn hoàn toàn việc tạo task trên CSDL seed |
| 2 | **A2** | Tìm bỏ dấu + nhận mã ST-n | S | 🟠 Rẻ, dùng lại khuôn mẫu có sẵn, sửa hai chỗ cùng lúc |
| 3 | **A3** | Sửa chữ "Bốn cách nhìn" | S | 🟡 Một dòng |
| 4 | **D2** | Seed chạm đủ mô hình | S | 🟠 Làm cùng tệp với A1; mở đường cho B3, M5 |
| 5 | **B1** | Một bộ lọc duy nhất, đủ chiều | M | 🟠 Nền cho B2; gỡ luôn nửa M7 |
| 6 | **B2** | Thẻ số Dashboard bấm được | S | 🟠 Rẻ nhất trên mỗi điểm ấn tượng |
| 7 | **B4** | Bảng năng lực khi giao việc | M | 🔴 Điểm nhấn đề tài, đang hoàn toàn vắng mặt |
| 8 | **B3** | Huy hiệu bị chặn / quá tải | M | 🟠 Đã chốt trong phạm vi MVP |
| 9 | **C2** | Chốt quy tắc giờ của việc con | S+S | 🔴 Đang làm lệch số liệu tải |
| 10 | **C1** | Dòng việc con đủ dùng | M | 🟠 |
| 11 | **E2+E3** | Đánh giá sau hoàn thành → nuôi EAR | S+S | 🔴 Cho EAR một nguồn thật |
| 12 | **B5** | "Việc của tôi" xuyên dự án | M | 🟠 Đã chốt là MVP mà chưa có |
| 13 | **D1** | Eisenhower kéo được + ngưỡng khẩn | M | 🟠 UC-14 ghi [ĐV] mà đang chỉ đọc |
| 14 | **E1** | Ghi giờ làm thực tế | M+M | 🟠 Đắt nhất nhóm E |
| 15 | **C3** | Việc con trong Danh sách | S | 🟡 |
| 16 | **F1–F3** | Nói thật về giới hạn 1.000 · tập trung bấm được · ngày dd/mm | S×3 | 🟡 |

---

## 9. Bảng chốt — anh tick vào đây

| ✔ | Mã | Việc | Công sức | Quyết định (MVP 06/11 · nếu kịp · để sau · bỏ) |
|---|---|---|---|---|
| ☐ | A1 | Chữa `taskCounter` trong seed + chống tái phát ở `nextNumber` + e2e | S | |
| ☐ | A2 | Tìm kiếm bỏ dấu (`unaccent`+`pg_trgm`) và nhận mã `ST-n` | S | |
| ☐ | A3 | "Bốn cách nhìn" → "Năm cách nhìn" | S | |
| ☐ | B1 | Gộp hai hàng lọc; thêm lọc **nhãn / ưu tiên / hạn** | M | |
| ☐ | B2 | Thẻ số Dashboard bấm được → mở đúng bộ lọc | S | |
| ☐ | B3 | Huy hiệu **bị chặn** + **người nhận quá tải** trên thẻ | M | |
| ☐ | B4 | Bảng năng lực (kỹ năng · giờ trống · U) ngay lúc giao việc | M | |
| ☐ | B5 | Màn "Việc của tôi" xuyên dự án (`GET /me/tasks`) | M | |
| ☐ | C1 | Dòng việc con: người, hạn, mở chi tiết, xoá | M | |
| ☐ | C2 | Chốt quy tắc giờ việc con — **(a) cha = tổng con** hay **(b) con không có giờ**? | S+S | |
| ☐ | C3 | Ô "Hiện việc con" ở Danh sách (`includeSubtasks` đã có) | S | |
| ☐ | D1 | Eisenhower kéo đổi ưu tiên/khẩn + ô chọn ngưỡng 1/3/7 ngày | M | |
| ☐ | D2 | Seed: việc con, phụ thuộc, nhãn, bình luận, đính kèm | S | |
| ☐ | E1 | `time-entries` + ô ghi giờ trong chi tiết | M+M | |
| ☐ | E2 | `PUT /tasks/:id/review` + hộp thoại khi việc sang cột hoàn thành | S+S | |
| ☐ | E3 | `MetricsService` đọc giờ thật; hiện nguồn của EAR trên giao diện | S | |
| ☐ | F1 | `total` + cảnh báo khi chạm trần 1.000 việc | S | |
| ☐ | F2 | Nút "Tập trung" bấm được + bộ lọc thu gọn trên màn hẹp | S | |
| ☐ | F3 | Ô ngày dd/mm/yyyy (`Popover` + `Calendar`) | S | |

**Ba câu cần anh trả lời trước khi chia việc:**

1. **Nhóm E có làm không?** Đây là quyết định đắt nhất và có lợi nhất. Ba mức: *đủ* (E1+E2+E3) · *tối thiểu* (E2+E3) · *không làm, ghi hướng phát triển*.
2. **C2 chọn (a) hay (b)?** Phải chốt trước khi làm C1 và D2, nếu không sẽ phải sửa hai lần.
3. **Có đụng `apps/api` trong đợt này không?** A1, A2, C2, E1–E3 đều chạm backend; B, D, F gần như chỉ `apps/web`. Nếu nhóm muốn backend đóng băng sau gói thiết kế 16/10 thì phải dồn A và E lên trước mốc đó.

---

## 10. Chia phase đề xuất

> Đánh số **12 / 13 / 14** tiếp theo cách đánh số của đợt cải tiến giao diện (đợt 1 dùng 9, 9b, 10, 11), **không liên quan** tới Phase 9–10 của [kế hoạch backend](../05-hien-thuc/00-ke-hoach-backend.md).

| Phase | Tên | Nội dung | Ước lượng | Mốc |
|---|---|---|---|---|
| **Phase 12** | Sửa lỗi & dữ liệu mẫu | A1 → A2 → A3 → D2 | 1–1,5 ngày | **ngay tuần này** — A1 đang chặn |
| **Phase 13** | Từ con số tới việc | B1 → B2 → B4 → B3 → B5 | 4–5 ngày | trước 16/10 (gói thiết kế) |
| **Phase 14** | Việc con & lịch sử làm việc | C2 (chốt) → C1 → C3 → E2 → E3 → *(E1 nếu duyệt mức "đủ")* → D1 | 4–6 ngày | trước **05/11** (freeze) |
| **Vét** | Quy mô & màn hẹp | F1 → F2 → F3 | 1 ngày | trước 05/11 |
| **Hướng phát triển** *(ghi vào báo cáo, không code)* | — | E4 kết quả xử lý (huỷ/không làm), khôi phục việc đã xoá mềm, Epic, ảo hoá danh sách, trường tuỳ biến, JQL | — | — |

**Thứ tự bắt buộc:** A1 trước mọi thứ (không tạo được việc thì không kiểm được gì khác) · D2 sau C2 nếu C2 đổi quy tắc giờ · B1 trước B2 · C2 trước C1 · E3 sau E2.

---

## 11. Cách kiểm chứng lại các con số trong tài liệu này

```bash
# Stack riêng, không đụng tiến trình của phiên song song
setsid env PORT=3100 CORS_ORIGIN=http://localhost:3003 AI_PROVIDER=fake npm run api:dev &
setsid env NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 PORT=3003 npm run web:dev &
```

```bash
docker exec smarttask-postgres psql -U smarttask -d smarttask -c "select key, task_counter from projects;" -c "select count(*) from tasks;"
```

- **L1:** `POST /api/v1/projects/<id>/tasks` ba lần → cả ba `409`; `update projects set task_counter=12` rồi gọi lại → `201`.
- **L2/L3:** `GET /api/v1/workspaces/<wsId>/tasks/search?q=bang` → `[]`, `?q=Bảng` → `[ST-5]`, `?q=ST-5` → `[]`.
- **M5:** đếm trực tiếp `task_dependencies`, `task_labels`, `comments`, `attachments`, `time_entries`, `task_reviews` — hiện đều bằng 0.
- **M6:** tạo 100 việc qua API rồi mở màn Công việc; nhớ xoá sạch sau khi đo (`delete from tasks where title like '<tiền tố>%'` và đặt lại `task_counter`).
- Ảnh chụp trong `anh/cai-tien-task-dot-2/` chụp bằng Chrome headless 1600×1000 (pane trình duyệt trong môi trường này không chụp được — xem [05/web-tich-hop §5](../05-hien-thuc/web-tich-hop.md)).

---

## 12. Nguồn tham khảo

Chỉ đối chiếu cơ chế, không sao chép giao diện. Đợt này tra thêm hai chỗ so với [02/05 §14](05-cai-tien-quan-ly-task.md):

- Tài liệu nội bộ: [04/04 công thức](../04-kien-truc/04-cong-thuc-tinh-toan.md) (EAR, HoursEff, burnout), [04/11 §1.2 và §3.6](../04-kien-truc/11-chot-chuc-nang-va-api.md) (thứ tự "làm nếu kịp", endpoint đã thiết kế cho UC-26/35/36), [04/03](../04-kien-truc/03-use-case.md) (UC-11, 12, 14, 15, 26, 35, 36).
- Khuôn mẫu sẵn có trong repo để dùng lại: `apps/api/src/comments/search/pg-trgm-member-search.ts` (unaccent + trigram) cho A2; `features/rebalance` + `GET /projects/:id/capacity-table` cho B4.
