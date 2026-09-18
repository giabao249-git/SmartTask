import { Injectable } from '@nestjs/common';
import { AiMemoryStatus, AiPurpose, SprintStatus } from '@prisma/client';
import type { ValidationIssue } from '@smarttask/shared';
import { AppError } from '../../common/app-error';
import { ForecastService } from '../../forecast/forecast.service';
import { PrismaService } from '../../prisma/prisma.service';
import { isoDate, toDate } from '../../workload/domain/calendar';
import { WorkloadService } from '../../workload/workload.service';
import { AiConfigService } from '../ai-config/ai-config.service';
import { PURPOSE_INSTRUCTIONS } from '../prompt/master-prompt';
import {
  assemblePrompt,
  bang,
  type AssembledPrompt,
  type PromptBlock,
} from '../prompt/prompt-assembler';
import { CodeBook } from './short-codes';

export type DetailLevel = 'coarse' | 'normal' | 'fine';

export interface BuildInput {
  userId: string;
  projectId: string;
  purpose: Extract<AiPurpose, 'DECOMPOSE' | 'EXPLAIN'>;
  sprintId?: string;
  requirement?: string;
  detail?: DetailLevel;
  /** Lượt gọi lại: lỗi Validator của lượt trước để LLM tự sửa (05 §9) */
  previousErrors?: ValidationIssue[];
  today?: Date;
}

export interface BuiltContext {
  prompt: AssembledPrompt;
  codes: CodeBook;
  meta: {
    workspaceId: string;
    projectKey: string;
    sprintId: string | null;
    sprintCode: string | null;
    masterVersion: number;
    workspacePromptVersion: number;
    requesterCode: string;
  };
  /** Số backend đã tính, để Validator/UI đối chiếu mà không tính lại */
  facts: {
    memberIds: string[];
    sprintFreeHours: number | null;
    sprintPlannedHours: number | null;
    forecastRiskLevel?: string;
  };
}

const MAX_OPEN_TASKS = 100;
const MAX_MEMORIES = 50;

/**
 * Nạp MỚI từ DB mỗi lượt bốn tầng ngữ cảnh (docs 05 §3): chính sách → sự thật (bảng backend tính) → ý định → danh tính.
 * Không cache trong tiến trình; mã ngắn cấp theo thứ tự ổn định; dữ liệu vào dạng bảng, không JSON.
 * Kế thừa `ai-v2/context-builder.service.ts` + `smart-scheduler/bang-du-lieu.ts` (Table_Calendar).
 */
