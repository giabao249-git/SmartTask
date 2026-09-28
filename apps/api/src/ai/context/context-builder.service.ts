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
import { itemsOf, type ProposalAction } from '../proposals/draft-items';
import type {
  ProposalPayload,
  ProposalRow,
} from '../proposals/proposals.service';
import { CodeBook } from './short-codes';

export type DetailLevel = 'coarse' | 'normal' | 'fine';

export interface BuildInput {
  userId: string;
  projectId: string;
  purpose: Extract<AiPurpose, 'DECOMPOSE' | 'EXPLAIN' | 'CHAT'>;
  sprintId?: string;
  requirement?: string;
  detail?: DetailLevel;
  /** Lượt gọi lại: lỗi Validator của lượt trước để LLM tự sửa (05 §9) */
  previousErrors?: ValidationIssue[];
  today?: Date;
  /** Chat theo phiên (docs 12 §4): bản nháp đang mở, lịch sử, key kế tiếp, chip người dùng đã chọn */
  session?: {
    id: string;
    nextDraftSeq: number;
    proposals: ProposalRow[];
    messages: { role: string; text: string; structuredData: unknown }[];
    selectedCode?: string;
  };
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
        // Mọi sprint, theo thứ tự TẠO: mã s1, s2… của một sprint không bao giờ đổi (đóng sprint hay thêm
        // sprint có ngày bắt đầu sớm hơn cũng không làm mã cũ trỏ sang sprint khác)
        sprints: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            goal: true,
            status: true,
            startDate: true,
            endDate: true,
            closedAt: true,
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

