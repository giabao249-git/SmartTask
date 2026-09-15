import { Injectable } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';
import { AppError } from '../app-error';
import { PrismaService } from '../../prisma/prisma.service';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/** Một nơi duy nhất trả lời "người này có vai gì trong workspace này" — guard và service đều dùng. */
@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async roleOf(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceRole | null> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true, workspace: { select: { archivedAt: true } } },
    });
    if (!m || m.workspace.archivedAt) return null;
    return m.role;
  }

  /** Ném 404 nếu không phải thành viên (không lộ workspace tồn tại), 403 nếu thiếu vai. */
  async assertRole(
    userId: string,
    workspaceId: string,
    allowed: WorkspaceRole[],
  ): Promise<WorkspaceRole> {
    const role = await this.roleOf(userId, workspaceId);
    if (!role) throw AppError.notFound({ workspaceId });
    if (allowed.length > 0 && !allowed.includes(role))
      throw AppError.forbidden({ required: allowed });
    return role;
  }

  /** Vai tối thiểu theo thứ bậc VIEWER < MEMBER < ADMIN < OWNER. */
  async assertAtLeast(
    userId: string,
    workspaceId: string,
    min: WorkspaceRole,
  ): Promise<WorkspaceRole> {
    const role = await this.roleOf(userId, workspaceId);
    if (!role) throw AppError.notFound({ workspaceId });
    if (ROLE_RANK[role] < ROLE_RANK[min])
      throw AppError.forbidden({ required: min });
    return role;
  }
}
