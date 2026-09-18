import { Injectable } from '@nestjs/common';
import type {
  DecomposeProposal,
  RiskExplanation,
  ValidationIssue,
  ValidationResult,
} from '@smarttask/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, isoDate, toDate } from '../../workload/domain/calendar';
import { WorkloadService } from '../../workload/workload.service';
import { mergeSettings } from '../../workspaces/workspace-settings';
import type { CodeBook } from '../context/short-codes';
import { boDau, findCycle } from './graph';

export interface DecomposeContext {
  codes: CodeBook;
  projectId: string;
  workspaceId: string;
  /** Sprint đích đã chọn trên form (null = backlog) */
  sprintId: string | null;
  today?: Date;
}

/** Ánh xạ mã → UUID mà Validator đã đối chiếu — Executor dùng, action gốc KHÔNG bị sửa. */
export interface DecomposeResolution {
  sprintId: string | null;
  tasks: Record<
    string,
    {
      assigneeId: string | null;
      skills: { skillId: string; minLevel: number }[];
      /** Tên kỹ năng LLM sinh không khớp danh mục — bị bỏ, đã ghi cảnh báo */
      droppedSkills: string[];
    }
  >;
}

export interface DecomposeValidation extends ValidationResult {
  resolution: DecomposeResolution;
}

const MIN_ESTIMATE = 0.5;
const MAX_ESTIMATE = 40;
const MAX_TASKS = 25;

/**
 * Kiểm đề xuất của LLM trên DỮ LIỆU SỐNG (docs 05 §2, 11 §5): quyền, tồn tại, kỹ năng, giờ trống, ngưỡng quá tải,
 * phụ thuộc không vòng. Trả `{ ok, errors[], warnings[] }` kèm số; KHÔNG xếp hạng lại, KHÔNG thay người/giờ,
 * KHÔNG chọn phương án khác — lỗi trả về để LLM (một lần) hoặc người sửa.
 */
