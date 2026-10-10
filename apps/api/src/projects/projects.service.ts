import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectRole, ProjectStatus } from '@prisma/client';
import { ProjectAccessService } from '../common/access/project-access.service';
import { WorkspaceAccessService } from '../common/access/workspace-access.service';
import { AppError } from '../common/app-error';
import { PROJECT_EVENTS } from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import { SkillEvidenceService } from '../metrics/skill-evidence.service';
import { isoDate, toDate, weekStartOf } from '../workload/domain/calendar';
import type {
  CreateProjectDto,
  LabelDto,
  PutColumnsDto,
  PutProjectMembersDto,
  UpdateLabelDto,
  UpdateProjectDto,
} from './dto/project.dto';

/** Cột mặc định cho dự án mới (docs 11 §1.1 mục 4). */
export const DEFAULT_COLUMNS = [
  { name: 'Cần làm', statusKey: 'TODO', position: 1, isDone: false },
  { name: 'Đang làm', statusKey: 'IN_PROGRESS', position: 2, isDone: false },
  { name: 'Kiểm thử', statusKey: 'REVIEW', position: 3, isDone: false },
  { name: 'Hoàn thành', statusKey: 'DONE', position: 4, isDone: true },
] as const;

const PROJECT_SELECT = {
  id: true,
  workspaceId: true,
  key: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      members: true,
      tasks: { where: { deletedAt: null, parentId: null } },
    },
  },
  sprints: {
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, startDate: true, endDate: true },
    take: 1,
  },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wsAccess: WorkspaceAccessService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
    private readonly workload: WorkloadService,
    private readonly evidence: SkillEvidenceService,
  ) {}

  async list(userId: string, workspaceId: string, status?: ProjectStatus) {
    await this.wsAccess.assertRole(userId, workspaceId, []);
    const rows = await this.prisma.project.findMany({
      where: { workspaceId, status: status ?? ProjectStatus.ACTIVE },
      select: {
        ...PROJECT_SELECT,
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ members, sprints, ...p }) => ({
      ...p,
      myRole: members[0]?.role ?? null,
      activeSprint: sprints[0] ?? null,
    }));
  }

  /** ws OWNER/ADMIN tạo; PM phải là thành viên workspace; cột mặc định; người tạo tự vào dự án nếu chưa có. */
  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    await this.wsAccess.assertRole(userId, workspaceId, ['OWNER', 'ADMIN']);
    await this.wsAccess.assertRole(dto.pmUserId, workspaceId, []).catch(() => {
      throw AppError.notFound({
        pmUserId: dto.pmUserId,
        reason: 'PM phải là thành viên workspace',
      });
    });
    const dup = await this.prisma.project.findUnique({
      where: { workspaceId_key: { workspaceId, key: dto.key } },
      select: { id: true },
    });
    if (dup) throw AppError.conflict('PROJECT_KEY_TAKEN');
    if (dto.startDate && dto.endDate && dto.startDate > dto.endDate) {
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['endDate phải sau startDate'],
      });
    }

    const members: Array<{ userId: string; role: ProjectRole }> = [
      { userId: dto.pmUserId, role: ProjectRole.PM },
    ];
    if (userId !== dto.pmUserId)
      members.push({ userId, role: ProjectRole.MEMBER });

    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        members: { create: members },
        columns: { create: DEFAULT_COLUMNS.map((c) => ({ ...c })) },
      },
      select: PROJECT_SELECT,
    });
    const { sprints, ...rest } = project;
    return { ...rest, activeSprint: sprints[0] ?? null };
  }

  async get(userId: string, projectId: string) {
    const access = await this.access.assertRead(userId, projectId);
    const p = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        ...PROJECT_SELECT,
        columns: { orderBy: { position: 'asc' } },
        labels: { orderBy: { name: 'asc' } },
        members: {
          select: {
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                fullName: true,
                shortName: true,
                avatarUrl: true,
                email: true,
              },
            },
          },
        },
      },
    });
    const { sprints, members, ...rest } = p;
    return {
      ...rest,
      activeSprint: sprints[0] ?? null,
      members: members.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      myRole: access.projectRole,
      canManage: access.canManage,
      canEdit: access.canEdit,
    };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.access.assertManage(userId, projectId);
    const current = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { startDate: true, endDate: true },
    });
    const start =
      dto.startDate === undefined
        ? current.startDate
        : dto.startDate
          ? new Date(dto.startDate)
          : null;
    const end =
      dto.endDate === undefined
        ? current.endDate
        : dto.endDate
          ? new Date(dto.endDate)
          : null;
    if (start && end && start > end)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['endDate phải sau startDate'],
      });
    const p = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: start,
        endDate: end,
        status: dto.status,
      },
      select: PROJECT_SELECT,
    });
    const { sprints, ...rest } = p;
    return { ...rest, activeSprint: sprints[0] ?? null };
  }

  async archive(userId: string, projectId: string): Promise<void> {
    await this.access.assertManage(userId, projectId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ARCHIVED },
    });
  }

  async members(userId: string, projectId: string) {
    const a = await this.access.assertRead(userId, projectId);
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
            avatarUrl: true,
            email: true,
            weeklyCapacityHours: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    // `level` = mức TỪ BẰNG CHỨNG (docs 02/08); `declared` = tự khai, chỉ để đối chiếu
    const [profiles, catalog] = await Promise.all([
      this.evidence.profiles(
        a.workspaceId,
        rows.map((m) => m.user.id),
      ),
      this.prisma.skill.findMany({
        where: { workspaceId: a.workspaceId, isActive: true },
        select: { id: true, name: true, category: true },
      }),
    ]);
    const skillOf = new Map(catalog.map((s) => [s.id, s]));
    return rows.map((m) => ({
      ...m.user,
      skills: (profiles.get(m.user.id) ?? [])
        .filter((e) => skillOf.has(e.skillId))
        .map((e) => ({
          ...skillOf.get(e.skillId)!,
          level: e.level,
          declared: e.declared,
          tasks: e.tasks,
          failed: e.failed,
          confidence: e.confidence,
          verified: e.verified,
        })),
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /** Thay toàn bộ thành viên; đúng một PM; mọi người phải thuộc workspace; người bị gỡ mất assignee trong dự án. */
  async putMembers(
    userId: string,
    projectId: string,
    dto: PutProjectMembersDto,
  ) {
    const access = await this.access.assertManage(userId, projectId);
    const pms = dto.members.filter((m) => m.role === ProjectRole.PM);
    if (pms.length !== 1)
      throw new AppError(
        'PROJECT_PM_REQUIRED',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    const ids = [...new Set(dto.members.map((m) => m.userId))];
    if (ids.length !== dto.members.length)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['userId trùng'],
      });
    const inWs = await this.prisma.workspaceMember.count({
      where: {
        workspaceId: access.workspaceId,
        userId: { in: ids },
        role: { not: 'VIEWER' },
      },
    });
    if (inWs !== ids.length)
      throw AppError.notFound({
        reason: 'Có người không thuộc workspace hoặc là VIEWER',
      });

    const removed = await this.prisma.$transaction(async (tx) => {
      const before = await tx.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      const removedIds = before
        .map((b) => b.userId)
        .filter((id) => !ids.includes(id));
      await tx.projectMember.deleteMany({ where: { projectId } });
      await tx.projectMember.createMany({
        data: dto.members.map((m) => ({
          projectId,
          userId: m.userId,
          role: m.role,
        })),
      });
      if (removedIds.length) {
        await tx.taskAssignee.deleteMany({
          where: { userId: { in: removedIds }, task: { projectId } },
        });
      }
      return removedIds;
    });
    for (const removedId of removed) {
      this.events.emit(PROJECT_EVENTS.memberRemoved, {
        projectId,
        userId: removedId,
        actorId: userId,
        at: new Date(),
      });
    }
    return this.members(userId, projectId);
  }

  async removeMember(
    userId: string,
    projectId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.access.assertManage(userId, projectId);
    const m = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!m) throw AppError.notFound();
    if (m.role === ProjectRole.PM)
      throw new AppError('PROJECT_PM_REQUIRED', HttpStatus.CONFLICT, {
        hint: 'Đổi PM bằng PUT /members trước',
      });
    await this.prisma.$transaction([
      this.prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId: targetUserId } },
      }),
      this.prisma.taskAssignee.deleteMany({
        where: { userId: targetUserId, task: { projectId } },
      }),
    ]);
    this.events.emit(PROJECT_EVENTS.memberRemoved, {
      projectId,
      userId: targetUserId,
      actorId: userId,
      at: new Date(),
    });
  }

  // ── Cột ────────────────────────────────────────────────────

  async columns(userId: string, projectId: string) {
    await this.access.assertRead(userId, projectId);
    return this.prisma.boardColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });
  }

  /** Thay toàn bộ cột theo thứ tự mảng. Cột bị bỏ phải không còn task; đúng một cột isDone; statusKey không trùng. */
  async putColumns(userId: string, projectId: string, dto: PutColumnsDto) {
    await this.access.assertManage(userId, projectId);
    const keys = dto.columns.map((c) => c.statusKey);
    if (new Set(keys).size !== keys.length)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['statusKey trùng'],
      });
    if (dto.columns.filter((c) => c.isDone).length !== 1)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['phải có đúng một cột isDone'],
      });

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.boardColumn.findMany({
        where: { projectId },
        select: { id: true },
      });
      const keepIds = new Set(
        dto.columns.map((c) => c.id).filter((id): id is string => !!id),
      );
      const toDelete = existing
        .filter((c) => !keepIds.has(c.id))
        .map((c) => c.id);
      if (toDelete.length) {
        const inUse = await tx.task.count({
          where: { columnId: { in: toDelete }, deletedAt: null },
        });
        if (inUse > 0)
          throw AppError.unprocessable('VALIDATION_FAILED', {
            fields: ['cột bị bỏ vẫn còn task — chuyển task trước'],
          });
        await tx.boardColumn.deleteMany({ where: { id: { in: toDelete } } });
      }
      // Hai bước để tránh đụng unique (projectId, statusKey) khi đổi chỗ key giữa các cột.
      for (const c of dto.columns) {
        if (c.id)
          await tx.boardColumn.update({
            where: { id: c.id },
            data: { statusKey: `__${c.id.slice(0, 8)}` },
          });
      }
      for (let i = 0; i < dto.columns.length; i += 1) {
        const c = dto.columns[i];
        const data = {
          name: c.name,
          statusKey: c.statusKey,
          position: i + 1,
          wipLimit: c.wipLimit ?? null,
          isDone: c.isDone ?? false,
        };
        if (c.id) await tx.boardColumn.update({ where: { id: c.id }, data });
        else await tx.boardColumn.create({ data: { projectId, ...data } });
      }
    });
    return this.columns(userId, projectId);
  }

  // ── Nhãn ───────────────────────────────────────────────────

  async labels(userId: string, projectId: string) {
    await this.access.assertRead(userId, projectId);
    return this.prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async createLabel(userId: string, projectId: string, dto: LabelDto) {
    await this.access.assertEdit(userId, projectId);
    return this.prisma.label.create({
      data: { projectId, name: dto.name, color: dto.color ?? '#64748b' },
    });
  }

  async updateLabel(userId: string, labelId: string, dto: UpdateLabelDto) {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label) throw AppError.notFound();
    await this.access.assertEdit(userId, label.projectId);
    return this.prisma.label.update({
      where: { id: labelId },
      data: { name: dto.name, color: dto.color },
    });
  }

  async deleteLabel(userId: string, labelId: string): Promise<void> {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label) throw AppError.notFound();
    await this.access.assertManage(userId, label.projectId);
    await this.prisma.label.delete({ where: { id: labelId } });
  }

  // ── Dashboard (phần không cần workload; Phase 5 bổ sung tải & burn-down) ──

  async dashboard(userId: string, projectId: string) {
    await this.access.assertRead(userId, projectId);
    const today = toDate(new Date());
    const [byColumn, byType, total, overdue, unassigned, byAssignee] =
      await Promise.all([
        this.prisma.task.groupBy({
          by: ['columnId'],
          where: { projectId, deletedAt: null, parentId: null },
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ['type'],
          where: { projectId, deletedAt: null, parentId: null },
          _count: { _all: true },
        }),
        this.prisma.task.count({
          where: { projectId, deletedAt: null, parentId: null },
        }),
        this.prisma.task.count({
          where: {
            projectId,
            deletedAt: null,
            parentId: null,
            completedAt: null,
            dueDate: { lt: today },
          },
        }),
        this.prisma.task.count({
          where: {
            projectId,
            deletedAt: null,
            parentId: null,
            completedAt: null,
            assignees: { none: {} },
          },
        }),
        this.prisma.taskAssignee.groupBy({
          by: ['userId'],
          where: { task: { projectId, deletedAt: null, completedAt: null } },
          _count: { _all: true },
        }),
      ]);
    const columns = await this.prisma.boardColumn.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    const done = byColumn
      .filter((b) => columns.find((c) => c.id === b.columnId)?.isDone)
      .reduce((s, b) => s + b._count._all, 0);
    const weekStart = weekStartOf(today);
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        workspaceId: true,
        members: { select: { userId: true } },
        sprints: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            scopeHoursInitial: true,
            snapshots: { orderBy: { date: 'desc' }, take: 1 },
          },
          take: 1,
        },
      },
    });
    const memberIds = project.members.map((m) => m.userId);
    // Snapshot tải chỉ cập nhật theo sự kiện/cron — đo được Dashboard báo 0 % trong khi tính trực tiếp là 39 %.
    // Cũ hơn 1 giờ (hoặc chưa có) thì tính lại trước khi đọc, để Dashboard, màn Nhân sự và Trợ lý nói cùng một số.
    const snaps = await this.prisma.workloadSnapshot.findMany({
      where: {
        workspaceId: project.workspaceId,
        weekStart,
        userId: { in: memberIds },
      },
      select: { computedAt: true },
    });
    const staleBefore = new Date(Date.now() - 3_600_000);
    if (!snaps.length || snaps.some((x) => x.computedAt < staleBefore))
      await this.workload
        .snapshotWorkspace(project.workspaceId, memberIds)
        .catch(() => undefined); // không tính lại được thì vẫn trả số cũ, không làm hỏng Dashboard
    const [workloadWeek, openAlerts] = await Promise.all([
      this.prisma.workloadSnapshot.findMany({
        where: {
          workspaceId: project.workspaceId,
          weekStart,
          userId: { in: memberIds },
        },
        select: {
          userId: true,
          utilization: true,
          level: true,
          riskScore: true,
          effLoadHours: true,
          effCapacityHours: true,
          user: {
            select: { fullName: true, shortName: true, avatarUrl: true },
          },
        },
        orderBy: { utilization: 'desc' },
      }),
      this.prisma.workloadAlert.findMany({
        where: {
          workspaceId: project.workspaceId,
          userId: { in: memberIds },
          ackedAt: null,
        },
        select: {
          id: true,
          userId: true,
          kind: true,
          weekStart: true,
          riskScore: true,
          user: { select: { fullName: true } },
        },
        orderBy: { weekStart: 'desc' },
      }),
    ]);
    const active = project.sprints[0];
    const last = active?.snapshots[0];
    return {
      counts: { total, done, open: total - done, overdue, unassigned },
      byStatus: columns.map((c) => ({
        columnId: c.id,
        name: c.name,
        statusKey: c.statusKey,
        count: byColumn.find((b) => b.columnId === c.id)?._count._all ?? 0,
      })),
      byType: (['STORY', 'TASK', 'BUG'] as const).map((t) => ({
        type: t,
        count: byType.find((b) => b.type === t)?._count._all ?? 0,
      })),
      byAssignee: byAssignee.map((b) => ({
        userId: b.userId,
        openTasks: b._count._all,
      })),
      workloadWeek: workloadWeek.map((w) => ({
        userId: w.userId,
        ...w.user,
        utilization: Number(w.utilization),
        level: w.level,
        riskScore: w.riskScore,
        effLoadHours: Number(w.effLoadHours),
        effCapacityHours: Number(w.effCapacityHours),
      })),
      openAlerts: openAlerts.map((a) => ({
        ...a,
        weekStart: isoDate(toDate(a.weekStart)),
      })),
      burndownMini: active
        ? {
            sprintId: active.id,
            name: active.name,
            startDate: isoDate(toDate(active.startDate)),
            endDate: isoDate(toDate(active.endDate)),
            scopeInitial: active.scopeHoursInitial
              ? Number(active.scopeHoursInitial)
              : null,
            lastSnapshot: last
              ? {
                  date: isoDate(toDate(last.date)),
                  remaining: Number(last.remainingHours),
                  scope: Number(last.scopeHours),
                }
              : null,
          }
        : null,
    };
  }
}
