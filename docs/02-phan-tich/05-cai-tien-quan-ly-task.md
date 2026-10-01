# 05 · Nghiên cứu và đề xuất cải tiến Tạo task & Quản lý task

**Phiên bản:** 1.2 — **Ngày:** 23/09/2026 (Tuần 03) — **Trạng thái:** đã duyệt; Phase 9 và Phase 10 hiện thực xong

> **Cập nhật 23/09/2026:** 15 mục đã làm và commit (xem cột "Chốt làm gì" ở §12): A1, A2, A3, A5, A6,
> A7, B3, B8, C3, D1, D2, D3, E1, E2, E3 — cộng việc bỏ ký hiệu phím Mac, hiện Ctrl theo hệ điều hành.
> Còn lại của Phase 9–10: B1 (chọn nhiều + hàng loạt), B2 (sửa tại chỗ ở Danh sách), B4 (hoàn tác),
> C1 (phím tắt toàn cục), C2 (bảng lệnh Ctrl/Super + K tìm & tạo việc — chờ `AppShell.tsx` rảnh), A4 (cú pháp `@ # !`),
> B5, B6, B7, C4, C5.
**Phạm vi:** UC-10 (công việc), UC-11 (subtask), UC-12 (Kanban), UC-15 (danh sách & bộ lọc).
**Ràng buộc bắt buộc giữ nguyên:**

- Quy ước giao diện [04/10](../04-kien-truc/10-quy-uoc-giao-dien.md): chỉ `components/ui` + `components/app`, không màu hex, màu trạng thái qua `lib/status.ts`, mỗi màn đủ 4 trạng thái (tải / rỗng / lỗi theo mã / có dữ liệu).
- Quy ước API [04/11](../04-kien-truc/11-chot-chuc-nang-va-api.md) §2: mọi `PATCH` task mang `version`, lệch → `409 TASK_VERSION_CONFLICT { current, sent }`; client ghi qua REST, socket chỉ nhận.
- Ranh giới AI ([04/12](../04-kien-truc/12-chat-phien-va-ban-nhap.md)): **LLM suy luận, backend chỉ tính và kiểm tra**. Mọi cải tiến trong tài liệu này là **xử lý tất định** (parse cú pháp, tách dòng, sắp xếp, lọc) — không có chỗ nào backend “đoán”. Phân rã bằng ngôn ngữ tự nhiên vẫn đi qua Trợ lý AI, có bản nháp và người duyệt.
- Feature freeze **05/11/2026** (hết Tuần 08) theo [04/11](../04-kien-truc/11-chot-chuc-nang-va-api.md); demo MVP 06/11.

---

## 1. Cách nghiên cứu

| Bước | Đã làm |
|---|---|
| Đọc mã | `apps/api/src/tasks/**` (controller 16 endpoint, service 1.217 dòng, DTO 313 dòng), `apps/api/prisma/schema.prisma` (Task/TaskAssignee/TaskSkill/TaskDependency/TaskLabel/BoardColumn), `apps/web/src/features/board/KanbanBoard.tsx` (550 dòng) + `hooks.ts`, `features/tasks/TaskListView.tsx`, `features/work/{filters,WorkFilterBar,WorkView}.tsx`, `components/app/{TaskCard,TaskDetailSheet,ShortcutsDialog,AppShell}.tsx` |
| Chạy thật | `make db-up` (Postgres 5434, seed sẵn) → `npm run api:dev` (3000) → `PORT=3001 npm run web:dev`; đăng nhập `lan@smarttask.local` |
| Đo thật | 3 kịch bản Puppeteer headless (Chrome 152) đếm **số cú bấm**, **số request API**, **thời gian**, chụp màn hình. Các task tạo ra khi đo đã được xoá, CSDL trả về đúng 10 task như seed. |
| Đối thủ | Tài liệu chính thức Atlassian (Jira Cloud, Trello), Linear Docs, ClickUp Help — chỉ đọc để đối chiếu cơ chế, **không sao chép giao diện**. |

> Ghi chú môi trường: pane trình duyệt trong môi trường phát triển này không chụp ảnh được (đúng như [05/web-tich-hop §5](../05-hien-thuc/web-tich-hop.md)), nên toàn bộ ảnh dưới đây chụp bằng Chrome headless 1600×1000.

---

## 2. Hiện trạng đo được — bảng ma sát

Ký hiệu mức: 🔴 chặn luồng làm việc · 🟠 tốn thao tác · 🟡 khó chịu.

| # | Ma sát quan sát được | Số đo thực tế | Mức |
|---|---|---|---|
| M1 | **Không có tạo nhanh trong cột.** Nút “Thêm công việc” ở đáy mỗi cột chỉ mở đúng hộp thoại modal như nút “Tạo công việc” ở đầu trang. Không gõ thẳng vào cột được. | 1 bấm → modal che cả bảng ([ảnh](anh/cai-tien-task/ma-01-hop-thoai-tao-task.png)) | 🔴 |
| M2 | **Không tạo liên tiếp.** Tạo xong hộp thoại đóng ngay; muốn tạo cái thứ hai phải bấm lại từ đầu. Không có “Create another”. | đo: dialog đóng sau 95 ms, không mở lại | 🔴 |
| M3 | **Dán nhiều dòng chỉ ra một task.** Dán `"Việc A\nViệc B\nViệc C"` vào ô tiêu đề → ô nhận `"Việc AViệc BViệc C"`, tạo đúng 1 task. | đo trực tiếp giá trị ô nhập | 🟠 |
| M4 | **Form tạo thiếu trường mà chính SmartTask cần.** Modal chỉ có: tiêu đề, mô tả, cột, ưu tiên, ước lượng giờ, hạn, **một** người thực hiện. Thiếu **nhãn**, **kỹ năng yêu cầu**, **độ khó**, **ngày bắt đầu**, **nhiều người**. Mà kỹ năng yêu cầu + độ khó chính là đầu vào của tính tải và bảng năng lực (UC-24, UC-26). Task tạo tay luôn “trống kỹ năng” cho tới khi mở Sheet sửa thêm. | 7/12 trường của `CreateTaskDto` không có trên UI | 🔴 |
| M5 | **Lọc “Backlog” nhưng tạo lại rơi vào sprint đang chạy.** `KanbanBoard.tsx` đặt `sprintId: sprintFilter !== "__all" && !== "__backlog" ? sprintFilter : project.activeSprint?.id`. Hộp thoại còn ghi thẳng “Tạo công việc mới vào **sprint đang chạy**” dù bộ lọc đang là Backlog. Thẻ vẫn hiện trên bảng Backlog (do cache client `upsert`), **F5 là biến mất**. | xác minh qua API: 3/3 task tạo khi lọc Backlog đều có `sprintId = Sprint 1` | 🔴 |
| M6 | **Lọc ra 0 kết quả thì mất cả bảng.** Điều kiện `local.length === 0` thay toàn bộ 4 cột bằng `EmptyState`; số cột hiển thị = 0, số nút “Thêm công việc” = 0. Nút hành động duy nhất là “Phân rã bằng Trợ lý AI” — không có “Xoá bộ lọc”. | đo: 0 cột / 0 nút thêm ([ảnh](anh/cai-tien-task/ma-02-loc-rong-mat-ca-bang.png)) | 🔴 |
| M7 | **Không chọn nhiều thẻ, không thao tác hàng loạt.** Trên bảng và danh sách: 0 checkbox, không Shift-click, không đổi trạng thái/người/sprint/nhãn cho nhiều task cùng lúc. Kéo task vào sprint hàng loạt đã ghi “chờ” trong [05/web-tich-hop §4](../05-hien-thuc/web-tich-hop.md) dù API `POST /sprints/:id/tasks {taskIds}` **đã có sẵn**. | đo: 0 checkbox trên bảng | 🔴 |
| M8 | **Không có hoàn tác.** Kéo thẻ xong chỉ có toast “Đã chuyển ST-6 sang Đang làm”, không nút Hoàn tác. Chỉ khi lỗi 409/422 mới tự khôi phục. | đo: chuỗi toast không chứa “Hoàn tác” ([ảnh](anh/cai-tien-task/ma-05-keo-tha-khong-co-hoan-tac.png)) | 🟠 |
| M9 | **Danh sách không sửa tại chỗ.** Bảng 9 dòng, 0 ô nhập/combobox trong `<tbody>`; đổi ưu tiên một task = mở Sheet → đổi → đóng. | đo: 0 ô sửa trong bảng ([ảnh](anh/cai-tien-task/ma-04-danh-sach-khong-sua-tai-cho.png)) | 🟠 |
| M10 | **Thẻ Kanban không sửa tại chỗ.** Menu “…” trên thẻ chỉ có “Chuyển sang cột” và “Xem chi tiết”. Giao người, đổi hạn, đổi ưu tiên đều phải mở Sheet. | giao việc từ bảng: 1 bấm mở Sheet → 1 bấm mở picker → 1 bấm chọn người → 1 bấm/Esc đóng = **4 thao tác** | 🟠 |
| M11 | **⌘K không tìm được công việc.** Command palette chỉ có điều hướng + 3 lệnh AI + phím tắt. Gõ `ST-` không ra task nào. Backend **đã có** `GET /workspaces/:wsId/tasks/search`, web đã có `features/search/TaskSearchGroup.tsx` nhưng chưa gắn vào `AppShell`. | đo: kết quả chỉ có nhóm “Thao tác AI” ([ảnh](anh/cai-tien-task/ma-03-cmdk-khong-tim-duoc-task.png)) | 🔴 |
| M12 | **Bộ phím tắt quá mỏng và chỉ sống trên bảng Kanban.** Thực tế chỉ có `C` (mở modal tạo) và `Q` (lọc việc của tôi), đăng ký trong `KanbanBoard.tsx` nên rời bảng là mất. Thử `a`, `m`, `e`, `i`, `/`, `n`: không phím nào có tác dụng. | đo: 6/6 phím không phản hồi | 🟠 |
| M13 | **`ShortcutsDialog` hứa nhiều hơn hệ thống làm được.** Bảng “?” liệt kê “Space/Enter chọn thẻ”, “←→↑↓ di chuyển thẻ giữa cột”, “/ mở menu lệnh nhanh” — phần lớn chưa có ngoài Trợ lý AI. Demo trước hội đồng mà bấm thử là lộ. | đối chiếu mã: 2/12 phím ngoài Trợ lý AI thực sự hoạt động | 🔴 |
| M14 | **Tạo task không cập nhật lạc quan.** `useTaskMutations.create/update` không có `onMutate`; chỉ `move` mới optimistic. Trên mạng chậm, người dùng ngồi nhìn hộp thoại tới khi API trả. | đọc mã `features/board/hooks.ts` | 🟡 |
| M15 | **Mở Sheet chi tiết kéo theo request thừa.** Mỗi lần mở: `GET /tasks/:id` + `GET /workspaces/:id/skills` + **`GET /projects/:id/tasks`** (do `DependencyPicker` dùng `useTasks` với khoá truy vấn khác bộ lọc chung) → tải lại toàn bộ danh sách task chỉ để đổ combobox phụ thuộc. | đo: 3 request / 1 lần mở Sheet ([ảnh](anh/cai-tien-task/ma-06-sheet-chi-tiet.png)) | 🟡 |
| M16 | **Sửa một trường khoá cả Sheet.** `busy = update.isPending \|\| assignees.isPending \|\| …` làm `disabled` mọi ô; đổi 3 trường liên tiếp phải chờ tuần tự 3 lượt round-trip. | đọc mã `TaskDetailSheet.tsx` | 🟡 |
| M17 | **Không có backlog tách khỏi sprint.** “Backlog” chỉ là một giá trị của combobox sprint, vẫn hiển thị bằng 4 cột Kanban. Không có màn xếp thứ tự backlog rồi kéo vào sprint. | quan sát UI | 🟡 |
| M18 | **Không nhóm / swimlane.** Chỉ có 4 cột theo trạng thái; không nhóm theo người thực hiện hay ưu tiên — trong khi đề tài lấy “cân bằng tải nhân sự” làm điểm nhấn. | quan sát UI | 🟠 |
| M19 | **Không có mẫu task, không tạo subtask theo mẫu.** `POST /tasks/:id/duplicate` đã có (kèm `withSubtasks`) nhưng **không có nút nào trên web gọi nó**. | grep web: 0 nơi gọi `/duplicate` | 🟠 |

