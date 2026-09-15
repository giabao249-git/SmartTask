# Phase 0 + 1 — Khung dự án, Prisma, xác thực & tài khoản

Nhánh `feature/be-p0-skeleton`. Ngày 15/09/2026.

## Đã làm

### Phase 0 — khung
- Monorepo npm workspaces: `apps/api` (`@smarttask/api`), `packages/shared` (`@smarttask/shared`: mã lỗi + thông điệp tiếng Việt). Script gốc: `api:dev`, `api:test`, `api:test:e2e`, `db:migrate`, `db:deploy`, `db:seed`, `shared:build` (tự chạy ở `prepare`).
- NestJS 11 (`nest new --strict`), TypeScript strict, ESLint type-checked + Prettier; rule `no-unsafe-*` tắt cho test.
- Prisma 6: `schema.prisma` lõi 28 model (users … user_time_off) theo [08](../04-kien-truc/08-mo-hinh-du-lieu.md); migration `init_core` gồm SQL tay: extension (`pgcrypto, citext, pg_trgm, btree_gist`), partial unique index (một sprint ACTIVE, một PM), CHECK khoảng giá trị, EXCLUDE nghỉ chồng nhau, index trgm. Migration tự thêm `public` vào `search_path` để chạy được trên schema khác (e2e, Supabase).
- `ConfigModule` + zod: thiếu biến bắt buộc → không khởi động. `PrismaModule` global. `HttpExceptionFilter`: mọi lỗi ra `{ code, message, details? }`; ánh xạ 400/401/403/404/429 và Prisma P2002/P2025/P2003. `AppError` cho service ném lỗi có mã.
- `main.ts`: prefix `/api/v1`, helmet, cookie-parser, CORS có credentials, `ValidationPipe(whitelist, forbidNonWhitelisted, transform)`, Swagger `/docs` + `/docs-json`, throttler 100 req/phút.
- `GET /health`, `GET /health/ready` (SELECT 1).
- CI: job `api` với Postgres service — lint (0 warning), tsc, prisma validate, unit, migrate deploy, e2e, build.

### Phase 1 — auth & tài khoản (UC-01, 02, 03)
| Endpoint | Ghi chú |
|---|---|
| `POST /auth/register` | bcrypt cost 12; email chuẩn hoá lowercase; trùng → 409 `EMAIL_TAKEN` |
| `POST /auth/login` | 10 lần/phút/IP; so sánh bcrypt cả khi không có user (không lộ email tồn tại); `ACCOUNT_LOCKED` |
| `POST /auth/refresh` | cookie `rt` httpOnly, path `/api/v1/auth`; **xoay vòng**: token cũ thu hồi; dùng lại token đã thu hồi → thu hồi toàn bộ phiên của user |
| `POST /auth/logout` | thu hồi + xoá cookie |
| `GET /me` | hồ sơ + workspaces kèm vai trò |
| `PATCH /me`, `PATCH /me/password` (thu hồi mọi phiên), `PUT /me/notification-prefs` | |

Guard `JwtAuthGuard` toàn cục, `@Public()` cho route mở; `@CurrentUser()` lấy `{ id, email }` từ token — không truy vấn DB mỗi request.

## Kiểm thử
- Unit (`auth.service.spec.ts`, 7 ca): trùng email, băm mật khẩu & lưu hash refresh, sai mật khẩu, tài khoản khoá, dùng lại token đã thu hồi, xoay vòng, token sai.
- E2E (`test/auth.e2e-spec.ts`, 10 ca) trên schema `smarttask_test` được xoá và migrate lại mỗi lần chạy: health → register (cookie HttpOnly) → 409 hoa/thường → 400 có `details.fields` → 401 → /me → login sai → refresh xoay vòng + phát hiện dùng lại → đổi hồ sơ/mật khẩu → logout.

## Cách thử tay
```bash
make db-up && npm run db:deploy && npm run db:seed      # 3 tài khoản demo, mật khẩu Demo@1234
npm run api:dev                                          # http://localhost:3000/docs
curl -c cj.txt -H 'Content-Type: application/json' -d '{"email":"lan@smarttask.local","password":"Demo@1234"}' http://localhost:3000/api/v1/auth/login
```

## Quyết định trong lúc làm
- Email lưu `citext` nhưng Prisma `findUnique` so sánh phân biệt hoa thường (tham số bị ép về `text`) → **luôn chuẩn hoá lowercase ở DTO**; unique index citext là tuyến phòng thủ cuối (P2002 → 409).
- Không dùng `@prisma/adapter-pg` ở phase này (engine mặc định đủ; pooler Supabase dùng `pgbouncer=true`).
- `prisma migrate` thay cho `db push` + SQL tay của Table_Calendar: SQL tay nằm ngay trong file migration nên deploy lên Supabase (`migrate deploy`) không mất ràng buộc.
- Dev DB cục bộ đã được tạo lại một lần khi sửa migration ban đầu (dữ liệu thử của phiên này).

## Việc còn lại của phase (làm ở phase sau)
- `prisma.config.ts` thay `package.json#prisma` (Prisma 7).
- Log có cấu trúc (pino) — Phase 10.
