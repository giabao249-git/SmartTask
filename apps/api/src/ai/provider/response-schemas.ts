import type { AiPurpose } from '@prisma/client';
import {
  QUERY_INTENTS,
  dueRangePresetSchema,
  prioritySchema,
  taskTypeSchema,
} from '@smarttask/shared';

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
    taskType: {
      type: 'string',
      enum: ['STORY', 'TASK', 'BUG'],
    },
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
  // Chat: một schema PHẲNG gộp mọi trường của 10 loại action — Gemini không có oneOf; zod kiểm chặt sau
  CHAT: obj(
    {
      type: {
        type: 'string',
        enum: [
          'DECOMPOSE_PROPOSAL',
          'CREATE_TASK_DRAFT',
          'UPDATE_TASK_DRAFT',
          'DISCARD_DRAFT',
          'ASSIGN_PROPOSAL',
          'REBALANCE_PROPOSAL',
          'RISK_EXPLANATION',
          'MEMORY_PROPOSAL',
          'ASK_CLARIFICATION',
          'CHAT_RESPONSE',
          'DATA_QUERY',
        ],
      },
      // DATA_QUERY: chỉ ý định + bộ lọc; backend chạy truy vấn và vẽ khối (docs 14)
      query: obj(
        {
          // Sinh từ packages/shared — thêm ý định không phải sửa tay ở đây (docs 02/07 D5)
          intent: { type: 'string', enum: [...QUERY_INTENTS] },
          sprint: str('mã s, "__all" hoặc "__backlog"'),
          filters: obj({
            assignee: arr(str('mã u hoặc "me"')),
            status: { type: 'string', enum: ['OPEN', 'DONE', 'ALL'] },
            taskType: arr({
              type: 'string',
              enum: [...taskTypeSchema.options],
            }),
            priority: arr({
              type: 'string',
              enum: [...prioritySchema.options],
            }),
            dueRange: obj({
              preset: {
                type: 'string',
                enum: [...dueRangePresetSchema.options],
              },
              from: str('YYYY-MM-DD'),
              to: str('YYYY-MM-DD'),
            }),
            unassignedOnly: { type: 'boolean' },
            q: str('từ khoá tiêu đề'),
            skill: str('mã k'),
            minLevel: int('1–5'),
            task: str('mã t'),
            draft: str('mã bản nháp dN — TASK_CANDIDATES hỏi về việc chưa ghi'),
            user: str('mã u hoặc "me"'),
            groupUsageBy: { type: 'string', enum: ['day', 'purpose', 'user'] },
            lastN: int('SPRINT_VELOCITY: số sprint đã đóng gần nhất, 1–10'),
          }),
          groupBy: {
            type: 'string',
            enum: ['NONE', 'DUE_DATE', 'ASSIGNEE', 'COLUMN', 'PRIORITY'],
          },
          limit: int('1–100, mặc định 25'),
        },
        ['intent'],
      ),
      reply: str('văn bản hiển thị ≤ 600 ký tự'),
      sprint: str('mã s'),
      tasks: arr(draftTask),
      drafts: arr(
        obj(
          {
            ...(draftTask.properties as Record<string, JsonSchema>),
            assignee: str('mã u'),
            start: str('YYYY-MM-DD'),
            due: str('YYYY-MM-DD'),
          },
          ['draftKey', 'title'],
        ),
      ),
      assumptions: arr(str()),
      targetTask: str(
        'CHỈ mã task thật dạng tN khi sửa task đã có; bản nháp dN phải đặt ở targetDraftKeys. Không dùng thì BỎ HẲN trường này, không gửi chuỗi rỗng',
      ),
      targetDraftKeys: arr(str('draftKey đang mở, dạng dN')),
      all: { type: 'boolean', description: 'DISCARD_DRAFT: bỏ mọi nháp' },
      patch: obj({
        title: str(),
        taskType: { type: 'string', enum: ['STORY', 'TASK', 'BUG'] },
        subtasks: arr(obj({ title: str(), estimateHours: num() }, ['title'])),
        description: { type: 'string', nullable: true },
        estimateHours: { type: 'number', nullable: true },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        difficulty: int(),
        requiredSkills: arr(obj({ skill: str(), minLevel: int() }, ['skill'])),
        dependsOn: arr(str()),
        suggestedAssignee: {
          type: 'string',
          nullable: true,
          description: 'mã u; null = bỏ giao',
        },
        start: { type: 'string', nullable: true, description: 'YYYY-MM-DD' },
        due: { type: 'string', nullable: true, description: 'YYYY-MM-DD' },
        sprint: { type: 'string', nullable: true, description: 'mã s' },
      }),
      // UPDATE_TASK_DRAFT BẮT BUỘC có patch; không có gì để đổi nghĩa là không phải UPDATE_TASK_DRAFT
      resolutionReason: str(),
      assignments: arr(
        obj(
          {
            task: str('mã t'),
            assignee: str('mã u'),
            start: str(),
            due: str(),
            reason: str(),
            alternatives: arr(
              obj({ assignee: str(), tradeoff: str() }, [
                'assignee',
                'tradeoff',
              ]),
            ),
          },
          ['task', 'assignee'],
        ),
      ),
      unassigned: arr(obj({ task: str(), why: str() }, ['task', 'why'])),
      warnings: arr(str()),
      moves: arr(
        obj({ task: str(), from: str(), to: str(), reason: str() }, [
          'task',
          'from',
          'to',
        ]),
      ),
      riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'] },
      causes: arr(obj({ code: str(), text: str() }, ['text'])),
      recommendations: arr(str()),
      memory: obj(
        {
          kind: {
            type: 'string',
            enum: ['PERSONAL', 'SCHEDULE', 'ASSIGNMENT', 'CAPACITY', 'PROJECT'],
          },
          content: str(),
        },
        ['kind', 'content'],
      ),
      question: str(),
      options: arr(obj({ code: str(), label: str() }, ['code', 'label'])),
      dataRef: str(),
      suggestApply: { type: 'boolean' },
    },
    ['type', 'reply'],
  ),
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
