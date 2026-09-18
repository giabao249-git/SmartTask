import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiLogStatus, AiPurpose } from '@prisma/client';
import { AppError } from '../../common/app-error';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { mergeSettings } from '../../workspaces/workspace-settings';

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  timezone: string;
}

type Purpose = Extract<AiPurpose, 'DECOMPOSE' | 'ASSIGN' | 'EXPLAIN' | 'CHAT'>;

/**
 * Hạn mức gọi AI theo người/ngày (docs 07 §5): đếm `ai_token_logs` (trừ dòng QUOTA) trên index (user_id, created_at)
 * từ 0h theo múi giờ người dùng; giới hạn lấy từ `settings.ai.dailyLimitPerUser` của workspace (0 = không giới hạn).
 * Hết → 429 AI_QUOTA_EXCEEDED kèm giờ mở lại.
 */
@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async status(
    userId: string,
    workspaceId: string | null,
  ): Promise<QuotaStatus> {
    const [user, ws] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      }),
      workspaceId
        ? this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { settings: true },
          })
        : Promise.resolve(null),
    ]);
    const limit = ws
      ? mergeSettings(ws.settings, {}).ai.dailyLimitPerUser
      : this.config.get('AI_DAILY_LIMIT_PER_USER', { infer: true });
    const { start, next } = dayBounds(user.timezone);
    const used = await this.prisma.aiTokenLog.count({
      where: {
        userId,
        createdAt: { gte: start },
        status: { not: AiLogStatus.QUOTA },
        ...(workspaceId ? { workspaceId } : {}),
      },
    });
    return {
      used,
      limit,
      remaining:
        limit === 0 ? Number.MAX_SAFE_INTEGER : Math.max(0, limit - used),
      resetsAt: next.toISOString(),
      timezone: user.timezone,
    };
  }

  /** Kiểm tính năng bật + hạn mức; hết hạn mức thì ghi một dòng QUOTA (để thống kê) rồi 429. */
  async assert(
    userId: string,
    workspaceId: string,
    purpose: Purpose,
    endpoint: string,
  ): Promise<QuotaStatus> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const settings = mergeSettings(ws.settings, {});
    if (!settings.ai.enabledPurposes.includes(purpose))
      throw new AppError('AI_PURPOSE_DISABLED', HttpStatus.FORBIDDEN, {
        purpose,
      });
    const q = await this.status(userId, workspaceId);
    if (q.limit > 0 && q.used >= q.limit) {
      await this.prisma.aiTokenLog
        .create({
          data: {
            workspaceId,
            userId,
            endpoint,
            purpose,
            provider: 'GEMINI',
            model: '-',
            status: AiLogStatus.QUOTA,
            errorMessage: `Hết hạn mức ${q.limit}/ngày`,
          },
        })
        .catch(() => undefined);
      throw new AppError('AI_QUOTA_EXCEEDED', HttpStatus.TOO_MANY_REQUESTS, {
        used: q.used,
        limit: q.limit,
        resetsAt: q.resetsAt,
      });
    }
    return q;
  }
}

/** Mốc 0h hôm nay và 0h ngày mai theo múi giờ IANA (không cần thư viện). */
export function dayBounds(
  timezone: string,
  now = new Date(),
): { start: Date; next: Date } {
  let tz = timezone;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  // Giờ địa phương hiện tại → lệch với UTC → 0h địa phương tính ngược ra UTC
  const localAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  const offsetMs = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const startLocal = Date.UTC(get('year'), get('month') - 1, get('day'));
  const start = new Date(startLocal - offsetMs);
  return { start, next: new Date(start.getTime() + 86_400_000) };
}
