import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TaskSource } from '@prisma/client';
import { ProjectAccessService } from '../common/access/project-access.service';
import { WorkspaceAccessService } from '../common/access/workspace-access.service';
import { AppError } from '../common/app-error';
import {
  TASK_EVENTS,
  type TaskEventPayload,
} from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';
import {
  needsNormalize,
  normalizePositions,
  POSITION_STEP,
} from './domain/position';
import type {
  AssigneesDto,
  CreateSubtaskDto,
  CreateTaskDto,
  DuplicateTaskDto,
  ListTasksQueryDto,
  MoveTaskDto,
  MyTasksQueryDto,
  ProgressDto,
  TaskLabelsDto,
  TaskSkillsDto,
  UpdateTaskDto,
} from './dto/task.dto';

type Tx = Prisma.TransactionClient;

/** Bản rút gọn cho danh sách/Kanban/Gantt — đủ để vẽ thẻ, không kéo mô tả dài. */
const TASK_LIST_SELECT = {
  id: true,
  projectId: true,
  sprintId: true,
  parentId: true,
  columnId: true,
  number: true,
  title: true,
  priority: true,
  isUrgent: true,
  difficulty: true,
  size: true,
  startDate: true,
  dueDate: true,
  estimateHours: true,
  remainingHours: true,
  progress: true,
  position: true,
  version: true,
  source: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
  assignees: {
    select: {
      user: {
        select: { id: true, fullName: true, shortName: true, avatarUrl: true },
      },
    },
  },
  labels: {
    select: { label: { select: { id: true, name: true, color: true } } },
  },
  skills: {
    select: { minLevel: true, skill: { select: { id: true, name: true } } },
  },
  dependsOn: { select: { dependsOnId: true } },
  _count: {
    select: {
      subtasks: { where: { deletedAt: null } },
      comments: { where: { deletedAt: null } },
      attachments: true,
    },
  },
} as const;

const TASK_DETAIL_SELECT = {
  ...TASK_LIST_SELECT,
  description: true,
  createdAt: true,
  deletedAt: true,
  createdBy: {
    select: { id: true, fullName: true, shortName: true, avatarUrl: true },
  },
  project: { select: { key: true, workspaceId: true } },
  column: { select: { id: true, name: true, statusKey: true, isDone: true } },
  sprint: { select: { id: true, name: true, status: true } },
  parent: { select: { id: true, number: true, title: true } },
  subtasks: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    select: TASK_LIST_SELECT,
  },
  dependents: { select: { taskId: true } },
} as const;

