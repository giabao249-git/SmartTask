# Quy tắc Git của nhóm SmartTask

Mục tiêu: commit log là **bằng chứng đóng góp cá nhân** (10% chuyên cần và % đóng góp cuối kỳ), đồng thời giữ `main` luôn chạy được để demo bất cứ lúc nào.

## Nhánh

| Nhánh | Mục đích | Ai được ghi |
|---|---|---|
| `main` | Bản ổn định, luôn deploy được; gắn tag mỗi cột mốc (`w03-de-cuong`, `w06-thiet-ke`, `w08-mvp`, `v1.0.0`) | Chỉ merge qua Pull Request đã review |
| `develop` | Tích hợp hằng tuần; demo nội bộ cuối tuần | Merge từ nhánh feature qua PR |
| `sprint_vN` (vd. `sprint_v0`) | Nhánh tích hợp **một sprint**: tách từ `main`, mọi nhánh feature của sprint gộp vào bằng `merge --no-ff`; cuối sprint mở PR `sprint_vN` → `main` | Nhóm trưởng gộp |
| `feature/UC-12-kanban` | Một use case / một mục; tên = `feature/<mã UC>-<mô tả ngắn>`, tách từ nhánh sprint đang chạy | Người được phân công trong WBS |
| `chore/<mô tả>` | Tài liệu, cấu hình, CI không gắn một UC (vd. `chore/sprint-v0-tai-lieu`) | Người được phân công |
| `bugfix/<mô tả>` · `release/<phiên bản>` | Sửa lỗi thường · chuẩn bị phát hành | Nhóm trưởng duyệt |
| `hotfix/<mô tả>` | Sửa lỗi khẩn trên `main` sau Tuần 9 | Nhóm trưởng duyệt |

**Tên nhánh được GitHub Actions kiểm** (`.github/workflows/main.yml`, chạy khi push mọi nhánh trừ `main`): phải khớp
`^(sprint_v[0-9]+|sprint/.+|feature/.+|chore/.+|bugfix/.+|release/.+|hotfix/.+)$`. Nhánh `docs/…` cũ (vd. `docs/w04-bfd`) **không còn hợp lệ** — tài liệu theo tuần dùng `chore/docs-<tuần>-<nội dung>`.

Quy trình một sprint (áp dụng từ `sprint_v0`, 28/09/2026):

```bash
git switch -c sprint_v0 main                       # mở sprint
git switch -c feature/UC-09-trang-sprint sprint_v0  # mỗi mục một nhánh
# ... commit (mỗi mục một commit, xem mục Commit) ...
git switch sprint_v0 && git merge --no-ff feature/UC-09-trang-sprint
git push -u origin sprint_v0                        # cuối ngày / cuối đợt
# cuối sprint: PR sprint_v0 → main, CI xanh + 1 review
```

Không commit thẳng vào `main`/`develop`. Bật branch protection trên GitHub cho `main`: yêu cầu 1 review, cấm force-push.

## Commit — Conventional Commits, tiếng Việt cho phần mô tả

```
<loại>(<phạm vi>): <mô tả ngắn, ≤ 72 ký tự, không dấu chấm cuối>

[nội dung chi tiết nếu cần]
[UC-12] [Tuần 07]
```

Loại: `feat` (tính năng), `fix` (sửa lỗi), `docs` (tài liệu), `design` (sơ đồ, mockup), `chore` (cấu hình, phụ thuộc), `test`, `refactor`, `ci`.

Ví dụ:
- `docs(de-cuong): hoàn thiện mục 6–10 và WBS gán tên [Tuần 02]`
- `feat(tasks): endpoint move có kiểm tra version [UC-12] [Tuần 07]`
- `design(erd): chuẩn hoá 3NF bảng tasks, task_assignees [Tuần 06]`

Mỗi thành viên commit bằng **tài khoản Git của chính mình** (`git config user.name` đúng họ tên trong danh sách nhóm) — GVHD đối chiếu commit log với WBS.

## Pull Request

- Một PR = một use case hoặc một tài liệu; nhỏ (< 400 dòng thay đổi) để review trong 15 phút.
- Điền đủ template `.github/PULL_REQUEST_TEMPLATE.md`: phạm vi, UC/tuần liên quan, cách kiểm tra, ảnh/video nếu có giao diện.
- Ít nhất **1 người khác** approve trước khi merge; nhóm trưởng merge vào `main`.
- Không merge khi CI đỏ.

## Nhịp làm việc

- Thứ Hai: họp 15' lập kế hoạch tuần, cập nhật WBS (ai làm gì, hạn).
- Hằng ngày: commit ít nhất một lần khi có việc; push cuối ngày.
- Thứ Sáu: merge `develop` → demo nội bộ 15' → ghi biên bản vào `docs/09-bien-ban/` → gửi tiến độ cho GVHD.

## Bí mật & dữ liệu

- Không commit `.env`, khoá API, dump CSDL có dữ liệu thật. `.env.example` chỉ chứa tên biến và giá trị mẫu.
- Bật GitHub secret scanning; nếu lỡ lộ khoá: xoay khoá ngay, không chỉ xoá commit.
