import type { AiPurpose } from '@prisma/client';

/**
 * JSON Schema đầu ra theo mục đích — ép nhà cung cấp trả đúng cấu trúc (Gemini `responseSchema`, Ollama `format`).
 * Viết PHẲNG (một object, `type` là enum, trường tuỳ chọn theo type) thay vì oneOf vì Gemini chỉ hỗ trợ tập con
 * OpenAPI; zod ở ResponseParser mới là nơi kiểm chặt.
 */
export type JsonSchema = Record<string, unknown>;

const str = (description?: string): JsonSchema => ({
  type: 'string',
  ...(description ? { description } : {}),
});
const num = (description?: string): JsonSchema => ({
  type: 'number',
  ...(description ? { description } : {}),
});
const int = (description?: string): JsonSchema => ({
  type: 'integer',
  ...(description ? { description } : {}),
});
const arr = (items: JsonSchema, description?: string): JsonSchema => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
});
const obj = (
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
});

const draftTask = obj(
  {
    draftKey: str('d1, d2, …'),
    title: str(),
    description: str(),
    estimateHours: num('0.5–40'),
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    difficulty: int('1–5'),
    requiredSkills: arr(
      obj({ skill: str('mã k'), minLevel: int('1–5') }, ['skill']),
    ),
    subtasks: arr(obj({ title: str(), estimateHours: num() }, ['title'])),
    dependsOn: arr(str('draftKey khác')),
    suggestedAssignee: str('mã u hoặc bỏ trống'),
    reason: str(),
  },
  ['draftKey', 'title', 'estimateHours'],
);

export const RESPONSE_SCHEMAS: Record<AiPurpose, JsonSchema> = {
  DECOMPOSE: obj(
    {
      type: {
        type: 'string',
        enum: ['DECOMPOSE_PROPOSAL', 'ASK_CLARIFICATION', 'CHAT_RESPONSE'],
      },
      reply: str('văn bản hiển thị ≤ 600 ký tự'),
      sprint: str('mã s'),
      tasks: arr(draftTask),
      assumptions: arr(str()),
      question: str('khi ASK_CLARIFICATION'),
      options: arr(obj({ code: str(), label: str() }, ['code', 'label'])),
    },
    ['type', 'reply'],
  ),
  EXPLAIN: obj(
    {
      type: { type: 'string', enum: ['RISK_EXPLANATION', 'CHAT_RESPONSE'] },
      reply: str(),
      riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] },
      causes: arr(obj({ code: str(), text: str() }, ['text'])),
      recommendations: arr(str()),
    },
    ['type', 'reply', 'riskLevel'],
  ),
  ASSIGN: obj({ type: str(), reply: str() }, ['type', 'reply']),
  CHAT: obj({ type: str(), reply: str() }, ['type', 'reply']),
  GENERAL: obj({ type: str(), reply: str() }, ['type', 'reply']),
};

/** Chuyển sang dạng Gemini `Schema` (type viết hoa, bỏ khoá không hỗ trợ). */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
    else if (k === 'properties' && v && typeof v === 'object')
      out.properties = Object.fromEntries(
        Object.entries(v as Record<string, JsonSchema>).map(([pk, pv]) => [
          pk,
          toGeminiSchema(pv),
        ]),
      );
    else if (k === 'items' && v && typeof v === 'object')
      out.items = toGeminiSchema(v as JsonSchema);
    else if (['enum', 'required', 'description', 'nullable'].includes(k))
      out[k] = v;
  }
  return out;
}
