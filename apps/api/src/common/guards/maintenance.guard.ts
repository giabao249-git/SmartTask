import { CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../app-error';
import { PlatformStateService } from '../../admin/platform-state.service';
import type { JwtUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const SAFE_PREFIXES = ['/admin', '/auth', '/health', '/me'];
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Thực thi chế độ bảo trì toàn sàn (UC-41): READ_ONLY chặn mọi ghi, FULL chặn cả đọc.
 * Quản trị nền tảng vẫn vào được để tắt bảo trì; `/auth`, `/health` luôn mở để đăng nhập và giám sát.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly state: PlatformStateService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();
    const path = req.path.replace(/^\/api\/v1/, '');
    if (SAFE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)))
      return true;

    const maintenance = await this.state.getMaintenance();
    if (maintenance.mode === 'DISABLED') return true;
    const isWrite = WRITE_METHODS.has(req.method);
    if (maintenance.mode === 'READ_ONLY' && !isWrite) return true;

    if (req.user?.id && (await this.isPlatformAdmin(req.user.id))) return true;

    throw new AppError('MAINTENANCE_MODE', HttpStatus.SERVICE_UNAVAILABLE, {
      mode: maintenance.mode,
      reason: maintenance.reason,
      expectedDurationMinutes: maintenance.expectedDurationMinutes,
      since: maintenance.updatedAt,
    });
  }

  private async isPlatformAdmin(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true, platformRole: true },
    });
    return !!u && (u.isSuperAdmin || u.platformRole !== null);
  }
}
