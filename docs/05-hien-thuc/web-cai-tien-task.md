# Đợt cải tiến tạo & quản lý công việc (web)

23/09/2026, trên `main`. Hiện thực bản đề xuất [02/05 · Cải tiến tạo & quản lý task](../02-phan-tich/05-cai-tien-quan-ly-task.md) — **26/27 mục**, 20 commit. Gần như toàn bộ nằm ở `apps/web`; backend chỉ đổi một chỗ (`TaskType`).

> Tài liệu này thuộc **nhánh frontend**, đi cùng [web-tich-hop.md](web-tich-hop.md). Bản đề xuất gọi hai lô việc là "Phase 9 / Phase 10" — đó là cách đánh số RIÊNG của đợt cải tiến giao diện, **không liên quan** tới Phase 9 (AI chat, memory) và Phase 10 (đóng gói, deploy) của [kế hoạch backend](00-ke-hoach-backend.md).
>
> Quy tắc bất biến giữ nguyên: mọi thay đổi task mang `version` và phát `task:*` như cũ; parse cú pháp nhanh là **tất định**, không gọi LLM — phân rã bằng ngôn ngữ tự nhiên vẫn đi qua Trợ lý AI có bản nháp và người duyệt ([04/12](../04-kien-truc/12-chat-phien-va-ban-nhap.md)).

## A. Vì sao làm — 19 ma sát đo được

Trước khi sửa, nhóm chạy thật API + web với dữ liệu seed và thao tác bằng Chrome headless, đếm số cú bấm và số request. Ba trong số đó là **lỗi**, không phải thiếu tính năng:

| | Lỗi |
|---|---|
| 1 | Tạo việc khi đang lọc "Backlog" lại rơi vào sprint đang chạy; thẻ vẫn hiện nhờ cache nên F5 mới biết mất (xác minh qua API: 3/3 task) |
| 2 | Lọc ra 0 kết quả thì mất cả 4 cột lẫn 4 nút "Thêm công việc" — không còn chỗ nào tạo việc |
| 3 | Bảng phím tắt "?" liệt kê 12 phím nhưng ngoài Trợ lý AI chỉ 2 phím chạy thật |

Chi tiết 19 ma sát và ảnh chụp: [02/05 §2](../02-phan-tich/05-cai-tien-quan-ly-task.md).

## B. Backend — chỉ một thay đổi

| Nhóm | Thay đổi |
|---|---|
| Migration `20260923052501_task_type` | `enum TaskType { STORY, TASK, BUG }` + `tasks.type` `@default(TASK)`. Cộng một cột có mặc định, **không đụng dữ liệu cũ**. |
| DTO | `type` vào `CreateTaskDto`, `UpdateTaskDto` (kèm `version`), `ListTasksQueryDto`; **gỡ `size`** khỏi mọi DTO và `TASK_LIST_SELECT` (cột CSDL giữ nguyên — xem §E). |
| Service | `type` vào select danh sách/chi tiết, `create`, `update`, `duplicate`; lọc `?type=`. |
| Dashboard | `GET /projects/:id/dashboard` trả thêm `byType[]`. |
| AI | `taskType` vào `draftTaskSchema` và `draftPatchSchema` (`packages/shared`), vào `response-schemas.ts` và master prompt. LLM **đề xuất** loại, backend chỉ kiểm giá trị thuộc enum. |
| Seed | 10 việc mẫu được gán loại + thêm 2 việc BUG → tổng 12 việc (6 STORY / 4 TASK / 2 BUG). |

**Không endpoint mới nào được thêm.** Hai endpoint hàng loạt từng đề xuất (`POST /tasks/bulk`, `PATCH /tasks/bulk`) hoá ra không cần — xem §D.

Backend Phase 3 phủ đủ hơn dự tính: ba endpoint đã có sẵn mà web **chưa từng gọi** nay đều dùng tới —
`POST /tasks/:id/duplicate`, `GET /tasks/by-key/:projectKey/:number`, `GET /workspaces/:wsId/tasks/search`.

## C. Web — theo nhóm

### Tạo việc

