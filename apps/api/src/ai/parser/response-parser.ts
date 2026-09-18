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
  const parsed = structuredActionSchema.safeParse(json);
  if (!parsed.success)
    return failed(
      text,
      parsed.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      ),
    );
  return { action: parsed.data, parseFailed: false };
}

function failed(text: string, issues: string[]): ParseResult {
  const action: ChatResponse = {
    type: 'CHAT_RESPONSE',
    schemaVersion: 1,
    reply: text.slice(0, 600),
    parseFailed: true,
  };
  return { action, parseFailed: true, issues };
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
