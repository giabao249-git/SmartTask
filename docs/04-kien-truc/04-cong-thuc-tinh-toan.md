# 04 · Công thức tính toán (phần backend "chỉ tính")

Mọi công thức ở đây cho ra **sự thật có thể tái lập và kiểm thử**: chúng được đưa vào ngữ cảnh cho LLM, hiển thị trên giao diện, và dùng trong Validator. Không công thức nào chọn người, chọn giờ hay xếp hạng — việc đó là của LLM (xem [05](05-ai-agent.md)). Hằng số là tham số `workspaces.settings` với giá trị mặc định ghi ở cột "Mặc định".

## 0. Ranh giới tính / quyết định

| Đầu ra của backend | Loại | Ai dùng |
|---|---|---|
| Giờ còn lại theo tuần, tải hiệu dụng, năng lực hiệu dụng, mức sử dụng, mức (Bình thường/Cao/Đầy/Quá tải) | Tính theo công thức và ngưỡng cấu hình | Giao diện, LLM, Validator |
| Điểm burnout 0–100 và nhãn | Tính | Giao diện, thông báo, LLM |
| EAR, vận tốc, đúng hạn, rating, cycle time theo người | Tính từ lịch sử | LLM, giao diện cá nhân |
| Giờ trống theo ngày, khối tập trung, khoảng bận | Tính từ lịch, nghỉ, việc đã có | LLM, Validator |
| Khớp kỹ năng từng cặp (người, task): mức đạt / mức yêu cầu | Tính | LLM, giao diện |
| Kiểm tra khả thi một đề xuất (đủ giờ trống, đủ kỹ năng, ngày hợp lệ) | Kiểm tra → đúng/sai kèm số | Validator |
| Vận tốc sprint, ETA, mức rủi ro theo ngưỡng, danh sách nguyên nhân đo được | Tính | Giao diện, LLM |
| Spread (độ chênh tải) của phương án | Tính, **chỉ báo cáo** | Giao diện, LLM |
| ~~Điểm phù hợp tổng hợp, top-N ứng viên, xếp lịch tham lam~~ | **Không có** — là quyết định | — |

## 1. Giờ còn lại và phân bổ theo tuần

```
remaining(t)  = remaining_hours nếu người dùng nhập, ngược lại estimate_hours × (1 − progress/100)
start*(t)     = start_date nếu có, ngược lại max(created_at, hôm nay)
due*(t)       = due_date nếu có, ngược lại end_date của sprint, ngược lại start* + 5 ngày làm việc
share(t, w)   = workdays([start*, due*] ∩ w) / workdays([start*, due*])
                — task đã quá hạn: share(t, tuần hiện tại) = 1, các tuần khác = 0
Load(u, w)    = Σ_{t ∈ Open(u)} remaining(t) × share(t, w)             (tải kế hoạch — bản tối thiểu)
```

Ngày làm việc lấy từ lịch workspace (`settings.workdays`, mặc định T2–T6, trừ ngày lễ `settings.holidays`).

## 2. Hệ số lịch sử cá nhân

| Chỉ số | Công thức | Mặc định | Ghi chú |
|---|---|---|---|
| **EAR(u, c)** — hệ số ước lượng theo nhóm kỹ năng c | `(Σ actual + k × 1.0) / (Σ estimate + k)` trên task DONE trong 8 tuần | k = 20 giờ | Làm mượt Bayes về 1,0 khi ít mẫu; `actual` từ `time_entries` (MANUAL) hoặc cycle time × 8 h/ngày làm việc × 0,6 (CYCLE_TIME, hệ số cấu hình) |
| EAR(u) tổng | Như trên, không tách nhóm | — | Dùng khi nhóm kỹ năng có < 5 task |
| Vận tốc cá nhân v(u) | trung bình giờ hoàn thành / tuần, 4 tuần trượt | — | Trần khi ước tính "còn bao nhiêu tuần" |
| OnTime(u) | task DONE trước hoặc đúng `due_date` / task DONE, 8 tuần | — | |
| Reschedules(u) | số lần `due_date` bị lùi (từ `activity_logs.diff`), 4 tuần | — | |
| Rating(u) | trung bình `task_reviews.rating`, 8 tuần | — | Chỉ hiển thị cho chính người đó và PM dự án |
| CycleTime(u, d) | trung vị ngày từ IN_PROGRESS → DONE theo độ khó d | — | So với trung vị nhóm |
| Reopen(u) | số lần DONE → IN_PROGRESS, 8 tuần | — | |

