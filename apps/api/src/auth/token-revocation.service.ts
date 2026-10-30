import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TokenStatus = 'OK' | 'ACCOUNT_LOCKED' | 'SESSION_REVOKED';

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly lockedUsers = new Set<string>();
  private readonly revocations = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** Thu hồi toàn bộ phiên đăng nhập của một người dùng (Kill switch) */
  async revokeUser(userId: string): Promise<void> {
    const now = Date.now();
    this.revocations.set(userId, now);

    try {
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
      await this.prisma.platformSetting.upsert({
        where: { key: `token_revoked_${userId}` },
        create: {
          key: `token_revoked_${userId}`,
          value: now as unknown as Prisma.InputJsonValue,
        },
        update: {
          value: now as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.error(`Lỗi lưu mốc thu hồi phiên user ${userId}: ${(e as Error).message}`);
    }
  }

  /** Thu hồi toàn bộ phiên đăng nhập của người dùng (alias theo RFC / spec) */
  async revokeAllForUser(userId: string): Promise<void> {
    return this.revokeUser(userId);
  }

  /** Khóa tài khoản Người dùng Toàn cục (Global Ban) */
  async banUser(userId: string, reason?: string): Promise<void> {
    this.lockedUsers.add(userId);
    await this.revokeUser(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  /** Mở khóa tài khoản Người dùng */
  async unbanUser(userId: string): Promise<void> {
    this.lockedUsers.delete(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }

  /** Kiểm tra tính hợp lệ của token dựa trên thời điểm cấp iat và trạng thái khóa tài khoản */
  async checkToken(userId: string, tokenIatSeconds?: number): Promise<TokenStatus> {
    // 1. Kiểm tra tài khoản bị khóa trong bộ nhớ
    if (this.lockedUsers.has(userId)) {
      return 'ACCOUNT_LOCKED';
    }

    // 2. Kiểm tra mốc thu hồi phiên trong bộ nhớ
    const revokedAtMs = this.revocations.get(userId);
    if (revokedAtMs) {
      const revokedAtSec = Math.floor(revokedAtMs / 1000);
      if (!tokenIatSeconds || tokenIatSeconds <= revokedAtSec) {
        return 'SESSION_REVOKED';
      }
    }

    // 3. Fallback tra cứu CSDL nếu chưa có trong cache
    if (!this.lockedUsers.has(userId) && !revokedAtMs) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
      });

      if (!user || !user.isActive) {
        this.lockedUsers.add(userId);
        return 'ACCOUNT_LOCKED';
      }

      const revokedSetting = await this.prisma.platformSetting.findUnique({
        where: { key: `token_revoked_${userId}` },
      });

      if (revokedSetting?.value) {
        const persistedRevokedAt = Number(revokedSetting.value);
        this.revocations.set(userId, persistedRevokedAt);
        const persistedRevokedAtSec = Math.floor(persistedRevokedAt / 1000);
        if (!tokenIatSeconds || tokenIatSeconds <= persistedRevokedAtSec) {
          return 'SESSION_REVOKED';
        }
      }
    }

    return 'OK';
  }
}
