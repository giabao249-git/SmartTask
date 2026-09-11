# Quy tắc Git của nhóm SmartTask

Mục tiêu: commit log là **bằng chứng đóng góp cá nhân** (10% chuyên cần và % đóng góp cuối kỳ), đồng thời giữ `main` luôn chạy được để demo bất cứ lúc nào.

## Nhánh

| Nhánh | Mục đích | Ai được ghi |
|---|---|---|
| `main` | Bản ổn định, luôn deploy được; gắn tag mỗi cột mốc (`w03-de-cuong`, `w06-thiet-ke`, `w08-mvp`, `v1.0.0`) | Chỉ merge qua Pull Request đã review |
| `develop` | Tích hợp hằng tuần; demo nội bộ cuối tuần | Merge từ nhánh feature qua PR |
| `feature/UC-12-kanban` | Một use case hoặc một tài liệu; tên = `feature/<mã UC>-<mô tả ngắn>` | Người được phân công trong WBS |
| `docs/w04-bfd` | Tài liệu theo tuần (`docs/<tuần>-<nội dung>`) | Người được phân công |
| `hotfix/<mô tả>` | Sửa lỗi khẩn trên `main` sau Tuần 9 | Nhóm trưởng duyệt |

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