Tất cả tính bằng cron chủ nhật vào `user_metrics_weekly (user_id, week_start, skill_category, ear, velocity_hours, on_time_rate, avg_rating, median_cycle_days, sample_size)`; `sample_size` đi kèm mọi số để LLM và giao diện biết độ tin cậy.

## 2b. Hồ sơ kỹ năng từ bằng chứng (thay mức tự khai — [02/08](../02-phan-tich/08-ho-so-ky-nang-tu-bang-chung.md))

```
Bằng chứng e = (u, s, m) cho mỗi việc ĐÃ XONG trong 26 tuần có yêu cầu kỹ năng s mức m, mỗi người làm u:
  trượt(e)  = mở lại ≥ 1  ∨  có bug gắn việc gốc  ∨  rating ≤ 2           (rating do người khác chấm; tự chấm bỏ qua)
  thểHiện(e)= m + 1 nếu rating ≥ 4 ∧ độ khó thực tế > m, ngược lại m      (kẹp 1–5)
  w(e)      = (rating có ? 1 : 0,5) × 1/số người làm;   PM xác nhận mức L = một bằng chứng đạt, w = 1, thểHiện = L
Mức(u, s)   = max L sao cho  Σ w(đạt, thểHiện ≥ L) ≥ 1  ∧  Σ w(đạt, ≥ L) > Σ w(trượt, ≥ L);   không có → 0
Độ tin cậy  = none (0 bằng chứng) · low (Σ w đạt < 2) · medium (< 4) · high
```

Mức tự khai (`user_skills.level` chưa xác nhận) **không** vào công thức; chỉ hiện để đối chiếu. Hàm thuần `metrics/domain/skill-evidence.ts`, nạp dữ liệu ở `SkillEvidenceService`.

## 3. Tải hiệu dụng và năng lực hiệu dụng

```
Diff(t)        = 1 + 0.10 × (difficulty(t) − 3)                         → 0.8 … 1.2     (difficulty 1–5, mặc định 3)
SkillGap(u, t) = 1.00 đủ mức yêu cầu · 1.15 thiếu 1 bậc · 1.30 thiếu ≥ 2 bậc hoặc không có kỹ năng
Switch(u)      = 1 + 0.05 × max(0, projects_open(u) − 1)                 (số dự án có task mở)
HoursEff(u, t) = remaining(t) × EAR(u, cat(t)) × Diff(t) × SkillGap(u, t)

EffLoad(u, w)  = Switch(u) × Σ_t HoursEff(u, t) × share(t, w)

MeetingHours(u, w) = Σ độ dài khoảng bận (calendar_events.is_busy) rơi trong giờ làm việc, gộp khoảng chồng nhau
TimeOff(u, w)      = Σ user_time_off trong w (LEAVE: cả ngày = base/5; PARTIAL: hours_per_day)
EffCap(u, w)       = Base(u) − MeetingHours(u, w) − TimeOff(u, w) − Admin × Base(u)
                     Base(u) = users.weekly_capacity_hours (mặc định settings.default_capacity = 40); Admin = 0.10

Utilization(u, w)  = EffLoad(u, w) / EffCap(u, w)         (EffCap ≤ 0 → Utilization = ∞, mức Quá tải)
Level              = < 0.70 Bình thường · 0.70–0.90 Cao · 0.90–1.10 Đầy · > 1.10 Quá tải
```

Ví dụ kiểm thử (đưa vào `workload.spec.ts`): Minh 32 giờ, EAR 0,9, Diff 1,0, 1 dự án, họp 3 h → EffLoad 28,8 / EffCap 33 = 87% Cao. Lan 32 giờ, EAR 1,4, Diff 1,1, 3 dự án, họp 11 h → EffLoad 54,2 / EffCap 25 = 217% Quá tải.

