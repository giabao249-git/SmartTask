import {
  structuredActionSchema,
  type ChatResponse,
  type StructuredAction,
} from '@smarttask/shared';

export interface ParseResult {
  action: StructuredAction;
  /** true khi JSON/zod thất bại → action là CHAT_RESPONSE { parseFailed } và caller ghi raw_response */
  parseFailed: boolean;
  issues?: string[];
  /** Những chỗ đã nắn lại hình dạng trước khi kiểm schema — để theo dõi model nào hay sai (05 §5). */
  repairs?: string[];
}

/**
 * Chuỗi LLM → structured action (docs 05 §5): hàm THUẦN, không ném lỗi — thất bại thì trả CHAT_RESPONSE có cờ
 * `parseFailed` kèm văn bản thô đã cắt, để lượt chat không vỡ và log vẫn lần ra được nguyên nhân.
 * Kế thừa `smart-scheduler/learned-knowledge.parser.ts` (Table_Calendar).
 */
export function parseStructuredAction(raw: string): ParseResult {
  const text = stripFences(raw ?? '');
  const json = tryParseJson(text);
  if (json === undefined) return failed(text, ['Không phải JSON']);
  const repairs: string[] = [];
  const normalized = normalizeAction(json, repairs);
  const parsed = structuredActionSchema.safeParse(normalized);
  if (!parsed.success)
    return failed(
      text,
      parsed.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      ),
      repairs,
    );
  return {
    action: parsed.data,
    parseFailed: false,
    ...(repairs.length ? { repairs } : {}),
  };
}

/**
 * Nắn hình dạng đầu ra trước khi kiểm schema — CHỈ những phép biến đổi không mang tính quyết định
 * (ranh giới 05 §2: backend không chọn thay LLM). Sửa các tật cố hữu của structured output phẳng:
 * model điền chuỗi rỗng cho trường không dùng, nhét draftKey vào `targetTask`, hoặc đặt phần sửa
 * vào mảng `tasks` thay vì `patch`. Mỗi lần nắn đều ghi lại vào `repairs` để còn biết mà chỉnh prompt.
 */
export function normalizeAction(raw: unknown, repairs: string[]): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const a = { ...(raw as Record<string, unknown>) };
  dropEmptyCodes(a, repairs, '');
  // Schema Gemini bắt buộc nêu các trường này (được null / []) — null/[] nghĩa là "không dùng"
  for (const k of NULLABLE_ROOT)
    if (a[k] === null || (Array.isArray(a[k]) && !(a[k] as unknown[]).length))
      delete a[k];

  if (a.type === 'UPDATE_TASK_DRAFT') {
    const keys = new Set(
      [
        ...(typeof a.targetDraftKey === 'string' ? [a.targetDraftKey] : []),
        ...(Array.isArray(a.targetDraftKeys)
          ? a.targetDraftKeys.filter((k): k is string => typeof k === 'string')
          : []),
      ].filter((k) => DRAFT_KEY.test(k)),
    );

    // "targetTask": "d2" — model lẫn mã bản nháp với mã task thật
    if (typeof a.targetTask === 'string' && DRAFT_KEY.test(a.targetTask)) {
      keys.add(a.targetTask);
      repairs.push(
        `targetTask "${a.targetTask}" là draftKey → targetDraftKeys`,
      );
      delete a.targetTask;
    }
    if (keys.size) {
      a.targetDraftKeys = [...keys];
      delete a.targetDraftKey;
    }

    // Phần sửa nằm trong mảng tasks/drafts (hình dạng của DECOMPOSE) thay vì `patch`
    if (!isObject(a.patch)) {
      const items = [a.tasks, a.drafts].find(
        (v) => Array.isArray(v) && v.length === 1,
      ) as Record<string, unknown>[] | undefined;
      const item = items?.[0];
      if (isObject(item)) {
        const { draftKey, reason, ...rest } = item;
        const patch = Object.fromEntries(
          Object.entries(rest).filter(([k]) => PATCH_FIELDS.has(k)),
        );
        if (Object.keys(patch).length) {
          a.patch = patch;
          if (
            !keys.size &&
            typeof draftKey === 'string' &&
            DRAFT_KEY.test(draftKey)
          )
            a.targetDraftKeys = [draftKey];
          if (typeof reason === 'string' && !a.resolutionReason)
            a.resolutionReason = reason;
          repairs.push(
            `patch thiếu → dựng từ ${Array.isArray(a.tasks) ? 'tasks[0]' : 'drafts[0]'} (${Object.keys(patch).join(', ')})`,
          );
        }
      }
    }
    delete a.tasks;
    delete a.drafts;

    // Không có gì để sửa thì đây là câu trả lời, không phải đề xuất sửa việc
    if (!isObject(a.patch) || !Object.keys(a.patch).length) {
      repairs.push('UPDATE_TASK_DRAFT không có patch → CHAT_RESPONSE');
      return {
        type: 'CHAT_RESPONSE',
        schemaVersion: a.schemaVersion ?? 1,
        reply: typeof a.reply === 'string' ? a.reply : '',
      };
    }
  }
  return a;
}

