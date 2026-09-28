import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, SprintStatus } from '@prisma/client';
import { ProjectAccessService } from '../common/access/project-access.service';
import { AppError } from '../common/app-error';
import {
  SPRINT_EVENTS,
  type SprintEventPayload,
} from '../common/events/task.events';
import { ForecastService } from '../forecast/forecast.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AddSprintTasksDto,
  CloseSprintDto,
  CreateSprintDto,
  UpdateSprintDto,
} from './dto/sprint.dto';

const SPRINT_SELECT = {
  id: true,
  projectId: true,
  name: true,
  goal: true,
  startDate: true,
  endDate: true,
  status: true,
  scopeHoursInitial: true,
  startedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tasks: { where: { deletedAt: null, parentId: null } } } },
} as const;

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
    private readonly forecast: ForecastService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.access.assertRead(userId, projectId);
    const rows = await this.prisma.sprint.findMany({
      where: { projectId },
      select: SPRINT_SELECT,
      orderBy: [{ startDate: 'asc' }],
    });
    const hours = await this.prisma.task.groupBy({
      by: ['sprintId'],
      where: {
        projectId,
        deletedAt: null,
        parentId: null,
        sprintId: { not: null },
      },
      _sum: { estimateHours: true, remainingHours: true },
    });
    const done = await this.prisma.task.groupBy({
      by: ['sprintId'],
      where: {
        projectId,
        deletedAt: null,
        parentId: null,
        sprintId: { not: null },
        completedAt: { not: null },
      },
      _count: { _all: true },
    });
    return rows.map((s) => {
      const h = hours.find((x) => x.sprintId === s.id);
      return {
        ...s,
        taskCount: s._count.tasks,
        doneCount: done.find((x) => x.sprintId === s.id)?._count._all ?? 0,
        estimateHours: num(h?._sum.estimateHours),
        remainingHours: num(h?._sum.remainingHours),
        _count: undefined,
      };
    });
  }

  async create(userId: string, projectId: string, dto: CreateSprintDto) {
    await this.access.assertManage(userId, projectId);
    this.assertDates(dto.startDate, dto.endDate);
    return this.prisma.sprint.create({
      data: {
        projectId,
        name: dto.name,
        goal: dto.goal,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      select: SPRINT_SELECT,
    });
  }

  async get(userId: string, sprintId: string) {
    const s = await this.load(sprintId);
    await this.access.assertRead(userId, s.projectId);
    return s;
  }

  async update(userId: string, sprintId: string, dto: UpdateSprintDto) {
    const s = await this.load(sprintId);
    await this.access.assertManage(userId, s.projectId);
    if (s.status === SprintStatus.CLOSED)
      throw new AppError('SPRINT_NOT_ACTIVE', HttpStatus.CONFLICT, {
        reason: 'Sprint đã đóng',
      });
    const start = dto.startDate ?? s.startDate.toISOString().slice(0, 10);
    const end = dto.endDate ?? s.endDate.toISOString().slice(0, 10);
    this.assertDates(start, end);
    const updated = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        name: dto.name,
        goal: dto.goal,
        startDate: new Date(start),
        endDate: new Date(end),
      },
      select: SPRINT_SELECT,
    });
    this.emit(SPRINT_EVENTS.updated, {
      projectId: s.projectId,
      sprintId,
      actorId: userId,
      at: new Date(),
    });
    return updated;
  }

  /** Chỉ một ACTIVE mỗi dự án (service kiểm + partial unique index ở DB); chốt phạm vi giờ ban đầu cho đường lý tưởng. */
  async start(userId: string, sprintId: string) {
    const s = await this.load(sprintId);
    await this.access.assertManage(userId, s.projectId);
    if (s.status !== SprintStatus.PLANNED)
      throw new AppError('SPRINT_NOT_ACTIVE', HttpStatus.CONFLICT, {
        reason: 'Chỉ bắt đầu sprint PLANNED',
      });
    const active = await this.prisma.sprint.findFirst({
      where: { projectId: s.projectId, status: SprintStatus.ACTIVE },
      select: { id: true, name: true },
    });
    if (active) throw AppError.conflict('SPRINT_ALREADY_ACTIVE', { active });
    const scope = await this.prisma.task.aggregate({
      where: { sprintId, deletedAt: null, parentId: null },
      _sum: { estimateHours: true },
    });
    try {
      const updated = await this.prisma.sprint.update({
        where: { id: sprintId },
        data: {
          status: SprintStatus.ACTIVE,
          startedAt: new Date(),
          scopeHoursInitial: scope._sum.estimateHours ?? new Prisma.Decimal(0),
        },
        select: SPRINT_SELECT,
      });
      // Điểm đầu của đường thực tế — không chờ cron 00:05 mới có
      await this.forecast.snapshotSprint(sprintId);
      this.emit(SPRINT_EVENTS.started, {
        projectId: s.projectId,
        sprintId,
        actorId: userId,
        at: new Date(),
      });
      return updated;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw AppError.conflict('SPRINT_ALREADY_ACTIVE');
      throw e;
    }
  }

  /** Đóng sprint: việc chưa xong về backlog hoặc sang sprint khác (PLANNED/ACTIVE cùng dự án). */
  async close(userId: string, sprintId: string, dto: CloseSprintDto) {
    const s = await this.load(sprintId);
    await this.access.assertManage(userId, s.projectId);
    if (s.status !== SprintStatus.ACTIVE)
      throw new AppError('SPRINT_NOT_ACTIVE', HttpStatus.CONFLICT);
    let targetSprintId: string | null = null;
    if (dto.moveOpenTo !== 'backlog') {
      const target = await this.prisma.sprint.findFirst({
        where: {
          id: dto.moveOpenTo,
          projectId: s.projectId,
          status: { in: [SprintStatus.PLANNED, SprintStatus.ACTIVE] },
        },
        select: { id: true },
      });
      if (!target) throw AppError.notFound({ moveOpenTo: dto.moveOpenTo });
      targetSprintId = target.id;
    }
    const movedTaskIds = await this.prisma.$transaction(async (tx) => {
      // Chụp số cuối TRƯỚC khi chuyển việc dở — sau bước này sprint không còn giữ chúng nữa
      await this.forecast.snapshotSprint(sprintId, new Date(), tx);
      const open = await tx.task.findMany({
        where: { sprintId, deletedAt: null, completedAt: null },
        select: { id: true },
      });
      const ids = open.map((t) => t.id);
      if (ids.length) {
        await tx.task.updateMany({
          where: { id: { in: ids } },
          data: { sprintId: targetSprintId, version: { increment: 1 } },
        });
      }
      await tx.sprint.update({
        where: { id: sprintId },
        data: { status: SprintStatus.CLOSED, closedAt: new Date() },
      });
      return ids;
    });
    this.emit(SPRINT_EVENTS.closed, {
      projectId: s.projectId,
      sprintId,
      actorId: userId,
      movedTaskIds,
      at: new Date(),
    });
    const closed = await this.prisma.sprint.findUniqueOrThrow({
      where: { id: sprintId },
      select: SPRINT_SELECT,
    });
    return { ...closed, movedTaskIds, movedTo: targetSprintId ?? 'backlog' };
  }

  /** Kéo task từ backlog/sprint khác vào sprint này (chỉ task gốc; subtask theo cha). */
  async addTasks(userId: string, sprintId: string, dto: AddSprintTasksDto) {
    const s = await this.load(sprintId);
    await this.access.assertManage(userId, s.projectId);
    if (s.status === SprintStatus.CLOSED)
      throw new AppError('SPRINT_NOT_ACTIVE', HttpStatus.CONFLICT, {
        reason: 'Sprint đã đóng',
      });
    const tasks = await this.prisma.task.findMany({
      where: {
        id: { in: dto.taskIds },
        projectId: s.projectId,
        deletedAt: null,
        parentId: null,
      },
      select: { id: true },
    });
    if (tasks.length !== new Set(dto.taskIds).size)
      throw AppError.notFound({
        reason: 'Có task không thuộc dự án hoặc là subtask',
      });
    await this.prisma.task.updateMany({
      where: { id: { in: dto.taskIds } },
      data: { sprintId, version: { increment: 1 } },
    });
    await this.prisma.task.updateMany({
      where: { parentId: { in: dto.taskIds } },
      data: { sprintId, version: { increment: 1 } },
    });
    this.emit(SPRINT_EVENTS.updated, {
      projectId: s.projectId,
      sprintId,
      actorId: userId,
      movedTaskIds: dto.taskIds,
      afterStart: s.status === SprintStatus.ACTIVE,
      at: new Date(),
    });
    return this.prisma.task.findMany({
      where: { id: { in: dto.taskIds } },
      select: {
        id: true,
        number: true,
        title: true,
        sprintId: true,
        version: true,
      },
    });
  }

  private async load(sprintId: string) {
    const s = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: SPRINT_SELECT,
    });
    if (!s) throw AppError.notFound({ sprintId });
    return s;
  }

  private assertDates(start: string, end: string): void {
    if (start > end)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['endDate phải sau startDate'],
      });
  }

  private emit(name: string, payload: SprintEventPayload): void {
    this.events.emit(name, payload);
  }
}

function num(d: Prisma.Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}
