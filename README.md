# SmartTask — Nền tảng Quản trị Dự án Thông minh & Cân bằng Tải Nhân sự tích hợp AI Agent

> Đồ án Chuyên ngành (841476, 04 tín chỉ) · Khoa CNTT · Trường ĐH Sài Gòn
> GVHD: ThS. Trần Đình Nghĩa · Khởi động 11/09/2026 · Nộp 11h30 23/11/2026 · Bảo vệ 27/11/2026

**Đề tài 01 — Smart Task & Workload Management Platform with AI Agent.**
Ứng dụng web quản trị dự án Agile/Kanban thời gian thực; AI phân rã yêu cầu thành công việc
kèm ước lượng; tự tính khối lượng công việc theo ma trận kỹ năng và cảnh báo quá tải.

## Trạng thái theo lộ trình 12 tuần

| Tuần | Thời gian | Nội dung | Trạng thái |
|---|---|---|---|
| 01 | 11/09 – 17/09 | Khởi tạo repo, thảo luận phạm vi, nháp đề cương Mục 1–5 | ✅ hoàn thành |
| 02 | 18/09 – 24/09 | Đề cương 10 mục, WBS gán tên, môi trường phát triển | ✅ hoàn thành (chờ điền tên thành viên) |
| 03 | 25/09 – 01/10 | Chấm duyệt đề cương (40% quá trình) | ⏳ chờ GVHD |
| 04 | 02/10 – 08/10 | Khảo sát hiện trạng, BFD/BPMN, FR/NFR | ⬜ |
| 05 | 09/10 – 15/10 | Use Case, đặc tả UC, Sequence | ⬜ |
| 06 | 16/10 – 22/10 | ERD 3NF, API Specs, Wireframe | ⬜ |
| 07 | 23/10 – 29/10 | Core Backend (NestJS, JWT, RBAC, CSDL) | 🔄 bắt đầu sớm 15/09 — Phase 0–3 xong (khung, Prisma, auth, workspace & kỹ năng, dự án/sprint/task); xem [docs/05-hien-thuc](docs/05-hien-thuc/00-ke-hoach-backend.md) |
| 08 | 30/10 – 05/11 | Frontend (Next.js), Realtime, Demo MVP | ⬜ |
| 09–12 | 06/11 – 27/11 | Đóng băng, test, deploy, báo cáo, bảo vệ | ⬜ |

## Cấu trúc thư mục

```
SmartTask/
├── docs/
│   ├── 00-quy-che/        # lộ trình 12 tuần, quy tắc Git, tiêu chí chấm
│   ├── 01-de-cuong/       # đề cương chi tiết, phạm vi, WBS, danh sách nhóm
│   ├── 02-phan-tich/      # (Tuần 4–5) hiện trạng, BFD/BPMN, FR/NFR, Use Case, Sequence
│   ├── 03-thiet-ke/       # (Tuần 6) ERD, API Specs, wireframe
│   ├── 04-kien-truc/      # kiến trúc, module, UC, công thức, AI agent, trí nhớ, cache & chi phí, dữ liệu
│   └── 09-bien-ban/       # biên bản họp nhóm, biên bản làm việc với GVHD
├── infra/                 # docker-compose PostgreSQL cục bộ
├── apps/api/              # NestJS 11 + Prisma 6 (Phase 0–1 xong) · apps/web Next.js (Tuần 8)
└── packages/shared/       # mã lỗi, kiểu dữ liệu, zod schema dùng chung
```

## Bắt đầu nhanh (môi trường phát triển — Tuần 02)

```bash
# 1. Node 22 (dùng nvm)
nvm use

# 2. CSDL PostgreSQL cục bộ
cp .env.example .env
make db-up          # PostgreSQL 16 tại localhost:5434 (5432/5433 đã có dự án khác dùng)
make db-psql        # vào psql kiểm tra; make db-ui mở Adminer tại :8080

# 3. API
npm install                 # cài toàn bộ workspace, tự build packages/shared
npm run db:deploy           # áp migration
npm run db:seed             # 3 tài khoản demo (mật khẩu Demo@1234)
npm run api:dev             # http://localhost:3000/docs

# 4. Kiểm thử
npm run api:test            # unit
npm run api:test:e2e        # e2e trên schema smarttask_test (tự tạo lại)

# 5. Nhánh làm việc
git switch develop
git switch -c feature/be-p2-workspaces
```

Quy tắc nhánh, commit và PR: [docs/00-quy-che/quy-tac-git.md](docs/00-quy-che/quy-tac-git.md).

## Tài liệu chính

- Lộ trình & quy chế học phần: [docs/00-quy-che/lo-trinh-12-tuan.md](docs/00-quy-che/lo-trinh-12-tuan.md)
- Đề cương chi tiết (10 mục): [docs/01-de-cuong/de-cuong-chi-tiet.md](docs/01-de-cuong/de-cuong-chi-tiet.md)
- Phạm vi đề tài (MoSCoW): [docs/01-de-cuong/pham-vi-de-tai.md](docs/01-de-cuong/pham-vi-de-tai.md)
- WBS 12 tuần gán tên: [docs/01-de-cuong/wbs-12-tuan.md](docs/01-de-cuong/wbs-12-tuan.md)
- Danh sách nhóm & % đóng góp: [docs/01-de-cuong/danh-sach-nhom.md](docs/01-de-cuong/danh-sach-nhom.md)
- Bộ tài liệu kiến trúc & AI: [docs/04-kien-truc/README.md](docs/04-kien-truc/README.md) · danh mục công nghệ: [09-cong-nghe.md](docs/04-kien-truc/09-cong-nghe.md) — nguyên tắc **LLM suy luận, backend chỉ tính, backend không quyết định**

## Công nghệ (theo đề bài, gói miễn phí)

Frontend Next.js 15 (App Router, TypeScript) + shadcn/ui · Backend NestJS 11 + Prisma 6 ·
PostgreSQL trên Supabase · Realtime Socket.io · AI Gemini Flash (structured output) ·
Triển khai Vercel + Render · CI GitHub Actions.
