import { z } from 'zod';

/**
 * `ai_configs.advanced_params` (docs 07 §3, 08 §2). Đặt theo từng cấu hình chứ không singleton như
 * `AiRuntimeConfig` của Table_Calendar vì SmartTask đa workspace. Cache prompt mặc định TẮT.
 */
export const advancedParamsSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().min(256).max(65_536).optional(),
    /** Gemini 2.5: 0 = tắt suy nghĩ (nhanh, rẻ); bỏ trống = mặc định nhà cung cấp */
    thinkingBudget: z.number().int().min(0).max(24_576).optional(),
    promptCache: z
      .object({
        enabled: z.boolean().default(false),
        ttlSeconds: z.number().int().min(60).max(86_400).default(3600),
        minStaticChars: z.number().int().min(1000).default(8000),
      })
      .default({}),
    trace: z.object({ enabled: z.boolean().default(false) }).default({}),
  })
  .strict();

export type AdvancedParams = z.infer<typeof advancedParamsSchema>;

export function parseAdvancedParams(raw: unknown): AdvancedParams {
  return advancedParamsSchema.parse(raw ?? {});
}
