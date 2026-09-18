import { Injectable, Logger } from '@nestjs/common';
import { AiCacheMode } from '@prisma/client';
import type { ResolvedAiConfig } from '../ai-config/ai-config.service';
import { geminiCachedContentsUrl, geminiHeaders } from './gemini';

interface Entry {
  name: string;
  expiresAt: number;
}

/**
 * Cache phần TĨNH của prompt bằng Gemini `cachedContents` (docs 07 §3): tạo đối tượng có `ttl`, các lượt sau chỉ gửi
 * phần động kèm tên cache. Mặc định TẮT; mọi nhánh hỏng đều quay về gửi nguyên prompt và nghỉ 5 phút —
 * cache là tối ưu, không phải điều kiện. Kế thừa `ai-config/gemini-prompt-cache.service.ts` (Table_Calendar).
 */
@Injectable()
export class GeminiPromptCacheService {
  private readonly logger = new Logger(GeminiPromptCacheService.name);
  private readonly entries = new Map<string, Entry>();
  private failedUntil = 0;

  /** Tên cache dùng được cho (model, hash tĩnh) — undefined = gửi nguyên. */
  async cachedContentFor(
    config: ResolvedAiConfig,
    system: string,
    staticText: string,
    staticHash: string,
  ): Promise<string | undefined> {
    const pc = config.advanced.promptCache;
    if (
      !pc.enabled ||
      config.caps.cacheMode !== AiCacheMode.GEMINI_CACHED_CONTENTS
    )
      return undefined;
    if (!config.apiKey || system.length + staticText.length < pc.minStaticChars)
      return undefined;
    if (Date.now() < this.failedUntil) return undefined;
    const key = `${config.model}:${staticHash}`;
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt - 30_000 > Date.now()) return hit.name;
    try {
      const res = await fetch(geminiCachedContentsUrl(config.baseUrl), {
        method: 'POST',
        headers: geminiHeaders(config.apiKey),
        body: JSON.stringify({
          model: `models/${config.model}`,
          displayName: key,
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: staticText }] }],
          ttl: `${pc.ttlSeconds}s`,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!res.ok)
        throw new Error(
          `HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`,
        );
      const json = (await res.json()) as { name?: string };
      if (!json.name) throw new Error('thiếu name');
      this.entries.set(key, {
        name: json.name,
        expiresAt: Date.now() + pc.ttlSeconds * 1000,
      });
      this.logger.log(
        `[Cache prompt] tạo ${json.name} (${staticText.length} ký tự, ttl ${pc.ttlSeconds}s)`,
      );
      return json.name;
    } catch (e) {
      this.failedUntil = Date.now() + 5 * 60_000;
      this.logger.warn(
        `[Cache prompt] tạo cache lỗi, gửi nguyên prompt 5 phút: ${String(e)}`,
      );
      return undefined;
    }
  }

  /** Request dùng cache bị từ chối (cache đã chết) → bỏ entry để lượt sau tạo lại. */
  invalidate(config: ResolvedAiConfig, staticHash: string): void {
    this.entries.delete(`${config.model}:${staticHash}`);
  }
}
