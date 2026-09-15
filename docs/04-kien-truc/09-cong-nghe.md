# 09 · Danh mục công nghệ sử dụng

Tiêu chí chọn: (1) đúng gợi ý "miễn phí" của đề bài và lộ trình học phần (Next.js, NestJS, PostgreSQL/Supabase, Socket.io, Gemini, Vercel + Render); (2) trưởng thành, tài liệu chính thức tốt, giấy phép mở; (3) nhóm đã có kinh nghiệm từ Table_Calendar (NestJS 11, Prisma 6, Socket.io, Zustand, Recharts, Jest/Vitest/Playwright); (4) mỗi lớp chỉ một lựa chọn — không cài hai thư viện cùng vai trò.

Phiên bản ghi là **major khoá trong `package.json`**; bản vá cụ thể lấy bản mới nhất tại thời điểm khởi tạo mã nguồn (Tuần 07) và ghi vào `package-lock.json`. Node và npm khoá bằng `.nvmrc` (Node 22 LTS) và `engines`.

## 1. Frontend — `apps/web`

| Công nghệ | Phiên bản | Vai trò | Lý do · ghi chú | Thay thế đã cân nhắc |
|---|---|---|---|---|
| Next.js | 15 (App Router) | Khung ứng dụng web, SSR trang đầu, route group theo workspace/dự án, proxy `/api` | Đề bài yêu cầu; không dùng Server Actions để ghi dữ liệu | Vite + React Router |
| React | 19 | Thư viện giao diện | Đi kèm Next 15 | — |
| TypeScript | 5.x, `strict` | Ngôn ngữ | Kiểu dùng chung với API qua `packages/shared` | — |
| Tailwind CSS | 4 | Tiện ích CSS, token màu trong `globals.css` | Nền của shadcn/ui | CSS Modules |
| shadcn/ui (Radix UI) | CLI mới nhất | Bộ component sao chép vào `components/ui/` | Đã chốt; accessibility sẵn; sửa tự do | MUI, Ant Design, Mantine |
| next-themes | 0.4 | Sáng/tối theo hệ thống | shadcn khuyến nghị | — |
| lucide-react | mới nhất | Biểu tượng | Mặc định của shadcn; Table_Calendar cũng dùng | — |
| @tanstack/react-query | 5 | Cache và đồng bộ dữ liệu server, optimistic update | Socket chỉ `setQueryData`/`invalidate` | SWR |
| zustand | 5 | Trạng thái giao diện (bộ lọc, chế độ xem, presence) | Không giữ task | Redux Toolkit |
| @dnd-kit/core, /sortable, /modifiers | mới nhất | Kéo thả Kanban, Eisenhower | Bàn phím, không phụ thuộc DOM | react-beautiful-dnd (ngừng phát triển), pragmatic-drag-and-drop |
| @tanstack/react-table | 8 | Danh sách task (DataTable pattern của shadcn) | Sắp xếp, lọc, phân trang | — |
| recharts | 3 (qua shadcn Charts) | Biểu đồ tải, burn-down, dashboard | shadcn Charts bọc sẵn theme | Chart.js |
| react-hook-form + @hookform/resolvers | 7 | Form | Ghép shadcn `Form` | Formik |
| zod | 4 | Xác thực form và schema dùng chung với API/AI | Một nguồn schema | yup |
| socket.io-client | 4 | Realtime | Khớp gateway NestJS | — |
| date-fns | 4 | Ngày giờ, múi giờ VN | Nhẹ, tree-shake | dayjs |
| react-markdown + remark-gfm + rehype-sanitize | mới nhất | Mô tả task, bình luận có @mention | Sanitize chống XSS | — |
| Gantt | tự vẽ SVG/div (chỉ đọc) | Biểu đồ Gantt | Đủ cho Must; `frappe-gantt` nếu làm kéo giãn (Should) | gantt-task-react |
| Service Worker (`public/sw.js`) | — | Nhận Web Push | Không cần thư viện | — |

## 2. Backend — `apps/api`