## 4. Điểm nguy cơ burnout

```
Burnout(u) = 35 × min(U_tuần_này / 1.2, 1)
           + 20 × min(số tuần liên tiếp U > 0.9 / 3, 1)
           + 15 × (việc quá hạn / việc mở)
           + 10 × min(max(0, EAR_4tuần − EAR_8tuần) × 2, 1)         — đang chậm dần so với chính mình
           + 10 × max(0, 1 − OnTime(u))
           + 10 × [check-in ≤ 2 hai tuần liên tiếp]                   — chỉ khi workspace bật và người dùng đồng ý
Nhãn: ≥ 70 Nguy cơ burnout · 50–69 Theo dõi · < 50 Bình thường
```

Mọi hạng tử được lưu riêng trong `workload_snapshots.risk_breakdown` (JSON) để giao diện giải thích "vì sao tôi bị gắn nhãn".

## 5. Giờ trống theo ngày (đầu vào chính cho LLM giao việc)

Cách làm theo `~/Table_Calendar/apps/api/src/smart-scheduler/smart-scheduler.service.ts#getAvailabilityContext`: liệt kê **khoảng bận**, vắng mặt nghĩa là rảnh; gộp khoảng trùng; sắp theo tên để phần văn bản ổn định cho cache.

```
PerDay(u)               = Base(u) / số ngày làm việc trong tuần              (8 h)
Busy(u, d)              = Σ khoảng bận trong giờ làm việc ngày d (gộp chồng)  từ calendar_events + user_time_off
Planned(u, d)           = Σ_t HoursEff(u, t) × shareDay(t, d)                  việc đã giao, phân bổ đều theo ngày làm việc
Free(u, d)              = max(0, PerDay(u) − Busy(u, d) − Planned(u, d))
FocusBlocks(u, d)       = số khối liên tục ≥ 2 h không bị khoảng bận cắt (trong 08:00–17:30 theo settings)
FreeBefore(u, due)      = Σ_{d ≤ due} Free(u, d)
```

Bảng gửi cho LLM (cửa sổ sprint hoặc 4 tuần, làm tròn 0,5 h):

```
NGƯỜI | Lan (PM) · kỹ năng React 4, NestJS 2 · U tuần này 1.05 · EAR NestJS 1.4 (n=6) · đúng hạn 0.62 · 3 dự án
  trống theo ngày: 14/10: 2.0 (họp 09:00-11:00, 14:00-16:00) · 15/10: 6.5 · 16/10: 0 (nghỉ) · 17/10: 5.0 · 20/10: 8.0 ...
  khối tập trung ≥2h: 15/10, 17/10, 20/10
```

## 6. Khớp kỹ năng từng cặp (sự thật, không xếp hạng)

```
SkillMatch(u, t) = với mỗi kỹ năng s yêu cầu ở mức m: level(u, s) / m  (kẹp 0–1)
                   level(u, s) = Mức(u, s) ở §2b; chưa có bằng chứng → ratio 0 nhưng đánh dấu `unproven`, không phải `missing`
                   trả về danh sách [{skill, required: m, level(u,s)}] và trung bình
```

LLM nhận danh sách này cho mọi cặp (u, t) chưa giao; giao diện hiển thị cạnh Combobox giao việc (UC-26). Không có trọng số kết hợp với tải hay lịch sử — LLM cân nhắc theo chính sách và yêu cầu hiện tại.

## 7. Kiểm tra khả thi một dòng đề xuất (Validator)

```
Đề xuất: (task t, người u, start, due)
Đạt khi:
  u ∈ project_members(t.project)                          → ASSIGN_NOT_MEMBER
  không có user_time_off phủ trọn [start, due]            → ASSIGN_ON_LEAVE
  kỹ năng theo bằng chứng (§2b), CHỈ CẢNH BÁO kèm số (từ 28/09 — PM quyết, dữ liệu thưa):
     chưa có bằng chứng                                   → ASSIGN_SKILL_UNPROVEN (cảnh báo)
     Mức(u,s) < m                                         → ASSIGN_SKILL_GAP (cảnh báo, kèm số việc / làm lại)
  FreeBefore(u, due) − FreeBefore(u, start − 1) ≥ HoursEff(u, t)   → ASSIGN_CAPACITY_EXCEEDED {free, need}
  start ≥ hôm nay; start ≤ due; due ≤ sprint.end_date (nếu vượt: WARN_DUE_AFTER_SPRINT)
  thêm cạnh phụ thuộc không tạo vòng                       → DEPENDENCY_CYCLE
  Utilization(u, tuần của due) sau khi nhận ≤ 1.10 hoặc PM đã bật "chấp nhận quá tải"   → ASSIGN_OVERLOAD
```

