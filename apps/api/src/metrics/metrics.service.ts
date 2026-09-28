import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { earBayes } from '../workload/domain/factors';
import {
  addDays,
  toDate,
  weekStartOf,
  workdaysBetween,
  type WorkCalendar,
} from '../workload/domain/calendar';
import { PrismaService } from '../prisma/prisma.service';
import { reopenCounts } from './skill-evidence.service';

export interface UserMetrics {
  windowWeeks: number;
  sampleSize: number;
  ear: number;
  earByCategory: Record<string, { ear: number; sampleSize: number }>;
  ear4w: number | null;
  ear8w: number | null;
  velocityHours: number;
  onTimeRate: number | null;
  avgRating: number | null;
  medianCycleDays: number | null;
  reopenCount: number;
  overdueOpen: number;
  openTasks: number;
}

/** Cycle time → giờ thực tế khi không có worklog: ngày làm việc × giờ/ngày × hệ số tập trung (mặc định 0.6). */
const CYCLE_FOCUS = 0.6;

/**
 * Chỉ số lịch sử cá nhân (docs 04 §2). Tính trực tiếp từ task DONE + time_entries + task_reviews;
 * cron chủ nhật vật chất hoá vào user_metrics_weekly để vẽ xu hướng.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(
    userId: string,
    workspaceId: string,
    cal: WorkCalendar,
    hoursPerDay: number,
    k = 20,
    windowWeeks = 8,
    now = new Date(),
  ): Promise<UserMetrics> {
    const since = addDays(toDate(now), -7 * windowWeeks);
    const since4 = addDays(toDate(now), -28);
    const done = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        completedAt: { gte: since },
        assignees: { some: { userId } },
        project: { workspaceId },
      },
      select: {
        id: true,
        estimateHours: true,
        dueDate: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        skills: { select: { skill: { select: { category: true } } }, take: 1 },
        timeEntries: { where: { userId }, select: { hours: true } },
        review: { select: { rating: true, actualHoursConfirmed: true } },
      },
    });
    const rows = done.map((t) => {
      const est = t.estimateHours ? Number(t.estimateHours) : null;
      const logged = t.timeEntries.reduce((s, e) => s + Number(e.hours), 0);
      const confirmed = t.review?.actualHoursConfirmed
        ? Number(t.review.actualHoursConfirmed)
        : null;
      const cycleDays =
        t.startedAt && t.completedAt
          ? Math.max(1, workdaysBetween(t.startedAt, t.completedAt, cal))
          : null;
      const actual =
        confirmed ??
        (logged > 0
          ? logged
          : cycleDays !== null
            ? Math.min(cycleDays * hoursPerDay * CYCLE_FOCUS, (est ?? 40) * 4)
            : null);
      return {
        est,
        actual,
        category: t.skills[0]?.skill.category ?? '*',
        onTime: t.dueDate
          ? t.completedAt! <= addDays(toDate(t.dueDate), 1)
          : null,
        rating: t.review?.rating ?? null,
        cycleDays,
        completedAt: t.completedAt!,
        source:
          confirmed !== null ? 'review' : logged > 0 ? 'worklog' : 'cycle',
      };
    });
    const withActual = rows.filter((r) => r.est !== null && r.actual !== null);
    const sum = (xs: typeof withActual) => ({
      a: xs.reduce((s, r) => s + (r.actual ?? 0), 0),
      e: xs.reduce((s, r) => s + (r.est ?? 0), 0),
    });
    const all = sum(withActual);
    const byCat: Record<string, { ear: number; sampleSize: number }> = {};
    for (const cat of new Set(withActual.map((r) => r.category))) {
      const xs = withActual.filter((r) => r.category === cat);
      if (xs.length >= 5) {
        const s = sum(xs);
        byCat[cat] = {
          ear: round3(earBayes(s.a, s.e, k)),
          sampleSize: xs.length,
        };
      }
    }
    const recent = sum(withActual.filter((r) => r.completedAt >= since4));
    const onTimeRows = rows.filter((r) => r.onTime !== null);
    const ratings = rows
      .filter((r) => r.rating !== null)
      .map((r) => r.rating as number);
    const cycles = rows
      .filter((r) => r.cycleDays !== null)
      .map((r) => r.cycleDays as number)
      .sort((a, b) => a - b);
    const [reopens, overdueOpen, openTasks] = await Promise.all([
      // Đếm trong JS: diff.completedAt.to là JSON null — lọc `equals: 'null'` (chuỗi) cũ luôn ra 0
      this.prisma.activityLog
        .findMany({
          where: {
            action: 'task.moved',
            createdAt: { gte: since },
            task: { assignees: { some: { userId } } },
          },
          select: { taskId: true, diff: true },
        })
        .then((logs) =>
          [...reopenCounts(logs).values()].reduce((s, n) => s + n, 0),
        )
        .catch(() => 0),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          completedAt: null,
          dueDate: { lt: toDate(now) },
          assignees: { some: { userId } },
          project: { workspaceId },
        },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          completedAt: null,
          assignees: { some: { userId } },
          project: { workspaceId },
        },
      }),
    ]);
    const velocity =
      rows
        .filter((r) => r.completedAt >= since4)
        .reduce((s, r) => s + (r.est ?? 0), 0) / 4;
    return {
      windowWeeks,
      sampleSize: withActual.length,
      ear: round3(earBayes(all.a, all.e, k)),
      earByCategory: byCat,
      ear4w: withActual.filter((r) => r.completedAt >= since4).length
        ? round3(earBayes(recent.a, recent.e, k))
        : null,
      ear8w: withActual.length ? round3(earBayes(all.a, all.e, k)) : null,
      velocityHours: Math.round(velocity * 100) / 100,
      onTimeRate: onTimeRows.length
        ? round3(onTimeRows.filter((r) => r.onTime).length / onTimeRows.length)
        : null,
      avgRating: ratings.length
        ? round3(ratings.reduce((s, x) => s + x, 0) / ratings.length)
        : null,
      medianCycleDays: cycles.length
        ? cycles[Math.floor(cycles.length / 2)]
        : null,
      reopenCount: reopens,
      overdueOpen,
      openTasks,
    };
  }

  /** Số tuần liên tiếp (tính đến tuần trước) có mức sử dụng > 0.9, từ snapshot. */
  async consecutiveHighWeeks(
    userId: string,
    workspaceId: string,
    currentWeekStart: Date,
    threshold = 0.9,
  ): Promise<number> {
    const rows = await this.prisma.workloadSnapshot.findMany({
      where: { userId, workspaceId, weekStart: { lt: currentWeekStart } },
      orderBy: { weekStart: 'desc' },
      take: 8,
      select: { weekStart: true, utilization: true },
    });
    let n = 0;
    let expect = addDays(currentWeekStart, -7).getTime();
    for (const r of rows) {
      if (
        toDate(r.weekStart).getTime() !== expect ||
        Number(r.utilization) <= threshold
      )
        break;
      n += 1;
      expect -= 7 * 86_400_000;
    }
    return n;
  }

  /** Chủ nhật 23:30: vật chất hoá chỉ số tuần cho mọi thành viên (trừ VIEWER) của workspace đang hoạt động. */
  @Cron('30 23 * * 0', { timeZone: 'Asia/Ho_Chi_Minh' })
  async materializeWeekly(): Promise<void> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { role: { not: 'VIEWER' }, workspace: { archivedAt: null } },
      select: {
        userId: true,
        workspaceId: true,
        workspace: { select: { settings: true } },
      },
    });
    const weekStart = weekStartOf(new Date());
    for (const m of members) {
      const settings = m.workspace.settings as {
        workdays?: number[];
        holidays?: string[];
        defaultCapacityHours?: number;
        workload?: { ear?: { smoothingHours?: number } };
      };
      const cal = {
        workdays: settings.workdays ?? [1, 2, 3, 4, 5],
        holidays: settings.holidays ?? [],
      };
      const metrics = await this.compute(
        m.userId,
        m.workspaceId,
        cal,
        (settings.defaultCapacityHours ?? 40) / cal.workdays.length,
        settings.workload?.ear?.smoothingHours ?? 20,
      );
      const rows = [
        { category: '*', ear: metrics.ear, sampleSize: metrics.sampleSize },
        ...Object.entries(metrics.earByCategory).map(([category, v]) => ({
          category,
          ...v,
        })),
      ];
      for (const r of rows) {
        await this.prisma.userMetricsWeekly.upsert({
          where: {
            userId_workspaceId_weekStart_skillCategory: {
              userId: m.userId,
              workspaceId: m.workspaceId,
              weekStart,
              skillCategory: r.category,
            },
          },
          create: {
            userId: m.userId,
            workspaceId: m.workspaceId,
            weekStart,
            skillCategory: r.category,
            ear: r.ear,
            velocityHours: metrics.velocityHours,
            onTimeRate: metrics.onTimeRate,
            avgRating: metrics.avgRating,
            medianCycleDays: metrics.medianCycleDays,
            reopenCount: metrics.reopenCount,
            sampleSize: r.sampleSize,
          },
          update: {
            ear: r.ear,
            velocityHours: metrics.velocityHours,
            onTimeRate: metrics.onTimeRate,
            avgRating: metrics.avgRating,
            medianCycleDays: metrics.medianCycleDays,
            reopenCount: metrics.reopenCount,
            sampleSize: r.sampleSize,
            computedAt: new Date(),
          },
        });
      }
    }
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
