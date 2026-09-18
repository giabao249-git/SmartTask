import type { ProviderUsage } from './gemini';
import type { JsonSchema } from './response-schemas';

/** Ollama `/api/chat` (kế hoạch B chạy cục bộ, docs 07 §5): `format` nhận JSON Schema → structured output. */
export function ollamaChatUrl(baseUrl?: string | null): string {
  const base = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  return base.endsWith('/api/chat') ? base : `${base}/api/chat`;
}

export function ollamaBody(i: {
  model: string;
  system: string;
  userText: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: JsonSchema;
  supportsStructuredOutput: boolean;
}): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (i.temperature !== undefined) options.temperature = i.temperature;
  if (i.maxOutputTokens) options.num_predict = i.maxOutputTokens;
  return {
    model: i.model,
    stream: false,
    messages: [
      { role: 'system', content: i.system },
      { role: 'user', content: i.userText },
    ],
    format:
      i.supportsStructuredOutput && i.responseSchema
        ? i.responseSchema
        : 'json',
    options,
  };
}

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
}

export function readOllama(raw: unknown): {
  text: string;
  usage: ProviderUsage;
  truncated: boolean;
} {
  const data = (raw ?? {}) as OllamaResponse;
  const text: string =
    typeof data.message?.content === 'string' ? data.message.content : '';
  const inputTokens = Number(data.prompt_eval_count ?? 0);
  const outputTokens = Number(data.eval_count ?? 0);
  return {
    text,
    truncated: data.done_reason === 'length',
    usage: {
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      reasoningTokens: 0,
      totalTokens: inputTokens + outputTokens,
    },
  };
}
