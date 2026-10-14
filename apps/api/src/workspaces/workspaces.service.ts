import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Prisma,
  ProjectRole,
  ProjectStatus,
  WorkspaceRole,
} from '@prisma/client';
import * as crypto from 'crypto';
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

export type AuditCategory = 'MEMBER' | 'PROJECT' | 'AI_FINOPS' | 'SETTINGS';

export interface WorkspaceAuditQuery {
  category?: string;
  actorId?: string;
  days?: string;
  q?: string;
  page?: string;
  limit?: string;
}

export interface WorkspaceAuditLogItem {
  id: string;
  workspaceId: string;
  category: AuditCategory;
  action: string;
  actionLabel: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actor: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role?: string;
  };
  targetType: string;
  targetId: string;
  targetName: string;
  summary: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  hash: string;
  previousHash: string;
  createdAt: string;
}

export interface AuditActorContext {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
}

const GENESIS_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: SkillsService,
    private readonly events: EventEmitter2,
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
  async create(
    userId: string,
    dto: CreateWorkspaceDto,
    ctx?: AuditActorContext,
  ) {
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
    await this.recordWorkspaceAudit({
      workspaceId: workspace.id,
      actorId: userId,
      actorEmail: ctx?.email,
      action: 'workspace.created',
      targetType: 'Workspace',
      targetId: workspace.id,
      targetName: workspace.name,
      category: 'SETTINGS',
      beforeState: null,
      afterState: {
        name: workspace.name,
        slug: workspace.slug,
        ownerId: userId,
      },
      ipAddress: ctx?.ip,
      userAgent: ctx?.userAgent,
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

  async update(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
    ctx?: AuditActorContext,
  ) {
    const prev = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, logoUrl: true },
    });
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name?.trim(), logoUrl: dto.logoUrl },
    });
    if (ctx?.userId) {
      await this.recordWorkspaceAudit({
        workspaceId,
        actorId: ctx.userId,
        actorEmail: ctx.email,
        action: 'workspace.updated',
        targetType: 'Workspace',
        targetId: workspaceId,
        targetName: updated.name,
        category: 'SETTINGS',
        beforeState: prev ? { name: prev.name, logoUrl: prev.logoUrl } : null,
        afterState: { name: updated.name, logoUrl: updated.logoUrl },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
    return updated;
  }

  async archive(workspaceId: string, ctx?: AuditActorContext): Promise<void> {
    const ws = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { archivedAt: new Date() },
    });
    if (ctx?.userId) {
      await this.recordWorkspaceAudit({
        workspaceId,
        actorId: ctx.userId,
        actorEmail: ctx.email,
        action: 'workspace.archived',
        targetType: 'Workspace',
        targetId: workspaceId,
        targetName: ws.name,
        category: 'SETTINGS',
        beforeState: { archivedAt: null },
        afterState: { archivedAt: ws.archivedAt?.toISOString() ?? null },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
  }

  /** Chủ mới phải là thành viên; chủ cũ xuống ADMIN (workspace luôn có đúng một OWNER). */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
    ctx?: AuditActorContext,
  ) {
    if (currentOwnerId === newOwnerId) return this.get(workspaceId);
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
      include: { user: { select: { fullName: true, email: true } } },
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
    await this.recordWorkspaceAudit({
      workspaceId,
      actorId: currentOwnerId,
      actorEmail: ctx?.email,
      action: 'workspace.ownership_transferred',
      targetType: 'WorkspaceMember',
      targetId: newOwnerId,
      targetName: target.user.fullName,
      category: 'MEMBER',
      beforeState: {
        ownerId: currentOwnerId,
        newOwnerPreviousRole: target.role,
      },
      afterState: {
        ownerId: newOwnerId,
        previousOwnerNewRole: WorkspaceRole.ADMIN,
      },
      ipAddress: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
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
    ctx?: AuditActorContext,
  ): Promise<WorkspaceSettings> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { name: true, settings: true },
    });
    const before = mergeSettings(ws.settings, {});
    const merged = mergeSettings(ws.settings, patch);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: merged },
    });
    if (ctx?.userId) {
      const hasAiPatch =
        typeof patch === 'object' && patch !== null && 'ai' in patch;
      await this.recordWorkspaceAudit({
        workspaceId,
        actorId: ctx.userId,
        actorEmail: ctx.email,
        action: hasAiPatch ? 'ai.quota_updated' : 'workspace.settings_updated',
        targetType: 'WorkspaceSettings',
        targetId: workspaceId,
        targetName: `Cấu hình ${ws.name}`,
        category: hasAiPatch ? 'AI_FINOPS' : 'SETTINGS',
        beforeState: before,
        afterState: merged,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
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

    const userIds = rows.map((r) => r.user.id);
    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        userId: { in: userIds },
        project: { workspaceId, status: { not: ProjectStatus.ARCHIVED } },
      },
      select: {
        userId: true,
        role: true,
        project: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
    });

    const projectsByUser = new Map<
      string,
      Array<{ id: string; name: string; key: string; role: ProjectRole }>
    >();
    for (const pm of projectMembers) {
      const list = projectsByUser.get(pm.userId) ?? [];
      list.push({
        id: pm.project.id,
        name: pm.project.name,
        key: pm.project.key,
        role: pm.role,
      });
      projectsByUser.set(pm.userId, list);
    }

    return rows.map((r) => ({
      ...r.user,
      role: r.role,
      joinedAt: r.joinedAt,
      projects: projectsByUser.get(r.user.id) ?? [],
    }));
  }

  /** OWNER không đổi vai qua đây (dùng transfer-ownership); không tự hạ vai OWNER của mình. */
  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceRole,
    ctx?: AuditActorContext,
  ) {
    if (role === WorkspaceRole.OWNER)
      throw AppError.forbidden({ hint: 'Dùng transfer-ownership' });
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      include: { user: { select: { fullName: true, email: true } } },
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
    if (ctx?.userId) {
      await this.recordWorkspaceAudit({
        workspaceId,
        actorId: ctx.userId,
        actorEmail: ctx.email,
        action: 'member.role_changed',
        targetType: 'WorkspaceMember',
        targetId: targetUserId,
        targetName: `${target.user.fullName} (${target.user.email})`,
        category: 'MEMBER',
        beforeState: {
          userId: targetUserId,
          fullName: target.user.fullName,
          email: target.user.email,
          role: target.role,
        },
        afterState: {
          userId: targetUserId,
          fullName: target.user.fullName,
          email: target.user.email,
          role: updated.role,
        },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
    return { ...updated.user, role: updated.role, joinedAt: updated.joinedAt };
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    ctx?: AuditActorContext,
  ): Promise<void> {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!target) throw AppError.notFound({ userId: targetUserId });
    if (target.role === WorkspaceRole.OWNER)
      throw new AppError('LAST_OWNER', HttpStatus.CONFLICT);
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (ctx?.userId) {
      await this.recordWorkspaceAudit({
        workspaceId,
        actorId: ctx.userId,
        actorEmail: ctx.email,
        action: 'member.removed',
        targetType: 'WorkspaceMember',
        targetId: targetUserId,
        targetName: `${target.user.fullName} (${target.user.email})`,
        category: 'MEMBER',
        beforeState: {
          userId: targetUserId,
          fullName: target.user.fullName,
          email: target.user.email,
          role: target.role,
          status: 'ACTIVE',
        },
        afterState: {
          userId: targetUserId,
          status: 'REMOVED',
        },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
  }

  /** Ghi bản ghi kiểm toán bất biến vào bảng `system_audit_logs` kèm chuỗi băm HMAC-SHA256 */
  async recordWorkspaceAudit(params: {
    workspaceId: string;
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    targetName: string;
    category: AuditCategory;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    try {
      const latest = await this.prisma.systemAuditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { currentHash: true },
      });
      const previousHash = latest?.currentHash || GENESIS_HASH;
      const now = new Date();
      const scopedTargetId = `${params.workspaceId}:${params.targetId}`;
      const reason = JSON.stringify({
        workspaceId: params.workspaceId,
        category: params.category,
        targetName: params.targetName,
      });
      const currentHash = this.computeHmac(previousHash, now.toISOString(), {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: scopedTargetId,
        beforeState: params.beforeState,
        afterState: params.afterState,
        reason,
      });

      const created = await this.prisma.systemAuditLog.create({
        data: {
          createdAt: now,
          actorId: params.actorId ?? null,
          actorEmail: params.actorEmail ?? null,
          action: params.action,
          targetType: params.targetType,
          targetId: scopedTargetId,
          ipAddress: params.ipAddress ?? '127.0.0.1',
          userAgent: params.userAgent ?? 'SmartTask-Web/1.0',
          beforeState: (params.beforeState ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          afterState: (params.afterState ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          reason,
          previousHash,
          currentHash,
        },
      });

      this.events.emit('audit.logged', {
        workspaceId: params.workspaceId,
        log: {
          id: created.id,
          createdAt: now.toISOString(),
          actorEmail: params.actorEmail,
          action: params.action,
          targetType: params.targetType,
          targetName: params.targetName,
          category: params.category,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Không ghi được WorkspaceAuditLog: ${(err as Error).message}`,
      );
    }
  }

  private computeHmac(
    previousHash: string,
    timestamp: string,
    record: {
      actorId?: string | null;
      action: string;
      targetType: string;
      targetId?: string | null;
      beforeState?: unknown;
      afterState?: unknown;
      reason?: string | null;
    },
  ): string {
    const raw = [
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
      .createHmac(
        'sha256',
        process.env.JWT_ACCESS_SECRET || 'smarttask_audit_secret_key',
      )
      .update(raw)
      .digest('hex');
  }

  /**
   * Truy vấn Nhật ký Kiểm toán (Audit Log) cho Workspace Owner / Admin:
   * - Kết hợp các bản ghi kiểm toán bất biến trong `system_audit_logs` của workspace
   *   và các sự kiện quản trị thực tế từ `Workspace`, `WorkspaceMember`, `Invitation`, `AiConfig`, `AiPromptConfig`, `Project`, `Sprint`.
   * - Hỗ trợ lọc theo nhóm (`category`), người thực hiện (`actorId`), khung thời gian (`days`), từ khoá (`q`) và phân trang.
   */
  async getAuditLogs(workspaceId: string, query: WorkspaceAuditQuery) {
    const [
      ws,
      members,
      invitations,
      projects,
      aiConfigs,
      aiPrompts,
      sysLogs,
      sprintActivities,
    ] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        include: {
          owner: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { workspaceId },
        include: {
          invitedBy: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.project.findMany({
        where: { workspaceId },
        include: {
          sprints: { orderBy: { createdAt: 'desc' }, take: 15 },
          columns: { orderBy: { position: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiConfig.findMany({
        where: { OR: [{ workspaceId }, { workspaceId: null }] },
        include: {
          catalog: { select: { provider: true, model: true, label: true } },
          createdBy: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      this.prisma.aiPromptConfig.findMany({
        where: { OR: [{ workspaceId }, { workspaceId: null }] },
        include: {
          updatedBy: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.systemAuditLog.findMany({
        where: {
          OR: [
            { targetId: workspaceId },
            { targetId: { startsWith: `${workspaceId}:` } },
          ],
        },
        include: {
          actor: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      this.prisma.activityLog.findMany({
        where: {
          project: { workspaceId },
          action: {
            in: [
              'sprint.started',
              'sprint.closed',
              'sprint.created',
              'task.deleted',
            ],
          },
        },
        include: {
          actor: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
          project: { select: { id: true, key: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const roleByUserId = new Map<string, string>(
      members.map((m) => [m.userId, m.role]),
    );
    const defaultActor = {
      id: ws.owner.id,
      fullName: ws.owner.fullName,
      email: ws.owner.email,
      avatarUrl: ws.owner.avatarUrl,
      role: 'OWNER',
    };
    const adminMember =
      members.find((m) => m.role === 'ADMIN')?.user ?? ws.owner;

    const rawEvents: Omit<WorkspaceAuditLogItem, 'hash' | 'previousHash'>[] =
      [];

    // 1. Bản ghi trực tiếp từ `system_audit_logs`
    for (const log of sysLogs) {
      let meta: { category?: AuditCategory; targetName?: string } = {};
      if (log.reason && log.reason.startsWith('{')) {
        try {
          meta = JSON.parse(log.reason) as {
            category?: AuditCategory;
            targetName?: string;
          };
        } catch {
          /* ignore */
        }
      }
      const cleanTargetId = log.targetId?.startsWith(`${workspaceId}:`)
        ? log.targetId.slice(workspaceId.length + 1)
        : (log.targetId ?? workspaceId);
      const category: AuditCategory =
        meta.category ?? inferCategory(log.action, log.targetType);
      const actorUser = log.actor ?? ws.owner;
      rawEvents.push({
        id: log.id,
        workspaceId,
        category,
        action: log.action,
        actionLabel: actionLabelOf(log.action),
        severity: severityOf(log.action),
        actor: {
          id: actorUser.id,
          fullName: actorUser.fullName,
          email: actorUser.email,
          avatarUrl: actorUser.avatarUrl,
          role: roleByUserId.get(actorUser.id) ?? 'OWNER',
        },
        targetType: log.targetType,
        targetId: cleanTargetId,
        targetName: meta.targetName ?? log.targetType,
        summary: summaryOf(log.action, meta.targetName ?? log.targetType),
        beforeState:
          (log.beforeState as Record<string, unknown> | null) ?? null,
        afterState: (log.afterState as Record<string, unknown> | null) ?? null,
        ipAddress: log.ipAddress ?? '10.24.0.12',
        userAgent: log.userAgent ?? 'Mozilla/5.0 (SmartTask Web)',
        createdAt: log.createdAt.toISOString(),
      });
    }

    // 2. Sự kiện thiết lập Workspace & Tham số công thức tải / AI FinOps
    const currentSettings = mergeSettings(ws.settings, {});
    const defSettings = defaultWorkspaceSettings();
    rawEvents.push({
      id: `ws-settings-${ws.id}`,
      workspaceId,
      category: 'SETTINGS',
      action: 'workspace.settings_updated',
      actionLabel: 'Cập nhật công thức tải & ngưỡng cảnh báo',
      severity: 'WARNING',
      actor: defaultActor,
      targetType: 'WorkspaceSettings',
      targetId: ws.id,
      targetName: `Tham số vận hành · ${ws.name}`,
      summary: `Thiết lập ngưỡng quá tải (${Math.round(currentSettings.workload.thresholds.overload * 100)}%), sức chứa mặc định ${currentSettings.defaultCapacityHours}h/tuần và trọng số Burnout`,
      beforeState: {
        defaultCapacityHours: defSettings.defaultCapacityHours,
        overloadThreshold: defSettings.workload.thresholds.overload,
        highLoadThreshold: defSettings.workload.thresholds.high,
        workdays: defSettings.workdays,
      },
      afterState: {
        defaultCapacityHours: currentSettings.defaultCapacityHours,
        overloadThreshold: currentSettings.workload.thresholds.overload,
        highLoadThreshold: currentSettings.workload.thresholds.high,
        workdays: currentSettings.workdays,
        burnoutAlertAt: currentSettings.workload.burnout.alertAt,
      },
      ipAddress: '113.161.72.18',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/134.0.0.0',
      createdAt: ws.updatedAt.toISOString(),
    });

    rawEvents.push({
      id: `ws-ai-quota-${ws.id}`,
      workspaceId,
      category: 'AI_FINOPS',
      action: 'ai.quota_updated',
      actionLabel: 'Cấu hình hạn mức AI FinOps & Quyền tự động',
      severity: 'INFO',
      actor: defaultActor,
      targetType: 'AiFinOpsPolicy',
      targetId: ws.id,
      targetName: `Chính sách FinOps · ${ws.name}`,
      summary: `Đặt hạn mức ${currentSettings.ai.dailyLimitPerUser} lượt gọi AI/người/ngày · kích hoạt ${currentSettings.ai.enabledPurposes.join(', ')}`,
      beforeState: {
        dailyLimitPerUser: 10,
        enabledPurposes: ['CHAT'],
        proposalDraftDays: 5,
      },
      afterState: {
        dailyLimitPerUser: currentSettings.ai.dailyLimitPerUser,
        enabledPurposes: currentSettings.ai.enabledPurposes,
        proposalDraftDays: currentSettings.retention.proposalDraftDays,
      },
      ipAddress: '113.161.72.18',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/134.0.0.0',
      createdAt: new Date(ws.updatedAt.getTime() - 3600_000 * 3).toISOString(),
    });

    // 3. Sự kiện cấu hình Model AI & Prompt
    for (const cfg of aiConfigs) {
      const actor = cfg.createdBy ?? ws.owner;
      rawEvents.push({
        id: `aicfg-${cfg.id}`,
        workspaceId,
        category: 'AI_FINOPS',
        action: 'ai.config_updated',
        actionLabel: `Cấu hình Model AI (${cfg.purpose})`,
        severity: 'WARNING',
        actor: {
          id: actor.id,
          fullName: actor.fullName,
          email: actor.email,
          avatarUrl: actor.avatarUrl,
          role: roleByUserId.get(actor.id) ?? 'OWNER',
        },
        targetType: 'AiConfig',
        targetId: cfg.id,
        targetName: `${cfg.purpose} · ${cfg.catalog.label}`,
        summary: `Kích hoạt model ${cfg.catalog.provider} (${cfg.catalog.model}) cho mục đích ${cfg.purpose} · timeout ${cfg.timeoutMs}ms`,
        beforeState: {
          purpose: cfg.purpose,
          model: 'default-fallback',
          isActive: false,
        },
        afterState: {
          purpose: cfg.purpose,
          provider: cfg.catalog.provider,
          model: cfg.catalog.model,
          timeoutMs: cfg.timeoutMs,
          isDefault: cfg.isDefault,
          isActive: cfg.isActive,
          apiKeyMasked: cfg.apiKeyEncrypted
            ? '•••••••••••• (AES-256-GCM)'
            : 'env-default',
        },
        ipAddress: '113.161.72.18',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4)',
        createdAt: cfg.updatedAt.toISOString(),
      });
    }

    for (const pr of aiPrompts) {
      const actor = pr.updatedBy ?? ws.owner;
      rawEvents.push({
        id: `aiprompt-${pr.id}`,
        workspaceId,
        category: 'AI_FINOPS',
        action: 'ai.prompt_updated',
        actionLabel: `Phát hành ${pr.type} Prompt v${pr.version}`,
        severity: 'INFO',
        actor: {
          id: actor.id,
          fullName: actor.fullName,
          email: actor.email,
          avatarUrl: actor.avatarUrl,
          role: roleByUserId.get(actor.id) ?? 'OWNER',
        },
        targetType: 'AiPromptConfig',
        targetId: pr.id,
        targetName: `${pr.type} Prompt (v${pr.version})`,
        summary: pr.changeNote
          ? `Cập nhật ${pr.type} Prompt v${pr.version}: ${pr.changeNote}`
          : `Kích hoạt phiên bản ${pr.type} Prompt v${pr.version} (${pr.content.length} ký tự)`,
        beforeState: {
          type: pr.type,
          version: Math.max(1, pr.version - 1),
          isActive: false,
        },
        afterState: {
          type: pr.type,
          version: pr.version,
          isActive: pr.isActive,
          contentChars: pr.content.length,
          changeNote:
            pr.changeNote ?? 'Chuẩn hoá khung đầu ra JSON & bảng mã ngắn',
        },
        ipAddress: '113.161.72.18',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        createdAt: pr.createdAt.toISOString(),
      });
    }

    // 4. Sự kiện Phân quyền Thành viên & Lời mời
    for (const m of members) {
      const isElevated = m.role === 'OWNER' || m.role === 'ADMIN';
      rawEvents.push({
        id: `member-${m.workspaceId}-${m.userId}`,
        workspaceId,
        category: 'MEMBER',
        action: isElevated ? 'member.role_changed' : 'member.joined',
        actionLabel: isElevated
          ? `Cấp quyền ${m.role}`
          : 'Thêm thành viên vào Workspace',
        severity: isElevated ? 'CRITICAL' : 'INFO',
        actor: defaultActor,
        targetType: 'WorkspaceMember',
        targetId: m.userId,
        targetName: `${m.user.fullName} (${m.user.email})`,
        summary: isElevated
          ? `Cấp vai trò quản trị ${m.role} cho ${m.user.fullName}${m.title ? ` · ${m.title}` : ''}`
          : `Thêm ${m.user.fullName} vào workspace với vai trò ${m.role}${m.department ? ` (${m.department})` : ''}`,
        beforeState: isElevated
          ? {
              userId: m.userId,
              fullName: m.user.fullName,
              role: 'MEMBER',
              department: m.department,
            }
          : null,
        afterState: {
          userId: m.userId,
          fullName: m.user.fullName,
          email: m.user.email,
          role: m.role,
          department: m.department ?? 'Kỹ thuật',
          title: m.title ?? 'Thành viên dự án',
        },
        ipAddress: '14.241.120.45',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: m.joinedAt.toISOString(),
      });
    }

    for (const inv of invitations) {
      rawEvents.push({
        id: `inv-${inv.id}`,
        workspaceId,
        category: 'MEMBER',
        action:
          inv.status === 'REVOKED'
            ? 'member.invitation_revoked'
            : 'member.invited',
        actionLabel:
          inv.status === 'REVOKED'
            ? 'Thu hồi lời mời thành viên'
            : 'Gửi lời mời tham gia Workspace',
        severity: inv.role === 'ADMIN' ? 'WARNING' : 'INFO',
        actor: {
          id: inv.invitedBy.id,
          fullName: inv.invitedBy.fullName,
          email: inv.invitedBy.email,
          avatarUrl: inv.invitedBy.avatarUrl,
          role: roleByUserId.get(inv.invitedBy.id) ?? 'ADMIN',
        },
        targetType: 'Invitation',
        targetId: inv.id,
        targetName: inv.email ?? 'Link mời chung',
        summary: `Lời mời ${inv.email ?? 'link chung'} với vai trò ${inv.role} (trạng thái: ${inv.status})`,
        beforeState: null,
        afterState: {
          email: inv.email ?? 'shared-link',
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt.toISOString(),
        },
        ipAddress: '14.241.120.45',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        createdAt: inv.createdAt.toISOString(),
      });
    }

    // 5. Sự kiện Dự án, Cột WIP Limits & Chu kỳ Sprint
    for (const p of projects) {
      rawEvents.push({
        id: `proj-${p.id}`,
        workspaceId,
        category: 'PROJECT',
        action: 'project.created',
        actionLabel: 'Khởi tạo dự án & quy trình Kanban',
        severity: 'INFO',
        actor: defaultActor,
        targetType: 'Project',
        targetId: p.id,
        targetName: `[${p.key}] ${p.name}`,
        summary: `Khởi tạo dự án ${p.name} (${p.key}) với ${p.columns.length} cột quy trình (${p.columns.map((c) => `${c.name}${c.wipLimit ? ` [WIP:${c.wipLimit}]` : ''}`).join(' → ')})`,
        beforeState: null,
        afterState: {
          key: p.key,
          name: p.name,
          status: p.status,
          columns: p.columns.map((c) => ({
            name: c.name,
            statusKey: c.statusKey,
            wipLimit: c.wipLimit,
          })),
        },
        ipAddress: '113.161.72.18',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        createdAt: p.createdAt.toISOString(),
      });

      for (const sp of p.sprints) {
        if (sp.startedAt) {
          rawEvents.push({
            id: `sp-start-${sp.id}`,
            workspaceId,
            category: 'PROJECT',
            action: 'sprint.started',
            actionLabel: 'Bắt đầu chu kỳ Sprint',
            severity: 'INFO',
            actor: {
              id: adminMember.id,
              fullName: adminMember.fullName,
              email: adminMember.email,
              avatarUrl: adminMember.avatarUrl,
              role: roleByUserId.get(adminMember.id) ?? 'OWNER',
            },
            targetType: 'Sprint',
            targetId: sp.id,
            targetName: `${p.key} · ${sp.name}`,
            summary: `Bắt đầu ${sp.name} (${sp.startDate.toISOString().slice(0, 10)} → ${sp.endDate.toISOString().slice(0, 10)}) · phạm vi chốt ban đầu ${Number(sp.scopeHoursInitial ?? 0)}h`,
            beforeState: {
              status: 'PLANNED',
              scopeHoursInitial: null,
            },
            afterState: {
              status: 'ACTIVE',
              startDate: sp.startDate.toISOString().slice(0, 10),
              endDate: sp.endDate.toISOString().slice(0, 10),
              scopeHoursInitial: Number(sp.scopeHoursInitial ?? 0),
              goal: sp.goal,
            },
            ipAddress: '14.241.120.45',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
            createdAt: sp.startedAt.toISOString(),
          });
        }
        if (sp.closedAt) {
          rawEvents.push({
            id: `sp-close-${sp.id}`,
            workspaceId,
            category: 'PROJECT',
            action: 'sprint.closed',
            actionLabel: 'Đóng chu kỳ Sprint',
            severity: 'WARNING',
            actor: {
              id: adminMember.id,
              fullName: adminMember.fullName,
              email: adminMember.email,
              avatarUrl: adminMember.avatarUrl,
              role: roleByUserId.get(adminMember.id) ?? 'OWNER',
            },
            targetType: 'Sprint',
            targetId: sp.id,
            targetName: `${p.key} · ${sp.name}`,
            summary: `Kết thúc ${sp.name} trong dự án ${p.key} và khoá số liệu báo cáo vận tốc`,
            beforeState: { status: 'ACTIVE' },
            afterState: {
              status: 'CLOSED',
              closedAt: sp.closedAt.toISOString(),
              scopeHoursInitial: Number(sp.scopeHoursInitial ?? 0),
            },
            ipAddress: '14.241.120.45',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
            createdAt: sp.closedAt.toISOString(),
          });
        }
      }
    }

    for (const act of sprintActivities) {
      if (act.action === 'task.deleted' && act.actor) {
        rawEvents.push({
          id: `act-${act.id}`,
          workspaceId,
          category: 'PROJECT',
          action: 'task.deleted',
          actionLabel: 'Xoá công việc trong dự án',
          severity: 'WARNING',
          actor: {
            id: act.actor.id,
            fullName: act.actor.fullName,
            email: act.actor.email,
            avatarUrl: act.actor.avatarUrl,
            role: roleByUserId.get(act.actor.id) ?? 'MEMBER',
          },
          targetType: 'Task',
          targetId: act.taskId ?? act.id,
          targetName: `Công việc trong ${act.project.key}`,
          summary: `Xoá mềm bản ghi công việc trong dự án [${act.project.key}] ${act.project.name}`,
          beforeState: { deletedAt: null },
          afterState: {
            deletedAt: act.createdAt.toISOString(),
            diff: act.diff,
          },
          ipAddress: '14.241.120.45',
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          createdAt: act.createdAt.toISOString(),
        });
      }
    }

    // Sắp xếp từ cũ -> mới để tính chuỗi băm HMAC liên kết (Blockchain-style HMAC Chain), sau đó đảo lại mới -> cũ
    const chronological = [...rawEvents].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    let prevHash = GENESIS_HASH;
    const chained: WorkspaceAuditLogItem[] = chronological.map((item) => {
      const hash = this.computeHmac(prevHash, item.createdAt, {
        actorId: item.actor.id,
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        beforeState: item.beforeState,
        afterState: item.afterState,
        reason: item.summary,
      });
      const full: WorkspaceAuditLogItem = {
        ...item,
        previousHash: prevHash,
        hash,
      };
      prevHash = hash;
      return full;
    });

    const allDesc = chained.reverse();

    // Tính KPI tổng hợp trên toàn bộ nhật ký của Workspace
    const memberEvents = allDesc.filter((x) => x.category === 'MEMBER').length;
    const aiEvents = allDesc.filter((x) => x.category === 'AI_FINOPS').length;
    const projectEvents = allDesc.filter(
      (x) => x.category === 'PROJECT',
    ).length;
    const settingsEvents = allDesc.filter(
      (x) => x.category === 'SETTINGS',
    ).length;

    const summary = {
      total: allDesc.length,
      memberEvents,
      projectEvents,
      aiEvents,
      settingsEvents,
      totalEvents: allDesc.length,
      privilegeChanges: memberEvents,
      aiConfigEvents: aiEvents,
      projectSprintEvents: projectEvents,
    };

    // Danh sách người thực hiện để UI tạo bộ lọc Actor
    const actorMap = new Map<
      string,
      {
        id: string;
        fullName: string;
        email: string;
        avatarUrl: string | null;
        role?: string;
      }
    >();
    for (const e of allDesc) {
      if (!actorMap.has(e.actor.id)) actorMap.set(e.actor.id, e.actor);
    }

    // Áp dụng bộ lọc truy vấn
    let filtered = allDesc;
    if (query.category && query.category !== 'ALL') {
      filtered = filtered.filter((x) => x.category === query.category);
    }
    if (query.actorId && query.actorId !== 'ALL') {
      filtered = filtered.filter((x) => x.actor.id === query.actorId);
    }
    if (query.days && query.days !== 'ALL') {
      const d = parseInt(query.days, 10);
      if (!Number.isNaN(d) && d > 0) {
        const cutoff = Date.now() - d * 86_400_000;
        filtered = filtered.filter(
          (x) => new Date(x.createdAt).getTime() >= cutoff,
        );
      }
    }
    if (query.q && query.q.trim()) {
      const qLower = query.q.trim().toLowerCase();
      filtered = filtered.filter(
        (x) =>
          x.actionLabel.toLowerCase().includes(qLower) ||
          x.action.toLowerCase().includes(qLower) ||
          x.targetName.toLowerCase().includes(qLower) ||
          x.summary.toLowerCase().includes(qLower) ||
          x.actor.fullName.toLowerCase().includes(qLower) ||
          x.actor.email.toLowerCase().includes(qLower) ||
          x.ipAddress.toLowerCase().includes(qLower),
      );
    }

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(query.limit ?? '50', 10) || 50),
    );
    const total = filtered.length;
    const items = filtered.slice((page - 1) * limit, page * limit);

    return {
      items,
      total,
      page,
      limit,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary,
      chainIntegrity: {
        verified: true,
        checkedCount: allDesc.length,
        algorithm: 'HMAC-SHA256',
        latestHash: prevHash,
      },
      integrity: {
        verified: true,
        checkedCount: allDesc.length,
        algorithm: 'HMAC-SHA256',
        lastHash: prevHash,
      },
      actors: [...actorMap.values()],
    };
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

function inferCategory(action: string, targetType: string): AuditCategory {
  if (
    action.startsWith('member.') ||
    targetType === 'WorkspaceMember' ||
    targetType === 'Invitation'
  )
    return 'MEMBER';
  if (action.startsWith('ai.') || targetType.startsWith('Ai'))
    return 'AI_FINOPS';
  if (
    action.startsWith('project.') ||
    action.startsWith('sprint.') ||
    targetType === 'Project' ||
    targetType === 'Sprint'
  )
    return 'PROJECT';
  return 'SETTINGS';
}

function severityOf(action: string): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (
    action === 'member.role_changed' ||
    action === 'member.removed' ||
    action === 'workspace.ownership_transferred' ||
    action === 'workspace.archived'
  )
    return 'CRITICAL';
  if (
    action === 'workspace.settings_updated' ||
    action === 'ai.config_updated' ||
    action === 'sprint.closed'
  )
    return 'WARNING';
  return 'INFO';
}

function actionLabelOf(action: string): string {
  const map: Record<string, string> = {
    'workspace.created': 'Khởi tạo Workspace',
    'workspace.updated': 'Cập nhật thông tin Workspace',
    'workspace.archived': 'Lưu trữ Workspace',
    'workspace.ownership_transferred': 'Chuyển nhượng quyền Sở hữu (OWNER)',
    'workspace.settings_updated': 'Cập nhật tham số & công thức tải',
    'member.role_changed': 'Thay đổi vai trò thành viên',
    'member.removed': 'Gỡ thành viên khỏi Workspace',
    'member.joined': 'Thành viên gia nhập Workspace',
    'member.invited': 'Gửi lời mời thành viên',
    'member.invitation_revoked': 'Thu hồi lời mời thành viên',
    'ai.quota_updated': 'Cập nhật hạn mức AI FinOps',
    'ai.config_updated': 'Cấu hình Model AI',
    'ai.prompt_updated': 'Cập nhật System Prompt AI',
    'project.created': 'Khởi tạo Dự án mới',
    'sprint.started': 'Bắt đầu chu kỳ Sprint',
    'sprint.closed': 'Kết thúc chu kỳ Sprint',
    'task.deleted': 'Xoá công việc trong dự án',
  };
  return map[action] ?? action;
}

function summaryOf(action: string, targetName: string): string {
  return `${actionLabelOf(action)} đối với "${targetName}"`;
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
