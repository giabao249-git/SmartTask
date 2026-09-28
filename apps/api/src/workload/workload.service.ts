import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AlertKind, WorkloadLevel } from '@prisma/client';
import { MetricsService } from '../metrics/metrics.service';
import {
  demonstrated,
  evidenceText,
  isConclusive,
  passedOf,
  weightOf,
} from '../metrics/domain/skill-evidence';
import { SkillEvidenceService } from '../metrics/skill-evidence.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mergeSettings,
  type WorkspaceSettings,
} from '../workspaces/workspace-settings';
import {
  remainingOf,
  shareInDay,
  shareInWeek,
  type AllocTask,
} from './domain/allocation';
import {
  addDays,
  daysBetween,
  isWorkday,
  isoDate,
  toDate,
  weekStartOf,
  weeksFrom,
} from './domain/calendar';
import {
  busyHoursOnDay,
  capacityInRange,
  focusBlocksOnDay,
  freeHoursOnDay,
  hoursPerDay,
  round2,
  weekCapacity,
  type BusyEvent,
  type TimeOff,
} from './domain/capacity';
import { burnoutScore } from './domain/burnout';
import {
  difficultyFactor,
  hoursEff,
  skillGapFactor,
  switchPenalty,
} from './domain/factors';
import { skillMatch } from './domain/skill-match';
import { levelOf, spreadOf, utilizationOf } from './domain/utilization';
import type {
  DayFree,
  TaskContribution,
  UserWorkload,
  WeekLoad,
} from './workload.types';

export const WORKLOAD_EVENTS = {
  updated: 'workload.updated',
  alert: 'workload.alert',
} as const;

export interface WorkloadAlertPayload {
  workspaceId: string;
  userId: string;
  weekStart: string;
  kind: AlertKind;
  utilization: number;
  riskScore: number;
  alertId: string;
  projectIds: string[];
  at: Date;
}

/**
 * "Backend chỉ tính": mọi số ở đây là công thức docs 04 — không chọn người, không xếp hạng.
 * Đầu ra dùng cho giao diện, cho LLM (bảng sự thật) và cho Validator.
 */