| Mã | Việc | Ghi chú |
|---|---|---|
| A1 | Tạo nhanh ngay trong cột | Enter tạo xong ô vẫn mở và giữ con trỏ cho việc kế; Esc đóng. Ô bị `disabled` lúc lưu nên mất focus — lấy lại trong `useEffect` khi `busy` tắt. |
| A2 | Dán nhiều dòng → nhiều việc | Tách dòng tất định: bỏ dòng trắng, bỏ tiền tố `-` `*` `1.`, cắt 200 ký tự cho khớp `MaxLength`, chặn cứng 50 dòng. Hỏi trước khi tạo. |
| A3 | Form tạo đủ trường | Tách `AssigneePicker` / `LabelPicker` / `SkillPicker` ra `components/app/TaskFieldPickers.tsx` dùng chung với modal. Trước: 1 POST + 2 PUT mới đủ kỹ năng; nay **1 POST**. |
| A4 | Cú pháp `@người #nhãn !cao 4h t6 ~react>=3` | Parser ở `packages/shared/src/task-quick-parse.ts`, **15 unit test**. Không đoán: trùng nhiều người hay nhãn lạ thì giữ nguyên trong tiêu đề và báo lại. Nhận ra gì thì hiện thành huy hiệu **trước khi** Enter. |
| A5 | Nhân bản việc | Gọi `POST /tasks/:id/duplicate` — lần đầu có nút gọi. |
| A6 | Cập nhật lạc quan khi tạo & sửa | Thẻ tạm mang `pending`, khoá thao tác vì chưa có id thật; `onError` khôi phục ảnh chụp cache. |
| A7 | **Sửa lỗi** tạo khi lọc Backlog | `createSprintId` đọc đúng bộ lọc; hộp thoại nói rõ việc sẽ vào đâu. |

### Quản lý

| Mã | Việc | Ghi chú |
|---|---|---|
| B1 | Chọn nhiều + thao tác hàng loạt | Xem §D — chỗ quan trọng nhất của đợt này. |
| B2 | Sửa tại chỗ ở Danh sách | 0 ô sửa → **21 ô** trên 7 dòng. Dùng lại mutation của Kanban nên không có đường ghi thứ hai. |
| B3 | Thao tác nhanh trên thẻ | Giao cho / Đặt ưu tiên / Đặt hạn / Nhân bản / Xoá. Giao việc từ bảng: **4 thao tác → 2**. |
| B4 | Hoàn tác | Toast có nút Hoàn tác cho kéo thả, giao việc, đổi ưu tiên. |
| B5 | Bộ lọc lưu được | `localStorage` theo dự án, tối đa 10 — **cố ý không thêm bảng CSDL**. Chỉ lưu tham số lọc, không lưu `view`/`task`. |
| B6 | Swimlane theo người / ưu tiên | Xem §D. |
| B7 | Màn Backlog riêng | Cách nhìn thứ năm; kéo xếp thứ tự bằng `position`, đưa vào sprint hàng loạt bằng 1 request. |
| B8 | **Sửa lỗi** lọc rỗng nuốt mất bảng | Tách hai trạng thái rỗng đúng [docs 10 §2](../04-kien-truc/10-quy-uoc-giao-dien.md): dự án chưa có việc → `EmptyState`; lọc ra 0 → vẫn vẽ đủ cột + `Alert` + nút Xoá bộ lọc. |

### Màn chi tiết

| Mã | Việc | Ghi chú |
|---|---|---|
| D1 | Chia hai cột | 15 điều khiển phẳng trong 576px → cột nội dung + cột thuộc tính gom 3 nhóm, rộng 768px, nhóm ít dùng thu gọn sẵn, bỏ nhãn VIẾT HOA. |
| D2 | Trang riêng `/projects/:id/tasks/ST-n` | Dùng chung `TaskDetailBody` với modal qua `variant`; URL mang mã ST-n đúng [docs 11 §2](../04-kien-truc/11-chot-chuc-nang-va-api.md). |
| — | Đổi `Sheet` → **`Dialog` giữa màn** | Theo yêu cầu; nội dung hai cột cần bề ngang. Thẻ Kanban và dòng Danh sách có icon mở **thẳng** trang chi tiết. [docs 10 §4](../04-kien-truc/10-quy-uoc-giao-dien.md) đã sửa theo. |
| C4 | Không khoá cả màn khi lưu một trường | Xem §D. |

