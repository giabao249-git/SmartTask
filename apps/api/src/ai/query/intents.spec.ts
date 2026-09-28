import {
  FILTERS_BY_INTENT,
  QUERY_INTENTS,
  QUERY_INTENT_HINT,
  queryFiltersSchema,
} from '@smarttask/shared';
import { MASTER_PROMPT, PURPOSE_INSTRUCTIONS } from '../prompt/master-prompt';
import { RESPONSE_SCHEMAS } from '../provider/response-schemas';

type Obj = { properties: Record<string, Obj>; enum?: string[] };

/**
 * Danh sách ý định tra cứu chỉ có MỘT nguồn (packages/shared). Trước đây viết tay ở ba nơi — thêm một ý định mà
 * quên responseSchema thì Gemini từ chối cả lượt, quên prompt thì LLM không bao giờ chọn nó (docs 02/07 D5).
 */
describe('ý định tra cứu: một nguồn cho schema, prompt, bộ lọc', () => {
  const query = (RESPONSE_SCHEMAS.CHAT as unknown as Obj).properties.query;

  it('responseSchema nhận đúng mọi ý định', () => {
    expect(query.properties.intent.enum).toEqual([...QUERY_INTENTS]);
  });

  it('responseSchema có đủ mọi bộ lọc của schema zod', () => {
    const keys = Object.keys(query.properties.filters.properties);
    for (const k of Object.keys(queryFiltersSchema.shape))
      expect(keys).toContain(k);
  });

  it('mỗi ý định có câu mẫu, có danh sách bộ lọc và có mặt trong prompt CHAT', () => {
    const prompt = `${MASTER_PROMPT}\n${PURPOSE_INSTRUCTIONS.CHAT}`;
    for (const i of QUERY_INTENTS) {
      expect(QUERY_INTENT_HINT[i]).toBeTruthy();
      expect(FILTERS_BY_INTENT[i]).toBeDefined();
      expect(prompt).toContain(`- ${i}: `);
    }
  });
});
