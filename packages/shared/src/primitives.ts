import { z } from 'zod';

/** Mã ngắn theo lượt: u = người, t = task, s = sprint, k = kỹ năng. Dùng chung cho action và truy vấn. */
export const shortCode = (prefix: 'u' | 't' | 's' | 'k') =>
  z.string().regex(new RegExp(`^${prefix}\\d{1,4}$`), `mã ${prefix}N`);

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
/** Loại công việc — trùng enum TaskType của Prisma. */
export const taskTypeSchema = z.enum(['STORY', 'TASK', 'BUG']);
export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']);