type TaskListRow = Prisma.TaskGetPayload<{ select: typeof TASK_LIST_SELECT }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly wsAccess: WorkspaceAccessService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Đọc ────────────────────────────────────────────────────

  /** Danh sách task của dự án (mặc định chỉ task gốc); `since` trả phần chênh + deletedIds. */
  async list(userId: string, projectId: string, q: ListTasksQueryDto) {
    await this.access.assertRead(userId, projectId);
    const since = q.since ? new Date(q.since) : undefined;
    const where: Prisma.TaskWhereInput = {
      projectId,
      ...(since ? {} : { deletedAt: null }),
      ...(q.parentId
        ? { parentId: q.parentId }
        : q.includeSubtasks
          ? {}
          : { parentId: null }),
      ...(q.sprintId ? { sprintId: q.sprintId } : {}),
      ...(q.backlog === 'true' ? { sprintId: null } : {}),
      ...(q.columnId ? { columnId: q.columnId } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.assigneeId
        ? { assignees: { some: { userId: q.assigneeId } } }
        : {}),
      ...(q.labelId ? { labels: { some: { labelId: q.labelId } } } : {}),
      ...(q.dueFrom || q.dueTo
        ? {
            dueDate: {
              ...(q.dueFrom ? { gte: new Date(q.dueFrom) } : {}),
              ...(q.dueTo ? { lte: new Date(q.dueTo) } : {}),
            },
          }
        : {}),
      ...(q.q ? { title: { contains: q.q.trim(), mode: 'insensitive' } } : {}),
      ...(since ? { updatedAt: { gt: since } } : {}),
    };
    const rows = await this.prisma.task.findMany({
      where,
      select: TASK_LIST_SELECT,
      orderBy: [{ columnId: 'asc' }, { position: 'asc' }],
      take: 1000,
    });
    const items = rows
      .filter((r) => !since || !('deletedAt' in r))
      .map((r) => this.toListView(r));
    const deletedIds = since
      ? (
          await this.prisma.task.findMany({
            where: { projectId, deletedAt: { gt: since } },
            select: { id: true },
          })
        ).map((t) => t.id)
      : [];
    return {
      items: items.filter((i) => !deletedIds.includes(i.id)),
      deletedIds,
      serverTime: new Date().toISOString(),
    };
  }

  async get(userId: string, taskId: string) {
    const projectId = await this.access.projectOfTask(taskId);
    await this.access.assertRead(userId, projectId);
    const t = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: TASK_DETAIL_SELECT,
    });
    return this.toDetailView(t);
  }

  async getByKey(
    userId: string,
    projectKey: string,
    number: number,
    workspaceId?: string,
  ) {
    const t = await this.prisma.task.findFirst({
      where: {
        number,
        deletedAt: null,
        project: {
          key: projectKey.toUpperCase(),
          ...(workspaceId ? { workspaceId } : {}),
        },
      },
      select: { id: true },
    });
    if (!t) throw AppError.notFound();
    return this.get(userId, t.id);
  }

  async myTasks(userId: string, q: MyTasksQueryDto) {
    const status = q.status ?? 'open';
    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        assignees: { some: { userId } },
        project: { status: 'ACTIVE', workspace: { archivedAt: null } },
        ...(status === 'open'
          ? { completedAt: null }
          : status === 'done'
            ? { completedAt: { not: null } }
            : {}),
        ...(q.dueTo ? { dueDate: { lte: new Date(q.dueTo) } } : {}),
      },
      select: {
        ...TASK_LIST_SELECT,
        project: { select: { id: true, key: true, name: true } },
      },
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { priority: 'desc' },
      ],
      take: 500,
    });
    return rows.map((r) => ({ ...this.toListView(r), project: r.project }));
  }

  /** ⌘K: tìm mờ tiêu đề trong các dự án người dùng đọc được (index trgm). */
  async search(userId: string, workspaceId: string, q: string, limit = 20) {
    await this.wsAccess.assertRole(userId, workspaceId, []);
    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        project: { workspaceId, status: 'ACTIVE' },
        title: { contains: q.trim(), mode: 'insensitive' },
      },
      select: {
        id: true,
        number: true,
        title: true,
        completedAt: true,
        project: { select: { id: true, key: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 50),
    });
    return rows.map((r) => ({ ...r, key: `${r.project.key}-${r.number}` }));
  }

  // ── Ghi ────────────────────────────────────────────────────

  async create(
    userId: string,
    projectId: string,
    dto: CreateTaskDto,
    source: TaskSource = TaskSource.MANUAL,
  ) {
    await this.access.assertEdit(userId, projectId);
    if (dto.startDate && dto.dueDate && dto.startDate > dto.dueDate)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['dueDate phải sau startDate'],
      });
    const [column, sprint] = await Promise.all([
      dto.columnId
        ? this.prisma.boardColumn.findFirst({
            where: { id: dto.columnId, projectId },
          })
        : this.prisma.boardColumn.findFirst({
            where: { projectId },
            orderBy: { position: 'asc' },
          }),
      dto.sprintId
        ? this.prisma.sprint.findFirst({
            where: { id: dto.sprintId, projectId, status: { not: 'CLOSED' } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!column) throw AppError.notFound({ columnId: dto.columnId });
    if (dto.sprintId && !sprint)
      throw AppError.notFound({ sprintId: dto.sprintId });
    await this.assertAssignees(projectId, dto.assigneeIds ?? []);
    await this.assertLabelsAndSkills(
      projectId,
      dto.labelIds ?? [],
      dto.requiredSkills ?? [],
    );

    const task = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, projectId);
      const position = await this.lastPosition(tx, column.id);
      return tx.task.create({
        data: {
          projectId,
          sprintId: sprint?.id ?? null,
          columnId: column.id,
          number,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          isUrgent: dto.isUrgent ?? false,
          difficulty: dto.difficulty ?? 3,
          size: dto.size,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          estimateHours: dto.estimateHours ?? null,
          remainingHours: dto.estimateHours ?? null,
          position,
          source,
          createdById: userId,
          completedAt: column.isDone ? new Date() : null,
          assignees: {
            create: (dto.assigneeIds ?? []).map((id) => ({ userId: id })),
          },
          labels: {
            create: (dto.labelIds ?? []).map((id) => ({ labelId: id })),
          },
          skills: {
            create: (dto.requiredSkills ?? []).map((s) => ({
              skillId: s.skillId,
              minLevel: s.minLevel ?? 1,
            })),
          },
        },
        select: TASK_DETAIL_SELECT,
      });
    });
    this.emit(TASK_EVENTS.created, {
      projectId,
      taskId: task.id,
      actorId: userId,
      affectedUserIds: dto.assigneeIds ?? [],
      version: task.version,
      source,
      at: new Date(),
    });
    return this.toDetailView(task);
  }

  async createSubtask(userId: string, parentId: string, dto: CreateSubtaskDto) {
    const projectId = await this.access.projectOfTask(parentId);
    await this.access.assertEdit(userId, projectId);
    const parent = await this.prisma.task.findUniqueOrThrow({
      where: { id: parentId },
      select: {
        parentId: true,
        sprintId: true,
        columnId: true,
        projectId: true,
      },
    });
    if (parent.parentId)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['chỉ một cấp subtask'],
      });
    await this.assertAssignees(projectId, dto.assigneeIds ?? []);
    const task = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, projectId);
      const position = await this.lastPosition(tx, parent.columnId, parentId);
      return tx.task.create({
        data: {
          projectId,
          parentId,
          sprintId: parent.sprintId,
          columnId: parent.columnId,
          number,
          title: dto.title,
          estimateHours: dto.estimateHours ?? null,
          remainingHours: dto.estimateHours ?? null,
          position,
          createdById: userId,
          assignees: {
            create: (dto.assigneeIds ?? []).map((id) => ({ userId: id })),
          },
        },
        select: TASK_DETAIL_SELECT,
      });
    });
    await this.recomputeParentProgress(parentId, userId);
    this.emit(TASK_EVENTS.created, {
      projectId,
      taskId: task.id,
      actorId: userId,
      affectedUserIds: dto.assigneeIds ?? [],
      version: task.version,
      source: 'MANUAL',
      at: new Date(),
    });
    return this.toDetailView(task);
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const { projectId, current } = await this.loadForEdit(userId, taskId);
    const { version, ...patch } = dto;
    const start =
      patch.startDate === undefined
        ? current.startDate
        : patch.startDate
          ? new Date(patch.startDate)
          : null;
    const due =
      patch.dueDate === undefined
        ? current.dueDate
        : patch.dueDate
          ? new Date(patch.dueDate)
          : null;
    if (start && due && start > due)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['dueDate phải sau startDate'],
      });
    if (patch.sprintId) {
      const s = await this.prisma.sprint.findFirst({
        where: { id: patch.sprintId, projectId, status: { not: 'CLOSED' } },
        select: { id: true },
      });
      if (!s) throw AppError.notFound({ sprintId: patch.sprintId });
    }
    const data: Prisma.TaskUpdateInput = {
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      isUrgent: patch.isUrgent,
      difficulty: patch.difficulty,
      size: patch.size,
      startDate: start,
      dueDate: due,
      ...(patch.estimateHours !== undefined
        ? {
            estimateHours: patch.estimateHours,
            remainingHours: current.completedAt
              ? 0
              : patch.estimateHours === null
                ? null
                : this.scaleRemaining(current, patch.estimateHours),
          }
        : {}),
      ...(patch.sprintId !== undefined
        ? {
            sprint: patch.sprintId
              ? { connect: { id: patch.sprintId } }
              : { disconnect: true },
          }
        : {}),
    };
    const diff = this.diffOf(current, {
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      isUrgent: patch.isUrgent,
      difficulty: patch.difficulty,
      size: patch.size,
      startDate: start,
      dueDate: due,
      estimateHours: patch.estimateHours,
      sprintId: patch.sprintId,
    });
    const updated = await this.commit(taskId, version, data);
    if (patch.sprintId !== undefined && !current.parentId) {
      await this.prisma.task.updateMany({
        where: { parentId: taskId },
        data: { sprintId: patch.sprintId, version: { increment: 1 } },
      });
    }
    this.emit(TASK_EVENTS.updated, {
      projectId,
      taskId,
      actorId: userId,
      affectedUserIds: current.assignees.map((a) => a.userId),
      diff,
      version: updated.version,
      source: 'MANUAL',
      at: new Date(),
    });
    return this.toDetailView(updated);
  }

  /** Kéo thả: đổi cột/vị trí (và sprint); kiểm WIP; cột hoàn thành đặt completed_at; đánh số lại khi khe quá hẹp. */
  async move(userId: string, taskId: string, dto: MoveTaskDto) {
    const { projectId, current } = await this.loadForEdit(userId, taskId);
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: dto.columnId, projectId },
    });
    if (!column) throw AppError.notFound({ columnId: dto.columnId });
    if (dto.sprintId) {
      const s = await this.prisma.sprint.findFirst({
        where: { id: dto.sprintId, projectId, status: { not: 'CLOSED' } },
        select: { id: true },
      });
      if (!s) throw AppError.notFound({ sprintId: dto.sprintId });
    }
    if (column.id !== current.columnId && column.wipLimit) {
      const inColumn = await this.prisma.task.count({
        where: { columnId: column.id, deletedAt: null, parentId: null },
      });
      if (inColumn >= column.wipLimit && !current.parentId)
        throw AppError.unprocessable('WIP_LIMIT_EXCEEDED', {
          column: column.name,
          wipLimit: column.wipLimit,
          inColumn,
        });
    }
    const position =
      dto.position ?? (await this.lastPosition(this.prisma, column.id));
    const enteringDone = column.isDone && !current.completedAt;
    const leavingDone = !column.isDone && !!current.completedAt;
    const data: Prisma.TaskUpdateInput = {
      column: { connect: { id: column.id } },
      position,
      ...(dto.sprintId !== undefined
        ? {
            sprint: dto.sprintId
              ? { connect: { id: dto.sprintId } }
              : { disconnect: true },
          }
        : {}),
      ...(enteringDone
        ? { completedAt: new Date(), progress: 100, remainingHours: 0 }
        : {}),
      ...(leavingDone
        ? {
            completedAt: null,
            progress: current.progress === 100 ? 90 : current.progress,
            remainingHours: current.estimateHours
              ? Number(current.estimateHours) * 0.1
              : null,
          }
        : {}),
      ...(column.statusKey === 'IN_PROGRESS' && !current.startedAt
        ? { startedAt: new Date() }
        : {}),
    };
    const updated = await this.commit(taskId, dto.version, data);
    await this.normalizeIfNeeded(column.id);
    if (current.parentId)
      await this.recomputeParentProgress(current.parentId, userId);
    this.emit(TASK_EVENTS.moved, {
      projectId,
      taskId,
      actorId: userId,
      affectedUserIds: current.assignees.map((a) => a.userId),
      diff: {
        columnId: { from: current.columnId, to: column.id },
        ...(enteringDone || leavingDone
          ? {
              completedAt: {
                from: current.completedAt,
                to: enteringDone ? 'now' : null,
              },
            }
          : {}),
      },
      version: updated.version,
      source: 'MANUAL',
      at: new Date(),
    });
    return this.toDetailView(updated);
  }

  async progress(userId: string, taskId: string, dto: ProgressDto) {
    const { projectId, current, access } = await this.loadForEdit(
      userId,
      taskId,
    );
    const isAssignee = current.assignees.some((a) => a.userId === userId);
    if (!isAssignee && !access.canManage)
      throw AppError.forbidden({ required: 'người thực hiện hoặc PM' });
    const data: Prisma.TaskUpdateInput = {};
    if (dto.progress !== undefined) {
      data.progress = dto.progress;
      if (current.estimateHours && dto.remainingHours === undefined)
        data.remainingHours =
          Number(current.estimateHours) * (1 - dto.progress / 100);
    }
    if (dto.remainingHours !== undefined) {
      data.remainingHours = dto.remainingHours;
      if (current.estimateHours && dto.progress === undefined)
        data.progress = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (1 - dto.remainingHours / Number(current.estimateHours)) * 100,
            ),
          ),
        );
    }
    if (
      !current.startedAt &&
      ((dto.progress ?? 0) > 0 ||
        (dto.remainingHours !== undefined &&
          current.estimateHours &&
          dto.remainingHours < Number(current.estimateHours)))
    )
      data.startedAt = new Date();
    const updated = await this.commit(taskId, dto.version, data);
    if (current.parentId)
      await this.recomputeParentProgress(current.parentId, userId);
    this.emit(TASK_EVENTS.updated, {
      projectId,
      taskId,
      actorId: userId,
      affectedUserIds: current.assignees.map((a) => a.userId),
      diff: this.diffOf(current, {
        progress: data.progress,
        remainingHours: data.remainingHours,
      }),
      version: updated.version,
      source: 'MANUAL',
      at: new Date(),
    });
    return this.toDetailView(updated);
  }

  async setAssignees(
    userId: string,
    taskId: string,
    dto: AssigneesDto,
    source: TaskSource = TaskSource.MANUAL,
  ) {
    const { projectId, current } = await this.loadForEdit(userId, taskId);
    const ids = [...new Set(dto.userIds)];
    await this.assertAssignees(projectId, ids);
    const before = current.assignees.map((a) => a.userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertVersion(tx, taskId, dto.version);
      await tx.taskAssignee.deleteMany({
        where: { taskId, userId: { notIn: ids } },
      });
      await tx.taskAssignee.createMany({
        data: ids
          .filter((id) => !before.includes(id))
          .map((id) => ({ taskId, userId: id })),
        skipDuplicates: true,
      });
      return tx.task.update({
        where: { id: taskId },
        data: { version: { increment: 1 } },
        select: TASK_DETAIL_SELECT,
      });
    });
    this.emit(TASK_EVENTS.assigned, {
      projectId,
      taskId,
      actorId: userId,
      affectedUserIds: [...new Set([...before, ...ids])],
      diff: { assignees: { from: before, to: ids } },
      version: updated.version,
      source,
      at: new Date(),
    });
    return this.toDetailView(updated);
  }

  async setSkills(userId: string, taskId: string, dto: TaskSkillsDto) {
    const { projectId, current } = await this.loadForEdit(userId, taskId);
    await this.assertLabelsAndSkills(projectId, [], dto.skills);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertVersion(tx, taskId, dto.version);
      await tx.taskSkill.deleteMany({ where: { taskId } });
      await tx.taskSkill.createMany({
        data: dto.skills.map((s) => ({
          taskId,
          skillId: s.skillId,
          minLevel: s.minLevel ?? 1,
        })),
        skipDuplicates: true,
      });
      return tx.task.update({
        where: { id: taskId },
        data: { version: { increment: 1 } },
        select: TASK_DETAIL_SELECT,
      });
    });
    this.emit(TASK_EVENTS.updated, {
      projectId,
      taskId,
      actorId: userId,
      affectedUserIds: current.assignees.map((a) => a.userId),
      diff: {
        skills: {
          from: current.skills.map((s) => s.skill.id),
          to: dto.skills.map((s) => s.skillId),
        },
      },
      version: updated.version,
      source: 'MANUAL',
      at: new Date(),
    });
    return this.toDetailView(updated);
  }

  async setLabels(userId: string, taskId: string, dto: TaskLabelsDto) {
    const { projectId } = await this.loadForEdit(userId, taskId);
    await this.assertLabelsAndSkills(projectId, dto.labelIds, []);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertVersion(tx, taskId, dto.version);
      await tx.taskLabel.deleteMany({ where: { taskId } });
      await tx.taskLabel.createMany({
        data: [...new Set(dto.labelIds)].map((labelId) => ({
          taskId,
          labelId,
        })),
        skipDuplicates: true,
      });
      return tx.task.update({
        where: { id: taskId },
        data: { version: { increment: 1 } },
        select: TASK_DETAIL_SELECT,
      });
    });
    return this.toDetailView(updated);
  }

  async duplicate(userId: string, taskId: string, dto: DuplicateTaskDto) {
    const { projectId, current } = await this.loadForEdit(userId, taskId);
    const src = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: TASK_DETAIL_SELECT,
    });
    const copy = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, projectId);
      const firstColumn = await tx.boardColumn.findFirstOrThrow({
        where: { projectId },
        orderBy: { position: 'asc' },
      });
      const position = await this.lastPosition(tx, firstColumn.id);
      const created = await tx.task.create({
        data: {
          projectId,
          sprintId: src.sprintId,
          parentId: src.parentId,
          columnId: firstColumn.id,
          number,
          title: `${src.title} (bản sao)`,
          description: src.description,
          priority: src.priority,
          isUrgent: src.isUrgent,
          difficulty: src.difficulty,
          size: src.size,
          startDate: src.startDate,
          dueDate: src.dueDate,
          estimateHours: src.estimateHours,
          remainingHours: src.estimateHours,
          position,
          createdById: userId,
          labels: { create: src.labels.map((l) => ({ labelId: l.label.id })) },
          skills: {
            create: src.skills.map((s) => ({
              skillId: s.skill.id,
              minLevel: s.minLevel,
            })),
          },
        },
        select: TASK_DETAIL_SELECT,
      });
      if (dto.withSubtasks) {
        for (const sub of src.subtasks) {
          const n = await this.nextNumber(tx, projectId);
          await tx.task.create({
            data: {
              projectId,
              parentId: created.id,
              sprintId: src.sprintId,
              columnId: firstColumn.id,
              number: n,
              title: sub.title,
              estimateHours: sub.estimateHours,
              remainingHours: sub.estimateHours,
              position: sub.position,
              createdById: userId,
            },
          });
        }
      }
      return created;
    });
    void current;
    this.emit(TASK_EVENTS.created, {
      projectId,
      taskId: copy.id,
      actorId: userId,
      affectedUserIds: [],
      version: copy.version,
      source: 'MANUAL',
      at: new Date(),
    });
    return this.get(userId, copy.id);
  }

  /** Xoá mềm (kèm subtask). Người tạo hoặc PM. */
  async remove(userId: string, taskId: string): Promise<void> {
    const { projectId, current, access } = await this.loadForEdit(
      userId,
      taskId,
    );
    if (current.createdById !== userId && !access.canManage)
      throw AppError.forbidden({ required: 'người tạo hoặc PM' });
    const now = new Date();
    await this.prisma.task.updateMany({
      where: { OR: [{ id: taskId }, { parentId: taskId }], deletedAt: null },
      data: { deletedAt: now, version: { increment: 1 } },
    });
    if (current.parentId)
      await this.recomputeParentProgress(current.parentId, userId);
    this.emit(TASK_EVENTS.deleted, {
      projectId,
      taskId,
      actorId: userId,
      affectedUserIds: current.assignees.map((a) => a.userId),
      version: current.version + 1,
      source: 'MANUAL',
      at: now,
    });
  }

  // ── Trợ giúp ───────────────────────────────────────────────

  private async loadForEdit(userId: string, taskId: string) {
    const projectId = await this.access.projectOfTask(taskId);
    const access = await this.access.assertEdit(userId, projectId);
    const current = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        parentId: true,
        columnId: true,
        sprintId: true,
        title: true,
        description: true,
        priority: true,
        isUrgent: true,
        difficulty: true,
        size: true,
        startDate: true,
        dueDate: true,
        estimateHours: true,
        remainingHours: true,
        progress: true,
        version: true,
        startedAt: true,
        completedAt: true,
        createdById: true,
        assignees: { select: { userId: true } },
        skills: { select: { minLevel: true, skill: { select: { id: true } } } },
      },
    });
    return { projectId, access, current };
  }

  /** UPDATE … WHERE id AND version = ? — 0 dòng = người khác vừa sửa → 409 kèm version hiện tại. */
  private async commit(
    taskId: string,
    version: number,
    data: Prisma.TaskUpdateInput,
  ) {
    // updateMany chỉ nhận cột vô hướng; connect/disconnect quan hệ áp riêng sau khi khoá lạc quan đã qua.
    const { column, sprint, ...scalar } = data;
    const res = await this.prisma.task.updateMany({
      where: { id: taskId, version, deletedAt: null },
      data: {
        ...(scalar as Prisma.TaskUpdateManyMutationInput),
        version: { increment: 1 },
      },
    });
    if (res.count === 0) {
      const cur = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { version: true },
      });
      throw AppError.conflict('TASK_VERSION_CONFLICT', {
        current: cur?.version ?? null,
        sent: version,
      });
    }
    const relational: Prisma.TaskUpdateInput = {};
    if (column) relational.column = column;
    if (sprint) relational.sprint = sprint;
    if (Object.keys(relational).length)
      await this.prisma.task.update({
        where: { id: taskId },
        data: relational,
      });
    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: TASK_DETAIL_SELECT,
    });
  }

  private async assertVersion(
    tx: Tx,
    taskId: string,
    version: number,
  ): Promise<void> {
    const t = await tx.task.findUnique({
      where: { id: taskId },
      select: { version: true, deletedAt: true },
    });
    if (!t || t.deletedAt) throw AppError.notFound({ taskId });
    if (t.version !== version)
      throw AppError.conflict('TASK_VERSION_CONFLICT', {
        current: t.version,
        sent: version,
      });
  }

  private async nextNumber(tx: Tx, projectId: string): Promise<number> {
    const p = await tx.project.update({
      where: { id: projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    });
    return p.taskCounter;
  }

  private async lastPosition(
    db: Tx | PrismaService,
    columnId: string,
    parentId: string | null = null,
  ): Promise<number> {
    const last = await db.task.findFirst({
      where: { columnId, parentId, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? 0) + POSITION_STEP;
  }

  private async normalizeIfNeeded(columnId: string): Promise<void> {
    const rows = await this.prisma.task.findMany({
      where: { columnId, deletedAt: null, parentId: null },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    if (!needsNormalize(rows.map((r) => r.position))) return;
    await this.prisma.$transaction(
      normalizePositions(rows.map((r) => r.id)).map((p) =>
        this.prisma.task.update({
          where: { id: p.id },
          data: { position: p.position },
        }),
      ),
    );
  }

  /** Tiến độ cha = trung bình tiến độ subtask; cha xong khi mọi subtask xong (không tự kéo cột). */
  private async recomputeParentProgress(
    parentId: string,
    actorId: string,
  ): Promise<void> {
    const subs = await this.prisma.task.findMany({
      where: { parentId, deletedAt: null },
      select: { progress: true, completedAt: true },
    });
    if (subs.length === 0) return;
    const progress = Math.round(
      subs.reduce((s, x) => s + (x.completedAt ? 100 : x.progress), 0) /
        subs.length,
    );
    const parent = await this.prisma.task.update({
      where: { id: parentId },
      data: { progress, version: { increment: 1 } },
      select: {
        projectId: true,
        version: true,
        assignees: { select: { userId: true } },
      },
    });
    this.emit(TASK_EVENTS.updated, {
      projectId: parent.projectId,
      taskId: parentId,
      actorId,
      affectedUserIds: parent.assignees.map((a) => a.userId),
      diff: { progress: { from: null, to: progress } },
      version: parent.version,
      source: 'MANUAL',
      at: new Date(),
    });
  }

  private async assertAssignees(
    projectId: string,
    ids: string[],
  ): Promise<void> {
    if (!ids.length) return;
    const n = await this.prisma.projectMember.count({
      where: { projectId, userId: { in: ids } },
    });
    if (n !== new Set(ids).size)
      throw new AppError('ASSIGN_NOT_MEMBER', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  private async assertLabelsAndSkills(
    projectId: string,
    labelIds: string[],
    skills: { skillId: string }[],
  ): Promise<void> {
    if (labelIds.length) {
      const n = await this.prisma.label.count({
        where: { projectId, id: { in: labelIds } },
      });
      if (n !== new Set(labelIds).size)
        throw AppError.notFound({ reason: 'nhãn không thuộc dự án' });
    }
    if (skills.length) {
      const ws = await this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { workspaceId: true },
      });
      const n = await this.prisma.skill.count({
        where: {
          workspaceId: ws.workspaceId,
          isActive: true,
          id: { in: skills.map((s) => s.skillId) },
        },
      });
      if (n !== new Set(skills.map((s) => s.skillId)).size)
        throw AppError.notFound({ reason: 'kỹ năng không thuộc workspace' });
    }
  }

  private scaleRemaining(
    current: {
      estimateHours: Prisma.Decimal | null;
      remainingHours: Prisma.Decimal | null;
      progress: number;
    },
    newEstimate: number,
  ): number {
    return Math.max(0, newEstimate * (1 - current.progress / 100));
  }

  private diffOf(
    current: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    const out: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const from = current[k];
      const norm = (x: unknown) =>
        x instanceof Date
          ? x.toISOString().slice(0, 10)
          : x instanceof Prisma.Decimal
            ? Number(x)
            : x;
      if (JSON.stringify(norm(from)) !== JSON.stringify(norm(v)))
        out[k] = { from: norm(from), to: norm(v) };
    }
    return out;
  }

  private emit(name: string, payload: TaskEventPayload): void {
    this.events.emit(name, payload);
  }

  private toListView(r: TaskListRow) {
    return {
      id: r.id,
      projectId: r.projectId,
      sprintId: r.sprintId,
      parentId: r.parentId,
      columnId: r.columnId,
      number: r.number,
      title: r.title,
      priority: r.priority,
      isUrgent: r.isUrgent,
      difficulty: r.difficulty,
      size: r.size,
      startDate: r.startDate,
      dueDate: r.dueDate,
      estimateHours: r.estimateHours === null ? null : Number(r.estimateHours),
      remainingHours:
        r.remainingHours === null ? null : Number(r.remainingHours),
      progress: r.progress,
      position: r.position,
      version: r.version,
      source: r.source,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      updatedAt: r.updatedAt,
      assignees: r.assignees.map((a) => a.user),
      labels: r.labels.map((l) => l.label),
      requiredSkills: r.skills.map((s) => ({
        ...s.skill,
        minLevel: s.minLevel,
      })),
      dependsOnIds: r.dependsOn.map((d) => d.dependsOnId),
      subtaskCount: r._count.subtasks,
      commentCount: r._count.comments,
      attachmentCount: r._count.attachments,
    };
  }

  private toDetailView(
    t: Prisma.TaskGetPayload<{ select: typeof TASK_DETAIL_SELECT }>,
  ) {
    return {
      ...this.toListView(t),
      key: `${t.project.key}-${t.number}`,
      description: t.description,
      createdAt: t.createdAt,
      createdBy: t.createdBy,
      column: t.column,
      sprint: t.sprint,
      parent: t.parent,
      subtasks: t.subtasks.map((s) => this.toListView(s)),
      dependentIds: t.dependents.map((d) => d.taskId),
    };
  }
}