    // Sprint đích (form / thanh chọn trên giao diện) chỉ nhận sprint chưa đóng như trước
    const sprint = input.sprintId
      ? (project.sprints.find(
          (s) => s.id === input.sprintId && s.status !== SprintStatus.CLOSED,
        ) ?? null)
      : null;
    // Bảng trong prompt: sprint đang mở + 3 sprint đóng gần nhất — đủ để hỏi "sprint trước", không phình prompt
    const closedShown = new Set(
      project.sprints
        .filter((s) => s.status === SprintStatus.CLOSED)
        .sort(
          (a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0),
        )
        .slice(0, 3)
        .map((s) => s.id),
    );
    const shownSprints = project.sprints
      .filter((s) => s.status !== SprintStatus.CLOSED || closedShown.has(s.id))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
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
    const identity = await this.identityBlock(
      project.workspaceId,
      project.members.map((m) => m.user.id),
      codes,
    );
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
            shownSprints.map((s) => [
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
      identity,
    ];

    const dynamicBlocks: PromptBlock[] = [
      { title: 'HÔM NAY', body: isoDate(today) },
    ];
    const facts: BuiltContext['facts'] = {
      memberIds: project.members.map((m) => m.user.id),
      sprintFreeHours: null,
      sprintPlannedHours: null,
    };

    if (input.purpose === 'DECOMPOSE' || input.purpose === 'CHAT') {
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

    if (input.session)
      this.sessionBlocks(
        input.session,
        codes,
        requesterCode,
        requester?.role ?? null,
        dynamicBlocks,
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
        input.purpose === 'CHAT'
          ? [
              input.session?.selectedCode
                ? `Người dùng vừa chọn phương án: ${input.session.selectedCode} (trả lời cho ASK_CLARIFICATION lượt trước)`
                : '',
              sprintCode
                ? `Sprint đang chọn trên giao diện: ${sprintCode}`
                : '',
              input.requirement ?? '',
            ]
              .filter(Boolean)
              .join('\n')
          : input.purpose === 'DECOMPOSE'
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
        // Chat: mọi task mở của dự án (để tham chiếu task thật); form phân rã: chỉ sprint đích / backlog
        ...(input.purpose === 'CHAT'
          ? {}
          : sprint
            ? { sprintId: sprint.id }
            : { sprintId: null }),
      },
      orderBy: { number: 'asc' },
      take: MAX_OPEN_TASKS,
      select: {
        id: true,
        number: true,
        title: true,
        sprintId: true,
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
      title:
        input.purpose === 'CHAT'
          ? 'TASK MỞ TRONG DỰ ÁN (mã t để tham chiếu task thật)'
          : sprint
            ? 'TASK MỞ TRONG SPRINT ĐÍCH'
            : 'TASK MỞ TRONG BACKLOG',
      body: openTasks.length
        ? bang(
            [
              'mã',
              'khoá',
              'tiêu đề',
              'sprint',
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
              t.sprintId ? (codes.codeOf('s', t.sprintId) ?? '?') : 'backlog',
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
    const rows = [...cap.members]
      .sort(
        (a, b) =>
          codeNum(codes.codeOf('u', a.userId)) -
          codeNum(codes.codeOf('u', b.userId)),
      )
      .map((m) => {
        const free = m.freeByDay.reduce((s, d) => s + d.freeHours, 0);
        sprintFree += free;
        const days = m.freeByDay
          .filter((d) => d.isWorkday)
          .map(
            (d) =>
              `${d.date.slice(5)}:${d.freeHours}${d.focusBlocks ? '*' : ''}`,
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
      title: 'BẢNG NĂNG LỰC (backend tính — sự thật)',
      body: [
        `Cửa sổ ${cap.window.from} + ${cap.window.days} ngày; * = ngày có khối tập trung ≥ 2 h; U = mức sử dụng tuần này`,
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

  /** DANH TÍNH (docs 12 §4): admin quản lý — chức danh, phòng ban, quản lý, alias — chỉ để nhận diện, không phải chính sách. */
  private async identityBlock(
    workspaceId: string,
    memberIds: string[],
    codes: CodeBook,
  ): Promise<PromptBlock> {
    const [members, aliases] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, userId: { in: memberIds } },
        select: {
          userId: true,
          role: true,
          department: true,
          title: true,
          managerUserId: true,
          user: { select: { fullName: true, shortName: true } },
        },
      }),
      this.prisma.memberAlias.findMany({
        where: { workspaceId, userId: { in: memberIds } },
        orderBy: { alias: 'asc' },
        select: { userId: true, alias: true },
      }),
    ]);
    const aliasOf = new Map<string, string[]>();
    for (const a of aliases)
      aliasOf.set(a.userId, [...(aliasOf.get(a.userId) ?? []), `"${a.alias}"`]);
    const rows = members
      .sort(
        (a, b) =>
          codeNum(codes.codeOf('u', a.userId)) -
          codeNum(codes.codeOf('u', b.userId)),
      )
      .map((m) => [
        codes.codeOf('u', m.userId),
        m.user.fullName,
        m.user.shortName,
        m.title,
        m.department,
        m.managerUserId
          ? (codes.codeOf('u', m.managerUserId) ?? '(ngoài dự án)')
          : null,
        aliasOf.get(m.userId)?.join(', ') ?? null,
      ]);
    return {
      title:
        'DANH TÍNH (admin quản lý — chỉ để nhận diện người, KHÔNG phải chính sách giao việc; trùng tên → xem chức danh/phòng ban/alias, vẫn không chắc → ASK_CLARIFICATION)',
      body: bang(
        [
          'mã',
          'họ tên',
          'tên gọi',
          'chức danh',
          'phòng ban',
          'quản lý',
          'alias',
        ],
        rows,
      ),
    };
  }

  /** BẢN NHÁP ĐANG MỞ TRONG PHIÊN + LỊCH SỬ PHIÊN (docs 12 §4; 05 §5 mục 4 — lịch sử kèm structured_data). */
  private sessionBlocks(
    session: NonNullable<BuildInput['session']>,
    codes: CodeBook,
    requesterCode: string,
    requesterRole: string | null,
    out: PromptBlock[],
  ) {
    const lines: string[] = [];
    session.proposals.forEach((p, idx) => {
      const payload = p.payload as unknown as ProposalPayload;
      const items = (p.itemStatus ?? {}) as Record<string, string>;
      const applied = (p.appliedMap ?? {}) as Record<string, string>;
      const list = itemsOf(payload.action as ProposalAction).map((i) => {
        const st = items[i.draftKey] ?? 'DRAFT';
        const mark =
          st === 'APPLIED'
            ? ` ✓ ${applied[i.draftKey] ? (codes.codeOf('t', applied[i.draftKey]) ?? 'đã tạo') : 'đã tạo'}`
            : st === 'DISCARDED'
              ? ' ✗ đã bỏ'
              : '';
        const parts = [
          i.estimateHours != null ? `${i.estimateHours}h` : null,
          i.skills?.length ? i.skills.join(' ') : null,
          i.assignee ? `→ ${i.assignee}` : null,
          i.task ? `task ${i.task}` : null,
          i.due ? `hạn ${i.due}` : null,
          i.dependsOn?.length ? `sau ${i.dependsOn.join(',')}` : null,
          i.extra ?? null,
        ].filter(Boolean);
        return `${i.draftKey}${mark} ${i.title} (${parts.join(', ')})`;
      });
      lines.push(
        `[p${idx + 1} · ${p.kind} · ${p.status} · version ${p.version}] ${list.join(' · ')}`,
      );
    });
    out.push({
      title:
        'BẢN NHÁP ĐANG MỞ TRONG PHIÊN (chỉ được sửa/bỏ các key còn DRAFT; item ✓ đã thành task thật → muốn sửa dùng UPDATE_TASK_DRAFT với targetTask; key mới do hệ thống cấp)',
      body: [
        lines.length ? lines.join('\n') : '(chưa có bản nháp nào)',
        `next = d${session.nextDraftSeq}`,
      ].join('\n'),
    });
    if (session.messages.length)
      out.push({
        title:
          'LỊCH SỬ PHIÊN (cũ → mới; dòng trợ lý kèm action đã trả để bạn giải tham chiếu "cái thứ hai")',
        body: session.messages
          .map((m) => {
            const data = m.structuredData
              ? ` ⟶ ${JSON.stringify(m.structuredData).slice(0, 1500)}`
              : '';
            return `[${m.role}] ${m.text.slice(0, 600)}${data}`;
          })
          .join('\n'),
      });
    out.push({
      title: 'NGƯỜI ĐANG CHAT',
      body: `${requesterCode}${requesterRole ? ` · vai ${requesterRole}` : ''} (xem DANH TÍNH để biết phòng ban/quản lý)`,
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

/** Số trong mã ngắn (u12 → 12) để sắp hàng ổn định theo mã. */
function codeNum(code: string | undefined): number {
  return code ? Number(code.slice(1)) : Number.MAX_SAFE_INTEGER;
}
