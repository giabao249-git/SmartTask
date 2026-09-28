import { z } from 'zod';
import { prioritySchema, shortCode, taskTypeSchema } from './primitives';

/**
 * Tra cứu trong hội thoại (docs 04/14): LLM CHỈ chọn ý định + bộ lọc, KHÔNG tự trả số.
 * Backend chạy truy vấn thật dưới quyền người hỏi rồi trả `blocks` để web vẽ.
 * Mọi tham chiếu vẫn là mã ngắn (u1/s1/k1) như các action khác — Validator đổi sang UUID.
 */
export const QUERY_INTENTS = [
  'TASK_LIST',
  'TASK_AGENDA',
  'TASK_DETAIL',
  'TASK_STATS',
  'TASK_BLOCKED',
  'MEMBER_LIST',
  'MEMBER_PROFILE',
  'WORKLOAD_WEEK',
  'CAPACITY_FREE',
  'WHO_KNOWS_SKILL',
  'TASK_CANDIDATES',
  'BUS_FACTOR',
  'SPRINT_LIST',
  'SPRINT_PROGRESS',
  'SPRINT_REPORT',
  'SPRINT_VELOCITY',
  'ACTIVITY_FEED',
  'NOTIFICATION_LIST',
  'AI_USAGE',
] as const;
export const queryIntentSchema = z.enum(QUERY_INTENTS);
export type QueryIntent = z.infer<typeof queryIntentSchema>;

export const dueRangePresetSchema = z.enum([
  'TODAY',
  'TOMORROW',
  'THIS_WEEK',
  'NEXT_WEEK',
  'OVERDUE',
  'NO_DUE',
]);

