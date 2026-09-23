/**
 * E2E chạy trên schema riêng `smarttask_test` của cùng Postgres cục bộ, để không đụng dữ liệu dev.
 * DATABASE_URL lấy từ .env (hoặc CI), chỉ đổi tham số schema.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

const base =
  process.env.DATABASE_URL ??
  'postgresql://smarttask:smarttask@localhost:5434/smarttask';
const url = new URL(base);
url.searchParams.set('schema', 'smarttask_test');
process.env.DATABASE_URL = url.toString();
process.env.DIRECT_URL = url.toString();
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-0123456789abcdef';
// Phase 7: AI chạy bằng nhà cung cấp giả (không gọi mạng); APP_KEY để mã hoá khoá API trong test quản trị
process.env.AI_PROVIDER = 'mock'; // hàng đợi action cho e2e chat; rỗng → fake
process.env.APP_KEY ??= 'e2e-app-key-phase-7';
process.env.SYSTEM_ADMIN_EMAILS ??= '';
// e2e không bao giờ gọi nhà cung cấp thật, kể cả khi ca kiểm thử tạo cấu hình AI cho workspace
process.env.AI_FORCE_FAKE ??= '1';
// Bộ e2e gọi /ai/query hàng chục lần trong một phút — nới trần cho môi trường kiểm thử
process.env.AI_QUERY_RATE_LIMIT_PER_MINUTE ??= '500';