**Những thứ đã tốt, không đụng vào:**

- Mở màn Công việc = **5 request**; đổi qua lại 4 cách nhìn (Bảng → Danh sách → Timeline) = **0 request thêm** — khoá truy vấn dùng chung hoạt động đúng như [05/web-tich-hop §1b](../05-hien-thuc/web-tich-hop.md).
- Ô “Tìm tiêu đề” debounce 300 ms: gõ 9 ký tự → đúng **1** request.
- Kéo thả: đúng **1** `PATCH /tasks/:id/move`, có optimistic, 409/422 tự hoàn tác + toast đúng mã lỗi.
- Nút “Thêm công việc” trong cột thứ 3 **có** chọn sẵn đúng cột đó trong hộp thoại.
- Ô thêm việc con trong Sheet **có** giữ form sau khi tạo (`form.reset()`) — đây chính là khuôn mẫu cần nhân rộng ra cho tạo task ở cấp trên.

---

## 3. Bảng so sánh với Jira / Trello / Linear

Cột **SmartTask**: ✅ đã có · ⚠️ có một phần · ❌ thiếu · ⛔ cố ý không làm (theo MoSCoW ở [01/pham-vi-de-tai §3](../01-de-cuong/pham-vi-de-tai.md)).

### 3.1 Tạo công việc

| Tính năng | Jira Cloud | Trello | Linear | SmartTask |
|---|---|---|---|---|
| Tạo nhanh ngay trong cột / danh sách | Inline create `+ Create` ở backlog & sprint | “Add a card” cuối mỗi list; thêm đầu list qua menu; nháy đúp giữa hai thẻ | Tạo thẳng trong view | ❌ (M1 — chỉ có modal) |
| Enter tạo liên tiếp, giữ ô mở | — (dùng “Create another”) | Có: gõ tên → Enter → ô vẫn mở cho thẻ kế | Có | ❌ (M2) |
| “Create another” giữ nguyên ngữ cảnh | Có checkbox; tiêu đề/mô tả xoá trắng, các trường khác giữ nguyên | — | — | ❌ (M2) |
| Dán nhiều dòng → nhiều thẻ | — | Có: mỗi dòng thành một thẻ (hoặc một mục checklist) | — | ❌ (M3) |
| Mẫu (template) | Cấu hình theo loại việc | Thẻ mẫu, “Create from template” cuối list | `Option/Alt + C` tạo từ mẫu | ❌ (M19 — `duplicate` có API, không có UI) |
| Tạo bằng bàn phím ở bất kỳ màn nào | `C` toàn cục | — | `C` ở mọi view | ⚠️ `C` chỉ sống trên bảng Kanban (M12) |
| Tạo từ command menu | — | — | `⌘K` có lệnh tạo; `linear.new` | ❌ (M11) |
| Điền sẵn thuộc tính khi tạo | Trường bắt buộc/tuỳ chọn theo cấu hình | Thành viên, nhãn, hạn ngay trên thẻ | Query param điền sẵn assignee/estimate/label/cycle… | ⚠️ 5/12 trường (M4) |
| Parse ngôn ngữ tự nhiên khi gõ | — | — | Không có trong tài liệu | ❌ — **đề xuất A4 (cú pháp tất định, không phải AI)** |
| Subtask nhiều cấp | Subtask 1 cấp | Checklist (không phải thẻ) | Sub-issue nhiều cấp | ⛔ một cấp — đúng [04/11 §1.1](../04-kien-truc/11-chot-chuc-nang-va-api.md) mục 6 |
| Chuyển checklist item thành thẻ | — | Có | — | ⛔ SmartTask không có checklist riêng, đã có subtask thật |

### 3.2 Quản lý công việc

| Tính năng | Jira Cloud | Trello | Linear | SmartTask |
|---|---|---|---|---|
| Chọn nhiều | Checkbox, Ctrl/Cmd-click, Shift-click; tối đa 1.000 | Kéo nhiều thẻ | `X` chọn, Shift+↑↓ mở rộng, `⌘A` chọn tất cả | ❌ (M7) |
| Thao tác hàng loạt | Bulk change: người, ưu tiên, hạn, loại, trường tuỳ biến; có màn xác nhận trước khi ghi | Di chuyển/lưu trữ nhiều thẻ | Qua `⌘K`: trạng thái, người, nhãn, cycle, dự án, ưu tiên, xoá | ❌ (M7) |
| Sửa tại chỗ trên bảng/danh sách | Có (list view, board) | Nhãn/hạn/thành viên ngay trên thẻ | Có | ❌ (M9, M10) |
| Bộ lọc lưu được | Saved filter + JQL | — | Custom view | ⚠️ lọc lưu **trong URL** (đúng docs 11 §1.1 mục 8), chưa đặt tên lưu lại |
| Ngôn ngữ truy vấn đầy đủ | JQL | — | Filter builder | ⛔ ngoài phạm vi 12 tuần |
| Nhóm / swimlane | Swimlane theo người, epic, query | — | Group by | ❌ (M18) |
| Backlog tách khỏi bảng | Có màn backlog riêng, kéo vào sprint | — | Backlog view | ⚠️ chỉ là một mục combobox (M17) |
| WIP limit + cảnh báo | Column constraint, đổi màu header khi vượt | — | — | ✅ có, đổi màu + badge `n/limit` |
| Thứ tự kéo thả bền | Có | Có | Có | ✅ vị trí phân số + đánh số lại khi khe < 1e-6 |
| Hoàn tác | Màn xác nhận trước khi ghi hàng loạt | Có với vài thao tác | — | ❌ (M8) |
| Lịch sử thay đổi | History + audit | Card activity | Issue history | ✅ `GET /projects/:id/activity?taskId=` + tab Hoạt động trong Sheet |
| Phụ thuộc | Issue links | — | Blocked/blocking | ✅ `PUT /tasks/:id/dependencies` + phát hiện vòng |
| Trường tuỳ biến động | Có | Custom Fields Power-Up | Có | ⛔ ngoài phạm vi — xem §7 |

### 3.3 Bàn phím & tốc độ

| Phím | Jira Cloud | Linear | SmartTask hiện tại |
|---|---|---|---|
| Tạo | `C` | `C` | ⚠️ `C` (chỉ trên bảng) |
| Command menu | — | `⌘K` | ⚠️ `⌘K` có, nhưng không tìm task (M11) |
| Di chuyển giữa thẻ | `J` / `K` | `↑` `↓` | ❌ |
| Đổi cột | `N` / `P` | — | ❌ |
| Mở chi tiết | `O` | `Enter` | ❌ (phải bấm chuột) |
| Giao cho người | `A` | `A` | ❌ |
| Giao cho mình | `I` | `I` | ❌ |
| Bình luận nhanh | `M` | — | ❌ |
| Chọn để làm hàng loạt | checkbox | `X` | ❌ |
| Bảng tra phím tắt | `?` | `?` | ✅ (nhưng liệt kê thừa — M13) |

---

## 4. Nhóm A — Tạo task nhanh

### A1 · Tạo nhanh ngay trong cột, Enter tạo liên tiếp 🔴

- **Vấn đề (M1, M2):** mỗi task = mở modal che cả bảng → gõ → submit → modal đóng. Lập kế hoạch sprint 15 task = 15 lần mở/đóng modal. Trong khi [04/11 §1.1](../04-kien-truc/11-chot-chuc-nang-va-api.md) mục 7 và UC-12 đã chốt “**tạo nhanh**” là MVP.
- **Đối thủ:** Trello “Add a card” ở cuối list, Enter tạo xong ô vẫn mở cho thẻ kế tiếp; Jira inline create `+ Create` ở backlog/sprint, có trường bắt buộc thì mới rơi về hộp thoại đầy đủ.
- **SmartTask nên làm:** nút “Thêm công việc” sẵn có trong `Column` đổi thành ô nhập tại chỗ.
  - UI: `Textarea` (autosize, `components/ui/textarea`) trong `Card p-2` ở **đáy cột** (giữ đúng vị trí quen thuộc và đúng `lastPosition` của backend), kèm dòng gợi ý `text-[11px] text-muted-foreground`: “Enter để tạo · Shift+Enter xuống dòng · Esc để đóng”. Không thêm component mới ngoài `ui/`.
  - Hành vi: Enter → gọi `POST /projects/:id/tasks` với ngữ cảnh của cột đang đứng, **ô không đóng**, focus giữ nguyên, thẻ mới hiện ngay bằng cập nhật lạc quan (A6). Esc đóng. Nút “Mở đầy đủ…” chuyển sang hộp thoại chi tiết, mang theo chữ đã gõ.
  - Endpoint: **không cần endpoint mới**. `POST /projects/:id/tasks` đã nhận `columnId`; `sprintId` lấy từ bộ lọc (đã sửa theo A7).
  - Version / realtime: task mới nên `version = 1`, không đụng khoá lạc quan. Vẫn phát `task:created` như hiện tại; tab khác nhận sự kiện, bỏ qua `actorId` của mình.
- **Công sức:** S (≈ 120 dòng trong `KanbanBoard.tsx`, không đổi backend).
- **Rủi ro:** thấp. Cần chặn gửi chồng khi Enter liên tiếp quá nhanh — hàng đợi tuần tự trong client, không để hai `POST` cùng lúc tranh `task_counter` (backend đã `increment` trong transaction nên an toàn, chỉ là tránh nhảy số khó hiểu).

### A2 · Dán nhiều dòng → nhiều task 🟠

- **Vấn đề (M3):** dán một cột từ Excel hay một đoạn WBS chép tay vào ô tiêu đề chỉ ra một task dính liền.
- **Đối thủ:** Trello — dán danh sách phân cách bằng xuống dòng vào ô soạn thẻ, mỗi dòng thành một thẻ.
- **SmartTask nên làm:** trong ô tạo nhanh của A1, khi nội dung có `\n`:
  - Hiện `Alert` (variant mặc định) ngay dưới ô: “Phát hiện **N** dòng — tạo N công việc?” với hai `Button` `sm`: **Tạo N công việc** / **Giữ một công việc**.
  - Chọn tạo N: gọi tuần tự N lần `POST /projects/:id/tasks`, hiện thanh tiến trình bằng `Progress`, kết thúc bằng một toast “Đã tạo N công việc”. Bỏ dòng trắng, cắt 200 ký tự theo `MaxLength` của DTO, bỏ tiền tố gạch đầu dòng và số thứ tự (`-`, `*`, `1.`) — xử lý tất định phía client.
  - Nếu một dòng lỗi: dừng, giữ nguyên các dòng chưa tạo trong ô, `Alert` nêu mã lỗi.