| Công nghệ | Phiên bản | Vai trò | Lý do · ghi chú | Thay thế |
|---|---|---|---|---|
| Node.js | 22 LTS | Runtime | `.nvmrc`; Render hỗ trợ | Bun |
| NestJS (`@nestjs/core, common, platform-express`) | 11 | Khung API, DI, module, guard, pipe | Nhóm đã dùng; Swagger tự sinh | Express thuần, Fastify |
| @nestjs/swagger + swagger-ui-express | 8+ | OpenAPI 3 tự sinh từ DTO — giao phẩm Tuần 06 | `GET /docs` | — |
| Prisma (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`) | 6 | ORM, migrate, seed | Cùng dòng Table_Calendar; SQL tay cho partial index/EXCLUDE | Drizzle, TypeORM |
| class-validator + class-transformer | mới nhất | DTO, `ValidationPipe({ whitelist, forbidNonWhitelisted })` | Chuẩn NestJS | zod pipe |
| @nestjs/passport + passport-jwt + @nestjs/jwt | mới nhất | Xác thực JWT access/refresh | Refresh trong cookie httpOnly | Supabase Auth |
| bcrypt | 5 | Băm mật khẩu (cost 12) | — | argon2 |
| @nestjs/websockets + @nestjs/platform-socket.io + socket.io | 11 / 4 | Gateway realtime, phòng theo dự án | Một instance, không cần adapter Redis | Supabase Realtime, SignalR |
| @nestjs/event-emitter (EventEmitter2) | 3 | Sự kiện nội bộ `task.updated` → listener | Tách service khỏi socket/push/log | BullMQ |
| @nestjs/schedule | 5 | Cron: snapshot 00:05, quét tải 07:00, đồng bộ lịch 30', chỉ số tuần | Không cần Redis | BullMQ + Redis |
| @nestjs/throttler | 6 | Giới hạn tần suất (login, AI) | — | — |
| @nestjs/config + zod | — | Biến môi trường có kiểm tra khi khởi động | Thiếu biến → không chạy | joi |
| helmet, cookie-parser, cors | mới nhất | Bảo mật HTTP | — | — |
| @google/genai | 1.x | Gọi Gemini API, `responseSchema`, `cachedContents` | SDK chính thức mới (thay `@google/generative-ai`) | REST thuần |
| ollama (npm) hoặc REST `http://localhost:11434` | — | LLM cục bộ khi dev/offline (`qwen2.5:7b`) | Cùng interface `AiProvider` | LM Studio |
| zod-to-json-schema | mới nhất | Sinh `responseSchema` từ zod dùng chung | Một nguồn schema | viết tay |
| web-push | 3 | Gửi Web Push (VAPID) | Chuẩn W3C | Firebase Cloud Messaging |
| @supabase/supabase-js | 2 | Ký URL upload/tải Storage (service role, chỉ ở server) | Không dùng cho Auth/DB | S3 SDK + MinIO |
| ical.js hoặc node-ical | mới nhất | Parse ICS lịch bận | UC-37 | — |
| pino + nestjs-pino | mới nhất | Log có cấu trúc, ẩn token | Render đọc stdout | winston |
| @elastic/elasticsearch + Elasticsearch 8 (Docker) | 8.x | Gợi ý @mention kiểu elastic (bỏ dấu, edge_ngram, fuzziness) | Quyết định 15/09; **tự rơi về pg_trgm** khi không có `ELASTICSEARCH_URL` (Render/Supabase free không chạy ES) | pg_trgm + unaccent (luôn có) |
| crypto (Node) AES-256-GCM | — | Mã hoá khoá API AI trong DB (`APP_KEY`) | Không thêm thư viện | — |

## 3. Cơ sở dữ liệu & lưu trữ

| Công nghệ | Phiên bản | Vai trò | Ghi chú |
|---|---|---|---|
| PostgreSQL | 16 | CSDL chính | Cục bộ: Docker `postgres:16-alpine` cổng 5434; Cloud: Supabase |
| Extension `pgcrypto`, `citext`, `pg_trgm`, `btree_gist` | — | UUID, email không phân biệt hoa thường, tìm mờ, EXCLUDE khoảng ngày | `infra/init/01-extensions.sql` |
| Supabase (Postgres + PgBouncer + Storage) | Free | Host DB và tệp đính kèm | `DATABASE_URL` pooler 6543 + `DIRECT_URL` 5432; dự án tạm dừng sau 7 ngày không hoạt động → cron ping |
| Adminer | 4 | Xem DB cục bộ (`make db-ui`) | Tuỳ chọn |

## 4. AI

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Model chính (demo) | Gemini 2.5 Flash (`gemini-2.5-flash`) | Đề bài ghi 1.5 Flash đã ngừng; free tier ~10–15 RPM; `flash-lite` cho mục đích EXPLAIN |
| Model dự phòng / dev | Ollama `qwen2.5:7b` (hoặc `llama3.1:8b`) | Chạy trên laptop, JSON mode |
| Structured output | `responseSchema` (Gemini) / `format: json` (Ollama) + zod | Không parse văn bản thô |
| Cache prompt | `cachedContents` (Gemini) theo `cache_mode` trong catalog | Mặc định tắt; xem 07 |
| Đánh giá | Bộ hồi quy 20 kịch bản JSON, script Node | Trước khi đổi prompt |

## 5. Hạ tầng, triển khai, DevOps

| Công nghệ | Vai trò | Ghi chú |
|---|---|---|
| Vercel (Hobby) | Frontend, HTTPS, preview mỗi PR | Cần HTTPS cho Web Push |
| Render (Free web service) | NestJS API + Socket.io | Ngủ sau 15'; UptimeRobot ping `/api/health` 10'; Railway là phương án B |
| Supabase (Free) | DB + Storage | Xem mục 3 |
| Docker + Docker Compose | Postgres cục bộ; đóng gói API/Web ở Tuần 09 (`Dockerfile` đa giai đoạn) | Yêu cầu Tuần 09 của lộ trình |
| GitHub + GitHub Actions | Repo, PR review, CI: lint → type-check → `prisma validate` → test → build; deploy hook Render; branch protection `main` | `.github/workflows/ci.yml` |
| UptimeRobot / cron-job.org | Đánh thức Render, ping Supabase | Miễn phí |
| GitHub Secrets · Vercel/Render env | Bí mật | `.env.example` không có giá trị thật |
| Sentry (Free, tuỳ chọn) | Bắt lỗi runtime web + API | Cân nhắc Tuần 10; không bắt buộc |

## 6. Kiểm thử & chất lượng

| Công nghệ | Vai trò | Phạm vi |
|---|---|---|
| Jest 30 + ts-jest | Test đơn vị API: workload, forecast, EAR, validator AI, vị trí thẻ | ≥ 80% cho module thuật toán |
| Supertest | Test tích hợp API với DB test (Docker) | auth, quyền, task, move 409, apply AI |
| Vitest + React Testing Library | Test component web | TaskCard, WorkloadBar, form |
| Playwright | E2E một luồng vàng | đăng nhập → tạo dự án → AI phân rã → kéo thẻ → cảnh báo tải |
| k6 | Tải: 20 VU đọc/ghi, 2 phút | p95 API |
| Script `socket-loadtest.mjs` (socket.io-client) | 20 client, 200 lần kéo, kiểm thứ tự | Theo `~/Table_Calendar/scripts/socket-loadtest.mjs` |
| ESLint 9 (flat config) + Prettier 3 + Husky + lint-staged | Chuẩn mã, pre-commit | Cả monorepo |
| markdownlint-cli2 | Tài liệu | CI (không chặn) |
| axe DevTools | Truy cập (tương phản, bàn phím) | Kiểm tay Tuần 09 |
| openapi-typescript | Sinh kiểu TS từ Swagger cho web | `packages/shared/types` |

## 7. Công cụ thiết kế & tài liệu

| Công cụ | Dùng cho |
|---|---|
| Mermaid (trong Markdown; mermaid.live để xuất ảnh) | BFD, Use Case, Sequence, ERD, kiến trúc |
| draw.io / diagrams.net | BPMN AS-IS/TO-BE (Tuần 04) |
| Figma (Free) | Wireframe 8 màn hình (Tuần 06) |
| Swagger UI (`/docs`) + Postman | Đặc tả và thử API |
| prisma-erd-generator | ERD từ `schema.prisma` cho quyển báo cáo |
| VS Code + extension (ESLint, Prettier, Prisma, Tailwind, Mermaid, GitLens) | `.vscode/extensions.json` |
| Word/LibreOffice theo mẫu Khoa (TNR 13) | Đề cương, quyển báo cáo |

## 8. Miễn phí ↔ doanh nghiệp (theo hai cột của đề bài)

| Nhu cầu | Đồ án (miễn phí) | Doanh nghiệp / có phí | Cần đổi gì trong mã |
|---|---|---|---|
| LLM | Gemini 2.5 Flash free tier, Ollama | OpenAI GPT-4o mini / GPT-5 mini, Gemini trả phí | Chỉ `ai_configs` (provider, model, khoá); `AiProvider` có sẵn adapter OpenAI-compatible |
| CSDL | Supabase Free | AWS RDS PostgreSQL, Supabase Pro | Đổi `DATABASE_URL`; bỏ pooler nếu không cần |
| Realtime | Socket.io một instance | Pusher Channels, hoặc Socket.io + Redis adapter nhiều instance | Thêm `@socket.io/redis-adapter`, hoặc adapter Pusher trong `RealtimeListener` |
| Lưu tệp | Supabase Storage 1 GB | S3, MinIO tự host (Table_Calendar có `doc/02_implement/minio-self-host-setup.md`) | Đổi `StorageProvider` |
| Giám sát | Log stdout + UptimeRobot (+ Sentry Free) | Datadog (APM, log, RUM) | Thêm `dd-trace` ở `main.ts` |
| Triển khai | Vercel + Render | VPS + Nginx + PM2 (theo `~/Table_Calendar/README.md`) hoặc Kubernetes | `Dockerfile` đã có từ Tuần 09 |

## 9. Danh sách gói cài đặt (Tuần 07 — sao chép khi khởi tạo)

```bash
# apps/api
npm i @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/platform-socket.io @nestjs/websockets \
      @nestjs/swagger swagger-ui-express @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt \
      @nestjs/event-emitter @nestjs/schedule @nestjs/throttler @prisma/client @prisma/adapter-pg pg \
      class-validator class-transformer bcrypt cookie-parser helmet socket.io zod zod-to-json-schema \
      @google/genai web-push @supabase/supabase-js node-ical nestjs-pino pino-http
npm i -D prisma typescript ts-node @types/node @types/bcrypt @types/passport-jwt @types/cookie-parser \
      jest ts-jest @types/jest supertest @types/supertest eslint prettier

# apps/web
npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npx shadcn@latest add button card badge avatar input textarea select checkbox switch slider progress tabs sheet dialog alert-dialog \
      dropdown-menu context-menu popover tooltip hover-card command combobox calendar form table scroll-area separator \
      skeleton sonner sidebar breadcrumb toggle toggle-group accordion collapsible resizable pagination radio-group chart
npm i @tanstack/react-query @tanstack/react-table zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers \
      react-hook-form @hookform/resolvers zod socket.io-client date-fns react-markdown remark-gfm rehype-sanitize next-themes
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test openapi-typescript

# packages/shared
npm i zod
```

## 10. Giấy phép

Toàn bộ thư viện trên là MIT hoặc Apache-2.0 (PostgreSQL License cho PostgreSQL); shadcn/ui MIT; Gemini API theo Điều khoản dịch vụ Google (free tier có thể dùng dữ liệu để cải thiện sản phẩm → **không gửi dữ liệu cá nhân thật** vào prompt, đã ghi ở 05). Ghi mục này vào Chương 1.6 và Phụ lục của quyển báo cáo.
