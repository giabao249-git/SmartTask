import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiLogStatus, AiProvider, AiPurpose, Prisma } from '@prisma/client';
import type { Env } from '../../config/env.schema';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { ResolvedAiConfig } from '../ai-config/ai-config.service';
import { hashPrompt } from '../ai-config/crypto.util';
import { tachPromptTinhDong } from '../prompt/prompt-assembler';
import { fakeGenerate } from './fake-provider';
import { mockGenerate } from './mock-provider';
import {
  geminiBody,
  thinkingBudgetFor,
  geminiGenerateUrl,
  geminiHeaders,
  readGemini,
  type ProviderUsage,
} from './gemini';
import { GeminiPromptCacheService } from './gemini-prompt-cache.service';
import { ollamaBody, ollamaChatUrl, readOllama } from './ollama';
import { RESPONSE_SCHEMAS } from './response-schemas';
import { AiCircuitBreakerService } from '../ai-circuit-breaker.service';

export interface AiCallInput {
  config: ResolvedAiConfig;
  purpose: AiPurpose;
  /** systemInstruction (Master + Workspace + khung đầu ra) */
  system: string;
  /** static + mốc + dynamic */
  userText: string;
  staticHash: string;
  endpoint: string;
  workspaceId: string | null;
  userId: string | null;
  /** Câu người dùng gõ — cắt 2.000 ký tự, LUÔN ghi */
  userMessage?: string;
  promptVersions?: { master: number; workspace: number };
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiCallResult {
  text: string;
  usage: ProviderUsage;
  durationMs: number;
  estimatedCost: number;
  truncated: boolean;
  provider: string;
  model: string;
  logId: string | null;
  cachedContentUsed: boolean;
}

class RetryableError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
    public readonly rawBody?: string,
  ) {
    super(message);
  }
}
class TimeoutError extends Error {}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const DEFAULT_MAX_OUTPUT = 4096;

