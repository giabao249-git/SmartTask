import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiLogStatus, Prisma } from '@prisma/client';
import { AppError } from '../common/app-error';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_AI_DAILY_BUDGET_USD = 100.0;
const SETTING_KEY = 'ai_circuit_breaker';

export interface AiCircuitBreakerStatus {
  isOpen: boolean;
  currentCost: number;
  budgetLimit: number;
  currency: 'USD';
  resetsAt: string;
}

@Injectable()
export class AiCircuitBreakerService {
  private readonly logger = new Logger(AiCircuitBreakerService.name);
  private cachedBudget: number | null = null;
  private simulatedTrip = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Lấy ngưỡng ngân sách chi phí AI theo ngày (mặc định $100/ngày) */
  async getBudget(): Promise<number> {
    if (this.cachedBudget !== null) return this.cachedBudget;
    try {
      const row = await this.prisma.platformSetting.findUnique({
        where: { key: SETTING_KEY },
      });
      if (row?.value && typeof (row.value as { budget?: number }).budget === 'number') {
        this.cachedBudget = (row.value as { budget: number }).budget;
        return this.cachedBudget;
      }
    } catch {
      // Bỏ qua lỗi DB fallback về env hoặc mặc định
    }

    const envBudget = Number(this.config.get('AI_GLOBAL_DAILY_BUDGET_USD' as any));
    this.cachedBudget = !isNaN(envBudget) && envBudget > 0 ? envBudget : DEFAULT_AI_DAILY_BUDGET_USD;
    return this.cachedBudget;
  }

  /** Cập nhật ngưỡng ngân sách chi phí theo ngày toàn sàn */
  async setBudget(budget: number, updatedBy?: string): Promise<void> {
    this.cachedBudget = budget;
    this.simulatedTrip = false;
    await this.prisma.platformSetting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: { budget } as unknown as Prisma.InputJsonValue,
        updatedBy,
      },
      update: {
        value: { budget } as unknown as Prisma.InputJsonValue,
        updatedBy,
      },
    });
  }

  /** Mô phỏng ngắt mạch phục vụ kiểm thử (Simulation) */
  setSimulatedTrip(tripped: boolean): void {
    this.simulatedTrip = tripped;
  }

  /** Tính tổng chi phí gọi AI của toàn nền tảng trong ngày hôm nay (từ 0h UTC) */
  async getTodayCost(): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const sum = await this.prisma.aiTokenLog.aggregate({
      where: {
        createdAt: { gte: startOfDay },
        status: { in: [AiLogStatus.SUCCESS, AiLogStatus.INVALID_OUTPUT] },
      },
      _sum: { estimatedCost: true },
    });

    return Math.round((sum._sum.estimatedCost ?? 0) * 1000) / 1000;
  }

  /** Kiểm tra trạng thái mạch ngắt AI */
  async getStatus(): Promise<AiCircuitBreakerStatus> {
    const now = new Date();
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const budgetLimit = await this.getBudget();
    const currentCost = await this.getTodayCost();
    const isOpen = this.simulatedTrip || (budgetLimit > 0 && currentCost >= budgetLimit);

    return {
      isOpen,
      currentCost,
      budgetLimit,
      currency: 'USD',
      resetsAt: resetsAt.toISOString(),
    };
  }

  /** Kiểm tra cờ ngắt mạch đã kích hoạt chưa (tripped) */
  async isTripped(): Promise<boolean> {
    const status = await this.getStatus();
    return status.isOpen;
  }

  /**
   * Ngắt mạch trước khi gọi AI Provider:
   * Nếu tổng chi phí đạt ngưỡng $100/ngày (hoặc ngưỡng cấu hình) → ném 503 AI_PROVIDER_UNAVAILABLE
   */
  async assertCircuitBreaker(): Promise<void> {
    const status = await this.getStatus();
    if (status.isOpen) {
      this.logger.warn(
        `[AI Circuit Breaker OPEN] Tổng chi phí $${status.currentCost}/ngày đã chạm ngưỡng ngân sách $${status.budgetLimit}/ngày. Chặn request trước provider.`,
      );
      throw new AppError(
        'AI_PROVIDER_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          reason: 'CIRCUIT_BREAKER_OPEN',
          currentCost: status.currentCost,
          budgetLimit: status.budgetLimit,
          resetsAt: status.resetsAt,
        },
        `Dịch vụ AI tạm thời ngắt mạch do chi phí toàn hệ thống trong ngày ($${status.currentCost}) đã chạm ngưỡng ngân sách bảo vệ ($${status.budgetLimit}/ngày). Vui lòng thử lại sau.`,
      );
    }
  }
}
