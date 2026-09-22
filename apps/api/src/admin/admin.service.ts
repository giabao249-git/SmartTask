import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiLogStatus,
  Prisma,
  SupportAccessStatus,
  WorkspaceLifecycleStatus,
} from '@prisma/client';
import * as os from 'os';
import { AppError } from '../common/app-error';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
import { PlatformStateService } from './platform-state.service';
import type {
  CreateSupportSessionDto,
  QueryUsersDto,
  QueryWorkspacesDto,
  SetMaintenanceModeDto,
  UpdateUserPlatformRoleDto,
  UpdateWorkspaceStatusDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AdminAuditService,
    private readonly platformState: PlatformStateService,
  ) {}

  /** Thống kê Tổng quan Nền tảng (Mission Control KPIs) */
  async getPlatformStats() {
    const [
      totalWorkspaces,
      activeWorkspaces,
      suspendedWorkspaces,
      totalUsers,
      activeUsers,
      superAdmins,
      totalTasks,
      completedTasks,
      aiLogsAggregate,
    ] = await Promise.all([
      this.prisma.workspace.count(),
      this.prisma.workspace.count({
        where: { status: WorkspaceLifecycleStatus.ACTIVE, archivedAt: null },
      }),
      this.prisma.workspace.count({
        where: { status: WorkspaceLifecycleStatus.SOFT_SUSPENDED },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({
        where: {
          OR: [{ isSuperAdmin: true }, { platformRole: { not: null } }],
        },
      }),
      this.prisma.task.count({ where: { deletedAt: null } }),
      this.prisma.task.count({
        where: { deletedAt: null, completedAt: { not: null } },
      }),
      this.prisma.aiTokenLog.aggregate({
        where: { status: AiLogStatus.SUCCESS },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
          estimatedCost: true,
        },
        _count: true,
      }),
    ]);

    const usdVnd = 25400; // tỷ giá quy đổi tham chiếu
    const totalTokens = aiLogsAggregate._sum?.totalTokens || 0;
    const totalCostUsd = Number(aiLogsAggregate._sum?.estimatedCost || 0);

    return {
      workspaces: {
        total: totalWorkspaces,
        active: activeWorkspaces,
        suspended: suspendedWorkspaces,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        superAdmins,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRate:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      aiFinOps: {
        totalCalls: aiLogsAggregate._count,
        totalTokens,
        inputTokens: aiLogsAggregate._sum?.inputTokens || 0,
        outputTokens: aiLogsAggregate._sum?.outputTokens || 0,
        totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
        totalCostVnd: Math.round(totalCostUsd * usdVnd),
      },
      maintenance: await this.platformState.getMaintenance(true),
    };
  }

  /** Danh sách Workspaces có phân trang & lọc trạng thái */
  async listWorkspaces(query: QueryWorkspacesDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkspaceWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, email: true, fullName: true, avatarUrl: true },
          },
          _count: {
            select: {
              members: true,
              projects: true,
              aiTokenLogs: true,
            },
          },
        },
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return {
      items: items.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        status: w.status,
        logoUrl: w.logoUrl,
        owner: w.owner,
        suspendedAt: w.suspendedAt,
        suspendReason: w.suspendReason,
        membersCount: w._count.members,
        projectsCount: w._count.projects,
        aiCallsCount: w._count.aiTokenLogs,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Cập nhật Trạng thái Vòng đời Workspace (State Machine) */
  async updateWorkspaceStatus(
    id: string,
    dto: UpdateWorkspaceStatusDto,
    actor: JwtUser,
    ip?: string,
    ua?: string,
  ) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id },
    });

    if (!ws) {
      throw AppError.notFound('Workspace không tồn tại');
    }

    const beforeState = {
      status: ws.status,
      suspendedAt: ws.suspendedAt,
      suspendReason: ws.suspendReason,
    };

    const isSuspending =
      dto.status === WorkspaceLifecycleStatus.SOFT_SUSPENDED ||
      dto.status === WorkspaceLifecycleStatus.READ_ONLY_ENFORCED;

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        status: dto.status,
        suspendedAt: isSuspending ? new Date() : null,
        suspendedById: isSuspending ? actor.id : null,
        suspendReason: isSuspending ? dto.reason : null,
      },
    });

    const afterState = {
      status: updated.status,
      suspendedAt: updated.suspendedAt,
      suspendReason: updated.suspendReason,
    };

    await this.audit.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: `WORKSPACE_STATUS_${dto.status}`,
      targetType: 'Workspace',
      targetId: id,
      ipAddress: ip,
      userAgent: ua,
      beforeState,
      afterState,
      reason: dto.reason,
    });

    return {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      suspendedAt: updated.suspendedAt,
      suspendReason: updated.suspendReason,
    };
  }

  /** Danh sách Người dùng Toàn sàn */
  async listUsers(query: QueryUsersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.platformRole !== undefined) {
      where.platformRole = query.platformRole;
    }
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          isActive: true,
          isSuperAdmin: true,
          platformRole: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              workspaceMembers: true,
              ownedWorkspaces: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        workspacesCount: u._count.workspaceMembers,
        ownedWorkspacesCount: u._count.ownedWorkspaces,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Cập nhật Vai trò Quản trị Nền tảng của Người dùng */
  async updateUserPlatformRole(
    userId: string,
    dto: UpdateUserPlatformRoleDto,
    actor: JwtUser,
    ip?: string,
    ua?: string,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw AppError.notFound('Người dùng không tồn tại');
    }

    // Không cho phép tự hạ quyền ROOT_ADMIN của chính mình nếu là admin duy nhất
    if (
      actor.id === userId &&
      dto.isSuperAdmin === false &&
      dto.platformRole === null
    ) {
      throw new AppError(
        'VALIDATION_FAILED',
        HttpStatus.BAD_REQUEST,
        undefined,
        'Bạn không thể tự tước quyền quản trị tối cao của chính mình',
      );
    }

    const beforeState = {
      isSuperAdmin: targetUser.isSuperAdmin,
      platformRole: targetUser.platformRole,
    };

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isSuperAdmin:
          dto.isSuperAdmin !== undefined
            ? dto.isSuperAdmin
            : targetUser.isSuperAdmin,
        platformRole:
          dto.platformRole !== undefined
            ? dto.platformRole
            : targetUser.platformRole,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isSuperAdmin: true,
        platformRole: true,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE_PLATFORM_ROLE',
      targetType: 'User',
      targetId: userId,
      ipAddress: ip,
      userAgent: ua,
      beforeState,
      afterState: {
        isSuperAdmin: updated.isSuperAdmin,
        platformRole: updated.platformRole,
      },
      reason: dto.reason,
    });

    return updated;
  }

  /** Thu hồi Toàn bộ Phiên Đăng nhập của Người dùng (Kill switch session) */
  async revokeUserSessions(
    userId: string,
    actor: JwtUser,
    ip?: string,
    ua?: string,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      throw AppError.notFound('Người dùng không tồn tại');
    }

    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    await this.audit.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'REVOKE_ALL_SESSIONS',
      targetType: 'User',
      targetId: userId,
      ipAddress: ip,
      userAgent: ua,
      reason: `Cưỡng chế đăng xuất toàn sàn bởi ${actor.email}`,
    });

    return {
      message: 'Đã thu hồi thành công mọi phiên đăng nhập của người dùng',
    };
  }

  /** Tổng hợp Chi phí AI FinOps theo Model và Provider */
  async getAiFinOpsCosts(days = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const logs = await this.prisma.aiTokenLog.groupBy({
      by: ['provider', 'model'],
      where: {
        status: AiLogStatus.SUCCESS,
        createdAt: { gte: fromDate },
      },
      _count: { _all: true },
      _sum: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
    });

    const usdVnd = 25400;

    return logs.map((l) => {
      const costUsd = Number(l._sum?.estimatedCost || 0);
      return {
        provider: l.provider,
        model: l.model,
        calls: l._count?._all || 0,
        tokens: l._sum?.totalTokens || 0,
        inputTokens: l._sum?.inputTokens || 0,
        outputTokens: l._sum?.outputTokens || 0,
        costUsd: Math.round(costUsd * 1000) / 1000,
        costVnd: Math.round(costUsd * usdVnd),
      };
    });
  }

  /** Giám sát Sức khỏe & Telemetry Hạ tầng */
  async getSystemTelemetry() {
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();
    let dbStatus = 'CONNECTED';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DISCONNECTED';
    }

    return {
      status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
      uptimeSeconds: Math.round(process.uptime()),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCores: cpus.length,
        freeMemMb: Math.round(os.freemem() / 1024 / 1024),
        totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      },
      process: {
        nodeVersion: process.version,
        pid: process.pid,
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      database: {
        provider: 'postgresql',
        status: dbStatus,
      },
      maintenance: await this.platformState.getMaintenance(true),
    };
  }

  /** Cấu hình Chế độ Bảo trì Toàn sàn — lưu DB, guard đọc lại sau tối đa 5 giây */
  async setMaintenanceMode(
    dto: SetMaintenanceModeDto,
    actor: JwtUser,
    ip?: string,
    ua?: string,
  ) {
    const before = await this.platformState.getMaintenance(true);
    const next = await this.platformState.setMaintenance({
      mode: dto.mode,
      reason: dto.reason,
      expectedDurationMinutes: dto.expectedDurationMinutes,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email,
    });

    await this.audit.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: `MAINTENANCE_MODE_${dto.mode}`,
      targetType: 'System',
      ipAddress: ip,
      userAgent: ua,
      beforeState: before as unknown as Prisma.InputJsonValue,
      afterState: next as unknown as Prisma.InputJsonValue,
      reason: dto.reason,
    });

    return next;
  }

  /** Lấy Nhật ký Kiểm toán Toàn sàn có kèm Kiểm tra Tính Toàn vẹn */
  async getAuditLogs(page = 1, limit = 25) {
    const skip = (page - 1) * limit;

    const [items, total, integrity] = await Promise.all([
      this.prisma.systemAuditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.systemAuditLog.count(),
      this.audit.verifyIntegrity(50),
    ]);

    return {
      items,
      integrityCheck: integrity,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Tạo Phiên Hỗ trợ Khách hàng (Customer Consent Impersonation) */
  async createSupportSession(
    dto: CreateSupportSessionDto,
    actor: JwtUser,
    ip?: string,
    ua?: string,
  ) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: dto.workspaceId },
      include: { owner: true },
    });

    if (!ws) {
      throw AppError.notFound('Workspace không tồn tại');
    }

    const durationHours = Math.min(dto.durationHours || 2, 8);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    const session = await this.prisma.supportAccessSession.create({
      data: {
        workspaceId: dto.workspaceId,
        adminId: actor.id,
        ticketReference: dto.ticketReference,
        reason: dto.reason,
        status: SupportAccessStatus.ACTIVE,
        consentGrantedBy: ws.ownerId,
        expiresAt,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'SUPPORT_SESSION_CREATED',
      targetType: 'SupportAccessSession',
      targetId: session.id,
      ipAddress: ip,
      userAgent: ua,
      reason: `Mở phiên hỗ trợ kỹ thuật theo ticket ${dto.ticketReference}`,
    });

    return session;
  }
}
