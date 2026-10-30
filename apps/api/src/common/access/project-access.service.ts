import { Injectable } from '@nestjs/common';
import {
  ProjectRole,
  ProjectStatus,
  WorkspaceRole,
  type WorkspaceLifecycleStatus,
} from '@prisma/client';
import { AppError } from '../app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { assertLifecycle } from './workspace-access.service';

export interface ProjectAccess {
  projectId: string;
  workspaceId: string;
  workspaceStatus: WorkspaceLifecycleStatus;
  projectArchived: boolean;
  workspaceRole: WorkspaceRole;
  projectRole: ProjectRole | null;
  /** PM của dự án hoặc OWNER/ADMIN workspace */
  canManage: boolean;
  /** Thành viên dự án (PM/MEMBER) hoặc OWNER/ADMIN workspace */
  canEdit: boolean;
}

/**
 * Quyền trên dự án suy từ DỮ LIỆU: vai workspace + vai dự án. Không tin projectId/workspaceId trong body.
 * - Đọc: mọi thành viên workspace (kể cả VIEWER).
 * - Sửa task/bình luận: thành viên dự án, hoặc OWNER/ADMIN workspace.
 * - Quản lý (sprint, thành viên, cột, xoá task người khác, dùng AI): PM của dự án hoặc OWNER/ADMIN.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, projectId: string): Promise<ProjectAccess> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workspaceId: true,
        status: true,
        workspace: {
          select: {
            archivedAt: true,
            status: true,
            members: { where: { userId }, select: { role: true } },
          },
        },
        members: { where: { userId }, select: { role: true } },
      },
    });
    const wsMember = project?.workspace.members[0];
    if (!project || project.workspace.archivedAt || !wsMember)
      throw AppError.notFound({ projectId });
    const workspaceRole = wsMember.role;
    const projectRole = project.members[0]?.role ?? null;
    const isWsAdmin =
      workspaceRole === WorkspaceRole.OWNER ||
      workspaceRole === WorkspaceRole.ADMIN;
    const isViewer = workspaceRole === WorkspaceRole.VIEWER;
    return {
      projectId,
      workspaceId: project.workspaceId,
      workspaceStatus: project.workspace.status,
      projectArchived: project.status === ProjectStatus.ARCHIVED,
      workspaceRole,
      projectRole,
      canManage: !isViewer && (isWsAdmin || projectRole === ProjectRole.PM),
      canEdit: !isViewer && (isWsAdmin || projectRole !== null),
    };
  }

  async assertRead(userId: string, projectId: string): Promise<ProjectAccess> {
    const a = await this.resolve(userId, projectId);
    assertLifecycle(a.workspaceStatus, 'read');
    return a;
  }

  async assertEdit(userId: string, projectId: string): Promise<ProjectAccess> {
    const a = await this.resolve(userId, projectId);
    assertLifecycle(a.workspaceStatus, 'write');
    if (!a.canEdit) throw AppError.forbidden({ required: 'thành viên dự án' });
    return a;
  }

  async assertManage(
    userId: string,
    projectId: string,
  ): Promise<ProjectAccess> {
    const a = await this.resolve(userId, projectId);
    assertLifecycle(a.workspaceStatus, 'write');
    if (!a.canManage)
      throw AppError.forbidden({ required: 'PM hoặc quản trị workspace' });
    return a;
  }

  /** Task → dự án của nó; task đã xoá mềm coi như không tồn tại. */
  async projectOfTask(taskId: string): Promise<string> {
    const t = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true },
    });
    if (!t) throw AppError.notFound({ taskId });
    return t.projectId;
  }
}
