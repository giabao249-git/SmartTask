# Phase 6 — Realtime Socket.io

Nhánh `feature/be-p6-realtime`. 15/09/2026. Sự kiện theo [11 §4](../04-kien-truc/11-chot-chuc-nang-va-api.md); nguyên tắc [01 §3](../04-kien-truc/01-kien-truc-he-thong.md).

## Đã làm
- `RealtimeGateway` (`@nestjs/platform-socket.io`, cùng cổng HTTP): handshake mang access token trong `auth.token` (hoặc header Bearer) → sai thì `error` + ngắt; mỗi socket tự vào phòng `user:{id}`.
- `project:join {projectId, view}` → kiểm `ProjectAccessService.assertRead` (người ngoài nhận ack `{ error: { code: 'FORBIDDEN' } }`), vào phòng `project:{id}`, trả `presence`; `project:leave`; `presence:ping {view}`; `presence:update` phát cho phòng (gộp theo user, giữ view mới nhất); rời/ngắt → cập nhật presence.
- `RealtimeListener` bắc cầu sự kiện nội bộ → socket: `task:created/updated/moved/assigned` (task rút gọn + `diffKeys` + `version` + `actorId` + `source`), `task:deleted` (chỉ id), `comment:created/updated/deleted`, `sprint:updated`, `notification:new` (phòng cá nhân), `workload:updated` (phòng cá nhân + các dự án liên quan), `forecast:risk`.
- `WsExceptionFilter`: lỗi handler trả qua ack `{ error }` thay vì ngắt kết nối.
- Client **không ghi qua socket** — chỉ nhận; ghi qua REST (docs 05 §1). Client bỏ sự kiện có `version` nhỏ hơn bản đang giữ.
- `RATE_LIMIT_PER_MINUTE` (mặc định 100) để loadtest không bị throttler chặn.
- `scripts/socket-loadtest.mjs`: N client vào cùng phòng, M lần kéo qua REST, đo độ trễ sự kiện và đối chiếu version cuối với DB.

## Kết quả loadtest (máy dev, 20 client, 200 lần kéo)
```
Xong 200 lần kéo trong 6922 ms (29 req/s), 409: 0
Sự kiện nhận: 4000 / 4000 mong đợi; độ trễ p50 3 ms · p95 7 ms · max 12 ms
Version client khớp DB cho mọi task
```
Mục tiêu docs 01 §5 (≤ 500 ms, không mất thứ tự sau 20 lần kéo) đạt với biên rất rộng. 29 req/s là tốc độ tuần tự của script (mỗi lần kéo chờ phản hồi), không phải trần của API.

## Kiểm thử
E2E `realtime.e2e-spec.ts` (4 ca; tổng 43) với `socket.io-client` thật trên cổng ngẫu nhiên: token sai bị ngắt, người ngoài join → FORBIDDEN; presence hai client; tạo/kéo/xoá task qua REST → phòng nhận đúng sự kiện + version, người ngoài phòng không nhận; bình luận mention → `comment:created` + `notification:new`; giao việc nặng → `workload:updated` tới phòng cá nhân.

## Ghi chú vận hành
- Một instance Render → không cần Redis adapter; nếu chạy nhiều instance thì thêm `@socket.io/redis-adapter`.
- CORS socket lấy từ `CORS_ORIGIN` lúc khởi động.
- Phase 7 sẽ phát thêm `ai:proposal:applied`.