- **Endpoint:** không cần mới. *(Chỉ khi đo thấy > 20 dòng chậm mới cân nhắc `POST /projects/:id/tasks/bulk` — xem §6, xếp vào “làm nếu kịp”.)*
- **Công sức:** S.
- **Rủi ro:** thấp. Giới hạn cứng 50 dòng/lần để không tạo nhầm hàng trăm task khi dán nhầm cả file.

### A3 · Bổ sung trường còn thiếu trong hộp thoại tạo đầy đủ 🔴

- **Vấn đề (M4):** task tạo tay không có **kỹ năng yêu cầu** và **độ khó** — hai đầu vào trực tiếp của tính tải (UC-24) và bảng năng lực (UC-26). Demo sẽ lộ: tạo task tay xong mở màn Cân bằng tải thì task đó không khớp kỹ năng với ai.
- **Đối thủ:** Jira/Linear cho điền mọi thuộc tính ngay khi tạo.
- **SmartTask nên làm:** dùng lại **đúng** các picker đã có trong `TaskDetailSheet` (`AssigneePicker`, `LabelPicker`, `SkillPicker`), nâng lên `components/app/` để hai nơi dùng chung (đúng quy tắc “dùng lại ≥ 2 nơi” của [04/10 §1](../04-kien-truc/10-quy-uoc-giao-dien.md)). Thêm vào hộp thoại: nhãn, kỹ năng yêu cầu + mức tối thiểu, độ khó 1–5, ngày bắt đầu, nhiều người thực hiện. Gói phần ít dùng trong `Collapsible` “Thêm chi tiết” để hộp thoại không phình.
- **Endpoint:** không cần mới — `CreateTaskDto` **đã nhận đủ** `labelIds`, `requiredSkills`, `difficulty`, `startDate`, `assigneeIds`.
- **Version / realtime:** không đổi — vẫn một `POST`, một `task:created`. Đây là lợi thế so với cách hiện nay (tạo rồi mở Sheet sửa = 1 POST + 2–3 PUT, mỗi PUT tăng `version`).
- **Công sức:** M (chủ yếu là tách picker ra `components/app/`).
- **Rủi ro:** thấp; cần giữ hộp thoại vẫn vừa `sm:max-w-lg`, không vượt chiều cao màn hình ở 1024 px.

### A4 · Cú pháp tự nhiên trong ô tạo nhanh 🟠

- **Vấn đề:** ngay cả khi có A1 + A3, gán người/nhãn/ưu tiên vẫn phải rời bàn phím.
- **Đối thủ:** Jira/Trello/Linear đều **không** có; đây là chỗ SmartTask đi trước được mà vẫn rẻ.
- **SmartTask nên làm:** parse **tất định phía client** ngay trong ô tạo nhanh — không gọi AI, không có suy luận:

  | Ký hiệu | Ý nghĩa | Nguồn khớp |
  |---|---|---|
  | `@tên` | người thực hiện | `project.members` (khớp không dấu, không phân biệt hoa thường; trùng → `Popover` chọn) |
  | `#nhãn` | nhãn | `project.labels` (chỉ nhãn đã có; nhãn lạ → bỏ qua và báo) |
  | `!cao` `!khẩn` `!tb` `!thấp` | ưu tiên | ánh xạ cố định sang `Priority` |
  | `4h` `2.5h` | ước lượng giờ | biểu thức chính quy |
  | `t6` `25/10` `hôm nay` `mai` | hạn | bảng ánh xạ cố định, tính theo múi giờ người dùng |
  | `~k:React>=3` | kỹ năng yêu cầu | `GET /workspaces/:id/skills` |

  - Gõ dở `@` hoặc `#` thì hiện hàng gợi ý bấm được ngay dưới ô nhập (đơn giản hơn `Command` để không giành focus của ô đang gõ).
  - Phần đã nhận diện hiện thành các `Badge` ngay dưới ô (“Huy → người thực hiện”, “Cao → ưu tiên”), bấm `×` để bỏ. **Người dùng luôn thấy hệ thống hiểu gì trước khi Enter** — đây là điều kiện để không vi phạm nguyên tắc “không đoán thay người dùng”.
  - Không khớp được thì **giữ nguyên trong tiêu đề**, không tự bịa.
- **Ranh giới AI:** đây là parse chuỗi tất định, chạy client, cùng một đầu vào luôn cho cùng một kết quả. Câu tự do kiểu “chia nhỏ màn đăng nhập ra thành các việc con” vẫn phải vào **Trợ lý AI** → bản nháp → người duyệt (docs 12).
- **Endpoint:** không cần mới.
- **Công sức:** M (parser ≈ 150 dòng + `parser.spec.ts`).
- **Rủi ro:** trung bình — tiếng Việt có dấu, tên trùng. Chặn bằng: khớp không dấu, trùng thì hỏi, và luôn hiện badge xác nhận trước khi ghi. Nên có unit test cho parser (dễ chấm điểm trong báo cáo kiểm thử).

### A5 · Mẫu task và sao chép 🟠

- **Vấn đề (M19):** `POST /tasks/:id/duplicate {withSubtasks}` đã hiện thực từ Phase 3 mà **không nút nào trên web gọi**. Các việc lặp lại (“Kiểm thử hồi quy sprint N”, “Review code module X”) phải gõ lại từ đầu.
- **Đối thủ:** Trello thẻ mẫu + “Create from template”; Linear `Option/Alt + C`.
- **SmartTask nên làm:**
  - Bước 1 (rẻ): thêm mục **“Nhân bản công việc”** vào `DropdownMenu` “…” của thẻ và vào Sheet, hỏi “kèm việc con?” bằng `AlertDialog`. Gọi endpoint đã có.
  - Bước 2 (nếu kịp): đánh dấu một task là **mẫu** bằng nhãn quy ước `mẫu` (không thêm cột CSDL), ô tạo nhanh có mục “Từ mẫu…” liệt kê các task mang nhãn đó → gọi `duplicate`.
- **Endpoint:** bước 1 không cần mới. Bước 2 cũng không — dùng nhãn.
- **Version / realtime:** `duplicate` tạo task mới `version = 1`, phát `task:created`; không ảnh hưởng bản gốc.
- **Công sức:** S (bước 1) · S (bước 2).
- **Rủi ro:** thấp. Lưu ý: `duplicate` hiện đưa bản sao **về cột đầu** — cần ghi rõ trong tooltip.

### A6 · Cập nhật lạc quan khi tạo 🟡

- **Vấn đề (M14):** `create`/`update` không có `onMutate`; chỉ `move` mới optimistic. A1 (tạo liên tiếp) sẽ giật nếu thiếu cái này.
- **SmartTask nên làm:** thêm `onMutate` cho `create` và `update` trong `features/board/hooks.ts`, theo đúng khuôn mẫu `useMoveTask` đã có: chèn thẻ tạm (`id` tạm, `version = 0`, badge `Đang lưu…` dùng `Badge variant="secondary"`), `onSuccess` thay bằng bản thật, `onError` gỡ ra + toast mã lỗi.
- **Version / realtime:** thẻ tạm **không** được phép gửi `PATCH` (chưa có id thật) → khoá thao tác trên thẻ tạm cho tới khi `onSuccess`. Sự kiện `task:created` của chính mình vẫn bị bỏ qua theo `actorId` như hiện tại.
- **Công sức:** S.
- **Rủi ro:** trung bình — dễ sinh thẻ “ma” nếu `onError` quên gỡ. Bắt buộc có test.

### A7 · Sửa lỗi “tạo khi lọc Backlog lại rơi vào sprint” 🔴

- **Vấn đề (M5):** dữ liệu nhìn thấy khác dữ liệu đã ghi; F5 là mất thẻ. Đây là lỗi đúng nghĩa, không phải thiếu tính năng.
- **SmartTask nên làm:** `sprintId = null` khi bộ lọc là `__backlog`; khi bộ lọc là `__all` thì hộp thoại hiện `Select` sprint (mặc định sprint đang chạy) để người dùng thấy rõ mình đang tạo vào đâu; dòng mô tả trong `DialogDescription` đọc đúng bộ lọc hiện tại.
- **Công sức:** S (vài dòng, nhưng nên làm cùng A1/A3 để chỉ sửa một lần).
- **Rủi ro:** không.

---

## 5. Nhóm B — Quản lý task

### B1 · Chọn nhiều + thao tác hàng loạt 🔴

- **Vấn đề (M7):** cuối sprint muốn đẩy 6 việc dở sang sprint sau = 6 lần mở Sheet × 3 thao tác = 18 thao tác. Mà `POST /sprints/:id/tasks {taskIds}` đã có sẵn từ Phase 3 và [05/web-tich-hop §4](../05-hien-thuc/web-tich-hop.md) đã ghi nợ việc này.
- **Đối thủ:** Jira bulk change (checkbox / Ctrl-click / Shift-click, tối đa 1.000, có **màn xác nhận trước khi ghi**); Linear `X` chọn + `⌘K` áp hành động.
- **SmartTask nên làm:**
  - Chọn: `Checkbox` ở đầu mỗi dòng của Danh sách và góc trên trái thẻ Kanban (hiện khi hover hoặc khi đã có ít nhất một thẻ được chọn). Shift-click chọn dải trong Danh sách. `Esc` bỏ chọn hết.
  - Thanh hành động: `Card` cố định đáy màn (`sticky bottom-4`, không dùng `position: fixed` tự chế) ghi “Đã chọn **n** công việc” + các `Button`: **Chuyển cột**, **Giao cho**, **Đổi sprint**, **Gắn nhãn**, **Xoá**. Mỗi cái mở `DropdownMenu`/`Combobox` đã có.
  - Xác nhận: theo Jira, trước khi ghi hiện `AlertDialog` liệt kê “n công việc · trường X: từ … sang …”.
  - **Ghi thế nào (điểm quan trọng nhất):** `PATCH /tasks/:id` yêu cầu `version` của **từng** task. Client gửi tuần tự n lời gọi, mỗi lời mang `version` riêng đang giữ trong cache. Task nào trả `409` thì **không dừng cả lô**: gom lại, cuối cùng hiện `Alert` “n−k đã đổi · k công việc vừa được người khác sửa” + nút “Tải lại và thử lại k công việc”. Đây là cách giữ khoá lạc quan mà không cần endpoint hàng loạt.
  - Riêng đổi sprint hàng loạt có thể dùng `POST /sprints/:id/tasks {taskIds}` đã có (1 request).
  - Realtime: mỗi task phát `task:updated` như thường; `useBoardRealtime` đã gộp 300 ms nên tab khác chỉ tải lại một lần.
- **Endpoint:** không bắt buộc endpoint mới. *(Xem §6 nếu muốn gọn hơn.)*
- **Công sức:** L.
- **Rủi ro:** trung bình — n request tuần tự. Chặn bằng giới hạn **50 task/lần** và thanh tiến trình. Không làm song song để tránh 429 (100 req/phút/IP).

