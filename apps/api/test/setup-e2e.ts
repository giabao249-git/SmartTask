import { execSync } from 'child_process';
import './env-e2e';

/**
 * Trước cả bộ e2e: xoá schema test rồi áp lại toàn bộ migration — mỗi lần chạy là một CSDL sạch,
 * và migration được kiểm tra "từ số 0" giống như deploy lên Supabase.
 */
export default function globalSetup(): void {
  const cwd = `${__dirname}/..`;
  const env = { ...process.env };
  execSync('npx prisma db execute --stdin --schema prisma/schema.prisma', {
    input:
      'DROP SCHEMA IF EXISTS "smarttask_test" CASCADE; CREATE SCHEMA "smarttask_test";',
    stdio: ['pipe', 'inherit', 'inherit'],
    env,
    cwd,
  });
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env, cwd });
}
