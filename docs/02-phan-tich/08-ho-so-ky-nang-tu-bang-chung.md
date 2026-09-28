# 08 · Hồ sơ kỹ năng **từ bằng chứng** thay cho mức tự khai

**Phiên bản:** 1.0 — **Ngày:** 28/09/2026 (Tuần 03) — **Trạng thái:** đã hiện thực trên nhánh `feature/UC-35-ghi-gio-danh-gia` (gộp vào `sprint_v1`).
**Phạm vi:** UC-23 (ma trận kỹ năng), UC-26 (giao việc), UC-28 (phân rã có gợi ý người), UC-35 (ghi giờ), UC-36 (đánh giá việc), docs [04/04 §2, §2b, §6, §7](../04-kien-truc/04-cong-thuc-tinh-toan.md).
**Quyết định của nhóm (28/09):** AI chia việc dựa trên hồ sơ tính từ lịch sử làm việc, **không** dựa trên mức tự khai 1–5. Mức tự khai giữ lại chỉ để tham khảo.

---

## 1. Vấn đề

| Hiện trạng trước 28/09 | Hệ quả đo được |
|---|---|
| `user_skills.level` do chính người dùng khai, dùng thẳng ở validator, bảng năng lực, ngữ cảnh AI, tra cứu "ai biết X" | Seed: Lan tự khai React 4 nhưng 0 việc React; Huy tự khai React 5. Mức không kiểm chứng được mà lại có quyền cao nhất |
| Validator coi thiếu kỹ năng là **lỗi** → khoá nút Duyệt | Đo với Gemini thật: "3/3 việc còn lỗi" trong một đề xuất, gần hết là `ASSIGN_SKILL_GAP` do dữ liệu tự khai |
| "Có React mức 0" khi người đó chỉ **chưa khai** React | Câu cảnh báo sai nghĩa |
| `task_reviews`, `time_entries` có bảng + hợp đồng API (docs 11 §3.6) nhưng **0 dòng mã** | EAR luôn suy từ cycle time; rating luôn trống; không có "feedback" nào cả |
| Không có liên kết bug → việc gốc | Không đo được "làm lại" (rework) theo người |
| Đếm "mở lại" trong `MetricsService` so JSON path với chuỗi `'null'` | `reopenCount` luôn 0 |

## 2. Kiến trúc

```
Việc đã xong có yêu cầu kỹ năng (task_skills)      ┐
Đánh giá của PM (task_reviews: rating, độ khó thực tế)│
Giờ thực tế (time_entries / giờ xác nhận khi đánh giá)├─► Engine (backend, hàm thuần) ─► Hồ sơ kỹ năng ─► AI chia việc
Bug gắn việc gốc (tasks.origin_task_id)              │      metrics/domain/             (mức · độ tin cậy     (LLM chỉ đọc,
Việc bị mở lại (activity_logs task.moved)            │      skill-evidence.ts            · bằng chứng)         không chấm)
PM xác nhận mức (user_skills.verified_at)            ┘
```

Engine là **backend tính tất định** (ranh giới AI docs 04/05): LLM không chấm điểm người, chỉ đọc hồ sơ kèm bằng chứng để lập luận.

## 3. Công thức (docs 04 §2b)

Mỗi việc **đã xong** trong 26 tuần có yêu cầu kỹ năng *s* ở mức *m* là một bằng chứng cho từng người làm:

| Thành phần | Quy tắc |
|---|---|
| Đạt / trượt | Trượt nếu bị mở lại, có bug gắn việc gốc, hoặc PM đánh giá ≤ 2; còn lại là đạt |
| Mức thể hiện | *m*; làm tốt (đánh giá ≥ 4) việc có độ khó thực tế > *m* → *m* + 1 |
| Trọng số | Có đánh giá của người khác = 1; chưa đánh giá = 0,5; nhiều người làm chung thì chia đều; **tự chấm không tính** |
| PM xác nhận | Một bằng chứng trọng số 1 ở đúng mức xác nhận |
| **Mức(u, s)** | L lớn nhất mà, trong các bằng chứng thể hiện ≥ L: Σ đạt ≥ 1 **và** Σ đạt > Σ trượt |
| Độ tin cậy | không có bằng chứng → `none`; Σ đạt < 2 → `low`; < 4 → `medium`; ≥ 4 → `high` |