### B2 · Sửa tại chỗ trên Danh sách 🟠

- **Vấn đề (M9):** đổi ưu tiên một task = 3 thao tác + chờ Sheet tải (2 s).
- **Đối thủ:** Jira list view và Linear đều sửa tại chỗ.
- **SmartTask nên làm:** trong `TaskListView`, các ô **Cột**, **Ưu tiên**, **Người**, **Hạn** thành điều khiển tại chỗ (`Select`, `Combobox`, `Input type=date` — đều là `components/ui`), chỉ bật khi `project.canEdit`. Ghi ngay khi đổi, cập nhật lạc quan (A6), 409 → hoàn tác dòng đó + toast.
- **Version / realtime:** mỗi lần đổi là một `PATCH` mang `version` của dòng đó, giống hệt Sheet — không có đường ghi mới.
- **Công sức:** M.
- **Rủi ro:** thấp; chú ý không để `onClick` của ô lan ra làm mở Sheet (`stopPropagation`).

### B3 · Sửa nhanh trên thẻ Kanban 🟠

- **Vấn đề (M10):** giao việc từ bảng = 4 thao tác.
- **Đối thủ:** Trello đặt thành viên/nhãn/hạn ngay trên thẻ.
- **SmartTask nên làm:** mở rộng `DropdownMenu` “…” của thẻ: **Giao cho** (submenu thành viên + “Giao cho tôi”), **Đặt ưu tiên**, **Đặt hạn** (`Popover` + `Calendar`), **Nhân bản** (A5), **Xoá**. Giữ nguyên mục “Chuyển sang cột” đang có — đây cũng chính là “nút tương đương cho mọi hành động kéo” mà [04/10 §6](../04-kien-truc/10-quy-uoc-giao-dien.md) yêu cầu.
- **Version / realtime:** dùng lại đúng các mutation đã có (`update`, `assignees`, `move`), không thêm đường ghi.
- **Công sức:** S.
- **Rủi ro:** thấp.

### B4 · Hoàn tác 🟠

- **Vấn đề (M8):** kéo nhầm thẻ, đổi nhầm hàng loạt → phải tự sửa ngược bằng tay.
- **Đối thủ:** Jira chọn cách khác — **xác nhận trước khi ghi** cho thao tác hàng loạt.
- **SmartTask nên làm:** hai lớp, cả hai đều rẻ:
  1. Toast `sonner` có `action: { label: "Hoàn tác", onClick }` cho: kéo thả, đổi cột, xoá, thao tác hàng loạt. Hoàn tác = gọi lại chính endpoint cũ với giá trị trước đó **và `version` mới nhất trả về từ lần ghi vừa rồi** (không dùng version cũ, sẽ 409 ngay).
  2. Thao tác hàng loạt bắt buộc có `AlertDialog` xác nhận (B1) — an toàn hơn hoàn tác.
  - Xoá task là **xoá mềm** (`deletedAt`) nên hoàn tác về lý thuyết làm được, nhưng **API chưa có đường khôi phục** → xem §6 (`POST /tasks/:id/restore`), xếp “làm nếu kịp”. Trước mắt: xoá vẫn dùng `AlertDialog` chứ không hứa hoàn tác.
- **Công sức:** S (lớp 1) · S (lớp 2).
- **Rủi ro:** thấp — miễn là dùng `version` mới, không phải version trước thao tác.

### B5 · Bộ lọc lưu được (đặt tên) 🟡

- **Vấn đề:** lọc đã lưu trong URL (đúng như chốt ở docs 11), nhưng “việc quá hạn của Huy trong sprint này” vẫn phải dựng lại mỗi lần.
- **Đối thủ:** Jira saved filter (JQL); Linear custom view.
- **SmartTask nên làm:** **lưu ở `localStorage`**, không đụng CSDL: `Popover` “Bộ lọc đã lưu” cạnh `WorkFilterBar`, lưu nguyên chuỗi query hiện tại kèm tên do người dùng đặt; chọn lại = `router.replace`. Tối đa 10 bộ.
- **Endpoint:** **không** — cố ý. Lưu theo người trên server là phình CSDL và không đáng trước freeze.
- **Công sức:** S.
- **Rủi ro:** thấp; mất khi đổi máy — chấp nhận được, ghi rõ trong tooltip.

### B6 · Nhóm / swimlane theo người hoặc ưu tiên 🟠

- **Vấn đề (M18):** đề tài lấy “cân bằng tải nhân sự” làm điểm nhấn, nhưng bảng Kanban không nhìn được “ai đang ôm gì”.
- **Đối thủ:** Jira swimlane theo assignee; Linear group by.
- **SmartTask nên làm:** `Select` “Nhóm theo: Không / Người thực hiện / Ưu tiên” trong `WorkFilterBar`, ghi vào URL (`&group=`). Mỗi nhóm là một hàng, trong hàng vẫn là 4 cột. Header mỗi hàng dùng `UserAvatar` + `WorkloadBadge` **đã có sẵn** → nhìn thấy ngay ai quá tải. Kéo thả **trong cùng một swimlane** giữ nguyên hành vi; kéo **sang swimlane khác** thì **không** tự đổi người (tránh ghi ngầm) — vẫn phải dùng menu “Giao cho”.
- **Endpoint:** không cần — nhóm hoàn toàn trên client từ danh sách đã tải (đúng tinh thần “một lần gọi API cho cả màn”).
- **Công sức:** M.
- **Rủi ro:** trung bình — dnd-kit với nhiều `SortableContext` lồng nhau dễ sinh lỗi kéo thả. **Đây là rủi ro lớn nhất trong nhóm B**; nếu chậm thì cắt xuống “chỉ hiển thị, không kéo giữa swimlane”.

### B7 · Backlog tách khỏi sprint 🟡

- **Vấn đề (M17):** không có chỗ xếp thứ tự việc chưa vào sprint rồi kéo vào.
- **Đối thủ:** Jira backlog riêng; Linear backlog view.
- **SmartTask nên làm:** thêm cách nhìn thứ 5 `?view=backlog` — danh sách phẳng các task `sprintId = null`, kéo để xếp thứ tự (dùng `PATCH /tasks/:id/move` với `columnId` giữ nguyên + `position` mới), chọn nhiều (B1) rồi **“Đưa vào sprint”** qua `POST /sprints/:id/tasks`.
- **Endpoint:** không cần mới; `ListTasksQueryDto` đã có `backlog=true`.
- **Công sức:** M.
- **Rủi ro:** thấp, nhưng làm tăng số màn phải bảo trì. Chỉ nên làm nếu B1 đã xong.

### B8 · Không mất bảng khi lọc ra 0 kết quả 🔴

- **Vấn đề (M6):** mất cả 4 cột, không tạo được gì, lời khuyên duy nhất là gọi AI.
- **SmartTask nên làm:** phân biệt hai trạng thái rỗng, đúng yêu cầu “đủ 4 trạng thái màn hình” của [04/10 §2](../04-kien-truc/10-quy-uoc-giao-dien.md):
  - **Dự án thật sự chưa có task** → `EmptyState` như hiện nay (giữ CTA Trợ lý AI).
  - **Có task nhưng bộ lọc ra 0** → **vẫn vẽ đủ 4 cột rỗng** (để còn tạo nhanh được), thêm `Alert` phía trên: “Bộ lọc đang ẩn N/N công việc” + `Button variant="outline"` **Xoá bộ lọc**.
- **Công sức:** S.
- **Rủi ro:** không.

---

## 6. Nhóm C — Bàn phím & tốc độ

### C1 · Bộ phím tắt kiểu Jira/Linear, đăng ký toàn cục 🔴

- **Vấn đề (M12, M13):** thực tế chỉ có 2 phím và chỉ sống trên bảng; bảng “?” thì liệt kê 12 phím.
- **SmartTask nên làm:** một hook duy nhất `lib/hooks/use-shortcuts.ts`, đăng ký ở `AppShell` (không rải trong từng feature), luôn bỏ qua khi con trỏ đang ở `input`/`textarea`/`contentEditable`:

  | Phím | Hành động | Ghi chú |
  |---|---|---|
  | `C` | mở ô tạo nhanh ở cột đầu (A1) | thay cho mở modal |
  | `⌘K` | command menu (C2) | đã có, cần bổ sung nội dung |
  | `J` / `K` hoặc `↑` `↓` | chuyển thẻ đang trỏ | viền `ring-ring` |
  | `N` / `P` | sang cột kế / cột trước | theo Jira |
  | `Enter` hoặc `O` | mở Sheet chi tiết của thẻ đang trỏ | |
  | `A` | giao cho ai (mở Combobox) | theo Jira/Linear |
  | `I` | giao cho tôi | theo Jira/Linear |
  | `X` | chọn / bỏ chọn thẻ (B1) | theo Linear |
  | `Q` | lọc “Việc của tôi” | giữ nguyên |
  | `Esc` | bỏ chọn / đóng | |
  | `?` | bảng phím tắt | giữ nguyên |

- **Đồng thời:** sửa `ShortcutsDialog` để **chỉ liệt kê phím có thật** (M13). Không được để bảng tra cứu hứa suông khi bảo vệ.
- **Công sức:** M.
- **Rủi ro:** trung bình — xung đột với Radix (Sheet/Dialog/Popover đã bắt `Esc` và mũi tên). Chặn bằng: tắt hook khi có `[role=dialog]` đang mở.

### C2 · ⌘K tìm được công việc và tạo được công việc 🔴

- **Vấn đề (M11):** ⌘K là thứ đầu tiên hội đồng bấm thử, hiện chưa tìm được task nào. Cả backend (`GET /workspaces/:wsId/tasks/search`) lẫn component web (`features/search/TaskSearchGroup.tsx`) đều **đã có**, chỉ thiếu 10 dòng nối vào `AppShell` — đúng như đã ghi nợ ở [05/web-tich-hop §4](../05-hien-thuc/web-tich-hop.md).
- **Đối thủ:** Linear — `⌘K` tìm, tạo, và áp hành động hàng loạt lên các issue đang chọn.
- **SmartTask nên làm:**
  1. Nhúng `<TaskSearchGroup>` vào `CommandList` (dùng `GET /workspaces/:wsId/tasks/search` **xuyên dự án**, không phải `?q=` trong một dự án); chọn → `?task=<id>` mở Sheet.
  2. Thêm nhóm lệnh **“Tạo”**: “Tạo công việc mới…” (mở ô tạo nhanh ở dự án đang mở), “Tạo công việc trong sprint đang chạy…”.
  3. Khi đang chọn nhiều thẻ (B1), ⌘K hiện thêm nhóm **“Áp cho n công việc đã chọn”** — đúng mô hình Linear.
- **Endpoint:** không cần mới.
- **Công sức:** S (mục 1–2) · S (mục 3, sau B1).
- **Rủi ro:** thấp. **Lưu ý phối hợp:** `AppShell.tsx` đang được phiên làm việc song song sửa — phải hẹn nhau trước khi động vào file này.

### C3 · Bớt request thừa khi mở Sheet 🟡

