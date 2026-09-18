import type { JsonSchema } from './response-schemas';
import { toGeminiSchema } from './response-schemas';

/**
 * Dựng URL/body cho Gemini `generateContent` (REST v1beta) — kế thừa `gemini-api.util.ts` (Table_Calendar):
 * baseUrl bỏ trống → endpoint chuẩn; có `{model}` → thay; đã có `:generateContent` → dùng nguyên.
 */
export const DEFAULT_GEMINI_ROOT =
  'https://generativelanguage.googleapis.com/v1beta';

export function geminiGenerateUrl(
  model: string,
  baseUrl?: string | null,
): string {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
  const m = encodeURIComponent(model);
  if (!base) return `${DEFAULT_GEMINI_ROOT}/models/${m}:generateContent`;
  if (base.includes('{model}')) return base.replaceAll('{model}', m);
  if (base.includes(':generateContent')) return base;
  if (/\/models$/i.test(base)) return `${base}/${m}:generateContent`;
  if (base === 'https://generativelanguage.googleapis.com')
    return `${base}/v1beta/models/${m}:generateContent`;
  return `${base}/models/${m}:generateContent`;
}

/** Endpoint `cachedContents` dựng từ CÙNG base URL để đổi proxy một chỗ là cả hai theo. */
export function geminiCachedContentsUrl(
  baseUrl?: string | null,
  name = '',
): string {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
  const suffix = name
    ? `/${name.replace(/^\/+/, '').replace(/^cachedContents\//, '')}`
    : '';
  if (!base) return `${DEFAULT_GEMINI_ROOT}/cachedContents${suffix}`;
  let root = base;
  const i1 = root.indexOf('{model}');
  if (i1 >= 0) root = root.slice(0, i1);
  const i2 = root.indexOf(':generateContent');
  if (i2 >= 0) root = root.slice(0, i2);
  root = root.replace(/\/+$/, '');
  const i3 = root.lastIndexOf('/models');
  if (i3 >= 0) root = root.slice(0, i3);
  root = root.replace(/\/+$/, '');
  if (root === 'https://generativelanguage.googleapis.com')
    root = `${root}/v1beta`;
  return `${root}/cachedContents${suffix}`;
}

export function geminiHeaders(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
}

export interface GeminiBodyInput {
  system: string;
  userText: string;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  supportsTemperature: boolean;
  responseSchema?: JsonSchema;
  /** Tên `cachedContents/...` — khi có, systemInstruction đã nằm trong cache, không gửi lại */
  cachedContent?: string;
}

export function geminiBody(i: GeminiBodyInput): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
  };
  if (i.supportsTemperature && i.temperature !== undefined)
    generationConfig.temperature = i.temperature;
  if (i.maxOutputTokens) generationConfig.maxOutputTokens = i.maxOutputTokens;
  if (i.responseSchema)
    generationConfig.responseSchema = toGeminiSchema(i.responseSchema);
  if (i.thinkingBudget !== undefined)
    generationConfig.thinkingConfig = { thinkingBudget: i.thinkingBudget };
  return {
    ...(i.cachedContent
      ? { cachedContent: i.cachedContent }
      : { systemInstruction: { parts: [{ text: i.system }] } }),
    contents: [{ role: 'user', parts: [{ text: i.userText }] }],
    generationConfig,
  };
}

export interface ProviderUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
    totalTokenCount?: number;
  };
}

export function readGemini(raw: unknown): {
  text: string;
  usage: ProviderUsage;
  truncated: boolean;
  blocked?: string;
} {
  const data = (raw ?? {}) as GeminiResponse;
  const cand = data.candidates?.[0];
  const text: string =
    cand?.content?.parts
      ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('') ?? '';
  const u = data.usageMetadata ?? {};
  const inputTokens = Number(u.promptTokenCount ?? 0);
  const outputTokens = Number(u.candidatesTokenCount ?? 0);
  const reasoningTokens = Number(u.thoughtsTokenCount ?? 0);
  return {
    text,
    truncated: cand?.finishReason === 'MAX_TOKENS',
    blocked:
      data?.promptFeedback?.blockReason ??
      (cand?.finishReason && !['STOP', 'MAX_TOKENS'].includes(cand.finishReason)
        ? cand.finishReason
        : undefined),
    usage: {
      inputTokens,
      cachedInputTokens: Number(u.cachedContentTokenCount ?? 0),
      outputTokens,
      reasoningTokens,
      totalTokens: Number(
        u.totalTokenCount ?? inputTokens + outputTokens + reasoningTokens,
      ),
    },
  };
}