/**
 * Bộ chuyển đổi gọi LLM (docs 05 §2, 07 §4): retry lỗi mạng/5xx/429 (lùi cấp số nhân), timeout theo cấu hình,
 * tính tiền theo giá catalog và LUÔN ghi một dòng `ai_token_logs` kể cả khi lỗi — ghi log không được làm hỏng lượt.
 * Kế thừa ELPREP `ai-provider.service.ts` và Table_Calendar `ai-v2/provider.service.ts`.
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promptCache: GeminiPromptCacheService,
    private readonly config: ConfigService<Env, true>,
    private readonly circuitBreaker: AiCircuitBreakerService,
  ) {}

  async call(input: AiCallInput): Promise<AiCallResult> {
    // Chặn request trước khi đến AI Provider nếu chạm ngưỡng ngân sách toàn nền tảng
    await this.circuitBreaker.assertCircuitBreaker();

    const { config } = input;
    const started = Date.now();
    let lastError: unknown;
    let usedCache = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const out = await this.callOnce(input);
        usedCache = out.cachedContentUsed;
        const durationMs = Date.now() - started;
        const estimatedCost = estimateCost(config.prices, out.usage);
        const logId = await this.writeLog(input, {
          status: out.blocked
            ? AiLogStatus.INVALID_OUTPUT
            : AiLogStatus.SUCCESS,
          durationMs,
          usage: out.usage,
          estimatedCost,
          errorMessage: out.blocked ? `Bị chặn: ${out.blocked}` : undefined,
          rawResponse:
            out.blocked || config.advanced.trace.enabled
              ? out.text.slice(0, 20_000)
              : undefined,
        });
        if (out.blocked && !out.text)
          throw new AppError(
            'AI_RESPONSE_INVALID',
            HttpStatus.SERVICE_UNAVAILABLE,
            { reason: out.blocked },
          );
        return {
          text: out.text,
          usage: out.usage,
          durationMs,
          estimatedCost,
          truncated: out.truncated,
          provider: config.provider,
          model: config.model,
          logId,
          cachedContentUsed: usedCache,
        };
      } catch (e) {
        lastError = e;
        if (e instanceof AppError) throw e;
        if (e instanceof RetryableError && attempt < MAX_ATTEMPTS) {
          const waitMs =
            e.status === 429
              ? Math.min(8000, (e.retryAfterSeconds ?? 2) * 1000)
              : 500 * 2 ** (attempt - 1);
          this.logger.warn(
            `[AI retry] ${config.provider}/${config.model} lần ${attempt}/${MAX_ATTEMPTS} sau ${waitMs} ms: ${e.message}`,
          );
          await sleep(waitMs);
          continue;
        }
        break;
      }
    }

    const durationMs = Date.now() - started;
    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    const status =
      lastError instanceof TimeoutError
        ? AiLogStatus.TIMEOUT
        : AiLogStatus.ERROR;
    await this.writeLog(input, {
      status,
      durationMs,
      usage: zeroUsage(),
      estimatedCost: 0,
      errorMessage: message.slice(0, 1000),
      rawResponse: (lastError as { rawBody?: string })?.rawBody,
    });
    this.logger.error(
      `[AI] ${config.provider}/${config.model} thất bại sau ${durationMs} ms: ${message}`,
    );
    const retryAfter = (lastError as RetryableError)?.retryAfterSeconds;
    throw new AppError(
      'AI_PROVIDER_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
      {
        provider: config.provider,
        model: config.model,
        ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
      },
      `Gọi AI thất bại (${config.provider}/${config.model}): ${message.slice(0, 300)}`,
    );
  }

  private async callOnce(input: AiCallInput): Promise<{
    text: string;
    usage: ProviderUsage;
    truncated: boolean;
    blocked?: string;
    cachedContentUsed: boolean;
  }> {
    const { config } = input;
    if (config.provider === 'FAKE')
      return {
        text:
          config.model === 'mock'
            ? await mockGenerate(input.purpose, input.system, input.userText)
            : fakeGenerate(input.purpose, input.userText),
        usage: {
          inputTokens: Math.ceil(input.userText.length / 4),
          cachedInputTokens: 0,
          outputTokens: 200,
          reasoningTokens: 0,
          totalTokens: Math.ceil(input.userText.length / 4) + 200,
        },
        truncated: false,
        cachedContentUsed: false,
      };
    if (config.provider === AiProvider.GEMINI) return this.callGemini(input);
    if (config.provider === AiProvider.OLLAMA) return this.callOllama(input);
    if (config.provider === AiProvider.DEEPSEEK)
      return this.callDeepSeek(input);
    if (config.provider === AiProvider.OPENAI) return this.callOpenAi(input);
    throw new Error(
      `Nhà cung cấp ${String(config.provider)} chưa được hỗ trợ ở Phase 7`,
    );
  }

  private async callGemini(input: AiCallInput) {
    const { config } = input;
    if (!config.apiKey)
      throw new AppError(
        'AI_PROVIDER_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          reason:
            'Chưa có khoá Gemini: đặt GEMINI_API_KEY hoặc tạo cấu hình AI cho workspace',
        },
      );
    const { tinh, dong } = tachPromptTinhDong(input.userText);
    const cachedContent = tinh
      ? await this.promptCache.cachedContentFor(
          config,
          input.system,
          tinh,
          input.staticHash,
        )
      : undefined;
    const maxOut =
      input.maxOutputTokens ??
      config.advanced.maxOutputTokens ??
      DEFAULT_MAX_OUTPUT;
    const body = geminiBody({
      system: input.system,
      userText: cachedContent ? dong : input.userText,
      temperature: input.temperature ?? config.advanced.temperature,
      maxOutputTokens: maxOut,
      thinkingBudget: thinkingBudgetFor(
        maxOut,
        config.advanced.thinkingBudget,
        config.caps.isReasoning,
      ),
      supportsTemperature: config.caps.supportsTemperature,
      responseSchema: config.caps.supportsStructuredOutput
        ? RESPONSE_SCHEMAS[input.purpose]
        : undefined,
      cachedContent,
    });
    try {
      const data = await this.post(
        geminiGenerateUrl(config.model, config.baseUrl),
        geminiHeaders(config.apiKey),
        body,
        config.timeoutMs,
      );
      return { ...readGemini(data), cachedContentUsed: !!cachedContent };
    } catch (e) {
      if (cachedContent) this.promptCache.invalidate(config, input.staticHash);
      throw e;
    }
  }

  private async callOllama(input: AiCallInput) {
    const { config } = input;
    const body = ollamaBody({
      model: config.model,
      system: input.system,
      userText: input.userText,
      temperature: input.temperature ?? config.advanced.temperature,
      maxOutputTokens:
        input.maxOutputTokens ??
        config.advanced.maxOutputTokens ??
        DEFAULT_MAX_OUTPUT,
      responseSchema: RESPONSE_SCHEMAS[input.purpose],
      supportsStructuredOutput: config.caps.supportsStructuredOutput,
    });
    const data = await this.post(
      ollamaChatUrl(config.baseUrl),
      { 'Content-Type': 'application/json' },
      body,
      config.timeoutMs,
    );
    return { ...readOllama(data), cachedContentUsed: false };
  }

  private callDeepSeek(input: AiCallInput) {
    return this.callOpenAiCompatible(input, {
      providerLabel: 'DeepSeek',
      envKey: 'DEEPSEEK_API_KEY',
      defaultBaseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-v4.1-flash',
    });
  }

  /** OpenAI (GPT) dùng cùng giao thức /chat/completions với DeepSeek — chỉ khác khoá, base URL và tên tham số. */
  private callOpenAi(input: AiCallInput) {
    return this.callOpenAiCompatible(input, {
      providerLabel: 'OpenAI',
      envKey: 'OPENAI_API_KEY',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-6-luna',
    });
  }

  private async callOpenAiCompatible(
    input: AiCallInput,
    opts: {
      providerLabel: string;
      envKey: 'DEEPSEEK_API_KEY' | 'OPENAI_API_KEY';
      defaultBaseUrl: string;
      defaultModel: string;
    },
  ) {
    const { config } = input;
    const apiKey =
      config.apiKey ||
      this.config.get(opts.envKey, { infer: true }) ||
      process.env[opts.envKey];

    if (!apiKey)
      throw new AppError(
        'AI_PROVIDER_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          reason: `Chưa có khoá ${opts.providerLabel}: đặt ${opts.envKey} hoặc điền khoá trong cấu hình AI của workspace`,
        },
      );

    const baseUrl = (config.baseUrl || opts.defaultBaseUrl).replace(/\/$/, '');
    const maxParam = config.caps.maxOutputTokenParam || 'max_tokens';
    const body: Record<string, unknown> = {
      model: config.model || opts.defaultModel,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.userText },
      ],
      temperature: input.temperature ?? config.advanced.temperature ?? 0.7,
      [maxParam]:
        input.maxOutputTokens ??
        config.advanced.maxOutputTokens ??
        DEFAULT_MAX_OUTPUT,
    };
    if (config.caps.supportsStructuredOutput) {
      body.response_format = { type: 'json_object' };
    }

    const data = (await this.post(
      `${baseUrl}/chat/completions`,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      config.timeoutMs,
    )) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        prompt_cache_hit_tokens?: number;
        completion_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
        total_tokens?: number;
      };
    };

    const choice = data?.choices?.[0];
    const text = choice?.message?.content || '';
    const usage = data?.usage || {};
    return {
      text,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        cachedInputTokens: usage.prompt_cache_hit_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens || 0,
        totalTokens:
          usage.total_tokens ||
          (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
      },
      truncated: choice?.finish_reason === 'length',
      cachedContentUsed: (usage.prompt_cache_hit_tokens || 0) > 0,
    };
  }

  private async post(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const detail = extractErrorDetail(text) ?? `HTTP ${res.status}`;
        const retryAfter = Number(res.headers.get('retry-after')) || undefined;
        if (RETRYABLE_STATUS.has(res.status))
          throw new RetryableError(
            `HTTP ${res.status}: ${detail}`,
            res.status,
            retryAfter,
            text.slice(0, 4000),
          );
        const err = new Error(`HTTP ${res.status}: ${detail}`) as Error & {
          rawBody?: string;
        };
        err.rawBody = text.slice(0, 4000);
        throw err;
      }
      return await res.json();
    } catch (e) {
      if (abort.signal.aborted)
        throw new TimeoutError(
          `Nhà cung cấp không trả lời trong ${timeoutMs} ms`,
        );
      if (e instanceof TypeError)
        throw new RetryableError(`Lỗi mạng: ${e.message}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ghi sổ token (docs 07 §4) — bọc try/catch, thất bại chỉ warn. */
  private async writeLog(
    input: AiCallInput,
    r: {
      status: AiLogStatus;
      durationMs: number;
      usage: ProviderUsage;
      estimatedCost: number;
      errorMessage?: string;
      rawResponse?: string;
    },
  ): Promise<string | null> {
    const { config } = input;
    try {
      const { dong } = tachPromptTinhDong(input.userText);
      const row = await this.prisma.aiTokenLog.create({
        data: {
          configId: config.configId,
          workspaceId: input.workspaceId,
          userId: input.userId,
          endpoint: input.endpoint,
          purpose: input.purpose,
          provider:
            config.provider === 'FAKE' ? AiProvider.OLLAMA : config.provider,
          model: config.model,
          inputTokens: r.usage.inputTokens,
          cachedInputTokens: r.usage.cachedInputTokens,
          outputTokens: r.usage.outputTokens,
          reasoningTokens: r.usage.reasoningTokens,
          totalTokens: r.usage.totalTokens,
          estimatedCost: r.estimatedCost,
          durationMs: r.durationMs,
          status: r.status,
          errorMessage: r.errorMessage ?? null,
          promptChars: input.system.length + input.userText.length,
          promptHash: hashPrompt(`${input.system}\n${input.userText}`),
          masterPromptVersion: input.promptVersions?.master ?? null,
          workspacePromptVersion: input.promptVersions?.workspace ?? null,
          userMessage: input.userMessage?.slice(0, 2000) ?? null,
          promptText: config.advanced.trace.enabled
            ? dong.slice(0, 50_000)
            : null,
          rawResponse: r.rawResponse ?? null,
        },
        select: { id: true },
      });
      return row.id;
    } catch (e) {
      this.logger.warn(`Không ghi được ai_token_logs: ${String(e)}`);
      return null;
    }
  }

  /** Gắn message/proposal vào dòng log sau khi có id. */
  async attachLog(
    logId: string | null,
    data: { proposalId?: string; messageId?: string },
  ): Promise<void> {
    if (!logId) return;
    try {
      await this.prisma.aiTokenLog.update({
        where: { id: logId },
        data: data as Prisma.AiTokenLogUpdateInput,
      });
    } catch (e) {
      this.logger.warn(
        `Không cập nhật được ai_token_logs ${logId}: ${String(e)}`,
      );
    }
  }
}

/** cost_usd = (input − cached) × giá vào + cached × giá cache + output × giá ra, giá theo 1M token (docs 07 §5). */
export function estimateCost(
  prices: { input: number; output: number; cachedInput: number },
  u: ProviderUsage,
): number {
  const uncached = Math.max(0, u.inputTokens - u.cachedInputTokens);
  const usd =
    (uncached * prices.input +
      u.cachedInputTokens * prices.cachedInput +
      (u.outputTokens + u.reasoningTokens) * prices.output) /
    1_000_000;
  return Math.round(usd * 1e8) / 1e8;
}

function zeroUsage(): ProviderUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

function extractErrorDetail(body: string): string | null {
  try {
    const j = JSON.parse(body) as {
      error?: { message?: string };
      message?: string;
    };
    return j?.error?.message ?? j?.message ?? null;
  } catch {
    return body ? body.slice(0, 300) : null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