- **Vấn đề (M15):** mỗi lần mở Sheet tải lại **toàn bộ** danh sách task chỉ để đổ combobox phụ thuộc.
- **SmartTask nên làm:** `DependencyPicker` chỉ gọi khi người dùng **mở** combobox (`enabled: popoverOpen`), và dùng đúng khoá truy vấn của bộ lọc chung để ăn cache thay vì tạo khoá mới. Tương tự `useSkills` → `staleTime` dài (danh mục kỹ năng gần như tĩnh).
- **Kết quả kỳ vọng:** 3 request → 1 request mỗi lần mở Sheet.
- **Công sức:** S.
- **Rủi ro:** không.

### C4 · Không khoá cả Sheet khi lưu một trường 🟡

- **Vấn đề (M16):** `busy` disable mọi ô; sửa 3 trường = chờ tuần tự 3 lượt.
- **SmartTask nên làm:** chỉ khoá **đúng trường đang ghi** (`pendingField`), các trường khác vẫn dùng được; trường đang ghi hiện `Loader2 animate-spin` theo đúng quy ước [04/10 §4](../04-kien-truc/10-quy-uoc-giao-dien.md).
- **Version / realtime — chỗ nguy hiểm, phải làm đúng:** mỗi `PATCH` tăng `version`. Nếu cho ghi song song hai trường với cùng `version`, lời gọi thứ hai chắc chắn `409`. Vì vậy: **cho phép thao tác song song trên giao diện nhưng nối vào một hàng đợi tuần tự trong client**, mỗi lời gọi lấy `version` mới nhất từ phản hồi trước. Người dùng thấy mượt, backend vẫn giữ nguyên khoá lạc quan.
- **Công sức:** M.
- **Rủi ro:** trung bình — làm sai là sinh 409 hàng loạt. Bắt buộc có test hàng đợi.

### C5 · Chế độ tập trung (focus mode) 🟡

- **Vấn đề:** khi lập kế hoạch sprint, thanh vai trò + breadcrumb + sidebar chiếm ~40 % chiều cao (thấy rõ trong ảnh M6).
- **SmartTask nên làm:** phím `F` ẩn `PageHeader` + thanh vai trò + thu gọn sidebar (`⌘B` đã có), chỉ còn bộ lọc + bảng. Lưu ở `localStorage`.
- **Công sức:** S.
- **Rủi ro:** thấp. Giá trị demo cao, giá trị thực tế trung bình.

---

## 7. Nhóm D — Màn chi tiết task và ranh giới "tạo" ↔ "xem"

### D0 · Chẩn đoán: vấn đề không nằm ở cái Sheet, mà ở mật độ

Đếm trên mã `TaskDetailSheet.tsx`: **15 điều khiển** (trạng thái, ưu tiên, người thực hiện, sprint, ước lượng, giờ còn lại, bắt đầu, hạn, độ khó, tiến độ, nhãn, kỹ năng, phụ thuộc, cờ khẩn, mô tả) + ô tiêu đề + 4 tab, nhồi vào `Sheet` rộng `sm:max-w-xl` = **576 px**, xếp `grid-cols-2` phẳng lì — **không phân cấp, không nhóm, không thu gọn**. Nhãn thì viết hoa toàn bộ, cỡ chữ đều nhau, nên mắt không biết bám vào đâu.

Đối chiếu Jira: màn chi tiết của Jira **không hề ít trường hơn** — nhưng nó chia **cột nội dung** (mô tả, việc con, bình luận, đính kèm, hoạt động) và **cột thuộc tính bên phải** (gom nhóm, thu gọn được, trường ít dùng giấu sau "Show more"), và cho **cấu hình trường nào hiện, thứ tự nào**.

Kết luận: nới rộng và **tái cấu trúc bố cục** giải quyết được ~80 % cảm giác khó nhìn. Việc tách trang riêng là đáng làm, nhưng vì lý do khác (xem D2), không phải để chữa mật độ.

### D1 · Tái cấu trúc Sheet: hai cột, gom nhóm, thu gọn 🔴

- **Vấn đề:** như D0 — 15 trường ngang hàng nhau trong 576 px.
- **Đối thủ:** Jira tách cột nội dung / cột thuộc tính, gom nhóm, giấu trường ít dùng; cho cấu hình bố cục.
- **SmartTask nên làm** (giữ nguyên `Sheet`, chỉ đổi bố cục bên trong):
  - Nới `sm:max-w-xl` → `sm:max-w-3xl` (576 → 768 px), vẫn vừa màn 1024 px mục tiêu của [04/10 §5](../04-kien-truc/10-quy-uoc-giao-dien.md).
  - Bên trái ~60 %: **Mô tả** (đưa lên trên cùng, đây mới là nội dung) → tabs Việc con / Bình luận / Đính kèm / Hoạt động.
  - Bên phải ~40 %: thuộc tính xếp **một cột dọc**, gom thành 3 nhóm bằng `Separator` + tiêu đề `text-xs text-muted-foreground`:
    - **Phân công** — người thực hiện, trạng thái, sprint, ưu tiên, cờ khẩn
    - **Thời gian & công sức** — ước lượng, giờ còn lại, tiến độ, bắt đầu, hạn
    - **Phân loại & liên kết** — loại (E1), nhãn, kỹ năng yêu cầu, độ khó, phụ thuộc
  - Nhóm thứ ba mặc định **thu gọn** bằng `Collapsible` (trường ít đụng tới nhất), ghi số lượng đã đặt ở nhãn nhóm ("Phân loại & liên kết · 2").
  - Nhãn trường bỏ VIẾT HOA TOÀN BỘ → `text-xs text-muted-foreground` thường; giá trị `text-sm text-foreground`. Đây là lý do lớn nhất khiến ảnh chụp hiện tại đọc mệt.
  - Màn < 768 px: xếp chồng một cột như hiện nay.
- **Endpoint / version / realtime:** **không đổi gì** — thuần bố cục, dùng lại đúng các mutation và `version` hiện có.
- **Công sức:** M (sắp xếp lại ~250 dòng JSX trong `TaskDetailSheet.tsx`, không đổi logic).
- **Rủi ro:** thấp. Phải làm cùng C4 (không khoá cả Sheet) thì mới thấy hết hiệu quả.

> **Đã đổi 23/09/2026 theo yêu cầu:** bấm thẻ mở **modal giữa màn** (`Dialog`, `sm:max-w-3xl`) chứ không
> phải ngăn trượt bên phải; và thẻ Kanban lẫn dòng Danh sách có **icon mở thẳng trang chi tiết**, không
> phải mở modal rồi bấm thêm lần nữa. Docs 10 §4 đã cập nhật theo.

### D2 · Trang toàn màn hình cho một công việc 🟠

- **Câu hỏi của anh:** "click vào thì tách ra màn hình riêng đúng chứ?"
- **Trả lời thẳng:** Jira làm **cả hai**, không chọn một. Bấm thẻ trên bảng → xem nhanh ngay tại chỗ (giữ ngữ cảnh bảng); cần đọc kỹ / chia sẻ / mở tab thứ hai → trang riêng. Trello thì chỉ modal. Linear cũng cả hai.
  **Đề xuất cho SmartTask: giữ Sheet làm mặc định, thêm trang riêng — không thay thế.** Lý do:
  1. Sheet đang là đường nhanh nhất để sửa một trường rồi quay lại bảng; đổi thành điều hướng trang sẽ làm **chậm** luồng chính (mất vị trí cuộn, mất thẻ đang trỏ, phải tải lại màn).
  2. Nhưng Sheet **không** dùng được khi: mở hai công việc cạnh nhau để so, in ra, gửi link cho người khác đọc dài, hoặc đọc trên màn hẹp.
  3. Chi phí thấp **nếu** làm sau D1: cùng một component `TaskBody`, chỉ khác khung chứa.
- **SmartTask nên làm:**
  - Route mới `app/(dashboard)/projects/[projectId]/tasks/[taskKey]/page.tsx` — dùng **mã ST-n** trên URL (`/projects/<id>/tasks/ST-4`), gọi `GET /tasks/by-key/:projectKey/:number` **đã có sẵn**. Đây đúng quy ước định danh ở [04/11 §2](../04-kien-truc/11-chot-chuc-nang-va-api.md): "web dùng `taskKey` (ST-12) cho URL".
  - Tách `TaskBody` (hiện nằm trong `TaskDetailSheet.tsx`) ra `components/app/TaskDetailBody.tsx`, nhận `variant: "sheet" | "page"` chỉ để đổi bề rộng cột và có/không `SheetHeader`. **Một nguồn sự thật, hai khung chứa** — đúng quy tắc "dùng lại ≥ 2 nơi" của [04/10 §1](../04-kien-truc/10-quy-uoc-giao-dien.md).
  - Trong Sheet thêm nút icon `Maximize2` (kèm `aria-label`, `Tooltip`) ở header → mở trang riêng; và biến `Badge` mã `ST-4` thành link (`Button asChild` + `Link`) để Ctrl+click mở tab mới.
  - Trang riêng có `PageHeader` + breadcrumb `Dự án › Công việc › ST-4`, nút "Về bảng" quay lại `?task=` cũ.
  - Giữ nguyên `?task=<id>` đang chạy (thông báo, ⌘K, link cũ trong tài liệu vẫn mở đúng Sheet) — **không phá đường cũ**, giống cách [05/web-tich-hop §1b](../05-hien-thuc/web-tich-hop.md) đã xử lý khi gộp màn.
- **Endpoint:** **không cần mới** — `GET /tasks/by-key/:projectKey/:number` có từ Phase 3 và hiện **chưa có màn nào trên web gọi**.
- **Version / realtime:** giống hệt Sheet; trang riêng cũng `joinProject` để nhận `task:updated`.
- **Công sức:** M — nhưng **chỉ M nếu D1 làm trước**; làm ngược lại sẽ phải sửa bố cục hai lần.
- **Rủi ro:** thấp. Bẫy duy nhất: `TaskDetailSheet` đang nhận `project: ProjectDetail` từ cha; trang riêng phải tự lấy qua `ProjectProvider` — không được gọi trùng `GET /projects/:id`.

### D3 · Tách rõ "form tạo" và "màn xem" — nguyên tắc 🔴

- **Anh nói đúng, và hiện trạng đang ngược:** form tạo **quá nghèo** (5/12 trường, thiếu kỹ năng và độ khó — M4), còn màn xem **quá dày** (15 trường phẳng — D0). Hai lỗi trái dấu nhau nhưng cùng một gốc: chưa ai quyết định **trường nào phải chọn lúc tạo, trường nào để sau**.
- **Nguyên tắc đề xuất chốt:**

  | | Form tạo | Màn xem chi tiết |
  |---|---|---|
  | Mục tiêu | **nhanh** — ghi ý tưởng trước khi quên | **đọc & cộng tác** — hiểu việc, sửa, bàn |
  | Nguyên tắc chọn trường | chỉ những gì **không đoán được** và **cần cho tính toán ngay** | **tất cả**, nhưng có phân cấp |
  | Bắt buộc | tiêu đề | — |
  | Hiện sẵn | cột, ưu tiên, người, hạn, ước lượng | mô tả + thuộc tính nhóm 1–2 |
  | Sau nút "Thêm chi tiết" / thu gọn | nhãn, **kỹ năng yêu cầu**, **độ khó**, ngày bắt đầu, loại | nhóm "Phân loại & liên kết" |
  | Không có | bình luận, đính kèm, hoạt động, tiến độ, giờ còn lại | — (có đủ) |
  | Trạng thái 4 mức | không cần (form luôn sẵn sàng) | **bắt buộc đủ 4** theo [04/10 §2](../04-kien-truc/10-quy-uoc-giao-dien.md) |

