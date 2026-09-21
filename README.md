# SmartTask — Nền tảng Quản trị Dự án Agile Thông minh & Cân bằng Tải Nhân sự tích hợp AI Agent

> **Đồ án Chuyên ngành (Mã học phần: 841476 · 04 tín chỉ) — Khoa Công nghệ Thông tin · Trường Đại học Sài Gòn**  
> **Giảng viên Hướng dẫn:** ThS. Trần Đình Nghĩa  
> **Đề tài 01:** Smart Task & Workload Management Platform with AI Agent.  
> Ứng dụng web quản trị dự án Agile/Kanban thời gian thực; tích hợp Trợ lý AI (Google Gemini, DeepSeek V4 Flash) tự động phân rã yêu cầu (WBS), gợi ý ước lượng thời gian, tự động tính toán khối lượng công việc theo ma trận kỹ năng nhân sự và cảnh báo nguy cơ quá tải/cháy việc.

---

## Mục lục

1. [Kiến trúc & Công nghệ](#1-kiến-trúc--công-nghệ)
2. [Yêu cầu Môi trường](#2-yêu-cầu-môi-trường)
3. [Hướng dẫn Cài đặt Từng bước](#3-hướng-dẫn-cài-đặt-từng-bước)
4. [Hướng dẫn Khởi chạy Ứng dụng](#4-hướng-dẫn-khởi-chạy-ứng-dụng)
5. [Mô hình Phân quyền 3 Cấp độ & Chức năng Từng Role](#5-mô-hình-phân-quyền-3-cấp-độ--chức-năng-từng-role)
6. [Danh bạ Tài khoản Mẫu Đã Seed Sẵn](#6-danh-bạ-tài-khoản-mẫu-đã-seed-sẵn)
7. [Hướng dẫn Chi tiết Cách Test Từng Role](#7-hướng-dẫn-chi-tiết-cách-test-từng-role)
8. [Kiểm thử Tự động (Automated Testing)](#8-kiểm-thử-tự-động-automated-testing)
9. [Xử lý Sự cố Thường gặp (Troubleshooting)](#9-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. Kiến trúc & Công nghệ

Hệ thống được tổ chức theo kiến trúc **Monorepo (npm workspaces)** gồm các thành phần:

```
SmartTask/
├── apps/
│   ├── api/             # Backend REST API + WebSocket (NestJS 11, Prisma 6, PostgreSQL)
│   └── web/             # Frontend Web Client (Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui)
├── packages/
│   └── shared/          # Thư viện dùng chung (Types, DTOs, Enums, Zod validation schemas)
├── infra/               # Cấu hình hạ tầng Docker Compose (PostgreSQL 16, Adminer, Elasticsearch)
├── docs/                # Toàn bộ tài liệu phân tích, kiến trúc, thiết kế và báo cáo kiểm thử
└── scripts/             # Script kiểm thử tự động E2E Puppeteer, Audit và Seed
```

- **Frontend:** Next.js 15 (App Router, React Server/Client Components), Tailwind CSS v4, Radix UI / shadcn/ui, Lucide Icons, DnD Kit (kéo thả Kanban & Gantt).
- **Backend:** NestJS 11, Prisma ORM 6, JWT Authentication, Passport, Socket.io (realtime updates), bcrypt.
- **Cơ sở dữ liệu:** PostgreSQL 16 (chạy trên cổng `5434` tránh xung đột với các ứng dụng khác).
- **AI Engine:** Tích hợp đa nhà cung cấp (Google Gemini 2.5 Flash, DeepSeek V4 Flash qua OpenAI-compatible endpoint) với cơ chế bóc tách token và FinOps audit log.

---

## 2. Yêu cầu Môi trường

Trước khi bắt đầu cài đặt, đảm bảo máy của bạn đã cài đặt các công cụ sau:

- **Node.js:** Phiên bản `>= 22.x` (khuyến nghị dùng `nvm` để quản lý: `nvm install 22 && nvm use 22`).
- **npm:** Phiên bản `>= 10.x`.
- **Docker & Docker Compose:** Dùng để khởi chạy PostgreSQL 16 cục bộ.
- **Git:** Quản lý mã nguồn.
- *(Tùy chọn)* **Google Chrome / Chromium:** Cần thiết nếu chạy các bộ kiểm thử E2E tự động bằng Puppeteer.

---

## 3. Hướng dẫn Cài đặt Từng bước

### Bước 1: Sao chép mã nguồn (Clone Repository)

```bash
git clone https://github.com/dthai2424/SmartTask.git
cd SmartTask
```

### Bước 2: Thiết lập biến môi trường (Environment Variables)

Hệ thống sử dụng các file cấu hình môi trường mẫu:

1. **File môi trường tổng (Root & Backend):**
   ```bash
   cp .env.example .env
   cp .env.example apps/api/.env
   ```
   > **Lưu ý:** Trong file `.env`, CSDL mặc định trỏ tới `localhost:5434` với tài khoản `smarttask:smarttask`:
   > ```env
   > DATABASE_URL="postgresql://smarttask:smarttask@localhost:5434/smarttask?schema=public"
   > PORT=3000
   > CORS_ORIGIN="http://localhost:3001"
   > JWT_ACCESS_SECRET="smarttask-super-secret-jwt-access-key-2026"
   > JWT_REFRESH_SECRET="smarttask-super-secret-jwt-refresh-key-2026"
   > SYSTEM_ADMIN_EMAILS="admin@smarttask.local"
   > ```
   > *(Nếu bạn có API Key của DeepSeek hoặc Gemini, có thể điền vào `DEEPSEEK_API_KEY` và `GEMINI_API_KEY` để gọi AI trực tiếp).*

2. **File môi trường Frontend (`apps/web`):**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
   Nội dung file `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
   NEXT_PUBLIC_USE_MOCK=0
   ```

### Bước 3: Khởi động Cơ sở dữ liệu PostgreSQL cục bộ

Sử dụng lệnh `make` hoặc `docker compose` để bật container PostgreSQL:

```bash
# Cách 1: Sử dụng Makefile tiện ích
make db-up

# Cách 2: Gọi docker compose trực tiếp
docker compose -f infra/docker-compose.yml up -d postgres
```
> Kiểm tra container đang chạy: `docker ps` (sẽ thấy `infra-postgres-1` lắng nghe tại cổng `0.0.0.0:5434->5432/tcp`).

### Bước 4: Cài đặt Gói phụ thuộc (Install Dependencies)

Chạy lệnh cài đặt từ thư mục gốc để npm tự động liên kết các workspace và biên dịch `@smarttask/shared`:

```bash
npm install
```

### Bước 5: Khởi tạo Schema CSDL & Prisma Client

Sinh client và áp dụng migration vào cơ sở dữ liệu:

```bash
# Sinh mã Prisma Client
npm run db:generate

# Đẩy cấu trúc schema vào PostgreSQL
npm run db:deploy
# (Hoặc nếu muốn cập nhật nhanh cấu trúc mới nhất: npx prisma db push --schema=apps/api/prisma/schema.prisma)
```

### Bước 6: Nạp dữ liệu mẫu sạch & Khởi tạo tài khoản phân quyền (Seed Data)

Chạy kịch bản seed để dọn sạch dữ liệu cũ và khởi tạo sẵn 6 tài khoản mẫu, danh mục kỹ năng, cấu hình AI (Gemini, DeepSeek V4 Flash), Workspace Demo, Dự án Demo và 10 Task mẫu:

```bash
npm run db:seed
```
Khi hoàn tất, màn hình sẽ thông báo:
```text
🧹 [1/6] Đang dọn dẹp và xóa các dữ liệu cũ rác...
🤖 [2/6] Đang đồng bộ danh mục Model AI (bao gồm DeepSeek V4 Flash & Gemini)...
👥 [3/6] Đang tạo 6 tài khoản mẫu với đầy đủ phân cấp Role...
🏢 [4/6] Đang tạo Workspace "SmartTask Demo" và phân quyền thành viên...
🤖 [5/6] Đang cấu hình AI Workspace (DeepSeek V4 Flash & Gemini)...
📌 [6/6] Đang tạo Dự án ST "SmartTask v1", Sprints và 10 Task mẫu...
✨ QUY TRÌNH SEED DỮ LIỆU ĐÃ HOÀN TẤT THÀNH CÔNG!
```

---

## 4. Hướng dẫn Khởi chạy Ứng dụng

Bạn cần mở **2 cửa sổ dòng lệnh (Terminal)** độc lập để chạy song song Backend và Frontend:

### Terminal 1: Khởi chạy Backend API (NestJS)

```bash
npm run api:dev
```
- **REST API Server:** `http://localhost:3000/api/v1`
- **Tài liệu Swagger API Interactive Docs:** `http://localhost:3000/docs`
- **WebSocket Gateway:** `ws://localhost:3000`

### Terminal 2: Khởi chạy Frontend Web (Next.js)

```bash
npm run web:dev
```
- **Giao diện Web:** `http://localhost:3001`
- *(Lưu ý: Frontend chạy trên cổng `3001` để khớp với cấu hình CORS của Backend).*

### Tiện ích: Quản lý Cơ sở dữ liệu qua giao diện Web (Adminer)

Nếu cần tra cứu trực tiếp bảng dữ liệu PostgreSQL qua trình duyệt:
```bash
make db-ui
```
- Truy cập `http://localhost:8080` (Hệ quản trị: PostgreSQL, Máy chủ: `postgres`, Người dùng: `smarttask`, Mật khẩu: `smarttask`, CSDL: `smarttask`).

---

## 5. Mô hình Phân quyền 3 Cấp độ & Chức năng Từng Role

SmartTask triển khai kiến trúc bảo mật phân quyền đa tầng (**Hierarchical Multi-Tenant RBAC**):

```mermaid
graph TD
    subgraph Tầng 1: Nền tảng (Platform)
        SA[SUPER_ADMIN<br/>Quản trị Hệ thống Toàn cục]
        US[REGULAR USER<br/>Người dùng Nền tảng]
    end

    subgraph Tầng 2: Tổ chức (Workspace)
        OW[WORKSPACE OWNER<br/>Chủ sở hữu Không gian]
        AD[WORKSPACE ADMIN<br/>Quản trị viên Không gian]
        ME[WORKSPACE MEMBER<br/>Thành viên Thực thi]
        VI[WORKSPACE VIEWER<br/>Khách / Chỉ xem]
    end

    subgraph Tầng 3: Dự án Agile (Project)
        PM[PROJECT PM<br/>Trưởng dự án Scrum Master]
        PME[PROJECT MEMBER<br/>Kỹ sư / Lập trình viên / QA]
    end

    SA -->|Quản trị Hạ tầng / FinOps / Tenant| OW
    OW -->|Toàn quyền Workspace| AD
    AD -->|Điều phối Nhân sự| ME
    ME -->|Tham gia Dự án| PM
    ME -->|Thực thi Task| PME
    VI -.->|Chỉ xem dữ liệu| PME
```

### 1. Tầng 1: Cấp Nền tảng (Platform Level)

| Vai trò | Phân quyền & Chức năng chính | Hạn chế & Ranh giới Bảo mật |
|:---|:---|:---|
| **`SUPER_ADMIN`** | • Toàn quyền truy cập Cổng Quản trị Nền tảng `/admin`.<br/>• **Platform Health Telemetry**: Giám sát kết nối DB pool, RAM, CPU, Event-loop latency, kết nối WebSocket thời gian thực.<br/>• **AI FinOps Management**: Quản lý AI Model Catalog trung tâm (DeepSeek V4 Flash, Gemini 2.5 Flash, Claude, OpenAI), giám sát token burn-rate và chi phí API toàn hệ thống.<br/>• **Tenant Lifecycle Operations**: Khóa, đình chỉ (Suspended), hoặc kích hoạt Chế độ Bảo trì (Maintenance Mode 503).<br/>• Thao tác nhạy cảm yêu cầu **Nút Giữ 2.5 giây (Hold-to-confirm)** và kiểm tra **Quy mô ảnh hưởng (Blast Radius Drawer)**.<br/>• Truy vết chuỗi nhật ký kiểm toán bất biến **HMAC-chained audit trail**. | • **Zero-Data Peeking**: Super Admin quản trị tầng hạ tầng và tenant metadata, tuyệt đối không tự ý xem lén nội dung task, mã nguồn hoặc tài liệu nghiệp vụ nội bộ của từng khách hàng. |

---

### 2. Tầng 2: Cấp Không gian làm việc (Workspace Level)

| Vai trò | Phân quyền & Chức năng chính | Hạn chế / Read-only States |
|:---|:---|:---|
| **`OWNER`** | • **Chủ sở hữu tối cao của Workspace**.<br/>• Quản lý gói cước, cài đặt thanh toán, đổi tên hoặc xóa vĩnh viễn Workspace.<br/>• Toàn quyền quản trị thành viên: Mời người dùng, thăng/hạ quyền (Owner, Admin, Member, Viewer).<br/>• **Cấu hình AI Workspace**: Chỉ định model mặc định, prompt chính sách an toàn dữ liệu, thiết lập hạn mức token theo ngày.<br/>• Cấu hình tham số tính tải công việc: Ngưỡng WIP limits, trọng số kỹ năng, SLA cảnh báo cháy việc (Burnout warning). | • Mỗi workspace phải có ít nhất 1 Owner (hệ thống chặn không cho Owner duy nhất tự hạ quyền). |
| **`ADMIN`** | • **Quản trị viên vận hành**.<br/>• Quản lý nhân sự: Duyệt thành viên, gán danh mục kỹ năng (Skills Matrix) cho từng nhân viên.<br/>• Tạo mới dự án, cấu hình mẫu quy trình.<br/>• Quản lý danh mục nhãn (Labels) và cột trạng thái bảng dùng chung. | • Không có quyền xóa Workspace.<br/>• Không có quyền đổi hoặc chuyển nhượng vai trò của Owner. |
| **`MEMBER`** | • **Thành viên chính thức (Developer, Tester, QA, Designer)**.<br/>• Được phân bổ vào các dự án cụ thể để nhận và thực hiện task.<br/>• Trò chuyện với Trợ lý AI Assistant (hỏi đáp tiến độ, tóm tắt task). | • **Khóa Cài đặt (Locked/Read-only)**: Khi vào trang Cài đặt Workspace hoặc Cấu hình AI, giao diện tự động chuyển sang chế độ Chỉ xem với thông báo lý do rõ ràng, các nút chỉnh sửa/lưu cấu hình bị ẩn hoặc vô hiệu hóa. |
| **`VIEWER`** | • **Khách hàng hoặc Stakeholder liên quan**.<br/>• Có quyền xem toàn bộ Bảng Kanban, Biểu đồ Gantt, Sprints, Báo cáo tiến độ và Tải công việc. | • **Chỉ xem toàn diện (Full Read-only)**: Không được phép tạo task, không được kéo thả đổi trạng thái, không được nhận việc, không có quyền chỉnh sửa bất kỳ dữ liệu nào. |

---

### 3. Tầng 3: Cấp Dự án Agile (Project Level)

| Vai trò | Phân quyền & Chức năng chính | Hạn chế |
|:---|:---|:---|
| **`PM` (Project Manager)** | • **Trưởng dự án / Quản lý Agile**.<br/>• Lập kế hoạch Sprint: Tạo Sprint mới, Bắt đầu Sprint (Start Sprint), Đóng/Hoàn thành Sprint (Complete Sprint).<br/>• **Tạo công việc thủ công** (nút `+ Tạo công việc`, phím `C`, hoặc `+ Thêm công việc` ở từng cột) & **Trợ lý AI WBS**: Phân rã yêu cầu dự án thành task con tự động kèm ước lượng.<br/>• Phân bổ công việc và cân bằng tải nhân sự theo năng lực.<br/>• Quản lý thành viên dự án và cấu hình cột Kanban (WIP limits). | • CSDL áp đặt ràng buộc độc bản: **Mỗi dự án chỉ có duy nhất 1 Project Manager (PM)** nhằm đảm bảo rõ ràng trách nhiệm quản lý. |
| **`MEMBER`** | • **Thành viên thực thi dự án**.<br/>• **Tạo công việc thủ công linh hoạt**: Bấm nút **`+ Tạo công việc`**, phím tắt **`C`**, hoặc nút **`+ Thêm công việc`** dưới mỗi cột để thêm việc trực tiếp vào cột mong muốn.<br/>• Nhận task chưa phân công nhanh chóng bằng nút **`+ Nhận task`** ngay trên thẻ Kanban.<br/>• Sử dụng phím tắt **`Q`** để bật/tắt bộ lọc **"Việc của tôi"**.<br/>• Kéo thả thẻ task giữa các cột trạng thái (`Cần làm` ➔ `Đang làm` ➔ `Kiểm thử` ➔ `Hoàn thành`).<br/>• Khai báo log giờ làm việc (Time Entry), gán nhãn, cập nhật tiến độ %, mở Sheet chi tiết để bổ sung thông tin. | • Không được phép Bắt đầu/Đóng Sprint.<br/>• Không được cấu hình lại cấu trúc cột Kanban của dự án. |

---

## 6. Danh bạ Tài khoản Mẫu Đã Seed Sẵn

Sau khi chạy `npm run db:seed`, hệ thống đã thiết lập sẵn 6 tài khoản phân vai chuẩn mực. **Mật khẩu dùng chung cho tất cả tài khoản:** `Demo@1234`

| STT | Email Đăng nhập | Họ và tên | Quyền Platform | Quyền Workspace | Quyền Project | Chức danh / Vai trò mẫu |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| **1** | `admin@smarttask.local` | Bùi Hoàng Long | **SUPER_ADMIN** | ADMIN | MEMBER | **Platform Architect / Super Admin** (Vận hành nền tảng) |
| **2** | `lan@smarttask.local` | Nguyễn Thị Lan | USER | **OWNER** | **PM** | **Project Manager & Workspace Owner** (Quản lý dự án ST v1) |
| **3** | `quang@smarttask.local` | Đỗ Hồng Quang | USER | **ADMIN** | MEMBER | **Engineering Lead & Workspace Admin** (Quản lý kỹ thuật) |
| **4** | `minh@smarttask.local` | Trần Quang Minh | USER | **MEMBER** | MEMBER | **Backend Developer** (Lập trình viên phụ trách API/DB) |
| **5** | `huy@smarttask.local` | Lê Đức Huy | USER | **MEMBER** | MEMBER | **Frontend / QA Engineer** (Kỹ sư Giao diện & Kiểm thử) |
| **6** | `mai@smarttask.local` | Phạm Phương Mai | USER | **VIEWER** | MEMBER | **Client Stakeholder** (Đại diện khách hàng / Chỉ xem) |

---

## 7. Hướng dẫn Chi tiết Cách Test Từng Role

Mở trình duyệt và truy cập: **`http://localhost:3001/login`**

---

### Kịch bản 1: Kiểm thử Vai trò `SUPER_ADMIN` (Quản trị Nền tảng)

> **Tài khoản:** `admin@smarttask.local` · **Mật khẩu:** `Demo@1234`

1. **Đăng nhập & Nhận diện Quyền:**
   - Sau khi đăng nhập, quan sát thanh Top Navbar: Xuất hiện huy hiệu màu tím nổi bật **`[ SUPER ADMIN ]`** và nút truy cập nhanh **`Quản trị Nền tảng`**.
2. **Truy cập Cổng Quản trị `/admin`:**
   - Bấm vào nút hoặc gõ trực tiếp URL `http://localhost:3001/admin`.
3. **Kiểm tra 5 Phân hệ Quản trị (Mission Control Console):**
   - **Tab Tổng quan (Overview):** Xem KPI cards toàn hệ thống (Tổng Workspaces, Tổng Users, Tải CPU/RAM và trạng thái kết nối PostgreSQL/Socket.io).
   - **Tab Quản lý Tổ chức (Workspaces):**
     - Hiển thị danh sách tất cả các Workspace trong hệ thống kèm số thành viên và chi phí AI tiêu thụ.
     - Bấm nút **"Đình chỉ"**: Ngăn kéo **Blast Radius Drawer** trượt ra từ bên phải, hiển thị mức độ ảnh hưởng (số người dùng và số task sẽ bị tạm dừng hoạt động).
     - Kiểm tra nút an toàn: Nút bấm màu đỏ yêu cầu **Nhấn và Giữ trong 2.5 giây (Hold-to-confirm)** kèm vòng tròn tiến trình (Progress ring) để tránh thao tác bấm nhầm.
   - **Tab AI FinOps & Model Catalog:**
     - Xem biểu đồ chi phí tiêu thụ token thời gian thực.
     - Tra cứu danh mục AI Models: Kiểm tra sự xuất hiện của model **`deepseek-v4-flash`** (DeepSeek) và **`gemini-2.5-flash`** (Google Gemini).
     - Thử chỉnh sửa giá token hoặc chuyển đổi trạng thái model.
   - **Tab Vận hành & Bảo trì (Maintenance Mode):**
     - Bật toggle kích hoạt chế độ bảo trì hệ thống.
   - **Tab Nhật ký Kiểm toán (Audit Trail):**
     - Xem toàn bộ nhật ký thao tác của Super Admin được bảo vệ bởi chuỗi mã hóa toàn vẹn **HMAC-SHA256**.
4. **Kiểm thử Cơ chế Chặn Xâm nhập (Zero-Trust Security Barrier):**
   - Đăng xuất khỏi tài khoản Super Admin.
   - Đăng nhập bằng tài khoản thành viên thường (`minh@smarttask.local` hoặc `lan@smarttask.local`).
   - Cố tình truy cập đường dẫn `http://localhost:3001/admin`: Hệ thống lập tức chặn lại và hiển thị màn hình cảnh báo **`403 - KHÔNG CÓ QUYỀN TRUY CẬP (ACCESS DENIED)`**.

---

### Kịch bản 2: Kiểm thử Vai trò `OWNER` & `PM` (Quản lý Dự án & Chủ sở hữu)

> **Tài khoản:** `lan@smarttask.local` · **Mật khẩu:** `Demo@1234`

1. **Kiểm thử Quyền Quản trị Workspace:**
   - Điều hướng tới menu **Cài đặt (Settings)** trên thanh bên trái.
   - **Tab Cài đặt Workspace:** Chỉnh sửa được Tên Workspace, Ngưỡng cảnh báo quá tải (WIP limits), Giờ làm việc tiêu chuẩn trong tuần. Bấm **"Lưu thay đổi"** thành công.
   - **Tab Quản lý Thành viên:** Bấm đổi vai trò của một thành viên bất kỳ (ví dụ: chuyển Huy từ `MEMBER` thành `ADMIN`).
   - **Tab Cấu hình AI:**
     - Xem danh sách cấu hình AI đang kích hoạt cho Workspace.
     - Kiểm tra model mặc định đang sử dụng: **`DeepSeek V4 Flash`** cho General Chat, **`Gemini 2.5 Flash`** cho Phân rã WBS.
     - Bấm nút **"Thêm cấu hình AI"** hoặc **"Chỉnh sửa"** để thay đổi tham số Temperature, Max Tokens.
2. **Kiểm thử Quyền Quản lý Dự án (PM Controls):**
   - Vào menu **Dự án ST (SmartTask v1)** ➔ Chọn tab **Sprints**.
   - Thấy danh sách gồm `Sprint 1` (đang Active) và `Sprint 2` (Planned).
   - Có đầy đủ quyền hạn của PM: Bấm **"Tạo Sprint mới"**, chỉnh sửa ngày bắt đầu/kết thúc Sprint hoặc **"Hoàn thành Sprint"**.
3. **Kiểm thử Trợ lý AI Phân rã WBS (AI Decompose):**
   - Vào mục **Trợ lý AI** trên thanh điều hướng.
   - Nhập một yêu cầu nghiệp vụ: *"Phát triển tính năng xác thực hai lớp 2FA cho tài khoản"*.
   - Trợ lý AI sẽ tự động phân tích và tạo danh sách các công việc con WBS kèm số giờ ước lượng dự kiến để PM duyệt đưa vào Sprint.

---

### Kịch bản 3: Kiểm thử Vai trò `ADMIN` (Quản trị Nhân sự & Kỹ năng)

> **Tài khoản:** `quang@smarttask.local` · **Mật khẩu:** `Demo@1234`

1. **Quản lý Thành viên & Ma trận Kỹ năng:**
   - Vào **Cài đặt** ➔ Tab **Thành viên**.
   - Xem ma trận kỹ năng của các kỹ sư: Minh (NestJS 5★, PostgreSQL 4★), Huy (React 5★, Tailwind 5★).
   - Thêm kỹ năng mới hoặc cập nhật cấp độ thành thạo cho nhân sự.
2. **Kiểm tra Giới hạn Quyền so với Owner:**
   - Quang có thể quản lý người dùng và dự án, nhưng **không có nút Xóa Workspace** hoặc chuyển nhượng quyền Owner cao nhất.

---

### Kịch bản 4: Kiểm thử Vai trò `MEMBER` (Developer & QA thực thi)

> **Tài khoản:** `minh@smarttask.local` (Backend Dev) hoặc `huy@smarttask.local` (Frontend/QA) · **Mật khẩu:** `Demo@1234`

1. **Bộ lọc Nhanh "Việc của tôi" (My Tasks Filter):**
   - Vào **Bảng Kanban** của dự án `SmartTask v1`.
   - Nhấn phím tắt **`Q`** trên bàn phím (hoặc bấm nút toggle **"Việc của tôi"** trên thanh công cụ bảng).
   - Bảng ngay lập tức lọc chỉ còn hiển thị đúng các task được gán cho chính tài khoản đang đăng nhập.
2. **Tính năng Nhận việc Tự do (`+ Nhận task`):**
   - Bỏ chọn lọc `Q` để xem toàn bộ bảng.
   - Tìm thẻ task đang ở trạng thái chưa phân công (Unassigned) tại cột `Cần làm` (ví dụ: task *"Nút nhận việc nhanh (+ Nhận task) cho các task chưa phân công"*).
   - Thẻ task hiển thị nút bấm màu xanh **`+ Nhận task`**.
   - Bấm vào nút này: Hệ thống lập tức cập nhật Assignee thành tên của bạn và avatar hiển thị trên thẻ.
3. **Kéo thả Cập nhật Trạng thái Task:**
   - Kéo thẻ task từ cột `Cần làm` sang cột `Đang làm` hoặc `Hoàn thành`.
   - Tiến độ công việc và trạng thái được cập nhật theo thời gian thực.
4. **Tạo Công việc Mới Thủ công (Manual Task Creation):**
   - Bấm nút **`+ Tạo công việc`** ở góc trên phải (hoặc nhấn phím tắt **`C`** trên bàn phím, hoặc bấm **`+ Thêm công việc`** ở chân bất kỳ cột nào).
   - Điền Tiêu đề, Mô tả, chọn Cột trạng thái, Độ ưu tiên, Giờ ước lượng, Hạn chót và Người thực hiện.
   - Bấm **"Tạo công việc"**: Thẻ task lập tức xuất hiện đúng cột đã chọn mà không cần thông qua AI.
5. **Kiểm tra Cơ chế Khóa Giao diện Cài đặt (Locked / Read-only Barrier):**
   - Điều hướng tới trang **Cài đặt Workspace** hoặc **Cài đặt AI**:
   - Giao diện hiển thị biểu tượng ổ khóa màu vàng kèm thông báo:  
     > *🔒 Chế độ Chỉ xem: Bạn đang đăng nhập với vai trò Thành viên (MEMBER). Chỉ Quản trị viên hoặc Chủ sở hữu Workspace mới có quyền chỉnh sửa cấu hình này.*
   - Mọi ô nhập liệu và nút bấm lưu thay đổi đều bị vô hiệu hóa (disabled), bảo vệ tuyệt đối cấu hình của tổ chức.

---

### Kịch bản 5: Kiểm thử Vai trò `VIEWER` (Khách hàng / Quan sát viên)

> **Tài khoản:** `mai@smarttask.local` · **Mật khẩu:** `Demo@1234`

1. **Kiểm tra Chế độ Khóa Hoàn toàn (Full Read-only Mode):**
   - Đăng nhập vào tài khoản của Mai.
   - Truy cập Bảng Kanban:
     - Không hiển thị nút **"+ Tạo Task"**.
     - Không có nút **"+ Nhận task"** trên các thẻ chưa phân công.
     - Các thẻ task bị khóa tính năng kéo thả (không thể thay đổi cột trạng thái).
   - Truy cập Quản lý Sprints: Các nút Bắt đầu Sprint / Đóng Sprint bị ẩn.
   - Truy cập Cài đặt: Toàn bộ form thông tin đều ở trạng thái chỉ đọc.

---

## 8. Kiểm thử Tự động (Automated Testing)

Hệ thống được trang bị bộ kiểm thử toàn diện từ Unit Test đến E2E Automation:

### 1. Chạy Bộ Kiểm thử Unit Tests Backend (NestJS)

```bash
npm run api:test
```
> Kết quả: **10 test suites passed, 82/82 unit tests passed (100% pass rate)** kiểm tra toàn diện logic phân quyền, tính toán tải, HMAC chaining và xử lý AI Provider.

### 2. Chạy Bộ Kiểm thử Tự động Giao diện & Phân quyền bằng Puppeteer

Trước khi chạy, đảm bảo Backend (`npm run api:dev`) và Frontend (`npm run web:dev`) đang hoạt động:

```bash
# Kiểm thử ma trận phân quyền RBAC (Owner vs Admin vs Member vs PM)
node scripts/rbac-puppeteer-test.mjs

# Kiểm thử Cổng Quản trị Nền tảng Platform Super Admin (/admin & 403 Barrier)
node scripts/platform-admin-puppeteer-test.mjs
```

Toàn bộ ảnh chụp màn hình kiểm chứng kết quả kiểm thử được tự động xuất ra thư mục:
- `docs/test-reports/rbac/`
- `docs/test-reports/platform-admin/`

---

## 9. Xử lý Sự cố Thường gặp (Troubleshooting)

### 1. Lỗi không kết nối được PostgreSQL (`P1001: Can't reach database server at localhost:5434`)
- **Nguyên nhân:** Container Docker chứa PostgreSQL chưa khởi chạy hoặc cổng `5434` bị chiếm dụng.
- **Khắc phục:**
  ```bash
  # Kiểm tra trạng thái container
  docker ps -a
  # Bật lại CSDL
  make db-up
  ```

### 2. Lỗi CORS hoặc không gọi được API từ Web sang Backend
- **Nguyên nhân:** Cổng của Frontend không khớp với biến cấu hình `CORS_ORIGIN` trong `.env`.
- **Khắc phục:** Đảm bảo Backend chạy cổng `3000` và Frontend chạy cổng `3001`. Kiểm tra file `apps/api/.env` có dòng:
  ```env
  CORS_ORIGIN=http://localhost:3001
  ```

### 3. Cần làm mới và xóa sạch dữ liệu để test lại từ đầu
- **Khắc phục:** Chạy lại lệnh seed:
  ```bash
  npm run db:seed
  ```
  Lệnh này sẽ tự động xóa sạch dữ liệu rác cũ ở toàn bộ 44 bảng và nạp lại chính xác 6 tài khoản mẫu chuẩn ban đầu.

---

## 10. Đóng góp & Bản quyền

- **Đơn vị phát triển:** Nhóm sinh viên thực hiện Đồ án Chuyên ngành — Khoa CNTT, Trường Đại học Sài Gòn.
- **Giảng viên Hướng dẫn:** ThS. Trần Đình Nghĩa.
- **Giấy phép:** [MIT License](LICENSE).