/** Mã ngắn/ngày rỗng ("" ) = "không dùng trường này" chứ không phải giá trị — bỏ hẳn trước khi kiểm. */
function dropEmptyCodes(
  node: Record<string, unknown>,
  repairs: string[],
  path: string,
): void {
  for (const [k, v] of Object.entries(node)) {
    const at = path ? `${path}.${k}` : k;
    if (v === '' && CODE_FIELDS.has(k)) {
      delete node[k];
      repairs.push(`${at} rỗng → bỏ`);
      continue;
    }
    if (Array.isArray(v)) {
      const cleaned = v.filter((x) => !(x === '' && CODE_FIELDS.has(k)));
      if (cleaned.length !== v.length) {
        node[k] = cleaned;
        repairs.push(`${at} có phần tử rỗng → bỏ`);
      }
      for (const item of cleaned)
        if (isObject(item)) dropEmptyCodes(item, repairs, at);
      continue;
    }
    if (isObject(v)) dropEmptyCodes(v, repairs, at);
  }
}

const DRAFT_KEY = /^d\d{1,3}$/;

/** Trường gốc schema Gemini bắt buộc có mặt (docs 02/07 — đo 28/09) nhưng chỉ vài type dùng. */
const NULLABLE_ROOT = ['sprint', 'targetDraftKeys', 'patch', 'tasks'] as const;

/** Trường chỉ nhận mã ngắn hoặc ngày — không bao giờ có nghĩa khi là chuỗi rỗng. */
const CODE_FIELDS = new Set([
  'targetTask',
  'targetDraftKey',
  'targetDraftKeys',
  'sprint',
  'suggestedAssignee',
  'assignee',
  'skill',
  'user',
  'task',
  'draft',
  'from',
  'to',
  'start',
  'due',
  'status',
  'dataRef',
  'preset',
]);

/** Trường được phép chuyển từ item sang `patch` (khớp draftPatchSchema). */
const PATCH_FIELDS = new Set([
  'title',
  'description',
  'estimateHours',
  'taskType',
  'priority',
  'difficulty',
  'requiredSkills',
  'subtasks',
  'dependsOn',
  'suggestedAssignee',
  'start',
  'due',
  'sprint',
  'status',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function failed(
  text: string,
  issues: string[],
  repairs: string[] = [],
): ParseResult {
  const action: ChatResponse = {
    type: 'CHAT_RESPONSE',
    schemaVersion: 1,
    reply: text.slice(0, 600),
    parseFailed: true,
  };
  return {
    action,
    parseFailed: true,
    issues,
    ...(repairs.length ? { repairs } : {}),
  };
}

/** Bỏ ```json … ``` và văn bản lạc quanh object đầu tiên. */
export function stripFences(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first > 0 || (last >= 0 && last < s.length - 1))
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return s;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