- **Vì sao kỹ năng và độ khó phải nằm trong form tạo dù "để sau cũng được":** đó là đầu vào duy nhất của khớp kỹ năng (UC-26) và của Eisenhower (`difficulty >= 4` = quan trọng). Tạo xong mà bỏ trống thì task **vô hình** với chính điểm nhấn của đề tài. Đặt trong `Collapsible` là đủ — vừa không làm form dài, vừa không mất dữ liệu.
- **Công sức:** đã tính trong A3 + D1, không phát sinh thêm.

---

## 8. Nhóm E — Đã đủ "loại" chưa?

Đây là chỗ SmartTask **thiếu thật** so với Jira, và cũng là chỗ dễ bị hội đồng hỏi nhất. Kiểm kê từ `schema.prisma`:

| Khái niệm phân loại | Jira | SmartTask hiện có | Đánh giá |
|---|---|---|---|
| **Loại công việc** (Epic / Story / Task / Bug / Sub-task) | mặc định Epic, Story, Task, Bug, Subtask; thêm tới 30 loại; mỗi loại có icon, mô tả, workflow riêng | **Không có enum nào.** Không có `TaskType` trong `schema.prisma` | ❌ **thiếu thật** — xem E1 |
| Mức ưu tiên | Highest…Lowest | `Priority` LOW/MEDIUM/HIGH/URGENT | ✅ đủ |
| Cờ khẩn riêng | — | `isUrgent` boolean | ⚠️ chồng nghĩa với `URGENT` — xem E3 |
| Độ khó | — (SmartTask tự thêm) | `difficulty` 1–5 | ✅ đặc thù đề tài, tốt |
| Cỡ việc | Story point | `TaskSize` S/M/L/XL **trong CSDL và DTO** nhưng **0 chỗ dùng trên web, 0 công thức tính** | ⚠️ **trường chết** — xem E2 |
| Trạng thái | workflow theo loại | `BoardColumn.statusKey` (TODO/IN_PROGRESS/REVIEW/DONE) + `isDone` | ✅ đủ, cố ý đơn giản |
| Nguồn tạo | — | `TaskSource` MANUAL/AI | ✅ đặc thù đề tài, tốt |
| Nhãn | Label + Component + Version | `Label` (tự do, theo dự án) | ⚠️ một cái gánh ba vai — chấp nhận được |
| Kỹ năng yêu cầu | — | `TaskSkill` + mức tối thiểu 1–5 | ✅ đặc thù đề tài, điểm mạnh |
| Phân cấp | Epic → Story → Subtask (3 cấp, Premium thêm) | cha → con, **1 cấp** | ⛔ cố ý, chốt ở [04/11 §1.1](../04-kien-truc/11-chot-chuc-nang-va-api.md) — xem E5 |
| Loại liên kết | blocks, duplicates, relates to… | `TaskDependency` — **chỉ một loại** "phải xong trước" | ⚠️ đủ cho Gantt, xem E4 |
| Kết quả xử lý | Resolution: Done / Won't Do / Duplicate | **không có** — chỉ "ở cột DONE" hoặc bị xoá mềm | ❌ **thiếu thật** — xem E4 |

### E1 · Thêm `TaskType`: STORY / TASK / BUG 🟠 — **khuyến nghị làm**

- **Vấn đề:** không phân biệt được "tính năng mới" với "lỗi phải sửa". Hệ quả cụ thể, không phải lý thuyết:
  - Dashboard không nói được "sprint này có 5 bug" — một chỉ số chất lượng mà hội đồng rất hay hỏi.
  - Trợ lý AI khi phân rã không gắn nhãn loại cho bản nháp (`response-schemas.ts` chỉ có `priority`, `difficulty`).
  - Đây là khác biệt **dễ thấy bằng mắt** nhất giữa SmartTask và Jira: thẻ Jira có icon loại, thẻ SmartTask không.
- **Đối thủ:** Jira team-managed mặc định Story (Scrum) hoặc Task (Kanban), cộng Bug và Epic; mỗi loại có **workflow và trường bắt buộc riêng**.
- **SmartTask nên làm — bản tối giản, cố ý cắt hết phần đắt:**
  - `enum TaskType { STORY, TASK, BUG }` — **cố định, không cho workspace tự thêm loại**. Không workflow riêng. Không trường bắt buộc riêng. Chỉ là một nhãn phân loại có icon.
  - `Task.type TaskType @default(TASK)` — migration cộng một cột có mặc định, **không đụng dữ liệu cũ**.
  - UI: `Select` trong form tạo (nhóm "Thêm chi tiết") và trong Sheet; icon `lucide-react` trên `TaskCard` (`BookOpen` / `SquareCheck` / `Bug`), **màu lấy từ `lib/status.ts`** bằng hàm mới `typeToVariant(type)` — đúng quy ước [04/10 §3](../04-kien-truc/10-quy-uoc-giao-dien.md), không đặt màu trong component.
  - Bộ lọc: thêm `type` vào `ListTasksQueryDto` và `WorkFilterBar`.
  - AI: thêm `type` vào `response-schemas.ts` để bản nháp phân rã tự gắn loại — vẫn là **LLM đề xuất, người duyệt**, backend chỉ kiểm giá trị thuộc enum.
  - Dashboard: thêm một dòng "theo loại" vào `GET /projects/:id/dashboard`.
- **Endpoint:** không có đường dẫn mới; chỉ thêm trường `type` vào `CreateTaskDto`, `UpdateTaskDto`, `ListTasksQueryDto` và payload `dashboard` — **bổ sung vào bảng [04/11 §3.6](../04-kien-truc/11-chot-chuc-nang-va-api.md)**.
- **Version / realtime:** `type` sửa qua `PATCH /tasks/:id` như mọi trường khác — mang `version`, tăng `version`, phát `task:updated`. Không có đường ghi mới.
- **Công sức:** M — nhưng là M **trải rộng**: 1 migration + DTO + service select + 6 chỗ trên web + schema AI + seed. Đây là rủi ro chính, không phải độ khó.
- **Rủi ro:** trung bình. Đụng migration sau khi Phase 8 đã merge. **Phải làm sớm trong Phase 9 hoặc không làm** — không được đụng schema sát 05/11.
- **Phương án 0 đồng nếu anh không muốn migration:** dùng **nhãn quy ước** `bug` / `story` (`Label` đã có sẵn, đã lọc được, đã hiện trên thẻ). Được ~70 % giá trị, mất: icon riêng, thống kê tách bạch, AI gắn loại tự động. Nếu chọn phương án này thì **phải ghi rõ trong báo cáo là quyết định có chủ đích**, không phải bỏ sót.

### E2 · Dọn `TaskSize` — trường chết 🟡 — **khuyến nghị dọn**

- **Vấn đề:** `TaskSize S/M/L/XL` nằm trong `schema.prisma`, trong `CreateTaskDto`, trong `UpdateTaskDto`, được `create`/`update`/`duplicate` chép qua chép lại — nhưng **không màn web nào hiện nó** và **không công thức nào dùng nó**. Đơn vị ước lượng của đồ án đã chốt là **giờ** ([01/pham-vi-de-tai §6](../01-de-cuong/pham-vi-de-tai.md) câu hỏi 1), nên `size` là tàn dư của phương án story point bị loại.
- **Rủi ro để nguyên:** hội đồng đọc `schema.prisma` hỏi "cái `size` này để làm gì?" → không ai trả lời được. Trường chết trong mô hình dữ liệu là lỗi thiết kế, không phải chuyện nhỏ.
- **Hai lựa chọn, chọn một:**
  1. **Bỏ khỏi bề mặt (khuyến nghị):** gỡ `size` khỏi `CreateTaskDto`/`UpdateTaskDto` và khỏi `TASK_DETAIL_SELECT`. **Giữ nguyên cột trong CSDL** (không migration, không rủi ro), ghi một dòng trong [04/08](../04-kien-truc/08-mo-hinh-du-lieu.md): "cột dự phòng, không dùng trong phạm vi đồ án".
  2. **Dùng thật:** cho AI điền `size` làm ước lượng thô khi chưa có giờ, hiện thành `Badge` trên thẻ. Tốn thêm công mà trùng vai với `estimateHours`.
- **Công sức:** S (lựa chọn 1).
- **Rủi ro:** không — chỉ bớt bề mặt, không xoá dữ liệu.

### E3 · Làm rõ `isUrgent` ↔ `priority = URGENT` 🟡

- **Vấn đề đo được:** `EisenhowerMatrixView.tsx` dòng 24–25:
  - khẩn = `isUrgent || hạn ≤ 3 ngày`
  - quan trọng = `priority === "URGENT" || priority === "HIGH" || difficulty >= 4`

  Nghĩa là một task đặt **ưu tiên "Khẩn cấp (Urgent)"** mà không có hạn sẽ rơi vào ô **"Quan trọng – Không khẩn"**. Ai biết ma trận Eisenhower nhìn vào sẽ thấy sai ngay, và đây là màn có trong đề bài.
- **Không phải lỗi mã — là lỗi đặt tên.** Hai trường đang đo hai thứ khác nhau (`priority` = mức quan trọng nghiệp vụ, `isUrgent` = gấp về thời gian) nhưng cùng mang chữ "khẩn".
- **SmartTask nên làm (không đụng CSDL):**
  - Đổi nhãn hiển thị mức cao nhất của `Priority` từ "Khẩn cấp (Urgent)" → **"Rất cao"**, trong `lib/status.ts` và mọi `Select`. Ba mức kia giữ nguyên.
  - Nhãn `isUrgent` giữ nguyên "Khẩn" và thêm `Tooltip`: "Gấp về thời gian — xếp vào ô Làm ngay của ma trận Eisenhower. Khác với mức ưu tiên."
  - Ghi một dòng giải thích trong [04/04 công thức](../04-kien-truc/04-cong-thuc-tinh-toan.md) để bảo vệ được khi bị hỏi.
- **Công sức:** S.
- **Rủi ro:** không. Chỉ đổi chuỗi hiển thị, `Priority.URGENT` trong CSDL và API giữ nguyên.

### E4 · Kết quả xử lý (huỷ / không làm) — **ghi vào hướng phát triển**