Validator trả về từng dòng `{taskId, ok, errors: [{code, ...số liệu}]}`; **không** thay `u`, `start`, `due`.

## 8. Burn-down và dự báo sprint

```
Scope(d)      = Σ estimate_hours của task trong sprint tại ngày d (snapshot 00:05)
Remaining(d)  = Σ remaining(t) tại ngày d
Completed(d)  = Scope(d) − Remaining(d) − Completed(d−1)     (giờ hoàn thành trong ngày)
Ideal(d)      = Scope_0 × (1 − workdays(start..d) / workdays(start..end))
Velocity      = mean(Completed theo ngày làm việc, 5 ngày gần nhất; nếu sprint < 5 ngày thì từ đầu sprint)
                Completed(d) lấy thẳng từ completed_at của việc gốc trong sprint (không chờ snapshot) — sửa 28/09
ETA           = today + ceil(Remaining / Velocity) ngày làm việc   (Velocity = 0 → không xác định)
Risk          = ETA ≤ end − 1 → Thấp · |ETA − end| ≤ 1 → Trung bình · ETA > end + 1 hoặc (Velocity = 0 và sprint ≥ 3 ngày) → Cao
Snapshot      = cron 00:05 + lúc bắt đầu + lúc kết thúc (trong transaction, TRƯỚC khi chuyển việc dở)
Sprint CLOSED = không ETA, không mức rủi ro; số cuối trả trong forecast.final
ScopeCreep    = Scope(d) > 1.10 × Scope_0
Causes        = [task quá hạn, task chưa giao, người Quá tải, task bị chặn, task > 16 h chưa bắt đầu]   (đếm và liệt kê mã)
```

## 9. Chỉ số công bằng (báo cáo, không ép)

```
Spread(phương án)   = max_u Utilization(u) − median_u Utilization(u)      mục tiêu tham chiếu ≤ 0.20 (settings.fairness_target)
Gini(phương án)     = tuỳ chọn, hiển thị trong báo cáo sprint
```

Backend tính Spread trước/sau cho mọi đề xuất của LLM và cho thao tác tay; đưa vào thẻ xem trước và vào `ai_feedback`. LLM có thể tự nêu ước tính công bằng của nó — hai số này đặt cạnh nhau, số của backend là sự thật.

## 10. Bộ kiểm thử tối thiểu (Jest, hàm thuần)

| File | Ca |
|---|---|
| `workload/share.spec.ts` | task trong 1 tuần; cắt 2 tuần; quá hạn dồn tuần này; không ngày bắt đầu; ngày lễ |
| `workload/eff-load.spec.ts` | EAR 1,0 mặc định; EAR làm mượt với 1 task; Diff 1–5; SkillGap 3 mức; 1/2/3 dự án |
| `workload/eff-cap.spec.ts` | họp chồng nhau gộp; nghỉ cả ngày; nghỉ nửa ngày; EffCap ≤ 0 |
| `workload/burnout.spec.ts` | từng hạng tử; nhãn biên 49/50/69/70 |
| `workload/free-hours.spec.ts` | trống theo ngày với họp + việc đã giao; khối tập trung; FreeBefore |
| `ai/validator.spec.ts` | 7 mã lỗi ở mục 7; không bao giờ đổi userId/start/due trong kết quả |
| `forecast/burndown.spec.ts` | lý tưởng; vận tốc 5 ngày; ETA; 3 mức rủi ro; scope creep; sprint < 3 ngày |
| `metrics/ear.spec.ts` | Bayes k=20; tách nhóm ≥ 5 mẫu; nguồn CYCLE_TIME |