"Chưa có bằng chứng" **khác** "không biết": khi tính tải (`skillGapFactor`) kỹ năng chưa có bằng chứng là trung tính (1,0), còn kỹ năng có bằng chứng mà mức 0 vẫn phạt 1,3.

Hiệu suất cá nhân (đúng hạn, rating TB, EAR, số lần mở lại) vẫn do `MetricsService` tính (docs 04 §2), nay có dữ liệu thật từ giờ làm và đánh giá. Chỉ **chính người đó và PM** xem được.

## 4. Thay đổi

| Lớp | Thay đổi |
|---|---|
| CSDL | Migration `20260928100000_task_origin`: `tasks.origin_task_id` (null được, `ON DELETE SET NULL`, chỉ task BUG). **Thay đổi lược đồ duy nhất**, trước mốc 16/10 |
| API mới | `GET·POST /tasks/:id/time-entries`, `PATCH·DELETE /time-entries/:id` (người được giao · PM; không ghi ngày tương lai; ≤ 24 h/ngày) · `GET·PUT /tasks/:id/review` (PM chấm việc đã xong; người được giao và PM xem) · `GET /projects/:id/skill-profiles` · `GET /projects/:id/skill-profiles/:userId/evidence?skillId=` |
| API sửa | `POST/PATCH /tasks` nhận `originTaskId` (BUG, cùng dự án, không trỏ chính nó; đổi khỏi BUG thì tự gỡ); chi tiết việc trả `origin`, `derivedBugs` · validator: thiếu kỹ năng thành **cảnh báo** kèm bằng chứng, thêm `ASSIGN_SKILL_UNPROVEN` · ngữ cảnh AI: cột kỹ năng = "mức (số việc, làm lại, PM xác nhận)", không có mức tự khai · bảng năng lực, ứng viên, `WHO_KNOWS_SKILL`, `BUS_FACTOR`, thành viên dự án đọc từ engine |
| Web | Chi tiết việc: tab **Giờ làm**, thẻ **Đánh giá khi xong**, ô **Sinh ra từ việc** (BUG), danh sách **Bug phát sinh từ việc này** |
| Seed | `prisma/seed-history.ts`: 2 sprint đã đóng, 18 việc có đánh giá/giờ làm, 1 bug gốc, 1 lần mở lại; sửa `taskCounter` |

## 5. Kiểm chứng

- Unit: `metrics/domain/skill-evidence.spec.ts` (9 ca), validator (cảnh báo thay lỗi), `workload.spec.ts` (trung tính khi chưa có bằng chứng).
- E2e: `test/worklog.e2e-spec.ts` — quyền ghi giờ/đánh giá, bug gốc, và luồng đầu-cuối: tự khai 5 → "chưa có bằng chứng" → xong + PM đánh giá 4 → mức 3 → gắn bug gốc → mức 0 (còn bằng chứng, 1 phải làm lại); hiệu suất người khác không thấy.
- Seed lịch sử (Lan PM): Minh NestJS 4 (5 việc, 1 làm lại) · Huy React 3 (4 việc, 1 làm lại) · Long Docker 4 · Lan Phân tích nghiệp vụ 3 · các mức tự khai không có việc nào → "chưa có bằng chứng".
- Ảnh: [ghi giờ](../05-hien-thuc/anh/sprint-v1/g1-ghi-gio.png) · [đánh giá](../05-hien-thuc/anh/sprint-v1/g1-danh-gia.png) · [bug gốc](../05-hien-thuc/anh/sprint-v1/g1-bug-goc.png).

## 6. Rủi ro còn lại

| Rủi ro | Cách giữ |
|---|---|
| Vòng "giàu càng giàu": chỉ giao cho người đã có bằng chứng | Chưa có bằng chứng là trung tính và chỉ là cảnh báo; prompt nói rõ "chưa biết ≠ không biết" |
| Trễ hạn do ước lượng sai chứ không do người làm | Đúng hạn không vào mức kỹ năng, chỉ ở phần hiệu suất (PM xem) |
| Bug do đặc tả | Liên kết bug → việc gốc do người gắn tay, không tự suy |
| Dữ liệu ít | Mọi mức đi kèm số việc, độ tin cậy, lần gần nhất; cửa sổ 26 tuần |
