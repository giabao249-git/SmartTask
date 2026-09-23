import { z } from 'zod';
import { dataQuerySpecSchema } from '@smarttask/shared';

/** Thân request cho POST /ai/query — chạy lại truy vấn tra cứu, không gọi LLM. */
export const aiQueryBodySchema = z.object({
  projectId: z.string().uuid(),
  /** Phiên chat gốc: để giải mã u1/t1/s1 theo đúng bảng mã của phiên đó. */
  sessionId: z.string().uuid().optional(),
  query: dataQuerySpecSchema,
});
export type AiQueryDto = z.infer<typeof aiQueryBodySchema>;
