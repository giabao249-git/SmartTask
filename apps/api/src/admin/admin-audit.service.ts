import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogPayload {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
  reason?: string | null;
}

const GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);
  private readonly hmacSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.hmacSecret =
      this.config.get('JWT_ACCESS_SECRET', { infer: true }) ||
      'smarttask_audit_secret_key';
  }

  /** Hàm tính mã băm HMAC chuẩn hóa cho một bản ghi kiểm toán */
  computeRecordHash(
    previousHash: string,
    timestamp: string,
    record: {
      actorId?: string | null;
      action: string;
      targetType: string;
      targetId?: string | null;
      beforeState?: any;
      afterState?: any;
      reason?: string | null;
    },
  ): string {
    const rawString = [
      previousHash,
      timestamp,
      record.actorId || 'system',
      record.action,
      record.targetType,
      record.targetId || '',
      JSON.stringify(record.beforeState || null),
      JSON.stringify(record.afterState || null),
      record.reason || '',
    ].join('|');

    return crypto
      .createHmac('sha256', this.hmacSecret)
      .update(rawString)
      .digest('hex');
  }

  /** Ghi nhận nhật ký kiểm toán với chuỗi băm HMAC liên kết (HMAC Chaining) */
  async log(payload: AuditLogPayload) {
    try {
      const latest = await this.prisma.systemAuditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { currentHash: true },
      });

      const previousHash = latest?.currentHash || GENESIS_HASH;
      const recordDate = new Date();
      const timestamp = recordDate.toISOString();

      const currentHash = this.computeRecordHash(
        previousHash,
        timestamp,
        payload,
      );

      return await this.prisma.systemAuditLog.create({
        data: {
          createdAt: recordDate,
          actorId: payload.actorId,
          actorEmail: payload.actorEmail,
          action: payload.action,
          targetType: payload.targetType,
          targetId: payload.targetId,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          beforeState:
            payload.beforeState !== undefined ? payload.beforeState : undefined,
          afterState:
            payload.afterState !== undefined ? payload.afterState : undefined,
          reason: payload.reason,
          previousHash,
          currentHash,
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Lỗi ghi SystemAuditLog: ${error.message}`,
        error.stack,
      );
    }
  }

  /** Xác minh tính toàn vẹn chuỗi băm HMAC của N bản ghi gần nhất */
  async verifyIntegrity(limit = 50): Promise<{
    verifiedCount: number;
    isCompromised: boolean;
    brokenAtId?: string;
    compromiseReason?: 'BROKEN_CHAIN_LINK' | 'PAYLOAD_TAMPERED';
  }> {
    const logs = await this.prisma.systemAuditLog.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let prevHash = GENESIS_HASH;
    for (const record of logs) {
      // 1. Kiểm tra tính liên tục của mắt xích (Chain continuity)
      if (record.previousHash !== prevHash) {
        return {
          verifiedCount: logs.length,
          isCompromised: true,
          brokenAtId: record.id,
          compromiseReason: 'BROKEN_CHAIN_LINK',
        };
      }

      // 2. Kiểm tra tính toàn vẹn của nội dung bản ghi (Payload integrity)
      const expectedHash = this.computeRecordHash(
        record.previousHash,
        record.createdAt.toISOString(),
        record,
      );

      if (record.currentHash !== expectedHash) {
        return {
          verifiedCount: logs.length,
          isCompromised: true,
          brokenAtId: record.id,
          compromiseReason: 'PAYLOAD_TAMPERED',
        };
      }

      prevHash = record.currentHash;
    }

    return {
      verifiedCount: logs.length,
      isCompromised: false,
    };
  }
}
