# Phase 5 — Tải, năng lực, burnout, giờ trống, burn-down, dự báo

Nhánh `feature/be-p5-workload`. 15/09/2026. Công thức theo [04](../04-kien-truc/04-cong-thuc-tinh-toan.md); endpoint theo [11 §3.5, 3.9](../04-kien-truc/11-chot-chuc-nang-va-api.md).

## Hàm thuần (không đụng DB, có test)
| File | Nội dung |
|---|---|
| `workload/domain/calendar.ts` | ngày làm việc theo settings (workdays, holidays), tuần bắt đầu thứ Hai, đếm ngày làm việc |
| `workload/domain/allocation.ts` | `remainingOf`, cửa sổ hiệu dụng (không ngày bắt đầu → max(tạo, hôm nay); không hạn → sprint end hoặc +5 ngày làm việc), `shareInWeek` (quá hạn dồn tuần này; chỉ phân bổ từ hôm nay), `shareInDay` |
| `workload/domain/factors.ts` | EAR Bayes (k=20), hệ số độ khó 0.8–1.2, thiếu kỹ năng 1.15/1.30, phạt chuyển dự án, `hoursEff` |
| `workload/domain/capacity.ts` | giờ họp gộp chồng và cắt theo giờ làm việc, khối tập trung ≥ 2 h, nghỉ cả ngày/nửa ngày, `weekCapacity` (Base − họp − nghỉ − 10%), `freeHoursOnDay` |
| `workload/domain/utilization.ts` | mức sử dụng (EffCap ≤ 0 → ∞), mức theo ngưỡng 70/90/110, `spreadOf` |
| `workload/domain/burnout.ts` | 6 hạng tử có breakdown, nhãn ≥ 70 / 50–69 |
| `workload/domain/skill-match.ts` | khớp kỹ năng từng cặp (tỷ lệ, thiếu) — sự thật, không xếp hạng |
| `forecast/domain/burndown.ts` | đường lý tưởng theo ngày làm việc, vận tốc 5 ngày, ETA, mức rủi ro, scope creep |

34 ca unit (`workload.spec.ts`, `burndown.spec.ts`) — gồm ví dụ Minh/Lan trong tài liệu (28.8 và 54.2 giờ hiệu dụng).

## Service & endpoint
| | |
|---|---|
| `MetricsService` | EAR (giờ thực tế từ `task_reviews` → `time_entries` → cycle time × 8 h × 0.6), EAR theo nhóm kỹ năng (≥ 5 mẫu), 4 tuần vs 8 tuần, vận tốc, đúng hạn, rating, cycle time trung vị, số tuần liên tiếp > 90% từ snapshot; cron chủ nhật 23:30 vật chất hoá `user_metrics_weekly` |
| `WorkloadService.computeUsers` | tải theo người × tuần với `tasks[]` cấu thành (share, giờ hiệu dụng, hệ số), năng lực hiệu dụng (họp từ `calendar_events`, nghỉ từ `user_time_off`), mức, burnout (tuần hiện tại), Spread |
| `snapshotWorkspace` | upsert `workload_snapshots` 4 tuần; cảnh báo OVERLOAD/BURNOUT tuần hiện tại, một dòng mỗi (ws, người, tuần, loại), thông báo lại sớm nhất sau 24 h; phát `workload.updated`, `workload.alert` |
| `WorkloadListener` | nghe `task.*`, `project.member.removed`, `sprint.closed` → tính lại gộp 500 ms; cron 07:00 quét mọi workspace |
| `GET /workspaces/:wsId/workload` (ADMIN), `GET /projects/:id/workload`, `GET /users/:id/workload/details?week=&workspaceId=`, `GET …/workload/alerts`, `POST /workload/alerts/:id/ack`, `POST /projects/:id/workload/recompute` | chi tiết task cấu thành chỉ lộ task của dự án đang xem hoặc của chính mình |
| `GET /projects/:id/capacity-table?sprintId=&taskIds=` | **bảng sự thật** cho giao việc: mỗi thành viên (kỹ năng, U trước, EAR, giờ trống theo ngày, khối tập trung) × mỗi task chưa giao (giờ hiệu dụng theo người, khớp kỹ năng, giờ trống trước hạn). Không có cột "người tốt nhất" — e2e kiểm không tồn tại |
| `ForecastService` | snapshot burn-down (cron 00:05 chốt hôm qua; điểm live hôm nay khi xem), `GET /sprints/:id/burndown`, `GET /sprints/:id/forecast` (ETA, rủi ro, nguyên nhân: quá hạn, chưa giao, người quá tải, bị chặn, việc > 16 h chưa bắt đầu, scope creep); phát `forecast.risk.changed` khi mức tăng |
| Dashboard | thêm `workloadWeek` (snapshot tuần này của thành viên), `openAlerts`, `burndownMini` |
| Thông báo | `workload.alert` → WORKLOAD_ALERT cho người đó và PM các dự án liên quan |

## Kiểm thử
E2E `workload.e2e-spec.ts` (5 ca; tổng 39): Lan 32 h/3 dự án/khó 4/11 h họp/nghỉ nửa ngày → EffCap 21, EffLoad 38.7, **OVERLOAD**; Minh 32 h/1 dự án/3 h họp → EffCap 33, FULL; Spread > 0.5 → chi tiết tuần + giờ trống 7 ngày (thứ Bảy = 0) → recompute → snapshot + cảnh báo + thông báo Lan & PM → ack (MEMBER 403) → dashboard/capacity-table (MEMBER 403, không có xếp hạng) → sprint: scope 50, lý tưởng về 0, forecast UNKNOWN khi < 3 ngày, nguyên nhân UNASSIGNED/OVERLOADED_MEMBER/BIG_NOT_STARTED.

## Để lại
- `time_entries`, `task_reviews` chưa có API (Phase 8) — EAR hiện chủ yếu từ cycle time.
- Hạng tử check-in trong burnout luôn 0 (UC-41 không làm).
- `forecast/explain` (AI) — Phase 7.
