import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { ProjectAccessService } from '../common/access/project-access.service';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import { remainingOf } from '../workload/domain/allocation';
import {
  addDays,
  isoDate,
  toDate,
  workdaysBetween,
} from '../workload/domain/calendar';
import { mergeSettings } from '../workspaces/workspace-settings';
import {
  dailyCompleted,
  etaOf,
  idealLine,
  riskOf,
  scopeCreepDays,
  snapshotGaps,
  velocityOf,
  type RiskLevel,
  type Snapshot,
} from './domain/burndown';

export const FORECAST_EVENTS = {
  riskChanged: 'forecast.risk.changed',
} as const;

export interface ForecastCause {
  code:
    | 'OVERDUE'
    | 'UNASSIGNED'
    | 'OVERLOADED_MEMBER'
    | 'BLOCKED'
    | 'BIG_NOT_STARTED'
    | 'SCOPE_CREEP';
  count: number;
  taskIds?: string[];
  userIds?: string[];
}

/** Burn-down và dự báo — số do backend tính (docs 04 §8); AI chỉ diễn giải (Phase 7). */
@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);
  private readonly lastRisk = new Map<string, RiskLevel>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Snapshot một sprint tại ngày `date` (idempotent theo ngày). Nhận `db` là transaction để lúc đóng
   * sprint chụp được số cuối TRƯỚC khi việc dở bị chuyển đi.
   */
  async snapshotSprint(
    sprintId: string,
    date = new Date(),
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Snapshot> {
    const d = toDate(date);
    const tasks = await db.task.findMany({
      where: { sprintId, deletedAt: null, parentId: null },
      select: {
        estimateHours: true,
        remainingHours: true,
        progress: true,
        completedAt: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
      },
    });
    const scope = tasks.reduce(
      (s, t) => s + (t.estimateHours ? Number(t.estimateHours) : 0),
      0,
    );
    const remaining = tasks.reduce(
      (s, t) =>
        s +
        remainingOf({
          ...t,
          estimateHours:
            t.estimateHours === null ? null : Number(t.estimateHours),
          remainingHours:
            t.remainingHours === null ? null : Number(t.remainingHours),
          id: '',
        }),
      0,
    );
    const completedToday = tasks
      .filter(
        (t) => t.completedAt && toDate(t.completedAt).getTime() === d.getTime(),
      )
      .reduce((s, t) => s + (t.estimateHours ? Number(t.estimateHours) : 0), 0);
    const row = await db.burndownSnapshot.upsert({
      where: { sprintId_date: { sprintId, date: d } },
      create: {
        sprintId,
        date: d,
        scopeHours: scope,
        remainingHours: remaining,
        completedHours: completedToday,
      },
      update: {
        scopeHours: scope,
        remainingHours: remaining,
        completedHours: completedToday,
      },
    });
    return {
      date: row.date,
      scopeHours: Number(row.scopeHours),
      remainingHours: Number(row.remainingHours),
      completedHours: Number(row.completedHours),
    };
  }

  async burndown(userId: string, sprintId: string) {
    const sprint = await this.loadSprint(userId, sprintId);
    const cal = await this.calendarOf(sprint.project.workspaceId);
    const stored = (
      await this.prisma.burndownSnapshot.findMany({
        where: { sprintId },
        orderBy: { date: 'asc' },
      })
    ).map(toSnap);
    const live =
      sprint.status === 'ACTIVE' ? await this.liveSnapshot(sprintId) : null;
    const snapshots = mergeLive(stored, live);
    const scope0 = sprint.scopeHoursInitial
      ? Number(sprint.scopeHoursInitial)
      : (snapshots[0]?.scopeHours ?? 0);
    const span = this.spanOf(sprint);
    return {
      sprintId,
      status: sprint.status,
      startDate: isoDate(toDate(sprint.startDate)),
      endDate: isoDate(toDate(sprint.endDate)),
      scopeInitial: scope0,
      ideal: idealLine(scope0, sprint.startDate, sprint.endDate, cal),
      actual: snapshots.map((s) => ({
        date: isoDate(s.date),
        scope: s.scopeHours,
        remaining: s.remainingHours,
        completed: s.completedHours,
      })),
      velocity: await this.velocity(sprintId, span, cal),
      scopeCreepDays: scopeCreepDays(snapshots, scope0),
      /** Ngày làm việc không có snapshot (cron không chạy, sprint đóng trước khi có bản chụp…) */
      gaps: span ? snapshotGaps(snapshots, span.from, span.to, cal) : [],
    };
  }

  async forecast(userId: string, sprintId: string) {
    const sprint = await this.loadSprint(userId, sprintId);
    const cal = await this.calendarOf(sprint.project.workspaceId);
    const today = toDate(new Date());
    const stored = (
      await this.prisma.burndownSnapshot.findMany({
        where: { sprintId },
        orderBy: { date: 'asc' },
      })
    ).map(toSnap);
    const snapshots = mergeLive(
      stored,
      sprint.status === 'ACTIVE' ? await this.liveSnapshot(sprintId) : null,
    );
    const last = snapshots[snapshots.length - 1];
    const remaining = last?.remainingHours ?? 0;
    const velocity = await this.velocity(sprintId, this.spanOf(sprint), cal);
    const closed = sprint.status === 'CLOSED';
    // Sprint đã đóng không còn gì để dự báo: không ETA, không mức rủi ro — số cuối nằm ở `final`
    const eta = closed ? null : etaOf(remaining, velocity, today, cal);
    const age = sprint.startedAt
      ? workdaysBetween(
          sprint.startedAt,
          closed && sprint.closedAt ? sprint.closedAt : today,
          cal,
        )
      : 0;
    const riskLevel: RiskLevel =
      sprint.status === 'ACTIVE'
        ? riskOf(eta, sprint.endDate, velocity, age)
        : 'UNKNOWN';
    const causes = await this.causes(
      sprint.projectId,
      sprintId,
      sprint.project.workspaceId,
      today,
      snapshots,
      sprint.scopeHoursInitial ? Number(sprint.scopeHoursInitial) : 0,
    );
    const prev = this.lastRisk.get(sprintId);
    if (prev && prev !== riskLevel && rank(riskLevel) > rank(prev)) {
      this.events.emit(FORECAST_EVENTS.riskChanged, {
        sprintId,
        projectId: sprint.projectId,
        from: prev,
        to: riskLevel,
        at: new Date(),
      });
    }
    this.lastRisk.set(sprintId, riskLevel);
    return {
      sprintId,
      status: sprint.status,
      endDate: isoDate(toDate(sprint.endDate)),
      remainingHours: Math.round(remaining * 100) / 100,
      velocity,
      eta: eta ? isoDate(eta) : null,
      riskLevel,
      sprintAgeWorkdays: age,
      causes: closed ? [] : causes,
      /** Sprint đã đóng: số lúc đóng (snapshot chụp trong transaction đóng); null nếu đóng trước khi có bản chụp này */
      final:
        closed && last
          ? {
              date: isoDate(last.date),
              scopeHours: last.scopeHours,
              remainingHours: last.remainingHours,
              closedAt: sprint.closedAt?.toISOString() ?? null,
            }
          : null,
    };
  }

  /** Nguyên nhân đo được (docs 04 §8) — danh sách này là đầu vào cho RISK_EXPLANATION của AI. */
  private async causes(
    projectId: string,
    sprintId: string,
    workspaceId: string,
    today: Date,
    snapshots: Snapshot[],
    scope0: number,
  ): Promise<ForecastCause[]> {
    const open = {
      sprintId,
      deletedAt: null,
      completedAt: null,
      parentId: null,
    } as const;
    const [overdue, unassigned, big, blocked] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...open, dueDate: { lt: today } },
        select: { id: true },
      }),
      this.prisma.task.findMany({
        where: { ...open, assignees: { none: {} } },
        select: { id: true },
      }),
      this.prisma.task.findMany({
        where: { ...open, startedAt: null, estimateHours: { gt: 16 } },
        select: { id: true },
      }),
      this.prisma.task.findMany({
        where: {
          ...open,
          dependsOn: {
            some: { dependsOn: { completedAt: null, deletedAt: null } },
          },
        },
        select: { id: true },
      }),
    ]);
    const weekStart = addDays(today, -((today.getUTCDay() + 6) % 7));
    const overloaded = await this.prisma.workloadSnapshot.findMany({
      where: {
        workspaceId,
        weekStart,
        level: 'OVERLOAD',
        user: { projectMembers: { some: { projectId } } },
      },
      select: { userId: true },
    });
    const creep = scopeCreepDays(snapshots, scope0);
    const out: ForecastCause[] = [];
    if (overdue.length)
      out.push({
        code: 'OVERDUE',
        count: overdue.length,
        taskIds: overdue.map((t) => t.id),
      });
    if (unassigned.length)
      out.push({
        code: 'UNASSIGNED',
        count: unassigned.length,
        taskIds: unassigned.map((t) => t.id),
      });
    if (overloaded.length)
      out.push({
        code: 'OVERLOADED_MEMBER',
        count: overloaded.length,
        userIds: overloaded.map((u) => u.userId),
      });
    if (blocked.length)
      out.push({
        code: 'BLOCKED',
        count: blocked.length,
        taskIds: blocked.map((t) => t.id),
      });
    if (big.length)
      out.push({
        code: 'BIG_NOT_STARTED',
        count: big.length,
        taskIds: big.map((t) => t.id),
      });
    if (creep.length) out.push({ code: 'SCOPE_CREEP', count: creep.length });
    return out;
  }

  /** 00:05 hằng ngày: snapshot mọi sprint ACTIVE cho ngày hôm qua (chốt số cuối ngày). */
  @Cron('5 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async nightly(): Promise<void> {
    const sprints = await this.prisma.sprint.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    const yesterday = addDays(toDate(new Date()), -1);
    for (const s of sprints)
      await this.snapshotSprint(s.id, yesterday).catch((e) =>
        this.logger.warn(
          `snapshot ${s.id}: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  }

  private async liveSnapshot(sprintId: string): Promise<Snapshot> {
    const tasks = await this.prisma.task.findMany({
      where: { sprintId, deletedAt: null, parentId: null },
      select: {
        estimateHours: true,
        remainingHours: true,
        progress: true,
        completedAt: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
      },
    });
    const today = toDate(new Date());
    return {
      date: today,
      scopeHours: tasks.reduce(
        (s, t) => s + (t.estimateHours ? Number(t.estimateHours) : 0),
        0,
      ),
      remainingHours: tasks.reduce(
        (s, t) =>
          s +
          remainingOf({
            ...t,
            id: '',
            estimateHours:
              t.estimateHours === null ? null : Number(t.estimateHours),
            remainingHours:
              t.remainingHours === null ? null : Number(t.remainingHours),
          }),
        0,
      ),
      completedHours: tasks
        .filter(
          (t) =>
            t.completedAt &&
            toDate(t.completedAt).getTime() === today.getTime(),
        )
        .reduce(
          (s, t) => s + (t.estimateHours ? Number(t.estimateHours) : 0),
          0,
        ),
    };
  }

  /** Khoảng tính vận tốc: từ lúc bắt đầu tới hôm nay (đang chạy) hoặc tới lúc đóng. */
  private spanOf(sprint: {
    status: string;
    startDate: Date;
    startedAt: Date | null;
    closedAt: Date | null;
  }): { from: Date; to: Date } | null {
    if (sprint.status === 'PLANNED') return null;
    const from = toDate(sprint.startedAt ?? sprint.startDate);
    const to = toDate(
      sprint.status === 'CLOSED' && sprint.closedAt
        ? sprint.closedAt
        : new Date(),
    );
    return to.getTime() < from.getTime() ? null : { from, to };
  }

  /** Vận tốc (docs 04 §8) suy từ `completedAt` của việc gốc trong sprint — không phụ thuộc cron snapshot. */
  private async velocity(
    sprintId: string,
    span: { from: Date; to: Date } | null,
    cal: { workdays: number[]; holidays: string[] },
  ): Promise<number> {
    if (!span) return 0;
    const done = await this.prisma.task.findMany({
      where: {
        sprintId,
        deletedAt: null,
        parentId: null,
        completedAt: { gte: span.from, lt: addDays(span.to, 1) },
      },
      select: { estimateHours: true, completedAt: true },
    });
    return velocityOf(
      dailyCompleted(
        done.map((t) => ({
          estimateHours:
            t.estimateHours === null ? null : Number(t.estimateHours),
          completedAt: t.completedAt,
        })),
        span.from,
        span.to,
      ),
      cal,
    );
  }

  private async loadSprint(userId: string, sprintId: string) {
    const s = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        projectId: true,
        status: true,
        startDate: true,
        endDate: true,
        startedAt: true,
        closedAt: true,
        scopeHoursInitial: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!s) throw AppError.notFound({ sprintId });
    await this.access.assertRead(userId, s.projectId);
    return s;
  }

  private async calendarOf(workspaceId: string) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const settings = mergeSettings(ws.settings, {});
    return { workdays: settings.workdays, holidays: settings.holidays };
  }
}

function toSnap(r: {
  date: Date;
  scopeHours: Prisma.Decimal;
  remainingHours: Prisma.Decimal;
  completedHours: Prisma.Decimal;
}): Snapshot {
  return {
    date: r.date,
    scopeHours: Number(r.scopeHours),
    remainingHours: Number(r.remainingHours),
    completedHours: Number(r.completedHours),
  };
}

function mergeLive(stored: Snapshot[], live: Snapshot | null): Snapshot[] {
  if (!live) return stored;
  const without = stored.filter(
    (s) => toDate(s.date).getTime() !== toDate(live.date).getTime(),
  );
  return [...without, live].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function rank(r: RiskLevel): number {
  return { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }[r];
}