export const queryFiltersSchema = z
  .object({
    /** Mã người; bỏ trống = cả nhóm. "me" = chính người đang hỏi (server tự thay). */
    assignee: z
      .array(z.union([shortCode('u'), z.literal('me')]))
      .max(20)
      .optional(),
    status: z.enum(['OPEN', 'DONE', 'ALL']).optional(),
    taskType: z.array(taskTypeSchema).max(3).optional(),
    priority: z.array(prioritySchema).max(4).optional(),
    dueRange: z
      .object({
        preset: dueRangePresetSchema.optional(),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .optional(),
    unassignedOnly: z.boolean().optional(),
    q: z.string().max(200).optional(),
    /** WHO_KNOWS_SKILL: mã kỹ năng + mức tối thiểu. */
    skill: shortCode('k').optional(),
    minLevel: z.number().int().min(1).max(5).optional(),
    /** TASK_DETAIL / MEMBER_PROFILE / TASK_CANDIDATES: đối tượng cụ thể. */
    task: shortCode('t').optional(),
    /** TASK_CANDIDATES: hỏi về một BẢN NHÁP đang mở trong phiên thay vì task thật. */
    draft: z
      .string()
      .regex(/^d\d{1,3}$/, 'draftKey dạng d1, d2…')
      .optional(),
    user: z.union([shortCode('u'), z.literal('me')]).optional(),
    /** ACTIVITY_FEED: khoảng thời gian theo múi giờ người hỏi. */
    range: z.enum(['TODAY', 'YESTERDAY', 'THIS_WEEK']).optional(),
    /** SPRINT_VELOCITY: số sprint đã đóng gần nhất (mặc định 3). */
    lastN: z.number().int().min(1).max(10).optional(),
    /** AI_USAGE: gộp theo gì. */
    groupUsageBy: z.enum(['day', 'purpose', 'user']).optional(),
  })
  // Không nhận field lạ: LLM (hoặc người gọi API) không thể lén thêm tham số truy vấn
  .strict();
export type QueryFilters = z.infer<typeof queryFiltersSchema>;

/**
 * Bộ lọc có nghĩa cho từng ý định. LLM hay điền bừa các field không liên quan (task: "tN", sprint: "s2"…)
 * khi schema phẳng liệt kê hết — cắt trước khi kiểm để một câu hỏi hợp lệ không bị hỏng vì rác thừa.
 * Field THUỘC ý định mà sai định dạng thì vẫn báo lỗi (không đoán).
 */
export const FILTERS_BY_INTENT: Record<QueryIntent, (keyof QueryFilters)[]> = {
  TASK_LIST: ['assignee', 'status', 'taskType', 'priority', 'dueRange', 'unassignedOnly', 'q'],
  TASK_AGENDA: ['assignee', 'status', 'taskType', 'priority', 'dueRange', 'unassignedOnly', 'q'],
  TASK_BLOCKED: ['assignee', 'status', 'taskType', 'priority', 'q'],
  TASK_STATS: ['assignee', 'status', 'taskType', 'priority', 'dueRange', 'q'],
  TASK_DETAIL: ['task'],
  MEMBER_LIST: [],
  MEMBER_PROFILE: ['user'],
  WORKLOAD_WEEK: [],
  CAPACITY_FREE: [],
  WHO_KNOWS_SKILL: ['skill', 'minLevel'],
  TASK_CANDIDATES: ['task', 'draft'],
  BUS_FACTOR: ['minLevel'],
  SPRINT_LIST: [],
  SPRINT_PROGRESS: ['assignee'],
  SPRINT_REPORT: [],
  SPRINT_VELOCITY: ['lastN'],
  ACTIVITY_FEED: ['user', 'range'],
  NOTIFICATION_LIST: [],
  AI_USAGE: ['groupUsageBy'],
};

/**
 * Câu hỏi mẫu cho từng ý định — MỘT nguồn cho master prompt (mục CHAT), bảng ở docs 04/14 và test.
 * Thêm ý định: thêm vào QUERY_INTENTS, FILTERS_BY_INTENT và ở đây; responseSchema + prompt tự theo.
 */
export const QUERY_INTENT_HINT: Record<QueryIntent, string> = {
  TASK_LIST: 'còn việc nào chưa giao, việc BUG của tôi',
  TASK_AGENDA: 'hôm nay tôi làm gì, việc đến hạn tuần này',
  TASK_DETAIL: 'ST-6 đang thế nào',
  TASK_STATS: 'mỗi cột bao nhiêu việc',
  TASK_BLOCKED: 'việc nào đang bị chặn',
  MEMBER_LIST: 'danh sách thành viên',
  MEMBER_PROFILE: 'Huy đang làm gì',
  WORKLOAD_WEEK: 'ai đang quá tải tuần này',
  CAPACITY_FREE: 'ai còn giờ trống (trong sprint này)',
  WHO_KNOWS_SKILL: 'ai biết NestJS mức 4',
  TASK_CANDIDATES: 'ai làm được t7 / d2',
  BUS_FACTOR: 'kỹ năng nào chỉ một người biết',
  SPRINT_LIST: 'có mấy sprint',
  SPRINT_PROGRESS: 'sprint này còn bao nhiêu giờ, có kịp không, ai đang gánh nhiều nhất sprint này',
  SPRINT_REPORT:
    'sprint trước làm được gì, việc nào bị đẩy sang sprint này, có thêm việc giữa chừng không',
  SPRINT_VELOCITY: 'vận tốc 3 sprint gần nhất, mỗi sprint nhóm làm được bao nhiêu giờ',
  ACTIVITY_FEED: 'hôm qua ai sửa gì, hôm nay Huy làm gì',
  NOTIFICATION_LIST: 'tôi có thông báo gì',
  AI_USAGE: 'tháng này tốn bao nhiêu tiền AI',
};

/** Đoạn liệt kê ý định cho master prompt: "- INTENT: câu mẫu [filter: a, b]" — sinh từ QUERY_INTENTS. */
export function queryIntentGuide(): string {
  return QUERY_INTENTS.map((i) => {
    const f = FILTERS_BY_INTENT[i];
    return `  - ${i}: "${QUERY_INTENT_HINT[i]}"${f.length ? ` [filter: ${f.join(', ')}]` : ''}`;
  }).join('\n');
}

const KNOWN_FILTER_KEYS: (keyof QueryFilters)[] = [
  'assignee',
  'status',
  'taskType',
  'priority',
  'dueRange',
  'unassignedOnly',
  'q',
  'skill',
  'minLevel',
  'task',
  'draft',
  'user',
  'groupUsageBy',
  'lastN',
  'range',
];

const SPRINT_INTENTS: QueryIntent[] = [
  'TASK_LIST',
  'TASK_AGENDA',
  'TASK_BLOCKED',
  'TASK_STATS',
  'SPRINT_PROGRESS',
  'SPRINT_REPORT',
  'CAPACITY_FREE',
];

/** Cắt field thừa theo ý định trước khi kiểm schema. */
/** Bộ lọc mang Ý người hỏi — cắt đi thì phải nói ra; các field khác LLM hay điền rác (tN, u0) nên cắt im. */
const MEANINGFUL: string[] = [
  'assignee',
  'user',
  'status',
  'taskType',
  'priority',
  'dueRange',
  'q',
  'range',
];

export function pruneQuerySpec(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const spec = { ...(raw as Record<string, unknown>) };
  const intent = spec.intent as QueryIntent;
  const allowed = FILTERS_BY_INTENT[intent];
  if (!allowed) return spec;
  const dropped: string[] = [];
  const meaningful = (v: unknown) =>
    v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  if (!SPRINT_INTENTS.includes(intent) && spec.sprint !== undefined) {
    if (meaningful(spec.sprint) && spec.sprint !== '__all') dropped.push('sprint');
    delete spec.sprint;
  }
  if (spec.filters && typeof spec.filters === 'object') {
    const filters = spec.filters as Record<string, unknown>;
    // Chỉ cắt field HỢP LỆ nhưng không thuộc ý định; field lạ hoàn toàn vẫn để schema strict từ chối
    spec.filters = Object.fromEntries(
      Object.entries(filters).filter(([k, v]) => {
        const keep =
          !KNOWN_FILTER_KEYS.includes(k as keyof QueryFilters) ||
          allowed.includes(k as keyof QueryFilters);
        if (!keep && MEANINGFUL.includes(k) && meaningful(v)) dropped.push(k);
        return keep;
      }),
    );
  }
  // Truyền cho backend để trả ghi chú "bộ lọc X không áp dụng" thay vì lặng lẽ trả kết quả rộng hơn câu hỏi
  // Không xoá ignoredFilters có sẵn: "Làm mới" gửi lại truy vấn đã cắt, ghi chú vẫn phải còn
  if (dropped.length) spec.ignoredFilters = dropped;
  return spec;
}

const rawQuerySpecSchema = z
  .object({
    intent: queryIntentSchema,
    /** Sprint áp dụng; bỏ trống = sprint đang chạy, "__all" = mọi sprint, "__backlog" = backlog. */
    sprint: z.union([shortCode('s'), z.literal('__all'), z.literal('__backlog')]).optional(),
    filters: queryFiltersSchema.default({}),
    /** Do pruneQuerySpec điền (không phải LLM): bộ lọc có nghĩa bị cắt vì không thuộc ý định. */
    ignoredFilters: z.array(z.string().max(20)).max(20).optional(),
    groupBy: z.enum(['NONE', 'DUE_DATE', 'ASSIGNEE', 'COLUMN', 'PRIORITY']).default('NONE'),
    sort: z
      .object({
        field: z.enum(['DUE_DATE', 'PRIORITY', 'REMAINING_HOURS', 'UPDATED_AT', 'NUMBER']),
        dir: z.enum(['ASC', 'DESC']).default('ASC'),
      })
      .optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();

export const dataQuerySpecSchema = z.preprocess(pruneQuerySpec, rawQuerySpecSchema);
export type DataQuerySpec = z.infer<typeof rawQuerySpecSchema>;

// ── Khối hiển thị: backend dựng, web vẽ ──────────────────────

export interface BlockRef {
  type: 'task' | 'user' | 'sprint' | 'skill' | 'notification';
  id: string;
  /** Nhãn ngắn để hiện (ST-6, tên người…) */
  key?: string;
}

export interface BlockBadge {
  text: string;
  tone?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'danger';
}

export interface BlockItem {
  ref?: BlockRef;
  title: string;
  subtitle?: string;
  badges?: BlockBadge[];
  meta?: { icon?: 'clock' | 'user' | 'calendar' | 'flag' | 'link'; text: string }[];
}

export interface StatItem {
  label: string;
  value: number | string;
  unit?: string;
  tone?: BlockBadge['tone'];
  hint?: string;
}

export type QueryBlock =
  | { kind: 'stat_row'; items: StatItem[] }
  /** `title`: tiêu đề nhỏ khi một kết quả có nhiều danh sách (vd. báo cáo sprint) */
  | { kind: 'task_list'; items: BlockItem[]; title?: string }
  | { kind: 'agenda'; groups: { label: string; tone?: BlockBadge['tone']; items: BlockItem[] }[] }
  | { kind: 'people_list'; items: BlockItem[] }
  | { kind: 'person_card'; item: BlockItem; stats: StatItem[] }
  | {
      kind: 'table';
      title?: string;
      columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[];
      rows: { ref?: BlockRef; cells: Record<string, string | number | null> }[];
    }
  | {
      kind: 'heatmap';
      columns: string[];
      rows: {
        label: string;
        ref?: BlockRef;
        cells: { text: string; tone?: BlockBadge['tone'] }[];
      }[];
    }
  | {
      kind: 'bar_chart';
      /** `compare` (tuỳ chọn): cột thứ hai cạnh cột chính, vd. cam kết cạnh hoàn thành */
      series: { label: string; value: number; compare?: number }[];
      unit?: string;
      compareLabel?: string;
    }
  | {
      kind: 'line_chart';
      /** `null` = ngày không có số liệu (vd. thiếu snapshot) — web nối qua, không vẽ về 0 */
      points: { label: string; value: number | null; compare?: number | null }[];
      unit?: string;
      compareLabel?: string;
    }
  | { kind: 'activity_list'; items: BlockItem[] }
  | { kind: 'note'; text: string; tone?: BlockBadge['tone'] }
  | { kind: 'empty'; title: string; description?: string };

export interface QueryResult {
  intent: QueryIntent;
  generatedAt: string;
  /** Minh bạch nguồn số: endpoint tương đương + tham số + số bản ghi. */
  source: { endpoint: string; params: Record<string, unknown>; rowCount: number };
  blocks: QueryBlock[];
  /** Cắt bớt để không nhồi cả nghìn dòng vào chat. */
  truncated?: { shown: number; total: number; moreHref?: string };
}