@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
    private readonly workload: WorkloadService,
    private readonly forecast: ForecastService,
  ) {}

  async build(input: BuildInput): Promise<BuiltContext> {
    const today = toDate(input.today ?? new Date());
    const codes = new CodeBook();
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        workspaceId: true,
        members: {
          orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
          select: {
            role: true,
            user: {
              select: {
                id: true,
                fullName: true,
                shortName: true,
                weeklyCapacityHours: true,
                aiPersonalPrompt: true,
                userSkills: {
                  select: { skillId: true, level: true, verifiedById: true },
                },
              },
            },
          },
        },
        sprints: {
          where: {
            status: { in: [SprintStatus.PLANNED, SprintStatus.ACTIVE] },
          },
          orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            goal: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: project.workspaceId },
      select: { settings: true },
    });
    const settings = ws.settings as { defaultCapacityHours?: number } | null;
    const defaultCap = settings?.defaultCapacityHours ?? 40;

    // ── Danh tính: mã ổn định theo thứ tự vào dự án / tên kỹ năng / số sprint ──
    const skills = await this.prisma.skill.findMany({
      where: { workspaceId: project.workspaceId, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        aliases: { select: { alias: true } },
      },
    });
    for (const s of skills) codes.assign('k', s.id);
    for (const m of project.members) codes.assign('u', m.user.id);
    for (const s of project.sprints) codes.assign('s', s.id);
    const requester = project.members.find((m) => m.user.id === input.userId);
    const requesterCode = requester
      ? codes.codeOf('u', input.userId)!
      : codes.assign('u', input.userId);
    const requesterName =
      requester?.user.shortName ?? requester?.user.fullName ?? 'PM';

    const sprint = input.sprintId
      ? (project.sprints.find((s) => s.id === input.sprintId) ?? null)
      : null;
    if (input.sprintId && !sprint)
      throw AppError.notFound({ sprintId: input.sprintId });
    const sprintCode = sprint ? codes.codeOf('s', sprint.id)! : null;

    const prompts = await this.aiConfig.activePrompts(project.workspaceId);
    const policy: PromptBlock[] = [
      {
        title: `MASTER PROMPT (v${prompts.master.version})`,
        body: prompts.master.content,
      },
      {
        title: `WORKSPACE PROMPT (v${prompts.workspace.version})`,
        body: prompts.workspace.content,
      },
      { title: 'KHUNG ĐẦU RA', body: PURPOSE_INSTRUCTIONS[input.purpose] },
    ];

    const skillName = new Map(skills.map((s) => [s.id, s.name]));
    const staticBlocks: PromptBlock[] = [
      {
        title: 'DANH BẠ THÀNH VIÊN',
        body: bang(
          [
            'mã',
            'tên',
            'tên gọi',
            'vai',
            'kỹ năng (mức, *=PM xác nhận)',
            'giờ/tuần',
          ],
          project.members.map((m) => [
            codes.codeOf('u', m.user.id),
            m.user.fullName,
            m.user.shortName,
            m.role,
            m.user.userSkills
              .map(
                (s) =>
                  `${codes.codeOf('k', s.skillId) ?? '?'} ${skillName.get(s.skillId) ?? ''} ${s.level}${s.verifiedById ? '*' : ''}`,
              )
              .sort()
              .join(', ') || 'chưa khai',
            m.user.weeklyCapacityHours ?? defaultCap,
          ]),
        ),
      },
      {
        title: 'DANH MỤC KỸ NĂNG',
        body: bang(
          ['mã', 'tên', 'nhóm', 'alias'],
          skills.map((s) => [
            codes.codeOf('k', s.id),
            s.name,
            s.category,
            s.aliases.map((a) => a.alias).join(', '),
          ]),
        ),
      },
      {
        title: 'DỰ ÁN & SPRINT',
        body: [
          `Dự án ${project.key} "${project.name}"${project.startDate ? ` · ${isoDate(toDate(project.startDate))}` : ''}${project.endDate ? ` → ${isoDate(toDate(project.endDate))}` : ''}`,
          project.description
            ? `Mô tả: ${project.description.slice(0, 600)}`
            : '',
          bang(
            ['mã', 'sprint', 'trạng thái', 'từ', 'đến', 'mục tiêu'],
            project.sprints.map((s) => [
              codes.codeOf('s', s.id),
              s.name,
              s.status,
              isoDate(toDate(s.startDate)),
              isoDate(toDate(s.endDate)),
              s.goal?.slice(0, 120),
            ]),
          ),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];

    const dynamicBlocks: PromptBlock[] = [
      { title: 'HÔM NAY', body: isoDate(today) },
    ];
    const facts: BuiltContext['facts'] = {
      memberIds: project.members.map((m) => m.user.id),
      sprintFreeHours: null,
      sprintPlannedHours: null,
    };

    if (input.purpose === 'DECOMPOSE') {
      await this.decomposeBlocks(
        input,
        project,
        sprint,
        codes,
        skillName,
        dynamicBlocks,
        facts,
        today,
      );
    } else {
      await this.explainBlocks(
        input,
        project,
        sprint,
        codes,
        dynamicBlocks,
        facts,
      );
    }

    // ── Tầng ý định: memory đã xác nhận, thói quen, sở thích cá nhân (docs 06 §5) ──
    await this.intentBlocks(
      input.userId,
      project.workspaceId,
      requester?.user.aiPersonalPrompt ?? null,
      requesterCode,
      requesterName,
      dynamicBlocks,
      today,
    );

    if (input.previousErrors?.length)
      dynamicBlocks.push({
        title:
          'LỖI KIỂM TRA LƯỢT TRƯỚC (hệ thống kiểm trên dữ liệu sống — hãy sửa đề xuất)',
        body: input.previousErrors
          .map(
            (e) =>
              `- ${e.path}: [${e.code}] ${e.message}${e.data ? ' ' + JSON.stringify(e.data) : ''}`,
          )
          .join('\n'),
      });

    dynamicBlocks.push({
      title: `YÊU CẦU HIỆN TẠI của ${requesterCode} ${requesterName}`,
      body:
        input.purpose === 'DECOMPOSE'
          ? [
              `Mức chi tiết: ${input.detail ?? 'normal'}`,
              sprintCode
                ? `Sprint đích: ${sprintCode}`
                : 'Sprint đích: (backlog — chưa chọn sprint)',
              '',
              input.requirement ?? '',
            ].join('\n')
          : `Giải thích mức rủi ro trễ hạn của sprint ${sprintCode ?? ''} cho PM: vì sao ở mức này, nguyên nhân nào nặng nhất, nên làm gì.`,
    });

    return {
      prompt: assemblePrompt({ policy, staticBlocks, dynamicBlocks }),
      codes,
      meta: {
        workspaceId: project.workspaceId,
        projectKey: project.key,
        sprintId: sprint?.id ?? null,
        sprintCode,
        masterVersion: prompts.master.version,
        workspacePromptVersion: prompts.workspace.version,
        requesterCode,
      },
      facts,
    };
  }

  private async decomposeBlocks(
    input: BuildInput,
    project: { id: string; key: string; workspaceId: string },
    sprint: { id: string; endDate: Date } | null,
    codes: CodeBook,
    skillName: Map<string, string>,
    out: PromptBlock[],
    facts: BuiltContext['facts'],
    today: Date,
  ) {
    const openTasks = await this.prisma.task.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
        completedAt: null,
        parentId: null,
        ...(sprint ? { sprintId: sprint.id } : { sprintId: null }),
      },
      orderBy: { number: 'asc' },
      take: MAX_OPEN_TASKS,
      select: {
        id: true,
        number: true,
        title: true,
        estimateHours: true,
        remainingHours: true,
        difficulty: true,
        dueDate: true,
        skills: { select: { skillId: true, minLevel: true } },
        assignees: { select: { userId: true } },
      },
    });
    for (const t of openTasks) codes.assign('t', t.id);
    let planned = 0;
    for (const t of openTasks)
      planned += num(t.remainingHours ?? t.estimateHours) ?? 0;
    facts.sprintPlannedHours = Math.round(planned * 100) / 100;
    out.push({
      title: sprint ? 'TASK MỞ TRONG SPRINT ĐÍCH' : 'TASK MỞ TRONG BACKLOG',
      body: openTasks.length
        ? bang(
            [
              'mã',
              'khoá',
              'tiêu đề',
              'giờ còn',
              'độ khó',
              'kỹ năng',
              'hạn',
              'người',
            ],
            openTasks.map((t) => [
              codes.codeOf('t', t.id),
              `${project.key}-${t.number}`,
              t.title,
              num(t.remainingHours ?? t.estimateHours),
              t.difficulty,
              t.skills
                .map(
                  (s) =>
                    `${codes.codeOf('k', s.skillId) ?? skillName.get(s.skillId) ?? '?'}≥${s.minLevel}`,
                )
                .join(' '),
              t.dueDate ? isoDate(toDate(t.dueDate)) : null,
              t.assignees
                .map((a) => codes.codeOf('u', a.userId) ?? '?')
                .join(' ') || 'chưa giao',
            ]),
          )
        : '(chưa có task nào)',
    });

    // Bảng năng lực theo ngày — số backend tính (docs 04 §5), LLM chỉ đọc
    const cap = await this.workload.capacityTable(project.id, {
      sprintId: sprint?.id,
      today,
    });
    let sprintFree = 0;
    const rows = cap.members.map((m) => {
      const free = m.freeByDay.reduce((s, d) => s + d.freeHours, 0);
      sprintFree += free;
      const days = m.freeByDay
        .filter((d) => d.isWorkday)
        .map(
          (d) => `${d.date.slice(5)}:${d.freeHours}${d.focusBlocks ? '*' : ''}`,
        )
        .join(' ');
      return [
        codes.codeOf('u', m.userId),
        m.utilizationBefore.toFixed(2),
        m.levelBefore,
        `${m.metrics.ear.toFixed(2)} (n=${m.metrics.sampleSize})`,
        m.metrics.sampleSize && m.metrics.onTimeRate !== null
          ? `${Math.round(m.metrics.onTimeRate * 100)}%`
          : '—',
        m.projectsOpen,
        Math.round(free * 10) / 10,
        days || '—',
      ];
    });
    facts.sprintFreeHours = Math.round(sprintFree * 10) / 10;
    out.push({
      title: `BẢNG NĂNG LỰC (cửa sổ ${cap.window.from} + ${cap.window.days} ngày; * = có khối tập trung ≥ 2h)`,
      body: [
        bang(
          [
            'mã',
            'U tuần này',
            'mức',
            'EAR',
            'đúng hạn',
            'dự án mở',
            'giờ trống tới hết cửa sổ',
            'giờ trống theo ngày (MM-DD:h)',
          ],
          rows,
        ),
        `Tổng giờ trống cả nhóm tới hết cửa sổ: ${facts.sprintFreeHours} h · giờ còn lại của task đã có trong ${sprint ? 'sprint' : 'backlog'}: ${facts.sprintPlannedHours} h`,
      ].join('\n'),
    });
  }

  private async explainBlocks(
    input: BuildInput,
    project: { id: string; key: string; workspaceId: string },
    sprint: { id: string; name: string } | null,
    codes: CodeBook,
    out: PromptBlock[],
    facts: BuiltContext['facts'],
  ) {
    if (!sprint) throw AppError.notFound({ sprintId: input.sprintId });
    const [fc, bd, tasks] = await Promise.all([
      this.forecast.forecast(input.userId, sprint.id),
      this.forecast.burndown(input.userId, sprint.id),
      this.prisma.task.findMany({
        where: { sprintId: sprint.id, deletedAt: null, parentId: null },
        orderBy: { number: 'asc' },
        take: MAX_OPEN_TASKS,
        select: {
          id: true,
          number: true,
          title: true,
          remainingHours: true,
          estimateHours: true,
          dueDate: true,
          completedAt: true,
          startedAt: true,
          column: { select: { name: true } },
          assignees: { select: { userId: true } },
          dependsOn: { select: { dependsOnId: true } },
        },
      }),
    ]);
    for (const t of tasks) codes.assign('t', t.id);
    facts.forecastRiskLevel = fc.riskLevel;
    out.push({
      title: 'SỐ LIỆU DỰ BÁO (backend tính — sự thật)',
      body: [
        `Mức rủi ro (backend): ${fc.riskLevel}`,
        `Sprint: ${sprint.name} · kết thúc ${fc.endDate} · trạng thái ${fc.status} · đã chạy ${fc.sprintAgeWorkdays} ngày làm việc`,
        `Giờ còn lại: ${fc.remainingHours} h · vận tốc: ${fc.velocity} h/ngày làm việc · ETA: ${fc.eta ?? 'không tính được (vận tốc 0)'}`,
        `Scope creep vào các ngày: ${bd.scopeCreepDays?.length ? bd.scopeCreepDays.join(', ') : 'không'}`,
        'Nguyên nhân đo được:',
        bang(
          ['mã', 'số lượng', 'task', 'người'],
          fc.causes.map((c) => [
            c.code,
            c.count,
            (c.taskIds ?? [])
              .map((id) => codes.codeOf('t', id) ?? '?')
              .join(' '),
            (c.userIds ?? [])
              .map((id) => codes.codeOf('u', id) ?? '?')
              .join(' '),
          ]),
        ),
      ].join('\n'),
    });
    out.push({
      title: 'TASK TRONG SPRINT',
      body: bang(
        [
          'mã',
          'khoá',
          'tiêu đề',
          'cột',
          'còn (h)',
          'hạn',
          'người',
          'chặn bởi',
          'trạng thái',
        ],
        tasks.map((t) => [
          codes.codeOf('t', t.id),
          `${project.key}-${t.number}`,
          t.title,
          t.column.name,
          t.completedAt ? 0 : num(t.remainingHours ?? t.estimateHours),
          t.dueDate ? isoDate(toDate(t.dueDate)) : null,
          t.assignees
            .map((a) => codes.codeOf('u', a.userId) ?? '?')
            .join(' ') || 'chưa giao',
          t.dependsOn
            .map((d) => codes.codeOf('t', d.dependsOnId) ?? '?')
            .join(' '),
          t.completedAt ? 'xong' : t.startedAt ? 'đang làm' : 'chưa bắt đầu',
        ]),
      ),
    });
  }

  private async intentBlocks(
    userId: string,
    workspaceId: string,
    personalPrompt: string | null,
    requesterCode: string,
    requesterName: string,
    out: PromptBlock[],
    today: Date,
  ) {
    const [memories, habits] = await Promise.all([
      this.prisma.aiMemory.findMany({
        where: {
          userId,
          workspaceId,
          status: AiMemoryStatus.CONFIRMED,
          OR: [{ validUntil: null }, { validUntil: { gte: today } }],
        },
        orderBy: { confirmedAt: 'desc' },
        take: MAX_MEMORIES,
        select: { kind: true, content: true, confirmedAt: true },
      }),
      this.prisma.aiHabit.findMany({
        where: {
          userId,
          workspaceId,
          isVisible: true,
          confidence: { gte: 0.6 },
        },
        orderBy: { confidence: 'desc' },
        take: 20,
        select: {
          type: true,
          key: true,
          value: true,
          timesObserved: true,
          confidence: true,
        },
      }),
    ]);
    if (memories.length)
      out.push({
        title: `ĐIỀU AI ĐÃ BIẾT về ${requesterCode} ${requesterName} (sự thật đã xác nhận — dùng để giải thích và cân nhắc, KHÔNG BAO GIỜ dùng để bỏ qua dữ liệu, chỉ số hay giờ trống hệ thống tính ở trên)`,
        body: memories
          .map(
            (m) =>
              `- [${m.kind}] ${m.content}${m.confirmedAt ? ` (xác nhận ${isoDate(toDate(m.confirmedAt))})` : ''}`,
          )
          .join('\n'),
      });
    if (habits.length)
      out.push({
        title:
          'THÓI QUEN suy luận được (độ tin cậy thấp — bị ghi đè bởi sở thích cá nhân và yêu cầu hiện tại; BỎ QUA nếu mâu thuẫn với dữ liệu thật hoặc chính sách)',
        body: habits
          .map((h) => {
            const v = h.value as { description?: string } | null;
            return `- [${h.type}] ${v?.description ?? h.key} (đã thấy ${h.timesObserved} lần, tin cậy ${h.confidence.toFixed(2)})`;
          })
          .join('\n'),
      });
    if (personalPrompt?.trim())
      out.push({
        title: `SỞ THÍCH CÁ NHÂN của ${requesterCode} ${requesterName} (do chính người dùng viết — không ghi đè chính sách/sự thật; bị ghi đè bởi yêu cầu hiện tại nếu mâu thuẫn trực tiếp)`,
        body: personalPrompt.trim().slice(0, 2000),
      });
  }
}

/** Prisma Decimal → số; null → null (bảng in "—"). */
function num(
  v: { toNumber(): number } | number | null | undefined,
): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === 'number' ? v : v.toNumber();
}
