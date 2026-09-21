import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { PlatformRole } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../app-error';
import type { JwtUser } from '../decorators/current-user.decorator';
import {
  IS_SYSTEM_ADMIN_KEY,
  PLATFORM_ROLES_KEY,
} from '../decorators/system-admin.decorator';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlatformAdminContext {
  isSuperAdmin: boolean;
  role: PlatformRole;
  email: string;
}

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSystemAdmin = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_SYSTEM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRoles = this.reflector.getAllAndOverride<
      PlatformRole[] | undefined
    >(PLATFORM_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!isSystemAdmin && !requiredRoles) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<
        Request & { user?: JwtUser; platformAdmin?: PlatformAdminContext }
      >();

    if (!req.user || !req.user.id || !req.user.email) {
      throw new AppError(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        undefined,
        'Vui lòng đăng nhập để truy cập',
      );
    }

    const systemAdminEmails =
      this.config.get('SYSTEM_ADMIN_EMAILS', {
        infer: true,
      }) || [];
    const isEnvAdmin = systemAdminEmails.includes(req.user.email.toLowerCase());

    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        isActive: true,
        isSuperAdmin: true,
        platformRole: true,
      },
    });

    if (!user || !user.isActive) {
      throw AppError.forbidden({
        code: 'USER_INACTIVE',
        message: 'Tài khoản người dùng đã bị vô hiệu hoá hoặc không tồn tại',
      });
    }

    const hasSuperAdminPrivilege = user.isSuperAdmin || isEnvAdmin;

    if (!hasSuperAdminPrivilege && !user.platformRole) {
      throw AppError.forbidden({
        code: 'PLATFORM_ADMIN_REQUIRED',
        message:
          'Bạn không có quyền quản trị toàn nền tảng (Platform Super Admin)',
      });
    }

    const effectiveRole: PlatformRole =
      user.platformRole ??
      (hasSuperAdminPrivilege ? 'ROOT_ADMIN' : 'CUSTOMER_SUPPORT');

    if (requiredRoles && requiredRoles.length > 0) {
      const isRoot = effectiveRole === 'ROOT_ADMIN' || isEnvAdmin;
      const hasMatchingRole = requiredRoles.includes(effectiveRole);

      if (!isRoot && !hasMatchingRole) {
        throw AppError.forbidden({
          code: 'PLATFORM_ROLE_UNAUTHORIZED',
          message: `Thao tác yêu cầu một trong các vai trò: ${requiredRoles.join(', ')}`,
        });
      }
    }

    req.platformAdmin = {
      isSuperAdmin: true,
      role: effectiveRole,
      email: user.email,
    };

    return true;
  }
}
