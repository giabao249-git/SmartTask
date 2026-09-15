import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '@prisma/client';
import type { Request } from 'express';
import type { JwtUser } from '../decorators/current-user.decorator';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import { WorkspaceAccessService } from '../access/workspace-access.service';

/**
 * Kiểm quyền theo DỮ LIỆU: đọc :wsId từ URL, tra workspace_members. Không tin workspaceId trong body.
 * Kết quả gắn vào req.workspaceRole để service dùng lại mà không truy vấn thêm.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: WorkspaceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles === undefined) return true; // route không gắn decorator → không kiểm ở đây

    const req = context
      .switchToHttp()
      .getRequest<Request & { user: JwtUser; workspaceRole?: WorkspaceRole }>();
    const wsId = req.params.wsId;
    if (typeof wsId !== 'string' || !wsId) return true;
    req.workspaceRole = await this.access.assertRole(req.user.id, wsId, roles);
    return true;
  }
}
