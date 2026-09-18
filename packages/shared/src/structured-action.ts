import { z } from 'zod';

/**
 * Structured action — đầu ra duy nhất của LLM (docs/04-kien-truc/05 §4).
 * Discriminated union theo `type`; luôn có `reply` (văn bản hiển thị) và `schemaVersion`.
 * LLM chỉ được trả MÃ NGẮN (u1/t1/s1/k1) do ContextBuilder cấp; Validator đổi về UUID, mã lạ = lỗi UNKNOWN_CODE.
 * Web dùng cùng schema này để render thẻ theo `type`.
 */
export const STRUCTURED_ACTION_SCHEMA_VERSION = 1;

/** Mã ngắn theo lượt: u = người, t = task, s = sprint, k = kỹ năng, d = bản nháp trong cùng đề xuất. */
export const shortCode = (prefix: 'u' | 't' | 's' | 'k') =>
  z.string().regex(new RegExp(`^${prefix}\\d{1,4}$`), `mã ${prefix}N`);

export const draftKeySchema = z
  .string()
  .regex(/^d\d{1,3}$/, 'draftKey dạng d1, d2…');

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']);

const base = {
  schemaVersion: z
    .number()
    .int()
    .default(STRUCTURED_ACTION_SCHEMA_VERSION),
  reply: z.string().max(2000).default(''),
};

export const requiredSkillRefSchema = z.object({
  /** Mã k trong danh mục; LLM lỡ trả tên ("ReactJS") thì Validator chuẩn hoá qua alias, không khớp → bỏ + cảnh báo. */
  skill: z.string().min(1).max(60),
  minLevel: z.number().int().min(1).max(5).default(1),
});

export const draftTaskSchema = z.object({
  draftKey: draftKeySchema,
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  estimateHours: z.number().min(0).max(400).optional(),
  priority: prioritySchema.optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  requiredSkills: z.array(requiredSkillRefSchema).max(10).default([]),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        estimateHours: z.number().min(0).max(400).optional(),
      }),
    )
    .max(20)
    .default([]),
  dependsOn: z.array(draftKeySchema).max(20).default([]),
  suggestedAssignee: shortCode('u').optional(),
  reason: z.string().max(600).optional(),
});
export type DraftTask = z.infer<typeof draftTaskSchema>;

export const decomposeProposalSchema = z.object({
  type: z.literal('DECOMPOSE_PROPOSAL'),
  ...base,
  tasks: z.array(draftTaskSchema).min(1).max(25),
  assumptions: z.array(z.string().max(400)).max(20).default([]),
  sprint: shortCode('s').optional(),
});
export type DecomposeProposal = z.infer<typeof decomposeProposalSchema>;

export const createTaskDraftSchema = z.object({
  type: z.literal('CREATE_TASK_DRAFT'),
  ...base,
  drafts: z
    .array(
      draftTaskSchema.extend({
        assignee: shortCode('u').optional(),
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .min(1)
    .max(25),
  sprint: shortCode('s').optional(),
});
export type CreateTaskDraft = z.infer<typeof createTaskDraftSchema>;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

/**
 * Phần vá cho một bản nháp hoặc task thật (docs 12 §1 #3, #5). Trường nào không gửi = giữ nguyên;
 * `null` = xoá giá trị (bỏ người, bỏ hạn). Mã u/s/k như trong ngữ cảnh.
 */
export const draftPatchSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).nullable(),
    estimateHours: z.number().min(0).max(400).nullable(),
    priority: prioritySchema,
    difficulty: z.number().int().min(1).max(5),
    requiredSkills: z.array(requiredSkillRefSchema).max(10),
    subtasks: z
      .array(z.object({ title: z.string().min(1).max(200), estimateHours: z.number().min(0).max(400).optional() }))
      .max(20),
    dependsOn: z.array(draftKeySchema).max(20),
    /** Người thực hiện — với task thật là thay toàn bộ danh sách bằng một người; null = bỏ giao */
    suggestedAssignee: shortCode('u').nullable(),
    start: isoDay.nullable(),
    due: isoDay.nullable(),
    sprint: shortCode('s').nullable(),
    /** Chỉ cho task thật: mã cột đích theo statusKey (todo/doing/done…) */
    status: z.string().max(40),
  })
  .partial();
export type DraftPatch = z.infer<typeof draftPatchSchema>;

/**
 * Sửa bản nháp đang mở trong phiên (`targetDraftKey` / `targetDraftKeys`) hoặc đề xuất sửa TASK THẬT
 * (`targetTask` — tạo proposal kind TASK_UPDATE, chỉ ghi khi người duyệt).
 */
export const updateTaskDraftSchema = z.object({
  type: z.literal('UPDATE_TASK_DRAFT'),
  ...base,
  /** Server cấp khi lưu đề xuất sửa task thật vào phiên (kind TASK_UPDATE) */
  draftKey: draftKeySchema.optional(),
  targetTask: shortCode('t').optional(),
  targetDraftKey: draftKeySchema.optional(),
  targetDraftKeys: z.array(draftKeySchema).max(25).optional(),
  patch: draftPatchSchema,
  resolutionReason: z.string().max(600).optional(),
});
export type UpdateTaskDraft = z.infer<typeof updateTaskDraftSchema>;