### Bàn phím & tốc độ

| Mã | Việc | Ghi chú |
|---|---|---|
| C1 | Bộ phím tắt trên bảng | J/K (↓↑) trong cột, N/P (→←) sang cột, Enter/O mở chi tiết, I giao cho mình, A mở menu thẻ, X chọn, Esc bỏ. Xem §D về pha capture. |
| C2 | Bảng lệnh Ctrl/Super + K | Tìm việc **xuyên dự án** + nhóm lệnh "Tạo". Nhặt được hai lỗi: `?task=` chỉ đọc lúc mount nên điều hướng trong trang không mở modal; bộ lọc cmdk khớp theo `value` nên gõ có dấu không ra lệnh. |
| C3 | Bớt request khi mở chi tiết | 3 request → **1**; `DependencyPicker` chỉ kéo danh sách khi người dùng mở ô chọn. |
| C5 | Chế độ tập trung (phím F) | Bảng từ y=449 lên y=295 — lấy lại 15% chiều cao màn. |
| — | Bỏ ký hiệu phím Mac | `useModKey()`: Windows/Linux hiện **Ctrl**, macOS mới hiện `⌘`. Handler không đổi (`metaKey \|\| ctrlKey`) nên phím Super vẫn ăn. |

## D. Bốn chỗ phải làm cho đúng

Đây là những chỗ dễ sai lặng lẽ, đều đã đo chứ không chỉ suy luận.

### 1. Hàng loạt phải giữ `version` từng việc

`PATCH /tasks/:id` đòi `version` của **từng** task. Client gửi **tuần tự** n lời gọi, mỗi cái mang version riêng đang giữ trong cache. Việc nào trả 409 thì **không dừng cả lô** — gom lại, cuối cùng báo `"n−k công việc · k vừa được người khác sửa: ST-1"`.

Kiểm bằng cách ép một lời gọi mang version cũ: HTTP của lô là **409, 200, 200** — lô chạy hết 3/3, việc xung đột **không bị ghi đè**.

Giới hạn **50 việc/lần**, không chạy song song để khỏi đụng hạn mức 100 req/phút. Riêng đổi sprint dùng `POST /sprints/:id/tasks` — 1 request thay vì n. Gắn nhãn phải **gộp với nhãn sẵn có** vì `PUT /labels` thay toàn bộ.

### 2. Sửa nhiều trường liên tiếp: hàng đợi tuần tự, không song song

Bỏ `busy` để không khoá cả màn là nửa việc. Nửa còn lại: mỗi PATCH tăng `version`, nên hai lời gọi song song cùng version thì lời thứ hai chắc chắn 409. Giải pháp — giao diện bấm được ngay, còn các lời gọi nối vào **một hàng đợi** trong client, mỗi lời lấy version mới nhất từ phản hồi trước (`versionRef`, đồng bộ lại cả khi task tải lại sau 409 hoặc sau sự kiện realtime).

Đo với mỗi lời gọi bị giữ 900 ms: đổi Ưu tiên rồi bấm tiếp Trạng thái → hai PATCH đi lần lượt với version **25 → 26**, cả hai vào được, không 409 nào.

### 3. Phím tắt phải nghe ở **pha capture**

Radix xử lý `Escape` trước rồi đặt `data-state="closed"`. Nghe ở pha bubble thì đúng phím Escape dùng để đóng modal lại lọt qua guard và xoá luôn ô trỏ thẻ — hậu quả là bấm `I` hay `A` ngay sau khi đóng modal không ăn gì. Guard cũng phải loại trừ node đang chạy hiệu ứng đóng.

### 4. Swimlane: không ghi ngầm, và WIP là của cả cột

Kéo thẻ sang hàng khác **không** tự đổi người thực hiện hay ưu tiên — hoàn tác vị trí và toast chỉ sang menu "Giao cho" / "Đặt ưu tiên". Mỗi **hàng × cột** là một `SortableContext` riêng (`${lane}:${col}`), không thì dnd-kit lẫn thẻ giữa các hàng.

WIP limit là giới hạn của **cả cột**, không phải từng hàng — nên khi nhóm thì ẩn huy hiệu `n/limit` thay vì hiện con số sai. Kiểm bằng cách đặt tạm WIP=2: không nhóm hiện `3/2`, khi nhóm chỉ hiện số đếm.