@Injectable()
export class ActionValidatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workload: WorkloadService,
  ) {}

  async validateDecompose(
    action: DecomposeProposal,
    ctx: DecomposeContext,
  ): Promise<DecomposeValidation> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const today = toDate(ctx.today ?? new Date());
    const resolution: DecomposeResolution = {
      sprintId: ctx.sprintId,
      tasks: {},
    };

    // ── Sprint ──
    if (action.sprint) {
      const id = ctx.codes.idOf('s', action.sprint);
      if (!id)
        errors.push(
          issue(
            'sprint',
            'UNKNOWN_CODE',
            `Mã sprint ${action.sprint} không có trong ngữ cảnh`,
          ),
        );
      else if (ctx.sprintId && id !== ctx.sprintId)
        errors.push(
          issue(
            'sprint',
            'VALIDATION_FAILED',
            `Sprint ${action.sprint} khác sprint đích đã chọn trên form`,
            { expected: ctx.codes.codeOf('s', ctx.sprintId) },
          ),
        );
      else resolution.sprintId = id;
    }
    const sprint = resolution.sprintId
      ? await this.prisma.sprint.findFirst({
          where: {
            id: resolution.sprintId,
            projectId: ctx.projectId,
            status: { not: 'CLOSED' },
          },
          select: { id: true, startDate: true, endDate: true },
        })
      : null;
    if (resolution.sprintId && !sprint)
      errors.push(
        issue('sprint', 'NOT_FOUND', 'Sprint không còn tồn tại hoặc đã đóng'),
      );
    const windowFrom =
      sprint && toDate(sprint.startDate) > today
        ? toDate(sprint.startDate)
        : today;
    const windowTo = sprint ? toDate(sprint.endDate) : addDays(today, 27);
    if (windowTo < windowFrom)
      errors.push(
        issue('sprint', 'VALIDATION_FAILED', 'Sprint đã qua ngày kết thúc'),
      );

    // ── Dữ liệu sống: thành viên, kỹ năng, nghỉ ──
    const [members, skills, offs] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId: ctx.projectId },
        select: {
          userId: true,
          user: {
            select: {
              fullName: true,
              userSkills: { select: { skillId: true, level: true } },
            },
          },
        },
      }),
      this.prisma.skill.findMany({
        where: { workspaceId: ctx.workspaceId, isActive: true },
        select: { id: true, name: true, aliases: { select: { alias: true } } },
      }),
      this.prisma.userTimeOff.findMany({
        where: {
          fromDate: { lte: windowTo },
          toDate: { gte: windowFrom },
          kind: { not: 'PARTIAL' },
        },
        select: { userId: true, fromDate: true, toDate: true },
      }),
    ]);
    const memberById = new Map(members.map((m) => [m.userId, m]));
    const skillById = new Map(skills.map((s) => [s.id, s]));
    const skillByNorm = new Map<string, string>();
    // Khớp theo bản bỏ dấu và bản bỏ cả khoảng trắng ("react js" ↔ "ReactJS")
    for (const s of skills)
      for (const n of [s.name, ...s.aliases.map((a) => a.alias)]) {
        skillByNorm.set(boDau(n), s.id);
        skillByNorm.set(boDau(n).replace(/\s+/g, ''), s.id);
      }

    // ── Từng task ──
    if (action.tasks.length > MAX_TASKS)
      errors.push(
        issue('tasks', 'VALIDATION_FAILED', `Quá ${MAX_TASKS} task`, {
          count: action.tasks.length,
        }),
      );
    const keys = new Set<string>();
    const edges = new Map<string, string[]>();
    const hoursByUser = new Map<string, number>();
    action.tasks.forEach((t, i) => {
      const p = `tasks[${i}]`;
      if (keys.has(t.draftKey))
        errors.push(
          issue(
            `${p}.draftKey`,
            'VALIDATION_FAILED',
            `draftKey ${t.draftKey} trùng`,
          ),
        );
      keys.add(t.draftKey);
      edges.set(t.draftKey, t.dependsOn);
      if (t.estimateHours === undefined)
        errors.push(
          issue(
            `${p}.estimateHours`,
            'VALIDATION_FAILED',
            'Thiếu ước lượng giờ',
          ),
        );
      else if (t.estimateHours < MIN_ESTIMATE || t.estimateHours > MAX_ESTIMATE)
        errors.push(
          issue(
            `${p}.estimateHours`,
            'VALIDATION_FAILED',
            `Ước lượng phải trong ${MIN_ESTIMATE}–${MAX_ESTIMATE} h (task lớn hơn → tách)`,
            { value: t.estimateHours },
          ),
        );
      const subSum = t.subtasks.reduce((s, x) => s + (x.estimateHours ?? 0), 0);
      if (t.estimateHours !== undefined && subSum > t.estimateHours)
        warnings.push(
          issue(
            `${p}.subtasks`,
            'VALIDATION_FAILED',
            `Tổng giờ subtask (${subSum}) lớn hơn ước lượng task (${t.estimateHours})`,
          ),
        );

      // Kỹ năng: mã k → UUID; tên → chuẩn hoá qua alias; không khớp → bỏ + cảnh báo (không đoán)
      const resolvedSkills: { skillId: string; minLevel: number }[] = [];
      const dropped: string[] = [];
      t.requiredSkills.forEach((rs, j) => {
        const byCode = /^k\d+$/.test(rs.skill)
          ? ctx.codes.idOf('k', rs.skill)
          : undefined;
        if (/^k\d+$/.test(rs.skill) && !byCode) {
          errors.push(
            issue(
              `${p}.requiredSkills[${j}]`,
              'UNKNOWN_CODE',
              `Mã kỹ năng ${rs.skill} không có trong ngữ cảnh`,
            ),
          );
          return;
        }
        const id =
          byCode ??
          skillByNorm.get(boDau(rs.skill)) ??
          skillByNorm.get(boDau(rs.skill).replace(/\s+/g, ''));
        if (!id || !skillById.has(id)) {
          dropped.push(rs.skill);
          warnings.push(
            issue(
              `${p}.requiredSkills[${j}]`,
              'SKILL_UNKNOWN',
              `Kỹ năng "${rs.skill}" không có trong danh mục — sẽ bỏ khi tạo`,
            ),
          );
          return;
        }
        if (!resolvedSkills.some((x) => x.skillId === id))
          resolvedSkills.push({ skillId: id, minLevel: rs.minLevel });
      });

      // Người được gợi ý
      let assigneeId: string | null = null;
      if (t.suggestedAssignee) {
        const id = ctx.codes.idOf('u', t.suggestedAssignee);
        const m = id ? memberById.get(id) : undefined;
        if (!id)
          errors.push(
            issue(
              `${p}.suggestedAssignee`,
              'UNKNOWN_CODE',
              `Mã ${t.suggestedAssignee} không có trong ngữ cảnh`,
            ),
          );
        else if (!m)
          errors.push(
            issue(
              `${p}.suggestedAssignee`,
              'ASSIGN_NOT_MEMBER',
              `${t.suggestedAssignee} không còn là thành viên dự án`,
            ),
          );
        else {
          assigneeId = id;
          const off = offs.find(
            (o) =>
              o.userId === id &&
              toDate(o.fromDate) <= windowFrom &&
              toDate(o.toDate) >= windowTo,
          );
          if (off)
            errors.push(
              issue(
                `${p}.suggestedAssignee`,
                'ASSIGN_ON_LEAVE',
                `${m.user.fullName} nghỉ trọn ${isoDate(windowFrom)}–${isoDate(windowTo)}`,
                {
                  from: isoDate(toDate(off.fromDate)),
                  to: isoDate(toDate(off.toDate)),
                },
              ),
            );
          const levels = new Map(
            m.user.userSkills.map((s) => [s.skillId, s.level]),
          );
          for (const rs of resolvedSkills) {
            const lv = levels.get(rs.skillId) ?? 0;
            if (lv < rs.minLevel)
              errors.push(
                issue(
                  `${p}.suggestedAssignee`,
                  'ASSIGN_SKILL_GAP',
                  `${m.user.fullName} có ${skillById.get(rs.skillId)?.name} mức ${lv}, task cần ≥ ${rs.minLevel}`,
                  {
                    skill: skillById.get(rs.skillId)?.name,
                    required: rs.minLevel,
                    level: lv,
                  },
                ),
              );
          }
          hoursByUser.set(
            id,
            (hoursByUser.get(id) ?? 0) + (t.estimateHours ?? 0),
          );
        }
      }
      resolution.tasks[t.draftKey] = {
        assigneeId,
        skills: resolvedSkills,
        droppedSkills: dropped,
      };
    });

    // ── Phụ thuộc ──
    action.tasks.forEach((t, i) => {
      t.dependsOn.forEach((d, j) => {
        if (!keys.has(d))
          errors.push(
            issue(
              `tasks[${i}].dependsOn[${j}]`,
              'UNKNOWN_CODE',
              `draftKey ${d} không có trong đề xuất`,
            ),
          );
        if (d === t.draftKey)
          errors.push(
            issue(
              `tasks[${i}].dependsOn[${j}]`,
              'DEPENDENCY_CYCLE',
              'Task phụ thuộc chính nó',
            ),
          );
      });
    });
    const cycle = findCycle(edges);
    if (cycle)
      errors.push(
        issue(
          'tasks',
          'DEPENDENCY_CYCLE',
          `Phụ thuộc tạo vòng: ${cycle.join(' → ')}`,
          { cycle },
        ),
      );

    // ── Giờ trống & ngưỡng quá tải cho người được gợi ý (số backend tính) ──
    const totalHours = action.tasks.reduce(
      (s, t) => s + (t.estimateHours ?? 0),
      0,
    );
    const facts: Record<string, unknown> = {
      totalHours: round1(totalHours),
      window: { from: isoDate(windowFrom), to: isoDate(windowTo) },
    };
    if (members.length && windowTo >= windowFrom) {
      const days =
        Math.round((windowTo.getTime() - windowFrom.getTime()) / 86_400_000) +
        1;
      const weeks = Math.max(1, Math.ceil(days / 7));
      const ws = await this.prisma.workspace.findUniqueOrThrow({
        where: { id: ctx.workspaceId },
        select: { settings: true },
      });
      const overloadAt = mergeSettings(ws.settings, {}).workload.thresholds
        .overload;
      const { users } = await this.workload.computeUsers(
        ctx.workspaceId,
        members.map((m) => m.userId),
        windowFrom,
        weeks,
        { today },
      );
      let groupFree = 0;
      const perUser: Record<string, unknown> = {};
      for (const m of members) {
        const free = (
          await this.workload.freeByDay(
            ctx.workspaceId,
            m.userId,
            windowFrom,
            days,
            today,
          )
        ).reduce((s, d) => s + d.freeHours, 0);
        groupFree += free;
        const u = users.find((x) => x.userId === m.userId);
        const effLoad = u?.weeks.reduce((s, w) => s + w.effLoadHours, 0) ?? 0;
        const effCap =
          u?.weeks.reduce((s, w) => s + w.effCapacityHours, 0) ?? 0;
        const added = hoursByUser.get(m.userId) ?? 0;
        const uBefore = effCap ? effLoad / effCap : 0;
        const uAfter = effCap
          ? (effLoad + added) / effCap
          : added > 0
            ? 9.99
            : 0;
        const code = ctx.codes.codeOf('u', m.userId) ?? m.userId;
        perUser[code] = {
          freeHours: round1(free),
          addedHours: round1(added),
          utilizationBefore: round2(uBefore),
          utilizationAfter: round2(uAfter),
        };
        if (added > 0) {
          const paths = action.tasks
            .map((t, i) =>
              ctx.codes.idOf('u', t.suggestedAssignee) === m.userId
                ? `tasks[${i}].suggestedAssignee`
                : null,
            )
            .filter((x): x is string => !!x);
          if (added > free)
            errors.push(
              issue(
                paths[0] ?? 'tasks',
                'ASSIGN_CAPACITY_EXCEEDED',
                `${m.user.fullName} chỉ còn ${round1(free)} h trống tới ${isoDate(windowTo)}, đề xuất giao ${round1(added)} h`,
                { freeHours: round1(free), addedHours: round1(added), paths },
              ),
            );
          else if (uAfter > overloadAt)
            errors.push(
              issue(
                paths[0] ?? 'tasks',
                'ASSIGN_OVERLOAD',
                `${m.user.fullName} sẽ ở mức sử dụng ${round2(uAfter)} > ngưỡng ${overloadAt}`,
                {
                  utilizationBefore: round2(uBefore),
                  utilizationAfter: round2(uAfter),
                  threshold: overloadAt,
                  paths,
                },
              ),
            );
        }
      }
      facts.groupFreeHours = round1(groupFree);
      facts.perUser = perUser;
      if (totalHours > groupFree)
        warnings.push(
          issue(
            'tasks',
            'SPRINT_CAPACITY',
            `Tổng ${round1(totalHours)} h vượt ${round1(groupFree)} h trống của cả nhóm tới ${isoDate(windowTo)}`,
            {
              totalHours: round1(totalHours),
              groupFreeHours: round1(groupFree),
            },
          ),
        );
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      facts,
      checkedAt: new Date().toISOString(),
      resolution,
    };
  }

  /** RISK_EXPLANATION: mức phải trùng số backend (05 §4) — AI chỉ cấp phần văn bản. */
  validateExplain(
    action: RiskExplanation,
    expectedRiskLevel: string,
  ): ValidationResult {
    const errors: ValidationIssue[] = [];
    if (action.riskLevel !== expectedRiskLevel)
      errors.push(
        issue(
          'riskLevel',
          'AI_RESPONSE_INVALID',
          `Mức rủi ro ${action.riskLevel} khác mức backend tính ${expectedRiskLevel}`,
          { expected: expectedRiskLevel, got: action.riskLevel },
        ),
      );
    return {
      ok: errors.length === 0,
      errors,
      warnings: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

function issue(
  path: string,
  code: string,
  message: string,
  data?: Record<string, unknown>,
): ValidationIssue {
  return { path, code, message, ...(data ? { data } : {}) };
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
