import { z } from 'zod';

/**
 * Biến môi trường được kiểm tra khi khởi động: thiếu hoặc sai → không chạy.
 * Giá trị mẫu xem .env.example ở gốc repo.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_KEY: z.string().optional(),
  /** Giới hạn tần suất chung mỗi IP mỗi phút (tăng khi chạy loadtest) */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
  // Tìm kiếm @mention: có URL → Elasticsearch, không → pg_trgm
  ELASTICSEARCH_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  ELASTICSEARCH_API_KEY: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  // Storage: có Supabase → ký URL Supabase; không → lưu đĩa cục bộ (dev/test)
  SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  SUPABASE_STORAGE_BUCKET: z.string().default('attachments'),
  API_PUBLIC_URL: z.string().url().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  // AI (dùng từ Phase 7)
  /** Cấu hình dự phòng khi workspace chưa có ai_configs trong DB; `fake` (JSON mẫu) / `mock` (hàng đợi action cho e2e) không gọi mạng */
  AI_PROVIDER: z.enum(['gemini', 'ollama', 'fake', 'mock']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  DEEPSEEK_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:7b'),
  AI_DAILY_LIMIT_PER_USER: z.coerce.number().int().positive().default(20),
  /** Email (phân cách dấu phẩy) được sửa danh mục model toàn hệ thống — tạm thời cho tới Phase 7b (phân quyền động) */
  SYSTEM_ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Biến môi trường không hợp lệ — ${issues}`);
  }
  return parsed.data;
}