## E. Quyết định "không làm" và lý do

| Thứ | Vì sao |
|---|---|
| Endpoint hàng loạt (`tasks/bulk`) | Gọi tuần tự ≤ 50 đo thấy đủ nhanh, mà giữ nguyên được khoá lạc quan từng việc. Thêm endpoint chỉ đổi cách đóng gói, không đổi ngữ nghĩa. |
| Lưu bộ lọc trên server | Thêm bảng + API + đồng bộ, không tương xứng trước freeze 05/11. `localStorage` đủ; chú thích nói rõ "không đồng bộ giữa các máy". |
| Giữ `TaskSize` | Trường chết: trong CSDL và DTO nhưng 0 màn dùng, 0 công thức tính — tàn dư của phương án story point đã bị loại khi chốt đơn vị là **giờ**. Gỡ khỏi DTO, **giữ cột CSDL** (không migration, không mất dữ liệu). |
| Loại công việc cấu hình được | Jira cho tới 30 loại, mỗi loại một workflow riêng. Phần đắt nằm ở "cấu hình được". Ở đây enum cố định 3 giá trị, dùng chung một luồng cột. |
| Epic / cấp phân rã thứ ba | `recomputeParentProgress`, tính tải, burn-down và Gantt đều viết theo giả định **đúng hai cấp**. Sprint và Label đã phủ phần lớn vai của Epic. |
| Kết quả xử lý (huỷ / không làm) — **E4** | Mục duy nhất còn lại. Kéo theo `completedAt`, `recomputeParentProgress`, `BurndownSnapshot` và công thức [04/04](../04-kien-truc/04-cong-thuc-tinh-toan.md) — tức đụng đúng hai màn chấm điểm. Giữ ở hướng phát triển. |

## F. Kiểm thử

- **Unit:** 82 → **97** (thêm 15 ca cho parser cú pháp nhanh). `packages/shared/src/task-quick-parse.spec.ts` chạy được nhờ thêm `roots` vào jest của `apps/api`.
- **E2E:** **100/100** (bộ e2e tăng từ 83 do phiên AI thêm `ai-query`).
- **Build production:** xanh; route mới `/projects/[projectId]/tasks/[taskKey]` có trong bảng route.
- **Đo trên trình duyệt thật** (Chrome headless, dữ liệu seed) cho từng mục — số liệu trước/sau ở §G.

Một ca e2e đỏ ngẫu nhiên **không thuộc đợt này**: `admin.e2e-spec.ts:233` "nhật ký kiểm toán … chuỗi HMAC không bị phá". Mã kiểm toán nằm trọn trong `apps/api/src/admin/**`, không commit nào của đợt này chạm tới.

## G. Trước / sau

| | Trước | Sau |
|---|---|---|
| Tạo 3 việc | 3 lần mở/đóng modal | 3 lần Enter, ô không đóng |
| Dán 3 dòng | 1 việc dính liền | 3 việc riêng |
| Tạo việc có đủ kỹ năng | 1 POST + 2 PUT, version nhảy 3 lần | 1 POST |
| Giao việc từ bảng | 4 thao tác | 2 thao tác, hoặc phím `I` |
| Đẩy 3 việc sang sprint | 9 thao tác | chọn + 2 bấm, 1 request |
| Mở chi tiết | 3 request | 1 request |
| Ô sửa trên Danh sách | 0 | 21 |
| Phím tắt chạy thật | 2 | 12 |
| Màn chi tiết | 15 trường phẳng, 576px, ngăn phải | 2 cột, 3 nhóm, 768px, modal giữa màn + trang riêng |
| Cách nhìn Công việc | 4 | 5 (thêm Backlog) |

## H. Để lại

- **E4** kết quả xử lý (huỷ / không làm) — hướng phát triển.
- `POST /tasks/:id/restore` để hoàn tác xoá — hiện xoá đi qua `AlertDialog` và không hứa hoàn tác.
- Tìm **thành viên** trong bảng lệnh — backend chưa có endpoint.
- Chuông thông báo trên AppShell vẫn dùng `src/mocks/notifications.ts` ([web-tich-hop §4](web-tich-hop.md)).
