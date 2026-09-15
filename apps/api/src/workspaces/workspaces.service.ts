import { HttpStatus, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { SkillsService } from '../skills/skills.service';
import type {
  CreateWorkspaceDto,
  ListMembersQueryDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';
import {
  defaultWorkspaceSettings,
  mergeSettings,
  type WorkspaceSettings,
} from './workspace-settings';

const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  shortName: true,
  avatarUrl: true,
  weeklyCapacityHours: true,
} as const;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: SkillsService,
  ) {}

  async listMine(userId: string) {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { userId, workspace: { archivedAt: null } },
      select: {
        role: true,
        joinedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            createdAt: true,
            _count: { select: { members: true, projects: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => ({
      ...r.workspace,
      role: r.role,
      joinedAt: r.joinedAt,
    }));
  }

  /** Tạo workspace: người tạo là OWNER, cài đặt mặc định, nạp bộ kỹ năng mẫu (UC-04, UC-06). */
  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = await this.uniqueSlug(dto.slug ?? slugify(dto.name));
    const workspace = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: dto.name.trim(),
          slug,
          ownerId: userId,
          settings: defaultWorkspaceSettings(),
          members: { create: { userId, role: WorkspaceRole.OWNER } },
        },
      });
      await this.skills.seedDefaults(tx, ws.id);
      return ws;
    });
    return { ...workspace, role: WorkspaceRole.OWNER };
  }

  async get(workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, archivedAt: null },
      include: {
        _count: { select: { members: true, projects: true, skills: true } },
      },
    });
    if (!ws) throw AppError.notFound();
    return ws;
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name?.trim(), logoUrl: dto.logoUrl },
    });
  }

  async archive(workspaceId: string): Promise<void> {
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { archivedAt: new Date() },
    });
  }

  /** Chủ mới phải là thành viên; chủ cũ xuống ADMIN (workspace luôn có đúng một OWNER). */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    if (currentOwnerId === newOwnerId) return this.get(workspaceId);
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
    });
    if (!target) throw AppError.notFound({ userId: newOwnerId });
    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: newOwnerId },
      }),
      this.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
        data: { role: WorkspaceRole.OWNER },
      }),
      this.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: currentOwnerId } },
        data: { role: WorkspaceRole.ADMIN },
      }),
    ]);
    return this.get(workspaceId);
  }

  async getSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    return mergeSettings(ws.settings, {});
  }

  async patchSettings(
    workspaceId: string,
    patch: unknown,
  ): Promise<WorkspaceSettings> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const merged = mergeSettings(ws.settings, patch);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: merged },
    });
    return merged;
  }

  async listMembers(workspaceId: string, query: ListMembersQueryDto) {
    const q = query.q?.trim();
    const rows = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        role: query.role,
        ...(q
          ? {
              user: {
                OR: [
                  { fullName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      select: {
        role: true,
        joinedAt: true,
        user: { select: MEMBER_USER_SELECT },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((r) => ({ ...r.user, role: r.role, joinedAt: r.joinedAt }));
  }

  /** OWNER không đổi vai qua đây (dùng transfer-ownership); không tự hạ vai OWNER của mình. */
  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceRole,
  ) {
    if (role === WorkspaceRole.OWNER)
      throw AppError.forbidden({ hint: 'Dùng transfer-ownership' });
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) throw AppError.notFound({ userId: targetUserId });
    if (target.role === WorkspaceRole.OWNER)
      throw new AppError('LAST_OWNER', HttpStatus.CONFLICT);
    const updated = await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role },
      select: {
        role: true,
        joinedAt: true,
        user: { select: MEMBER_USER_SELECT },
      },
    });
    return { ...updated.user, role: updated.role, joinedAt: updated.joinedAt };
  }

  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) throw AppError.notFound({ userId: targetUserId });
    if (target.role === WorkspaceRole.OWNER)
      throw new AppError('LAST_OWNER', HttpStatus.CONFLICT);
    // Phase 3: gỡ khỏi project_members và task_assignees của workspace này trong cùng transaction.
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = base || 'workspace';
    for (let i = 0; i < 20; i += 1) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      const exists = await this.prisma.workspace.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw AppError.conflict('WORKSPACE_SLUG_TAKEN');
  }
}

/** "Nhóm SmartTask 2026" → "nhom-smarttask-2026" (bỏ dấu tiếng Việt). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