/** "bỏ cái thứ năm", "xoá hết nháp" — item → DISCARDED (docs 12 §1 #4). */
export const discardDraftSchema = z.object({
  type: z.literal('DISCARD_DRAFT'),
  ...base,
  targetDraftKeys: z.array(draftKeySchema).max(50).default([]),
  all: z.boolean().default(false),
  resolutionReason: z.string().max(600).optional(),
});
export type DiscardDraft = z.infer<typeof discardDraftSchema>;

export const assignProposalSchema = z.object({
  type: z.literal('ASSIGN_PROPOSAL'),
  ...base,
  assignments: z
    .array(
      z.object({
        /** Server cấp khi lưu vào phiên (d{seq}); LLM không cần gửi */
        draftKey: draftKeySchema.optional(),
        task: z.string().min(1),
        assignee: shortCode('u'),
        start: z.string().optional(),
        due: z.string().optional(),
        reason: z.string().max(600).optional(),
        alternatives: z
          .array(
            z.object({ assignee: shortCode('u'), tradeoff: z.string().max(300) }),
          )
          .max(3)
          .default([]),
      }),
    )
    .max(100),
  unassigned: z
    .array(z.object({ task: z.string(), why: z.string().max(300) }))
    .default([]),
  fairnessEstimate: z.string().max(300).optional(),
  warnings: z.array(z.string().max(300)).default([]),
});

export type AssignProposal = z.infer<typeof assignProposalSchema>;

export const rebalanceProposalSchema = z.object({
  type: z.literal('REBALANCE_PROPOSAL'),
  ...base,
  moves: z
    .array(
      z.object({
        draftKey: draftKeySchema.optional(),
        task: shortCode('t'),
        from: shortCode('u'),
        to: shortCode('u'),
        reason: z.string().max(600).optional(),
      }),
    )
    .max(100),
});

export type RebalanceProposal = z.infer<typeof rebalanceProposalSchema>;

export const riskExplanationSchema = z.object({
  type: z.literal('RISK_EXPLANATION'),
  ...base,
  /** Phải TRÙNG mức backend đã tính — Validator kiểm. */
  riskLevel: riskLevelSchema,
  causes: z
    .array(
      z.object({
        code: z.string().max(40).optional(),
        text: z.string().max(400),
      }),
    )
    .max(10)
    .default([]),
  recommendations: z.array(z.string().max(400)).max(10).default([]),
});
export type RiskExplanation = z.infer<typeof riskExplanationSchema>;

export const memoryProposalSchema = z.object({
  type: z.literal('MEMORY_PROPOSAL'),
  ...base,
  memory: z.object({
    kind: z.enum(['PERSONAL', 'SCHEDULE', 'ASSIGNMENT', 'CAPACITY', 'PROJECT']),
    content: z.string().min(1).max(1000),
    suggestedStructured: z.record(z.unknown()).optional(),
  }),
});

export const askClarificationSchema = z.object({
  type: z.literal('ASK_CLARIFICATION'),
  ...base,
  question: z.string().min(1).max(1000),
  options: z
    .array(z.object({ code: z.string().max(40), label: z.string().max(200) }))
    .max(10)
    .default([]),
});
export type AskClarification = z.infer<typeof askClarificationSchema>;

export const chatResponseSchema = z.object({
  type: z.literal('CHAT_RESPONSE'),
  ...base,
  /** Ví dụ `workload:week:u1` để UI vẽ thẻ số từ backend. */
  dataRef: z.string().max(120).optional(),
  /** Đặt bởi ResponseParser khi JSON/zod thất bại — không phải LLM. */
  parseFailed: z.boolean().optional(),
  /** "Duyệt đi", "ok tạo hết": KHÔNG ghi gì — UI chỉ nhấp nháy nút Duyệt (docs 12 §1 #12). */
  suggestApply: z.boolean().optional(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const structuredActionSchema = z.discriminatedUnion('type', [
  decomposeProposalSchema,
  createTaskDraftSchema,
  updateTaskDraftSchema,
  discardDraftSchema,
  assignProposalSchema,
  rebalanceProposalSchema,
  riskExplanationSchema,
  memoryProposalSchema,
  askClarificationSchema,
  chatResponseSchema,
]);
export type StructuredAction = z.infer<typeof structuredActionSchema>;
export type StructuredActionType = StructuredAction['type'];

/** Kết quả Validator — chỉ báo, không sửa (05 §2). */
export interface ValidationIssue {
  /** Đường dẫn trong action, ví dụ `tasks[2].suggestedAssignee` */
  path: string;
  code: string;
  message: string;
  data?: Record<string, unknown>;
}
export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Số liệu backend tính kèm để UI hiển thị (tổng giờ, năng lực còn lại…). */
  facts?: Record<string, unknown>;
  checkedAt: string;
}

/** Trạng thái từng item trong `ai_proposals.item_status` (docs 12 §2). */
export const DRAFT_ITEM_STATUSES = ['DRAFT', 'APPLIED', 'DISCARDED'] as const;
export type DraftItemStatus = (typeof DRAFT_ITEM_STATUSES)[number];
