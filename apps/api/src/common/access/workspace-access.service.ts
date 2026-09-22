import { HttpStatus, Injectable } from '@nestjs/common';
import { WorkspaceLifecycleStatus, type WorkspaceRole } from '@prisma/client';
import { AppError } from '../app-error';
import { PrismaService } from '../../prisma/prisma.service';

/** Vòng đời workspace do Quản trị Nền tảng đặt (UC-41): ai còn đọc được, ai còn ghi được. */
const LIFECYCLE: Record<
  WorkspaceLifecycleStatus,
  {
    read: boolean;
    write: boolean;
    code: 'WORKSPACE_READ_ONLY' | 'WORKSPACE_SUSPENDED' | null;
  }
> = {
  ACTIVE: { read: true, write: true, code: null },
  WARNING_GRACE: { read: true, write: true, code: null },
  READ_ONLY_ENFORCED: { read: true, write: false, code: 'WORKSPACE_READ_ONLY' },
  SOFT_SUSPENDED: { read: false, write: false, code: 'WORKSPACE_SUSPENDED' },
  COLD_STORAGE_ARCHIVED: {
    read: false,
    write: false,
    code: 'WORKSPACE_SUSPENDED',
  },
  PURGED: { read: false, write: false, code: 'WORKSPACE_SUSPENDED' },
};

/** Ném lỗi khi workspace không còn quyền đọc/ghi theo trạng thái vòng đời. */
export function assertLifecycle(
  status: WorkspaceLifecycleStatus,
  need: 'read' | 'write',
): void {
  const rule = LIFECYCLE[status];
  if (rule[need]) return;
  throw new AppError(rule.code ?? 'FORBIDDEN', HttpStatus.FORBIDDEN, {
    status,
  });
}

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
      select: {
        role: true,
        workspace: { select: { archivedAt: true, status: true } },
      },
    });
    if (!m || m.workspace.archivedAt) return null;
    return m.role;
  }

  /** Trạng thái vòng đời của workspace (ACTIVE nếu không tìm thấy thì ném 404 ở nơi gọi). */
  async statusOf(workspaceId: string): Promise<WorkspaceLifecycleStatus> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { status: true },
    });
    if (!ws) throw AppError.notFound({ workspaceId });
    return ws.status;
  }

  /** Dùng trước mọi thao tác ghi cấp workspace (cài đặt, thành viên, lời mời, kỹ năng, cấu hình AI). */
  async assertWritable(workspaceId: string): Promise<void> {
    assertLifecycle(await this.statusOf(workspaceId), 'write');
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