- **Vấn đề:** một việc quyết định **không làm nữa** hiện chỉ có hai đường: kéo sang cột "Hoàn thành" (làm **sai** burn-down và tỉ lệ hoàn thành), hoặc xoá mềm (biến mất khỏi mọi báo cáo, mất dấu vết quyết định). Cả hai đều bóp méo số liệu — mà burn-down và dự báo rủi ro là hai màn chấm điểm.
- **Đối thủ:** Jira có Resolution (Done / Won't Do / Duplicate) tách khỏi status.
- **Vì sao vẫn để lại:** thêm `resolution` kéo theo sửa `completedAt`, `recomputeParentProgress`, `BurndownSnapshot`, và công thức ở [04/04](../04-kien-truc/04-cong-thuc-tinh-toan.md). Không kịp trước 05/11 nếu còn muốn làm Phase 9–10.
- **Giảm nhẹ trước mắt (0 đồng):** quy ước nhãn `huỷ` + để task ở cột hiện tại, **không** kéo sang Hoàn thành. Ghi quy ước vào README dự án mẫu.
- **Cũng để lại:** thêm loại liên kết ngoài "phải xong trước" (relates to / duplicates) — `TaskDependency` một loại là đủ cho Gantt và phát hiện vòng.

### E5 · Epic / cấp phân rã thứ ba — **không làm, và nên nói rõ vì sao**

- Jira có Epic → Story → Subtask. SmartTask chỉ có cha → con một cấp.
- **Không làm**, vì: `recomputeParentProgress` (tiến độ cha = trung bình con), tính tải theo tuần, burn-down, và Gantt **đều** viết theo giả định đúng hai cấp. Thêm cấp ba là sửa cả bốn chỗ đó cộng migration — nhiều tuần, sau freeze.
- **Và vì SmartTask đã có hai cách gom việc mà Jira dùng Epic để làm:** `Sprint` gom theo thời gian, `Label` gom theo chủ đề. Epic ở đây phần lớn là trùng vai.
- Ghi vào "hướng phát triển" kèm đúng lý do này — trả lời được thì không bị coi là bỏ sót.

---

## 9. Cái gì **không** nên bắt chước, và vì sao

| Thứ bỏ qua | Ai có | Vì sao không làm |
|---|---|---|
| **Trường tuỳ biến động (custom field)** | Jira, ClickUp, Asana | Phải có bảng định nghĩa trường + bảng giá trị + render động + validate động. Phá vỡ `Task` đang là schema tĩnh mà toàn bộ công thức tính tải (04/04) dựa vào. Đã nằm trong **Won’t** ở [01/pham-vi-de-tai §3](../01-de-cuong/pham-vi-de-tai.md) (“workflow engine tuỳ biến”). |
| **Loại công việc cấu hình được (tới 30 loại, mỗi loại một workflow và bộ trường bắt buộc riêng)** | Jira | Phần đắt nằm ở “cấu hình được”, không ở “có loại”. §E1 lấy đúng phần rẻ: enum cố định 3 giá trị, dùng chung một workflow. Cho workspace tự định nghĩa loại là bước đầu của workflow engine. |
| **Workflow engine (trạng thái + điều kiện chuyển + quy tắc tự động)** | Jira | Ít nhất 3 tuần. SmartTask cố ý chỉ có cột + `statusKey`. Đã ở **Won’t**. |
| **JQL / ngôn ngữ truy vấn đầy đủ** | Jira | Cần parser + trình sinh truy vấn + chống SQL injection. Bộ lọc theo tham số hiện tại phủ 90 % nhu cầu; §B5 giải quyết nốt phần “lưu lại”. |
| **Subtask nhiều cấp** | ClickUp (1.000 subtask, lồng nhau), Linear | Backend đã **cố ý** chặn một cấp (`VALIDATION_FAILED: chỉ một cấp subtask`) và `recomputeParentProgress` tính theo đúng giả định đó. Đổi sẽ kéo theo tính tải, burn-down, Gantt. Chốt ở [04/11 §1.1](../04-kien-truc/11-chot-chuc-nang-va-api.md) mục 6. |
| **Checklist riêng trong task rồi chuyển thành thẻ** | Trello | SmartTask đã có subtask **thật** (có mã ST-n, ước lượng giờ, người thực hiện, vào được tính tải). Checklist là bản nghèo hơn của cái đã có. |
| **Cover ảnh, nhãn màu mở rộng, Power-Up** | Trello | Trang trí. Phá quy ước “màu chỉ lấy từ `lib/status.ts`” của [04/10 §3](../04-kien-truc/10-quy-uoc-giao-dien.md). |
| **Epic / cấp phân rã thứ ba** | Jira, Linear | Xem §E5 — `recomputeParentProgress`, tính tải, burn-down và Gantt đều viết theo giả định đúng hai cấp. Sprint (gom theo thời gian) và Label (gom theo chủ đề) đã phủ phần lớn vai của Epic. |
| **Cycle / triage inbox** | Linear | Trùng chức năng với Sprint đã có. Triage chỉ có nghĩa khi có luồng việc từ ngoài (email, khách hàng) — SmartTask không có. |
| **Bulk change tới 1.000 task** | Jira | Với khoá lạc quan theo từng task thì 1.000 lời gọi là không thực tế. Giới hạn **50/lần** (§B1). |
| **Tự động hoá kiểu “khi kéo sang Done thì …”** | Jira board rules, Trello Butler | Đây là workflow engine trá hình. Ngoài phạm vi. |
| **Parse ngôn ngữ tự nhiên bằng LLM ngay trong ô tạo task** | — | **Vi phạm ranh giới AI của đồ án.** Cú pháp `@ # ! h` ở §A4 là tất định, kiểm tra được, có test. Câu tự do phải đi qua Trợ lý AI → bản nháp → người duyệt (docs 12). Không được để ô tạo task gọi thẳng LLM rồi ghi. |

---

## 10. Xếp ưu tiên theo giá trị / công sức

| Hạng | Mã | Tên | Công sức | Giá trị | Đề xuất xếp vào |
|---|---|---|---|---|---|
| 1 | A7 | Sửa lỗi tạo khi lọc Backlog | S | 🔴 lỗi dữ liệu | **MVP 06/11** |
| 2 | B8 | Không mất bảng khi lọc rỗng | S | 🔴 chặn luồng | **MVP 06/11** |
| 3 | C2 | Bảng lệnh (Ctrl/Super + K) tìm & tạo công việc | S | 🔴 điểm nhấn demo | **MVP 06/11** |
| 4 | A1 | Tạo nhanh trong cột, Enter liên tiếp | S | 🔴 đã chốt là MVP (UC-12) | **MVP 06/11** |
| 5 | A3 | Hộp thoại tạo đủ trường (kỹ năng, độ khó…) | M | 🔴 đầu vào của tính tải | **MVP 06/11** |
| 6 | A6 | Cập nhật lạc quan khi tạo/sửa | S | 🟠 nền cho A1, B2 | **MVP 06/11** |
| 7 | B3 | Sửa nhanh trên thẻ Kanban | S | 🟠 4 thao tác → 2 | **MVP 06/11** |
| 8 | A2 | Dán nhiều dòng → nhiều task | S | 🟠 rất “ăn hình” khi demo | **MVP 06/11** |
| 9 | C3 | Bớt request thừa khi mở Sheet | S | 🟡 có số đo để báo cáo | **MVP 06/11** |
| 10 | M13 | `ShortcutsDialog` chỉ liệt kê phím có thật | S | 🔴 tránh lộ khi bảo vệ | **MVP 06/11** |
| 11 | D1 | Tái cấu trúc Sheet chi tiết (2 cột, gom nhóm, nới rộng) | M | 🔴 màn hay bị nhìn nhất | **MVP 06/11** |
| 12 | E3 | Làm rõ `isUrgent` ↔ ưu tiên `URGENT` (đổi nhãn) | S | 🟡 nhưng Eisenhower đang đọc sai nghĩa | **MVP 06/11** |
| 13 | E2 | Dọn `TaskSize` chết khỏi DTO | S | 🟡 tránh bị hỏi trường thừa | **MVP 06/11** |
| 14 | E1 | `TaskType` STORY/TASK/BUG | M | 🟠 khoảng cách dễ thấy nhất với Jira | **MVP nếu kịp — phải quyết sớm** |
| 15 | C1 | Bộ phím tắt toàn cục | M | 🟠 | **MVP nếu kịp** |
| 16 | B1 | Chọn nhiều + thao tác hàng loạt | L | 🔴 | **MVP nếu kịp** |
| 17 | D2 | Trang toàn màn hình `/tasks/ST-n` | M | 🟠 chia sẻ, in, mở hai việc cạnh nhau | **MVP nếu kịp** |
| 18 | B2 | Sửa tại chỗ trên Danh sách | M | 🟠 | **MVP nếu kịp** |
| 19 | B4 | Hoàn tác (toast + xác nhận) | S | 🟠 | **MVP nếu kịp** |
| 20 | A5 | Nhân bản / mẫu task | S | 🟠 tận dụng API bỏ không | **MVP nếu kịp** |
| 21 | A4 | Cú pháp `@ # ! h` khi tạo nhanh | M | 🟠 khác biệt so với đối thủ | **Làm nếu kịp** |
| 22 | B5 | Bộ lọc lưu được (localStorage) | S | 🟡 | **Làm nếu kịp** |
| 23 | C4 | Không khoá cả Sheet khi lưu | M | 🟡 | **Làm nếu kịp** |
| 24 | B6 | Swimlane theo người / ưu tiên | M | 🟠 nhưng rủi ro dnd cao | **Làm nếu kịp** — đã làm, mỗi hàng × cột một SortableContext riêng |
| 25 | C5 | Chế độ tập trung | S | 🟡 | **Làm nếu kịp** |
| 26 | B7 | Backlog tách khỏi sprint | M | 🟡 | **Hướng phát triển** |
| 27 | E4 | Kết quả xử lý (huỷ / không làm) | M | 🟡 nhưng đang bóp méo burn-down | **Hướng phát triển** |
| 28 | — | Khôi phục task đã xoá mềm | M | 🟡 | **Hướng phát triển** |
| — | E5 | Epic / cấp phân rã thứ ba | L | — | **Không làm** (§E5) |

---

## 11. Thay đổi API đề xuất (bổ sung vào [04/11 §3.6](../04-kien-truc/11-chot-chuc-nang-va-api.md))

**Phần lớn đề xuất ở trên không cần endpoint mới** — đây là điểm mạnh: backend Phase 3 đã phủ đủ. Ba đường dẫn mới dưới đây đều tuỳ chọn và đều **không** thuộc MVP:

| Phương thức · đường dẫn | Quyền | Body / query | Trả về | Mức | Dùng cho |
|---|---|---|---|---|---|
| `POST /projects/:id/tasks/bulk` | `pj:MEMBER` | `{ items: [{ title, columnId?, sprintId?, … }] }` (≤ 50) | `201 { created[{ index, task }], failed[{ index, code, message }] }` | S (làm nếu kịp) | A2 khi dán > 20 dòng — gộp N request thành 1 |
| `PATCH /tasks/bulk` | `pj:MEMBER` | `{ items: [{ id, version, patch }] }` (≤ 50) | `200 { updated[], conflicts[{ id, current }] }` — **từng phần tử vẫn mang `version` riêng**, xung đột trả về theo từng id, không rollback cả lô | S (làm nếu kịp) | B1 khi đo thấy 50 request tuần tự quá chậm |
| `POST /tasks/:id/restore` | người tạo · `pj:PM` | — | `200 task` (`deletedAt = null`, `version + 1`) | S (làm nếu kịp) | B4 hoàn tác xoá |

**Ghi chú thiết kế bắt buộc nếu làm `PATCH /tasks/bulk`:** không được bỏ `version` để cho “tiện”. Giữ `version` theo từng phần tử và trả `conflicts[]` — đúng tinh thần §2 của docs 11, chỉ đổi cách đóng gói, không đổi ngữ nghĩa. Mỗi task ghi thành công vẫn phát `task:updated` riêng như hiện tại.

**Trường thêm vào endpoint đã có (không phải đường dẫn mới):**

| Trường | Vào đâu | Cho mục | Ghi chú |
|---|---|---|---|
| `type: "STORY" \| "TASK" \| "BUG"` | `CreateTaskDto`, `UpdateTaskDto` (kèm `version`), `ListTasksQueryDto`, payload `GET /projects/:id/dashboard`, `response-schemas.ts` của AI | E1 | **Đây là thay đổi duy nhất cần migration** — cộng một cột có `@default(TASK)`, không đụng dữ liệu cũ |

**Kết quả thực tế sau khi hiện thực: chỉ E1 cần đổi lược đồ, và KHÔNG endpoint mới nào được thêm.**
Hai endpoint hàng loạt đề xuất ở trên hoá ra không cần: dán nhiều dòng và thao tác hàng loạt đều
gọi tuần tự với giới hạn 50, đo thấy đủ nhanh mà giữ nguyên được khoá lạc quan từng việc.

**Chỉ E1 cần đổi lược đồ CSDL; mọi đề xuất còn lại thì không.** Cụ thể: A5 dùng nhãn quy ước thay vì cột `isTemplate`; B5 dùng `localStorage` thay vì bảng `saved_filters`; B6 nhóm trên client; D2 dùng `GET /tasks/by-key/:projectKey/:number` đã có; E2 **giữ nguyên** cột `size` trong CSDL, chỉ gỡ khỏi DTO; E3 chỉ đổi chuỗi hiển thị, `Priority.URGENT` trong CSDL và API giữ nguyên.

*(Nếu muốn tạo nhanh chèn thẻ lên **đầu** cột thay vì cuối, `CreateTaskDto` cần thêm `position?: number` — hiện `create` luôn gọi `lastPosition`. Đề xuất **không** làm: giữ thẻ mới ở cuối cột đúng như Trello và đơn giản hơn.)*

---

## 12. Bảng “Chốt làm gì” — anh tick vào đây

| ✔ | Mã | Tên | Công sức | Quyết định (MVP 06/11 · nếu kịp · để sau · bỏ) |
|---|---|---|---|---|
| ✅ | A1 | Tạo nhanh trong cột, Enter tạo liên tiếp | S |  **đã làm 23/09** |
| ✅ | A2 | Dán nhiều dòng → nhiều task | S |  **đã làm 23/09** |
| ✅ | A3 | Hộp thoại tạo đủ trường (nhãn, kỹ năng, độ khó, ngày bắt đầu, nhiều người) | M |  **đã làm 23/09** |
| ✅ | A4 | Cú pháp `@người #nhãn !ưu-tiên 4h t6` | M | **đã làm 23/09** — parser ở `packages/shared`, 15 unit test |
| ✅ | A5 | Nhân bản task / mẫu task | S |  **đã làm 23/09** |
| ✅ | A6 | Cập nhật lạc quan khi tạo & sửa | S |  **đã làm 23/09** |
| ✅ | A7 | Sửa lỗi tạo khi lọc Backlog rơi vào sprint | S |  **đã làm 23/09** |
| ✅ | B1 | Chọn nhiều + thao tác hàng loạt (≤ 50) | L | **đã làm 23/09** |
| ✅ | B2 | Sửa tại chỗ trên Danh sách | M | **đã làm 23/09** |
| ✅ | B3 | Sửa nhanh trên thẻ Kanban (giao/ưu tiên/hạn/nhân bản) | S |  **đã làm 23/09** |
| ✅ | B4 | Hoàn tác + xác nhận trước khi ghi hàng loạt | S | **đã làm 23/09** |
| ✅ | B5 | Bộ lọc lưu được (localStorage) | S | **đã làm 23/09** |
| ✅ | B6 | Swimlane theo người / ưu tiên | M | **đã làm 23/09** |
| ✅ | B7 | Backlog tách khỏi sprint | M | **đã làm 23/09** |
| ✅ | B8 | Lọc rỗng vẫn giữ bảng + nút “Xoá bộ lọc” | S |  **đã làm 23/09** |
| ✅ | B9 | Tạo nhanh inline + phím tắt + tách rỗng ở màn Backlog; nút “Đề xuất phân công” (UC-39); hợp nhất contract `backlog=true` (boolean) và sắp `position` phẳng ở API | S | **đã làm 01/10** — `QuickCreateComposer` tách dùng chung với cột Kanban, `POSITION_STEP` Backlog = 1024 khớp backend |
| ✅ | C1 | Bộ phím tắt toàn cục kiểu Jira/Linear | M | **đã làm 23/09** |
| ✅ | C2 | Bảng lệnh (Ctrl/Super + K) tìm & tạo công việc | S | **đã làm 23/09** |
| ✅ | C3 | Bớt request thừa khi mở Sheet | S |  **đã làm 23/09** |
| ✅ | C4 | Không khoá cả màn chi tiết khi lưu một trường | M | **đã làm 23/09** |
| ✅ | C5 | Chế độ tập trung (phím `F`) | S | **đã làm 23/09** |
| ✅ | D1 | Tái cấu trúc Sheet chi tiết (2 cột, gom nhóm, `sm:max-w-3xl`) | M |  **đã làm 23/09** |
| ✅ | D2 | Trang toàn màn hình `/projects/:id/tasks/ST-n` | M |  **đã làm 23/09** |
| ✅ | D3 | Chốt nguyên tắc trường nào ở form tạo, trường nào ở màn xem | — |  **đã làm 23/09** |
| ✅ | E1 | `TaskType` STORY/TASK/BUG (enum cố định) — **hay dùng nhãn quy ước thay thế?** | M |  **đã làm 23/09** |
| ✅ | E2 | Dọn `TaskSize` khỏi DTO (giữ cột CSDL) | S |  **đã làm 23/09** |
| ✅ | E3 | Đổi nhãn ưu tiên `URGENT` → “Rất cao”, làm rõ cờ Khẩn | S |  **đã làm 23/09** |
| ☐ | E4 | Kết quả xử lý (huỷ / không làm) | M | |
| ✅ | — | Sửa `ShortcutsDialog` chỉ liệt kê phím có thật | S | **đã làm xong 23/09** cùng C1 |
| ☐ | — | `POST /projects/:id/tasks/bulk` | S | **không cần** — dán nhiều dòng gọi tuần tự, chặn 50 dòng, đo thấy đủ nhanh |
| ☐ | — | `PATCH /tasks/bulk` | S | **không cần** — B1 gửi tuần tự ≤ 50, giữ `version` từng việc; đổi sprint đã có endpoint gộp sẵn |
| ☐ | — | `POST /tasks/:id/restore` | S | chưa làm — xoá vẫn đi qua AlertDialog, không hứa hoàn tác |

---

## 13. Gợi ý chia phase

> **Lưu ý đánh số:** "Phase 9 / 10 / 11" dưới đây là cách chia lô của RIÊNG đợt cải tiến giao diện này, không liên quan tới Phase 9 (AI chat, memory) và Phase 10 (đóng gói, deploy) trong [kế hoạch backend](../05-hien-thuc/00-ke-hoach-backend.md). Kết quả hiện thực ghi ở [05/web-cai-tien-task.md](../05-hien-thuc/web-cai-tien-task.md).

| Phase | Tên | Nội dung | Ước lượng | Mốc |
|---|---|---|---|---|
| **Phase 9** ✅ | Tạo task nhanh & màn chi tiết | A7 → B8 → A6 → A1 → A2 → A3 → B3 → **D1** → **D3**; đồng thời C2 (mục 1–2), C3, E2, E3. Chỉ sửa `apps/web`, backend **không đổi**. | 5–6 ngày | xong trước 15/10 |
| **Phase 9b** ✅ | Loại công việc | **E1** — migration `TaskType` + DTO + 6 chỗ web + schema AI + seed. **Phải nằm đầu Phase 9, không được đẩy sang tháng 11.** | 1,5–2 ngày | xong trước 20/10 |
| **Phase 10** ✅ | Hàng loạt & bàn phím | B1 → B4 → B2 → **D2** → C1 → sửa `ShortcutsDialog` → C2 (mục 3). Cân nhắc `PATCH /tasks/bulk` nếu đo thấy chậm. | 6–7 ngày | xong trước **05/11** (freeze) |
| **Phase 11** ✅ | Tăng tốc | A4 (parser + test) → A5 → B5 → C4 → C5 | 3–4 ngày | trước 05/11 |
| **Hướng phát triển** *(ghi vào báo cáo, không code)* | — | E4 kết quả xử lý (huỷ / không làm), E5 Epic, khôi phục task đã xoá mềm, trường tuỳ biến động, JQL đầy đủ, workflow engine | — | — |

**Thứ tự trong Phase 9 là bắt buộc:** A7 và B8 là sửa lỗi (rẻ, phải làm trước); A6 (cập nhật lạc quan) là nền cho A1 và B2 — làm sau sẽ phải sửa lại; **D1 phải trước D2**, vì D2 chỉ rẻ khi `TaskBody` đã tách khung chứa; **E1 phải trước A3 và D1**, vì cả hai đều phải thêm ô chọn loại — làm ngược là sửa form hai lần.

**Cần thống nhất trước khi code:** `apps/web/src/components/app/AppShell.tsx` đang được một phiên làm việc song song chỉnh sửa. C2 phải đụng đúng file này — hẹn nhau hoặc tách thành commit riêng sau khi AppShell ổn định.

---

## 14. Nguồn tham khảo

Tài liệu chính thức, truy cập 23/09/2026 — chỉ đối chiếu cơ chế, không sao chép giao diện.

- [Use keyboard shortcuts — Jira Cloud](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/)
- [Create a work item and a subtask — Jira Cloud](https://support.atlassian.com/jira-software-cloud/docs/create-a-work-item-and-a-subtask/)
- [Edit multiple work items — Jira Cloud](https://support.atlassian.com/jira-software-cloud/docs/edit-multiple-issues/)
- [Configure swimlanes — Jira Cloud](https://support.atlassian.com/jira-software-cloud/docs/configure-swimlanes/) · [Configure columns — Jira Cloud](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/)
- [Manage filters in team-managed spaces — Jira Cloud](https://support.atlassian.com/jira-software-cloud/docs/manage-custom-filters-in-team-managed-projects/)
- [Add a card — Trello](https://support.atlassian.com/trello/docs/adding-cards/) · [Add and customize cards and lists — Trello](https://support.atlassian.com/trello/docs/add-and-customize-cards-and-lists/) · [Copy a card, list, or board — Trello](https://support.atlassian.com/trello/docs/copying-cards-lists-or-boards/)
- [Create issues — Linear Docs](https://linear.app/docs/creating-issues) · [Select issues — Linear Docs](https://linear.app/docs/select-issues) · [Triage — Linear Docs](https://linear.app/docs/triage)
- [Manage tasks with the Bulk Action Toolbar — ClickUp Help](https://help.clickup.com/hc/en-us/articles/6309768265495-Manage-tasks-with-the-Bulk-Action-Toolbar) · [Work with subtasks from tasks — ClickUp Help](https://help.clickup.com/hc/en-us/articles/29665922829335-Work-with-subtasks-from-tasks)
