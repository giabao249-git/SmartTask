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
import { remainingOf } from '../workload/domain/allocation';
import { toDate } from '../workload/domain/calendar';
import { WorkloadService } from '../workload/workload.service';
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
    private readonly workload: WorkloadService,
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
    // Việc đã xong ở lại sprint khi đóng (chỉ việc dở bị chuyển) → Σ ước lượng = giờ HOÀN THÀNH của sprint
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
      _sum: { estimateHours: true },
    });
    return rows.map((s) => {
      const h = hours.find((x) => x.sprintId === s.id);
      return {
        ...s,
        taskCount: s._count.tasks,
        doneCount: done.find((x) => x.sprintId === s.id)?._count._all ?? 0,
        completedHours: num(
          done.find((x) => x.sprintId === s.id)?._sum.estimateHours,
        ),
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
  async close(
    userId: string,
    sprintId: string,
    dto: CloseSprintDto,
    idempotencyKey?: string,
  ) {
    const s = await this.load(sprintId);
    await this.access.assertManage(userId, s.projectId);
    if (s.status === SprintStatus.CLOSED && idempotencyKey) {
      // Lần bấm lặp với cùng khoá: trả đúng kết quả lần đầu (nhật ký sprint.closed giữ khoá + việc đã chuyển)
      const logs = await this.prisma.activityLog.findMany({
        where: { projectId: s.projectId, action: 'sprint.closed' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { diff: true },
      });
      const hit = logs
        .map(
          (l) =>
            (l.diff ?? {}) as {
              sprintId?: string;
              idempotencyKey?: string;
              movedTaskIds?: string[];
              movedTo?: string | null;
            },
        )
        .find(
          (d) => d.sprintId === sprintId && d.idempotencyKey === idempotencyKey,
        );
      if (hit)
        return {
          ...s,
          movedTaskIds: hit.movedTaskIds ?? [],
          movedTo: hit.movedTo ?? 'backlog',
        };
    }
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
      movedTo: targetSprintId,
      idempotencyKey,
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

  /**
   * Tóm tắt một sprint — nguồn chung cho khung lập kế hoạch, hộp thoại bắt đầu/kết thúc, báo cáo sprint
   * và tra cứu của Trợ lý (docs 02/07 C1). Chỉ số backend tính; không xếp hạng, không gợi ý.
   */
  async summary(userId: string, sprintId: string) {
    const s = await this.load(sprintId);
    const acc = await this.access.assertRead(userId, s.projectId);
    const today = toDate(new Date());
    const [tasks, members, logs] = await Promise.all([
      this.prisma.task.findMany({
        where: { sprintId, deletedAt: null, parentId: null },
        orderBy: { number: 'asc' },
        select: TASK_BRIEF,
      }),
      // Người chỉ xem (VIEWER của workspace) không nhận việc → không tính vào năng lực nhóm
      this.prisma.projectMember.findMany({
        where: {
          projectId: s.projectId,
          user: {
            workspaceMembers: {
              some: { workspaceId: acc.workspaceId, role: { not: 'VIEWER' } },
            },
          },
        },
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              shortName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.activityLog.findMany({
        where: {
          projectId: s.projectId,
          action: { in: ['sprint.closed', 'sprint.tasks_added'] },
        },
        orderBy: { createdAt: 'asc' },
        select: { action: true, diff: true, createdAt: true },
      }),
    ]);
    const brief = (t: (typeof tasks)[number]) => ({
      id: t.id,
      key: `${t.project.key}-${t.number}`,
      number: t.number,
      title: t.title,
      estimateHours: num(t.estimateHours),
      remainingHours: round2(hoursLeft(t)),
      completedAt: t.completedAt,
      assigneeIds: t.assignees.map((a) => a.userId),
    });
    const done = tasks.filter((t) => t.completedAt);
    const open = tasks.filter((t) => !t.completedAt);
    const scopeHours = tasks.reduce((x, t) => x + num(t.estimateHours), 0);
    // Cửa sổ năng lực: sprint chưa đóng tính từ hôm nay (hoặc ngày bắt đầu nếu chưa tới) tới ngày kết thúc
    const start = toDate(s.startDate);
    const end = toDate(s.endDate);
    const from =
      s.status === SprintStatus.CLOSED ? start : start > today ? start : today;
    const cap = await this.workload.rangeCapacity(
      acc.workspaceId,
      members.map((m) => m.user.id),
      from,
      end,
    );
    // Việc có n người thực hiện: mỗi người nhận 1/n giờ còn lại (cùng cách chia với tính tải, docs 04 §1)
    const byUser = new Map<string, { tasks: number; hours: number }>();
    let unassignedTasks = 0;
    let unassignedHours = 0;
    for (const t of open) {
      const h = hoursLeft(t);
      if (!t.assignees.length) {
        unassignedTasks += 1;
        unassignedHours += h;
        continue;
      }
      for (const a of t.assignees) {
        const cur = byUser.get(a.userId) ?? { tasks: 0, hours: 0 };
        cur.tasks += 1;
        cur.hours += h / t.assignees.length;
        byUser.set(a.userId, cur);
      }
    }
    // Nhật ký: việc bị đẩy đi lúc đóng, việc được chuyển vào từ sprint khác, việc thêm sau khi bắt đầu
    const diffs = logs.map((l) => ({
      action: l.action,
      d: (l.diff ?? {}) as {
        sprintId?: string;
        movedTaskIds?: string[];
        movedTo?: string | null;
        taskIds?: string[];
        afterStart?: boolean;
      },
    }));
    const carriedOutIds = diffs
      .filter((x) => x.action === 'sprint.closed' && x.d.sprintId === sprintId)
      .flatMap((x) => x.d.movedTaskIds ?? []);
    const carriedInIds = diffs
      .filter((x) => x.action === 'sprint.closed' && x.d.movedTo === sprintId)
      .flatMap((x) => x.d.movedTaskIds ?? []);
    const addedIds = new Set([
      ...diffs
        .filter(
          (x) =>
            x.action === 'sprint.tasks_added' &&
            x.d.sprintId === sprintId &&
            x.d.afterStart,
        )
        .flatMap((x) => x.d.taskIds ?? []),
      // Việc tạo thẳng vào sprint sau khi đã bắt đầu cũng là phạm vi tăng giữa chừng
      ...(s.startedAt
        ? tasks.filter((t) => t.createdAt > s.startedAt!).map((t) => t.id)
        : []),
    ]);
    const others = await this.prisma.task.findMany({
      where: {
        id: {
          in: [...new Set([...carriedOutIds, ...carriedInIds, ...addedIds])],
        },
        deletedAt: null,
        parentId: null,
      },
      select: TASK_BRIEF,
    });
    const pick = (ids: Iterable<string>) => {
      const set = new Set(ids);
      return others.filter((t) => set.has(t.id)).map(brief);
    };
    const capacityHours = [...cap.values()].reduce((x, h) => x + h, 0);
    // Vận tốc tham chiếu (Jira Velocity chart; Linear lấy 3 cycle): 3 sprint ĐÃ ĐÓNG gần nhất, cam kết lúc bắt
    // đầu so với giờ hoàn thành. Chỉ là số để người lập kế hoạch nhìn — không dùng để gợi ý hay chặn.
    const history = (await this.list(userId, s.projectId))
      .filter((x) => x.status === SprintStatus.CLOSED && x.id !== sprintId)
      .sort(
        (a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0),
      )
      .slice(0, 3)
      .map((x) => ({
        id: x.id,
        name: x.name,
        committedHours: round2(num(x.scopeHoursInitial)),
        completedHours: round2(x.completedHours),
      }));
    return {
      sprint: {
        id: s.id,
        name: s.name,
        goal: s.goal,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        startedAt: s.startedAt,
        closedAt: s.closedAt,
      },
      window: {
        from: from.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      taskCount: tasks.length,
      doneCount: done.length,
      /** Cam kết: chưa bắt đầu = tổng ước lượng hiện tại; đã bắt đầu = phạm vi chốt lúc bắt đầu */
      committedHours: round2(
        s.status === SprintStatus.PLANNED
          ? scopeHours
          : s.scopeHoursInitial
            ? num(s.scopeHoursInitial)
            : scopeHours,
      ),
      scopeHours: round2(scopeHours),
      completedHours: round2(
        done.reduce((x, t) => x + num(t.estimateHours), 0),
      ),
      remainingHours: round2(open.reduce((x, t) => x + hoursLeft(t), 0)),
      /** Năng lực hiệu dụng cả nhóm trong cửa sổ — chưa trừ việc ở dự án khác */
      capacityHours: round2(capacityHours),
      byAssignee: members
        .map((m) => ({
          userId: m.user.id,
          fullName: m.user.fullName,
          shortName: m.user.shortName,
          avatarUrl: m.user.avatarUrl,
          tasks: byUser.get(m.user.id)?.tasks ?? 0,
          remainingHours: round2(byUser.get(m.user.id)?.hours ?? 0),
          capacityHours: cap.get(m.user.id) ?? 0,
        }))
        // Xếp theo giờ còn lại chỉ để đọc cho dễ — không phải thứ hạng
        .sort((x, y) => y.remainingHours - x.remainingHours),
      unassigned: { tasks: unassignedTasks, hours: round2(unassignedHours) },
      velocity: {
        sprints: history,
        avgCompletedHours: history.length
          ? round2(
              history.reduce((x, h) => x + h.completedHours, 0) /
                history.length,
            )
          : null,
      },
      completed: done.map(brief),
      open: open.map(brief),
      carriedOut: pick(carriedOutIds),
      carriedIn: pick(carriedInIds),
      addedAfterStart: pick(addedIds),
    };
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

const round2 = (n: number) => Math.round(n * 100) / 100;

const TASK_BRIEF = {
  id: true,
  number: true,
  title: true,
  estimateHours: true,
  remainingHours: true,
  progress: true,
  completedAt: true,
  createdAt: true,
  startDate: true,
  dueDate: true,
  project: { select: { key: true } },
  assignees: { select: { userId: true } },
} as const;

/** Giờ còn lại — cùng công thức với burn-down/forecast (docs 04 §1). */
function hoursLeft(t: {
  id: string;
  estimateHours: Prisma.Decimal | null;
  remainingHours: Prisma.Decimal | null;
  progress: number;
  completedAt: Date | null;
  createdAt: Date;
  startDate: Date | null;
  dueDate: Date | null;
}): number {
  return remainingOf({
    ...t,
    estimateHours: t.estimateHours === null ? null : Number(t.estimateHours),
    remainingHours: t.remainingHours === null ? null : Number(t.remainingHours),
  });
}