@Injectable()
export class WorkloadService {
  private readonly logger = new Logger(WorkloadService.name);
  private pending = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly events: EventEmitter2,
    private readonly evidence: SkillEvidenceService,
  ) {}

  /** Tải theo tuần cho một tập người trong workspace (mọi dự án của họ trong workspace). */
  async computeUsers(
    workspaceId: string,
    userIds: string[],
    from: Date,
    weeks: number,
    opts: { projectId?: string; today?: Date } = {},
  ): Promise<{
    users: UserWorkload[];
    settings: WorkspaceSettings;
    spread: number;
  }> {
    const today = toDate(opts.today ?? new Date());
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const settings = mergeSettings(ws.settings, {});
    const cal = { workdays: settings.workdays, holidays: settings.holidays };
    const weekStarts = weeksFrom(from, weeks);
    const rangeEnd = addDays(weekStarts[weekStarts.length - 1], 6);
    const perDay = hoursPerDay(settings.defaultCapacityHours, cal);

    const [users, tasks, skills, events, offs] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          fullName: true,
          shortName: true,
          avatarUrl: true,
          weeklyCapacityHours: true,
        },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          completedAt: null,
          project: {
            workspaceId,
            status: 'ACTIVE',
            ...(opts.projectId ? { id: opts.projectId } : {}),
          },
          assignees: { some: { userId: { in: userIds } } },
        },
        select: {
          id: true,
          number: true,
          title: true,
          projectId: true,
          estimateHours: true,
          remainingHours: true,
          progress: true,
          difficulty: true,
          startDate: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
          project: { select: { key: true } },
          sprint: { select: { endDate: true } },
          assignees: { select: { userId: true } },
          skills: {
            select: {
              skillId: true,
              minLevel: true,
              skill: { select: { category: true } },
            },
          },
        },
      }),
      // Mức kỹ năng để tính hệ số thiếu kỹ năng: TỪ BẰNG CHỨNG, không phải tự khai (docs 02/08)
      this.evidence.levels(workspaceId, userIds, today),
      this.prisma.calendarEvent.findMany({
        where: {
          userId: { in: userIds },
          isBusy: true,
          startAt: { lte: addDays(rangeEnd, 1) },
          endAt: { gte: weekStarts[0] },
        },
        select: { userId: true, startAt: true, endAt: true },
      }),
      this.prisma.userTimeOff.findMany({
        where: {
          userId: { in: userIds },
          fromDate: { lte: rangeEnd },
          toDate: { gte: weekStarts[0] },
        },
        select: {
          userId: true,
          fromDate: true,
          toDate: true,
          kind: true,
          hoursPerDay: true,
        },
      }),
    ]);
    const levelsOf = skills;
    const currentWeek = weekStartOf(today);
    const out: UserWorkload[] = [];
    for (const u of users) {
      const base = u.weeklyCapacityHours ?? settings.defaultCapacityHours;
      const myTasks = tasks.filter((t) =>
        t.assignees.some((a) => a.userId === u.id),
      );
      const projectsOpen = new Set(myTasks.map((t) => t.projectId)).size;
      const sp = switchPenalty(projectsOpen);
      const metrics = await this.metrics.compute(
        u.id,
        workspaceId,
        cal,
        perDay,
        settings.workload.ear.smoothingHours,
        settings.workload.ear.windowWeeks,
        today,
      );
      const consecutive = await this.metrics.consecutiveHighWeeks(
        u.id,
        workspaceId,
        currentWeek,
        settings.workload.thresholds.full,
      );
      const myEvents: BusyEvent[] = events.filter((e) => e.userId === u.id);
      const myOffs: TimeOff[] = offs
        .filter((o) => o.userId === u.id)
        .map((o) => ({
          ...o,
          hoursPerDay: o.hoursPerDay === null ? null : Number(o.hoursPerDay),
        }));
      const weeksOut: WeekLoad[] = [];
      for (const w of weekStarts) {
        const contributions: TaskContribution[] = [];
        let load = 0;
        let eff = 0;
        for (const t of myTasks) {
          const alloc: AllocTask = {
            ...t,
            estimateHours:
              t.estimateHours === null ? null : Number(t.estimateHours),
            remainingHours:
              t.remainingHours === null ? null : Number(t.remainingHours),
            sprintEndDate: t.sprint?.endDate ?? null,
          };
          const share = shareInWeek(alloc, w, today, cal);
          if (share <= 0) continue;
          const remaining = remainingOf(alloc);
          const cat = t.skills[0]?.skill.category ?? '*';
          const ear = metrics.earByCategory[cat]?.ear ?? metrics.ear;
          const gap = skillGapFactor(
            levelsOf.get(u.id) ?? new Map<string, number>(),
            t.skills.map((s) => ({ skillId: s.skillId, minLevel: s.minLevel })),
          );
          const hEff = hoursEff(remaining, ear, t.difficulty, gap) * share;
          load += remaining * share;
          eff += hEff;
          contributions.push({
            taskId: t.id,
            key: `${t.project.key}-${t.number}`,
            title: t.title,
            projectId: t.projectId,
            remainingHours: round2(remaining),
            share: round2(share),
            hoursInWeek: round2(remaining * share),
            hoursEff: round2(hEff),
            factors: {
              ear: round2(ear),
              difficulty: difficultyFactor(t.difficulty),
              skillGap: gap,
            },
            overdue: !!t.dueDate && toDate(t.dueDate) < today,
            dueDate: t.dueDate ? isoDate(toDate(t.dueDate)) : null,
          });
        }
        const effLoad = round2(eff * sp);
        const cap = weekCapacity(
          w,
          base,
          myEvents,
          myOffs,
          cal,
          settings.workHours,
          settings.adminOverhead,
        );
        const util = utilizationOf(effLoad, cap.effCapacityHours);
        const isCurrent = w.getTime() === currentWeek.getTime();
        const burn = burnoutScore(
          {
            utilization: util,
            consecutiveHighWeeks: isCurrent ? consecutive : 0,
            overdueTasks: metrics.overdueOpen,
            openTasks: metrics.openTasks,
            ear4w: metrics.ear4w,
            ear8w: metrics.ear8w,
            onTimeRate: metrics.onTimeRate,
            lowCheckinTwice: false,
          },
          settings.workload.burnout,
        );
        weeksOut.push({
          weekStart: isoDate(w),
          loadHours: round2(load),
          effLoadHours: effLoad,
          capacityHours: base,
          effCapacityHours: cap.effCapacityHours,
          meetingHours: cap.meetingHours,
          timeOffHours: cap.timeOffHours,
          utilization: Number.isFinite(util) ? round2(util) : 9.99,
          level: levelOf(util, settings.workload.thresholds),
          riskScore: isCurrent ? burn.score : 0,
          riskLabel: isCurrent ? burn.label : 'NORMAL',
          riskBreakdown: isCurrent ? burn.breakdown : {},
          switchPenalty: sp,
          projectsOpen,
          tasks: contributions.sort((a, b) => b.hoursEff - a.hoursEff),
        });
      }
      out.push({
        userId: u.id,
        fullName: u.fullName,
        shortName: u.shortName,
        avatarUrl: u.avatarUrl,
        weeks: weeksOut,
      });
    }
    const spread = spreadOf(out.map((u) => u.weeks[0]?.utilization ?? 0));
    return {
      users: out.sort(
        (a, b) =>
          (b.weeks[0]?.utilization ?? 0) - (a.weeks[0]?.utilization ?? 0),
      ),
      settings,
      spread,
    };
  }

  /** Lưu snapshot tuần hiện tại + 3 tuần tới, đánh giá cảnh báo; phát sự kiện. Gọi bởi cron 07:00, listener và POST recompute. */
  async snapshotWorkspace(
    workspaceId: string,
    userIds?: string[],
  ): Promise<{ users: number; alerts: number }> {
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        role: { not: 'VIEWER' },
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
      select: { userId: true },
    });
    if (!members.length) return { users: 0, alerts: 0 };
    const today = toDate(new Date());
    const { users } = await this.computeUsers(
      workspaceId,
      members.map((m) => m.userId),
      today,
      4,
      { today },
    );
    let alerts = 0;
    for (const u of users) {
      for (const w of u.weeks) {
        const weekStart = toDate(w.weekStart);
        const prev = await this.prisma.workloadSnapshot.findUnique({
          where: {
            workspaceId_userId_weekStart: {
              workspaceId,
              userId: u.userId,
              weekStart,
            },
          },
          select: { level: true, riskScore: true },
        });
        await this.prisma.workloadSnapshot.upsert({
          where: {
            workspaceId_userId_weekStart: {
              workspaceId,
              userId: u.userId,
              weekStart,
            },
          },
          create: {
            workspaceId,
            userId: u.userId,
            weekStart,
            loadHours: w.loadHours,
            effLoadHours: w.effLoadHours,
            capacityHours: w.capacityHours,
            effCapacityHours: w.effCapacityHours,
            utilization: w.utilization,
            level: w.level,
            riskScore: w.riskScore,
            riskBreakdown: w.riskBreakdown,
          },
          update: {
            loadHours: w.loadHours,
            effLoadHours: w.effLoadHours,
            capacityHours: w.capacityHours,
            effCapacityHours: w.effCapacityHours,
            utilization: w.utilization,
            level: w.level,
            riskScore: w.riskScore,
            riskBreakdown: w.riskBreakdown,
            computedAt: new Date(),
          },
        });
        if (!prev || prev.level !== w.level || prev.riskScore !== w.riskScore) {
          this.events.emit(WORKLOAD_EVENTS.updated, {
            workspaceId,
            userId: u.userId,
            weekStart: w.weekStart,
            utilization: w.utilization,
            level: w.level,
            riskScore: w.riskScore,
            projectIds: [...new Set(w.tasks.map((t) => t.projectId))],
            at: new Date(),
          });
        }
        if (weekStart.getTime() !== weekStartOf(today).getTime()) continue;
        if (w.level === WorkloadLevel.OVERLOAD)
          alerts += await this.raiseAlert(
            workspaceId,
            u.userId,
            weekStart,
            AlertKind.OVERLOAD,
            w,
          );
        if (w.riskLabel === 'BURNOUT_RISK')
          alerts += await this.raiseAlert(
            workspaceId,
            u.userId,
            weekStart,
            AlertKind.BURNOUT,
            w,
          );
      }
    }
    return { users: users.length, alerts };
  }

  /** Một cảnh báo mỗi (workspace, người, tuần, loại); thông báo lại sớm nhất sau 24 giờ (chống spam). */
  private async raiseAlert(
    workspaceId: string,
    userId: string,
    weekStart: Date,
    kind: AlertKind,
    w: WeekLoad,
  ): Promise<number> {
    const existing = await this.prisma.workloadAlert.findUnique({
      where: {
        workspaceId_userId_weekStart_kind: {
          workspaceId,
          userId,
          weekStart,
          kind,
        },
      },
    });
    const stale =
      !existing?.notifiedAt ||
      Date.now() - existing.notifiedAt.getTime() > 24 * 3_600_000;
    const alert = existing
      ? await this.prisma.workloadAlert.update({
          where: { id: existing.id },
          data: {
            riskScore: w.riskScore,
            ...(stale ? { notifiedAt: new Date() } : {}),
          },
        })
      : await this.prisma.workloadAlert.create({
          data: {
            workspaceId,
            userId,
            weekStart,
            kind,
            riskScore: w.riskScore,
            notifiedAt: new Date(),
          },
        });
    if (!stale && existing) return 0;
    this.events.emit(WORKLOAD_EVENTS.alert, {
      workspaceId,
      userId,
      weekStart: w.weekStart,
      kind,
      utilization: w.utilization,
      riskScore: w.riskScore,
      alertId: alert.id,
      projectIds: [...new Set(w.tasks.map((t) => t.projectId))],
      at: new Date(),
    } satisfies WorkloadAlertPayload);
    return 1;
  }

  /** Gộp nhiều sự kiện task liên tiếp thành một lần tính lại sau 500 ms. */
  scheduleRecompute(workspaceId: string, userIds: string[]): void {
    const key = `${workspaceId}:${[...userIds].sort().join(',')}`;
    const t = this.pending.get(key);
    if (t) clearTimeout(t);
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.snapshotWorkspace(workspaceId, userIds).catch((e) =>
          this.logger.warn(
            `Tính lại tải thất bại: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      }, 500),
    );
  }

  /** Giờ trống theo ngày (docs 04 §5) — đầu vào cho LLM/Validator. */
  /**
   * Năng lực hiệu dụng của từng người trong [from, to] (docs 04 §3) — dùng cho thanh "cam kết / năng lực"
   * khi lập kế hoạch sprint. Cùng dữ liệu họp/nghỉ/admin với màn Nhân sự; KHÔNG trừ việc đã nhận.
   */
  async rangeCapacity(
    workspaceId: string,
    userIds: string[],
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!userIds.length || to.getTime() < from.getTime()) return out;
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const settings = mergeSettings(ws.settings, {});
    const cal = { workdays: settings.workdays, holidays: settings.holidays };
    const [users, events, offs] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, weeklyCapacityHours: true },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          userId: { in: userIds },
          isBusy: true,
          startAt: { lte: addDays(to, 1) },
          endAt: { gte: from },
        },
        select: { userId: true, startAt: true, endAt: true },
      }),
      this.prisma.userTimeOff.findMany({
        where: {
          userId: { in: userIds },
          fromDate: { lte: to },
          toDate: { gte: from },
        },
        select: {
          userId: true,
          fromDate: true,
          toDate: true,
          kind: true,
          hoursPerDay: true,
        },
      }),
    ]);
    for (const u of users)
      out.set(
        u.id,
        capacityInRange(
          from,
          to,
          u.weeklyCapacityHours ?? settings.defaultCapacityHours,
          events.filter((e) => e.userId === u.id),
          offs
            .filter((o) => o.userId === u.id)
            .map((o) => ({
              ...o,
              hoursPerDay:
                o.hoursPerDay === null ? null : Number(o.hoursPerDay),
            })),
          cal,
          settings.workHours,
          settings.adminOverhead,
        ),
      );
    return out;
  }

  async freeByDay(
    workspaceId: string,
    userId: string,
    from: Date,
    days: number,
    today = new Date(),
  ): Promise<DayFree[]> {
    const td = toDate(today);
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const settings = mergeSettings(ws.settings, {});
    const cal = { workdays: settings.workdays, holidays: settings.holidays };
    const end = addDays(toDate(from), days - 1);
    const [user, tasks, events, offs] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { weeklyCapacityHours: true },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          completedAt: null,
          project: { workspaceId, status: 'ACTIVE' },
          assignees: { some: { userId } },
        },
        select: {
          id: true,
          estimateHours: true,
          remainingHours: true,
          progress: true,
          startDate: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
          difficulty: true,
          sprint: { select: { endDate: true } },
        },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          isBusy: true,
          startAt: { lte: addDays(end, 1) },
          endAt: { gte: toDate(from) },
        },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.userTimeOff.findMany({
        where: {
          userId,
          fromDate: { lte: end },
          toDate: { gte: toDate(from) },
        },
        select: { fromDate: true, toDate: true, kind: true, hoursPerDay: true },
      }),
    ]);
    const base = user.weeklyCapacityHours ?? settings.defaultCapacityHours;
    const offList: TimeOff[] = offs.map((o) => ({
      ...o,
      hoursPerDay: o.hoursPerDay === null ? null : Number(o.hoursPerDay),
    }));
    return daysBetween(from, end).map((d) => {
      const planned = tasks.reduce((s, t) => {
        const alloc: AllocTask = {
          ...t,
          estimateHours:
            t.estimateHours === null ? null : Number(t.estimateHours),
          remainingHours:
            t.remainingHours === null ? null : Number(t.remainingHours),
          sprintEndDate: t.sprint?.endDate ?? null,
        };
        return (
          s +
          remainingOf(alloc) *
            difficultyFactor(t.difficulty) *
            shareInDay(alloc, d, td, cal)
        );
      }, 0);
      const workday = isWorkday(d, cal);
      return {
        date: isoDate(d),
        isWorkday: workday,
        plannedHours: round2(planned),
        busyHours: workday
          ? round2(busyHoursOnDay(d, events, settings.workHours))
          : 0,
        freeHours: freeHoursOnDay(
          d,
          base,
          events,
          offList,
          planned,
          cal,
          settings.workHours,
        ),
        focusBlocks: workday
          ? focusBlocksOnDay(d, events, settings.workHours)
          : 0,
      };
    });
  }

  /** Bảng sự thật cho giao việc (UC-26/39): thành viên × task chưa giao — không xếp hạng. */
  async capacityTable(
    projectId: string,
    opts: { sprintId?: string; taskIds?: string[]; today?: Date },
  ) {
    const today = toDate(opts.today ?? new Date());
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        workspaceId: true,
        members: { select: { userId: true, role: true } },
      },
    });
    // Người chỉ xem (VIEWER của workspace) không nhận việc → không phải ứng viên (cùng quy tắc với tóm tắt sprint)
    const viewers = new Set(
      (
        await this.prisma.workspaceMember.findMany({
          where: {
            workspaceId: project.workspaceId,
            role: 'VIEWER',
            userId: { in: project.members.map((m) => m.userId) },
          },
          select: { userId: true },
        })
      ).map((v) => v.userId),
    );
    const memberIds = project.members
      .map((m) => m.userId)
      .filter((id) => !viewers.has(id));
    const sprint = opts.sprintId
      ? await this.prisma.sprint.findFirst({
          where: { id: opts.sprintId, projectId },
          select: { startDate: true, endDate: true },
        })
      : null;
    const from = sprint
      ? toDate(sprint.startDate) > today
        ? toDate(sprint.startDate)
        : today
      : today;
    const days = sprint
      ? Math.max(
          1,
          Math.round(
            (toDate(sprint.endDate).getTime() - from.getTime()) / 86_400_000,
          ) + 1,
        )
      : 28;
    const { users, settings } = await this.computeUsers(
      project.workspaceId,
      memberIds,
      today,
      2,
      { today },
    );
    const profiles = await this.evidence.profiles(
      project.workspaceId,
      memberIds,
      today,
    );
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        completedAt: null,
        parentId: null,
        ...(opts.taskIds
          ? { id: { in: opts.taskIds } }
          : {
              assignees: { none: {} },
              ...(opts.sprintId ? { sprintId: opts.sprintId } : {}),
            }),
      },
      select: {
        id: true,
        number: true,
        title: true,
        estimateHours: true,
        remainingHours: true,
        progress: true,
        difficulty: true,
        dueDate: true,
        startDate: true,
        createdAt: true,
        completedAt: true,
        skills: {
          select: {
            skillId: true,
            minLevel: true,
            skill: { select: { name: true, category: true } },
          },
        },
        dependsOn: { select: { dependsOnId: true } },
        project: { select: { key: true } },
      },
    });
    const members = await Promise.all(
      users.map(async (u) => {
        const mine = profiles.get(u.userId) ?? [];
        // Chỉ kỹ năng CÓ bằng chứng vào phép tính khớp; tự khai chỉ đi kèm để hiển thị
        const levels = new Map(
          mine.filter((s) => isConclusive(s)).map((s) => [s.skillId, s.level]),
        );
        const metrics = await this.metrics.compute(
          u.userId,
          project.workspaceId,
          { workdays: settings.workdays, holidays: settings.holidays },
          hoursPerDay(settings.defaultCapacityHours, {
            workdays: settings.workdays,
            holidays: settings.holidays,
          }),
          settings.workload.ear.smoothingHours,
          settings.workload.ear.windowWeeks,
          today,
        );
        return {
          userId: u.userId,
          fullName: u.fullName,
          shortName: u.shortName,
          role:
            project.members.find((m) => m.userId === u.userId)?.role ??
            'MEMBER',
          skills: mine.map((s) => ({
            skillId: s.skillId,
            name: s.name,
            level: s.level,
            declared: s.declared,
            tasks: s.tasks,
            failed: s.failed,
            confidence: s.confidence,
            evidence: evidenceText(s),
          })),
          utilizationBefore: u.weeks[0]?.utilization ?? 0,
          levelBefore: u.weeks[0]?.level ?? 'NORMAL',
          projectsOpen: u.weeks[0]?.projectsOpen ?? 0,
          metrics: {
            ear: metrics.ear,
            earByCategory: metrics.earByCategory,
            onTimeRate: metrics.onTimeRate,
            sampleSize: metrics.sampleSize,
          },
          freeByDay: await this.freeByDay(
            project.workspaceId,
            u.userId,
            from,
            days,
            today,
          ),
          _levels: levels,
        };
      }),
    );
    const taskRows = tasks.map((t) => {
      const alloc: AllocTask = {
        ...t,
        estimateHours:
          t.estimateHours === null ? null : Number(t.estimateHours),
        remainingHours:
          t.remainingHours === null ? null : Number(t.remainingHours),
      };
      const remaining = remainingOf(alloc);
      const required = t.skills.map((s) => ({
        skillId: s.skillId,
        name: s.skill.name,
        minLevel: s.minLevel,
      }));
      const cat = t.skills[0]?.skill.category ?? '*';
      return {
        taskId: t.id,
        key: `${t.project.key}-${t.number}`,
        title: t.title,
        remainingHours: round2(remaining),
        difficulty: t.difficulty,
        dueDate: t.dueDate ? isoDate(toDate(t.dueDate)) : null,
        dependsOnIds: t.dependsOn.map((d) => d.dependsOnId),
        requiredSkills: required,
        perUser: members.map((m) => {
          const ear = m.metrics.earByCategory[cat]?.ear ?? m.metrics.ear;
          const gap = skillGapFactor(m._levels, required);
          return {
            userId: m.userId,
            hoursEff: round2(hoursEff(remaining, ear, t.difficulty, gap)),
            skillMatch: skillMatch(m._levels, required),
            freeBeforeDue: t.dueDate
              ? round2(
                  m.freeByDay
                    .filter((d) => d.date <= isoDate(toDate(t.dueDate!)))
                    .reduce((s, d) => s + d.freeHours, 0),
                )
              : null,
          };
        }),
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      window: { from: isoDate(from), days },
      members: members.map((m) => ({ ...m, _levels: undefined })),
      tasks: taskRows,
      spread: spreadOf(members.map((m) => m.utilizationBefore)),
    };
  }

  /**
   * Ứng viên cho MỘT việc — "ai làm được việc này?" (docs 14). Nhận task thật (`taskId`) hoặc một bản nháp
   * chưa ghi (`requiredSkills`/`estimateHours`/`difficulty`/`dueDate`). Trả về SỰ THẬT từng người: độ khớp kỹ
   * năng, giờ hiệu dụng phải bỏ ra, giờ trống trước hạn, mức dùng tuần này. Backend KHÔNG chọn hộ và không
   * lọc bớt ai; xếp theo (khớp kỹ năng, giờ trống) chỉ để dễ đọc — LLM và người mới là nơi quyết định.
   */
  async candidatesFor(
    projectId: string,
    spec: {
      taskId?: string;
      title?: string;
      requiredSkills?: { skillId: string; minLevel: number }[];
      estimateHours?: number | null;
      difficulty?: number | null;
      dueDate?: string | null;
    },
    opts: { today?: Date } = {},
  ) {
    const today = toDate(opts.today ?? new Date());
    const table = await this.capacityTable(projectId, {
      taskIds: spec.taskId ? [spec.taskId] : [],
      today,
    });
    const real = spec.taskId
      ? table.tasks.find((t) => t.taskId === spec.taskId)
      : undefined;
    if (spec.taskId && !real) return null; // task đã xong/đã xoá/không thuộc dự án

    const subject = real
      ? {
          title: real.title,
          key: real.key as string | null,
          hours: real.remainingHours,
          difficulty: real.difficulty,
          dueDate: real.dueDate,
          requiredSkills: real.requiredSkills,
        }
      : await this.draftSubject(projectId, spec);

    const rows = table.members.map((m) => {
      const per = real?.perUser.find((p) => p.userId === m.userId);
      const levels = new Map(
        m.skills
          .filter((s) => isConclusive(s))
          .map((s) => [s.skillId, s.level]),
      );
      const required = subject.requiredSkills.map((r) => ({
        skillId: r.skillId,
        name: r.name,
        minLevel: r.minLevel,
      }));
      const freeBeforeDue = subject.dueDate
        ? round2(
            m.freeByDay
              .filter((d) => d.date <= subject.dueDate!)
              .reduce((s, d) => s + d.freeHours, 0),
          )
        : null;
      return {
        userId: m.userId,
        fullName: m.fullName,
        shortName: m.shortName,
        role: m.role,
        utilizationBefore: m.utilizationBefore,
        levelBefore: m.levelBefore,
        skills: m.skills,
        skillMatch: per?.skillMatch ?? skillMatch(levels, required),
        hoursEff:
          per?.hoursEff ??
          (subject.hours === null
            ? null
            : round2(
                hoursEff(
                  subject.hours,
                  m.metrics.ear,
                  subject.difficulty ?? 3,
                  skillGapFactor(levels, required),
                ),
              )),
        freeBeforeDue: per?.freeBeforeDue ?? freeBeforeDue,
        freeTotal: round2(m.freeByDay.reduce((s, d) => s + d.freeHours, 0)),
      };
    });
    rows.sort(
      (a, b) =>
        b.skillMatch.avg - a.skillMatch.avg ||
        (b.freeBeforeDue ?? b.freeTotal) - (a.freeBeforeDue ?? a.freeTotal),
    );
    return { window: table.window, subject, rows };
  }

  /**
   * Hồ sơ kỹ năng & hiệu suất của thành viên dự án (docs 02/08). Kỹ năng (mức từ bằng chứng) ai trong dự án
   * cũng xem được; hiệu suất cá nhân (đúng hạn, đánh giá, EAR, làm lại) chỉ chính người đó và PM (docs 04 §2).
   */
  async skillProfiles(
    projectId: string,
    viewer: { userId: string; canManage: boolean },
    today = new Date(),
  ) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        workspaceId: true,
        workspace: { select: { settings: true } },
        members: {
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          select: {
            role: true,
            user: {
              select: {
                id: true,
                fullName: true,
                shortName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
    const settings = mergeSettings(project.workspace.settings, {});
    const cal = { workdays: settings.workdays, holidays: settings.holidays };
    const ids = project.members.map((m) => m.user.id);
    const viewers = new Set(
      (
        await this.prisma.workspaceMember.findMany({
          where: {
            workspaceId: project.workspaceId,
            role: 'VIEWER',
            userId: { in: ids },
          },
          select: { userId: true },
        })
      ).map((v) => v.userId),
    );
    const profiles = await this.evidence.profiles(
      project.workspaceId,
      ids,
      today,
    );
    return Promise.all(
      project.members.map(async (m) => {
        const canSee = viewer.canManage || viewer.userId === m.user.id;
        const perf = canSee
          ? await this.metrics.compute(
              m.user.id,
              project.workspaceId,
              cal,
              hoursPerDay(settings.defaultCapacityHours, cal),
              settings.workload.ear.smoothingHours,
              settings.workload.ear.windowWeeks,
              today,
            )
          : null;
        return {
          ...m.user,
          role: m.role,
          // VIEWER của workspace: chỉ xem, không nhận việc (không nằm trong bảng năng lực)
          viewer: viewers.has(m.user.id),
          skills: (profiles.get(m.user.id) ?? []).map((e) => ({
            ...e,
            lastAt: e.lastAt ? isoDate(toDate(e.lastAt)) : null,
            evidence: evidenceText(e),
          })),
          performance: perf && {
            windowWeeks: perf.windowWeeks,
            doneTasks: perf.sampleSize,
            onTimeRate: perf.onTimeRate,
            avgRating: perf.avgRating,
            ear: perf.ear,
            reopenCount: perf.reopenCount,
            overdueOpen: perf.overdueOpen,
            openTasks: perf.openTasks,
          },
        };
      }),
    );
  }

  /** Các việc làm nên mức kỹ năng của một người — để giải thích "vì sao mức 3". */
  async skillEvidenceDetail(
    projectId: string,
    userId: string,
    viewer: { userId: string; canManage: boolean },
    skillId?: string,
    today = new Date(),
  ) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    const items = (
      await this.evidence.items(project.workspaceId, [userId], today)
    ).filter((e) => !skillId || e.skillId === skillId);
    const taskIds = [
      ...new Set(items.map((e) => e.taskId).filter((x): x is string => !!x)),
    ];
    const [tasks, skills] = await Promise.all([
      this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          number: true,
          title: true,
          project: { select: { key: true } },
        },
      }),
      this.prisma.skill.findMany({
        where: { id: { in: [...new Set(items.map((e) => e.skillId))] } },
        select: { id: true, name: true },
      }),
    ]);
    const taskOf = new Map(tasks.map((t) => [t.id, t]));
    const nameOf = new Map(skills.map((s) => [s.id, s.name]));
    const canSeeRating = viewer.canManage || viewer.userId === userId;
    return items
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((e) => {
        const t = e.taskId ? taskOf.get(e.taskId) : undefined;
        return {
          skillId: e.skillId,
          skill: nameOf.get(e.skillId) ?? e.skillId,
          source: e.source,
          task: t
            ? { id: t.id, key: `${t.project.key}-${t.number}`, title: t.title }
            : null,
          required: e.required,
          demonstrated: demonstrated(e),
          passed: passedOf(e),
          weight: Math.round(weightOf(e) * 100) / 100,
          rating: canSeeRating ? e.rating : null,
          reopened: e.reopened,
          bugs: e.bugs,
          at: isoDate(toDate(e.at)),
        };
      });
  }

  /** Việc chưa ghi (bản nháp trong phiên chat): lấy tên kỹ năng từ danh mục để bảng đọc được. */
  private async draftSubject(
    projectId: string,
    spec: {
      title?: string;
      requiredSkills?: { skillId: string; minLevel: number }[];
      estimateHours?: number | null;
      difficulty?: number | null;
      dueDate?: string | null;
    },
  ) {
    const ids = (spec.requiredSkills ?? []).map((r) => r.skillId);
    const names = ids.length
      ? await this.prisma.skill.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    return {
      title: spec.title ?? 'Bản nháp',
      key: null as string | null,
      hours:
        spec.estimateHours === null || spec.estimateHours === undefined
          ? null
          : Number(spec.estimateHours),
      difficulty: spec.difficulty ?? null,
      dueDate: spec.dueDate ?? null,
      requiredSkills: (spec.requiredSkills ?? []).map((r) => ({
        skillId: r.skillId,
        name: names.find((n) => n.id === r.skillId)?.name ?? r.skillId,
        minLevel: r.minLevel,
      })),
    };
  }
}
