import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TaskType } from '@prisma/client';
import { ACTIVITY_ACTION_LABEL, sprintActivityDetail } from '@smarttask/shared';
import type {
  BlockItem,
  DataQuerySpec,
  QueryIntent,
  QueryBlock,
  QueryResult,
  StatItem,
  StructuredAction,
} from '@smarttask/shared';
import { AppError } from '../../common/app-error';
import { ProjectAccessService } from '../../common/access/project-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env.schema';
import { WorkloadService } from '../../workload/workload.service';
import { remainingOf } from '../../workload/domain/allocation';
import {
  ForecastService,
  type ForecastCause,
} from '../../forecast/forecast.service';
import { SprintsService } from '../../sprints/sprints.service';
import { CodeBook } from '../context/short-codes';

const DAY = 86_400_000;
const PRIORITY_TONE: Record<
  string,
  'danger' | 'warning' | 'muted' | 'default'
> = {
  URGENT: 'danger',
  HIGH: 'warning',
  MEDIUM: 'default',
  LOW: 'muted',
};
const PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Rất cao',
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
};
const TYPE_LABEL: Record<string, string> = {
  STORY: 'Story',
  TASK: 'Task',
  BUG: 'Bug',
};

const SPRINT_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Kế hoạch',
  ACTIVE: 'Đang chạy',
  CLOSED: 'Đã đóng',
};
const RISK_LABEL: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  UNKNOWN: 'Chưa rõ',
};
const RISK_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  UNKNOWN: 'muted',
};
/** Nguyên nhân đo được của ForecastService (docs 04 §8) bằng lời — số vẫn là số backend đếm. */
const CAUSE_LABEL: Record<ForecastCause['code'], (n: number) => string> = {
  OVERDUE: (n) => `${n} việc quá hạn`,
  UNASSIGNED: (n) => `${n} việc chưa giao`,
  OVERLOADED_MEMBER: (n) => `${n} người quá tải`,
  BLOCKED: (n) => `${n} việc bị chặn`,
  BIG_NOT_STARTED: (n) => `${n} việc lớn (> 16 h) chưa bắt đầu`,
  SCOPE_CREEP: (n) => `phạm vi tăng > 10 % trong ${n} ngày`,
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Trần kích thước kết quả lưu kèm tin nhắn — tránh phình bảng chat_messages và prompt lượt sau. */
const MAX_RESULT_BYTES = 48_000;

/**
 * Cắt bớt khối cho vừa trần: giữ nguyên thẻ số/ghi chú, rút ngắn danh sách dài.
 * Trả về kết quả mới kèm ghi chú nói rõ đã cắt (không im lặng).
 */
export function trimQueryResult(result: QueryResult): QueryResult {
  const size = (r: QueryResult) => Buffer.byteLength(JSON.stringify(r), 'utf8');
  if (size(result) <= MAX_RESULT_BYTES) return result;
  let trimmed: QueryResult = result;
  for (const cap of [15, 8, 4, 2]) {
    trimmed = {
      ...result,
      blocks: result.blocks.map((b) =>
        b.kind === 'task_list' ||
        b.kind === 'people_list' ||
        b.kind === 'activity_list'
          ? { ...b, items: b.items.slice(0, cap) }
          : b.kind === 'agenda'
            ? {
                ...b,
                groups: b.groups
                  .slice(0, cap)
                  .map((g) => ({ ...g, items: g.items.slice(0, cap) })),
              }
            : b.kind === 'table'
              ? { ...b, rows: b.rows.slice(0, cap) }
              : b,
      ),
    };
    if (size(trimmed) <= MAX_RESULT_BYTES) break;
  }
  return {
    ...trimmed,
    blocks: [
      ...trimmed.blocks,
      {
        kind: 'note',
        text: 'Kết quả dài nên đã rút gọn để lưu vào hội thoại — mở màn Công việc để xem đầy đủ.',
        tone: 'muted',
      },
    ],
  };
}

/** Prisma trả Decimal cho giờ — đổi về number để tính và hiển thị. */
const num = (v: unknown): number => (v == null ? 0 : Number(v));

const iso = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** Thứ Hai của tuần chứa `d` (giờ UTC). */
const startOfWeek = (d: Date) => {
  const s = startOfDay(d);
  const dow = (s.getUTCDay() + 6) % 7;
  return new Date(s.getTime() - dow * DAY);
};

/**
 * Quyền theo từng ý định — PHẢI khớp endpoint tương ứng, nếu không hỏi qua chat sẽ là đường vòng
 * lấy dữ liệu mà màn hình không cho xem. 'manage' = PM dự án hoặc OWNER/ADMIN workspace.
 */
const INTENT_PERMISSION: Record<QueryIntent, 'read' | 'manage'> = {
  TASK_LIST: 'read',
  TASK_AGENDA: 'read',
  TASK_DETAIL: 'read',
  TASK_STATS: 'read',
  TASK_BLOCKED: 'read',
  MEMBER_LIST: 'read',
  MEMBER_PROFILE: 'read',
  WORKLOAD_WEEK: 'read',
  CAPACITY_FREE: 'manage', // GET /projects/:id/capacity-table yêu cầu assertManage
  WHO_KNOWS_SKILL: 'read',
  // Bảng ứng viên lộ giờ trống + mức dùng của từng người như bảng năng lực → cùng mức quyền
  TASK_CANDIDATES: 'manage',
  BUS_FACTOR: 'read',
  SPRINT_LIST: 'read',
  SPRINT_PROGRESS: 'read',
  ACTIVITY_FEED: 'read',
  NOTIFICATION_LIST: 'read',
  AI_USAGE: 'manage', // sổ token là dữ liệu quản trị
};

/** Truy vấn nặng (tính tải, bảng năng lực) — chặn thời gian để không giữ khoá phiên chat quá lâu. */
const HEAVY_INTENTS: QueryIntent[] = [
  'WORKLOAD_WEEK',
  'CAPACITY_FREE',
  'TASK_CANDIDATES',
];
const HEAVY_TIMEOUT_MS = 8_000;

export interface QueryContext {
  userId: string;
  projectId: string;
  /** Bảng mã của phiên chat; thiếu thì nạp lại từ phiên (nút "Làm mới" gọi sau nhiều ngày). */
  codes?: CodeBook | null;
  sessionId?: string;
  /** Tin nhắn chứa truy vấn gốc — bảng mã của đúng lượt đó được ưu tiên */
  messageId?: string;
}

/**
 * Chạy TRUY VẤN TRA CỨU cho Trợ lý AI (docs 14). LLM chỉ chọn ý định + bộ lọc; mọi con số ở đây
 * đều đọc thẳng từ CSDL dưới quyền người hỏi. Chỉ đọc, không ghi, không nhận field tự do.
 */
@Injectable()
export class AiQueryService {
  /** Cửa sổ trượt 60 giây theo người dùng — chặn bấm "Làm mới" liên tục làm nặng CSDL. */
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly workload: WorkloadService,
    private readonly config: ConfigService<Env, true>,
    private readonly sprintsSvc: SprintsService,
    private readonly forecast: ForecastService,
  ) {}

  private assertRate(userId: string): void {
    // Đọc thẳng biến môi trường: ConfigService cache theo tiến trình nên đổi trần lúc chạy sẽ không thấy
    const limit =
      Number(process.env.AI_QUERY_RATE_LIMIT_PER_MINUTE) ||
      this.config.get('AI_QUERY_RATE_LIMIT_PER_MINUTE', { infer: true });
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter(
      (t) => now - t < 60_000,
    );
    if (recent.length >= limit) {
      this.hits.set(userId, recent);
      throw new AppError('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS, {
        limit,
        windowSeconds: 60,
      });
    }
    recent.push(now);
    this.hits.set(userId, recent);
    if (this.hits.size > 5_000) this.hits.clear(); // chặn rò bộ nhớ khi nhiều người dùng
  }

  async run(spec: DataQuerySpec, context: QueryContext): Promise<QueryResult> {
    // Quyền: luôn kiểm theo dự án của phiên chat, không tin tham số LLM trả về
    this.assertRate(context.userId);
    const acc = await this.access.assertRead(context.userId, context.projectId);
    const ctx = context.codes
      ? context
      : { ...context, codes: await this.codesOfSession(context) };
    const at = new Date();
    const base = { intent: spec.intent, generatedAt: at.toISOString() };

    // Thiếu quyền → trả ghi chú, KHÔNG trả số (và không ném lỗi làm hỏng lượt chat)
    if (INTENT_PERMISSION[spec.intent] === 'manage' && !acc.canManage)
      return {
        ...base,
        source: { endpoint: '', params: {}, rowCount: 0 },
        blocks: [
          {
            kind: 'note',
            text: 'Mục này chỉ dành cho PM dự án hoặc quản trị workspace.',
            tone: 'warning',
          },
        ],
      };

    if (HEAVY_INTENTS.includes(spec.intent))
      return this.withTimeout(this.dispatch(spec, ctx, acc, at, base), base);
    return this.dispatch(spec, ctx, acc, at, base);
  }

  /** Quá hạn thì trả ghi chú thay vì treo lượt chat (khoá phiên đang giữ). */
  private async withTimeout(
    work: Promise<QueryResult>,
    base: { intent: QueryIntent; generatedAt: string },
  ): Promise<QueryResult> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<QueryResult>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            ...base,
            source: { endpoint: '', params: {}, rowCount: 0 },
            blocks: [
              {
                kind: 'note',
                text: 'Truy vấn mất quá lâu nên đã dừng. Bạn thu hẹp phạm vi (một sprint, một người) rồi hỏi lại giúp nhé.',
                tone: 'warning',
              },
            ],
          }),
        HEAVY_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async dispatch(
    spec: DataQuerySpec,
    ctx: QueryContext,
    acc: { workspaceId: string; canManage: boolean },
    at: Date,
    base: { intent: QueryIntent; generatedAt: string },
  ): Promise<QueryResult> {
    switch (spec.intent) {
      case 'TASK_LIST':
      case 'TASK_AGENDA':
      case 'TASK_BLOCKED':
      case 'TASK_STATS':
        return { ...base, ...(await this.tasks(spec, ctx, at)) };
      case 'TASK_DETAIL':
        return { ...base, ...(await this.taskDetail(spec, ctx)) };
      case 'MEMBER_LIST':
        return { ...base, ...(await this.members(ctx)) };
      case 'MEMBER_PROFILE':
        return { ...base, ...(await this.memberProfile(spec, ctx, at)) };
      case 'WORKLOAD_WEEK':
        return {
          ...base,
          ...(await this.workloadWeeks(ctx, acc.workspaceId, at)),
        };
      case 'CAPACITY_FREE':
        return {
          ...base,
          ...(await this.capacity(spec, ctx)),
        };
      case 'WHO_KNOWS_SKILL':
        return {
          ...base,
          ...(await this.whoKnows(spec, ctx, acc.workspaceId)),
        };
      case 'TASK_CANDIDATES':
        return { ...base, ...(await this.taskCandidates(spec, ctx, at)) };
      case 'BUS_FACTOR':
        return {
          ...base,
          ...(await this.busFactor(spec, ctx, acc.workspaceId)),
        };
      case 'SPRINT_LIST':
        return { ...base, ...(await this.sprints(ctx)) };
      case 'SPRINT_PROGRESS':
        return { ...base, ...(await this.sprintProgress(spec, ctx)) };
      case 'ACTIVITY_FEED':
        return { ...base, ...(await this.activity(spec, ctx)) };
      case 'NOTIFICATION_LIST':
        return { ...base, ...(await this.notifications(spec, ctx)) };
      case 'AI_USAGE':
        return {
          ...base,
          ...(await this.aiUsage(spec, ctx, acc.workspaceId, acc.canManage)),
        };
    }
  }

  /**
   * Nút "Làm mới" chạy lại truy vấn cũ: mã ngắn trong truy vấn chỉ có nghĩa theo bảng mã của lượt đã
   * sinh ra nó. Thứ tự: bảng mã lưu trong chính tin nhắn đó → tin tra cứu mới nhất của phiên → proposal
   * mới nhất (phiên có phân rã/nháp). Chỉ phiên của chính người hỏi.
   */
  private async codesOfSession(ctx: QueryContext): Promise<CodeBook | null> {
    if (!ctx.sessionId) return null;
    const own = { sessionId: ctx.sessionId, session: { userId: ctx.userId } };
    const mapOf = (sd: unknown) =>
      sd && typeof sd === 'object' && 'codeMap' in sd
        ? ((sd as { codeMap?: unknown }).codeMap ?? null)
        : null;
    if (ctx.messageId) {
      const msg = await this.prisma.chatMessage.findFirst({
        where: { id: ctx.messageId, ...own },
        select: { structuredData: true },
      });
      const map = mapOf(msg?.structuredData);
      if (map) return CodeBook.from(map as never);
    }
    const [msgs, proposal] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { ...own, role: 'ASSISTANT' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { structuredData: true, createdAt: true },
      }),
      this.prisma.aiProposal.findFirst({
        where: own,
        orderBy: { createdAt: 'desc' },
        select: { codeMap: true, createdAt: true },
      }),
    ]);
    const msg = msgs.find((m) => mapOf(m.structuredData));
    const fromMsg = msg ? mapOf(msg.structuredData) : null;
    if (fromMsg && (!proposal?.codeMap || msg!.createdAt >= proposal.createdAt))
      return CodeBook.from(fromMsg as never);
    return proposal?.codeMap ? CodeBook.from(proposal.codeMap as never) : null;
  }

  // ── Giải mã tham chiếu ─────────────────────────────────────

  private userId(
    code: string | undefined,
    ctx: QueryContext,
  ): string | undefined {
    if (!code) return undefined;
    if (code === 'me') return ctx.userId;
    const id = ctx.codes?.idOf('u', code);
    if (!id)
      throw AppError.unprocessable('UNKNOWN_CODE', { field: 'assignee', code });
    return id;
  }

  private sprintId(
    spec: DataQuerySpec,
    ctx: QueryContext,
  ): string | undefined | null {
    if (!spec.sprint) return undefined; // để nơi gọi quyết định (sprint đang chạy)
    if (spec.sprint === '__all') return undefined;
    if (spec.sprint === '__backlog') return null;
    const id = ctx.codes?.idOf('s', spec.sprint);
    if (!id)
      throw AppError.unprocessable('UNKNOWN_CODE', {
        field: 'sprint',
        code: spec.sprint,
      });
    return id;
  }

  private taskId(code: string | undefined, ctx: QueryContext): string {
    const id = code ? ctx.codes?.idOf('t', code) : undefined;
    if (!id)
      throw AppError.unprocessable('UNKNOWN_CODE', {
        field: 'task',
        code: code ?? null,
      });
    return id;
  }

  private range(
    spec: DataQuerySpec,
    at: Date,
  ): { from?: Date; to?: Date; overdue?: boolean; noDue?: boolean } {
    const r = spec.filters.dueRange;
    if (!r) return {};
    if (r.preset === 'TODAY')
      return {
        from: startOfDay(at),
        to: new Date(startOfDay(at).getTime() + DAY - 1),
      };
    if (r.preset === 'TOMORROW') {
      const d = new Date(startOfDay(at).getTime() + DAY);
      return { from: d, to: new Date(d.getTime() + DAY - 1) };
    }
    if (r.preset === 'THIS_WEEK') {
      const s = startOfWeek(at);
      return { from: s, to: new Date(s.getTime() + 7 * DAY - 1) };
    }
    if (r.preset === 'NEXT_WEEK') {
      const s = new Date(startOfWeek(at).getTime() + 7 * DAY);
      return { from: s, to: new Date(s.getTime() + 7 * DAY - 1) };
    }
    if (r.preset === 'OVERDUE') return { overdue: true, to: startOfDay(at) };
    if (r.preset === 'NO_DUE') return { noDue: true };
    return {
      from: r.from ? new Date(r.from) : undefined,
      to: r.to ? new Date(`${r.to}T23:59:59.999Z`) : undefined,
    };
  }

  // ── Công việc ──────────────────────────────────────────────

  private async tasks(spec: DataQuerySpec, ctx: QueryContext, at: Date) {
    const f = spec.filters;
    const sprint = this.sprintId(spec, ctx);
    const activeSprint =
      spec.sprint === undefined
        ? await this.prisma.sprint.findFirst({
            where: { projectId: ctx.projectId, status: 'ACTIVE' },
            select: { id: true },
          })
        : null;
    const sprintFilter =
      sprint === null
        ? { sprintId: null }
        : sprint
          ? { sprintId: sprint }
          : activeSprint
            ? { sprintId: activeSprint.id }
            : {};
    const rng = this.range(spec, at);
    const assigneeIds = (f.assignee ?? [])
      .map((c) => this.userId(c, ctx))
      .filter((x): x is string => !!x);

    const where: Prisma.TaskWhereInput = {
      projectId: ctx.projectId,
      deletedAt: null,
      parentId: null,
      ...sprintFilter,
      ...(f.status === 'DONE'
        ? { completedAt: { not: null } }
        : f.status === 'ALL'
          ? {}
          : { completedAt: null }),
      ...(f.taskType?.length ? { type: { in: f.taskType as TaskType[] } } : {}),
      ...(f.priority?.length ? { priority: { in: f.priority } } : {}),
      ...(assigneeIds.length
        ? { assignees: { some: { userId: { in: assigneeIds } } } }
        : {}),
      ...(f.unassignedOnly ? { assignees: { none: {} } } : {}),
      ...(f.q ? { title: { contains: f.q.trim(), mode: 'insensitive' } } : {}),
      ...(rng.noDue ? { dueDate: null } : {}),
      ...(rng.overdue ? { dueDate: { lt: rng.to } } : {}),
      ...(!rng.overdue && !rng.noDue && (rng.from || rng.to)
        ? {
            dueDate: {
              ...(rng.from ? { gte: rng.from } : {}),
              ...(rng.to ? { lte: rng.to } : {}),
            },
          }
        : {}),
      ...(spec.intent === 'TASK_BLOCKED'
        ? { dependsOn: { some: { dependsOn: { completedAt: null } } } }
        : {}),
    };

    const orderBy: Prisma.TaskOrderByWithRelationInput =
      spec.sort?.field === 'PRIORITY'
        ? { priority: spec.sort.dir === 'DESC' ? 'desc' : 'asc' }
        : spec.sort?.field === 'REMAINING_HOURS'
          ? { remainingHours: spec.sort.dir === 'DESC' ? 'desc' : 'asc' }
          : spec.sort?.field === 'UPDATED_AT'
            ? { updatedAt: spec.sort.dir === 'DESC' ? 'desc' : 'asc' }
            : spec.sort?.field === 'NUMBER'
              ? { number: spec.sort.dir === 'DESC' ? 'desc' : 'asc' }
              : { dueDate: spec.sort?.dir === 'DESC' ? 'desc' : 'asc' };

    const [rows, total, project] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy,
        take: spec.limit,
        select: {
          id: true,
          number: true,
          title: true,
          priority: true,
          type: true,
          dueDate: true,
          remainingHours: true,
          estimateHours: true,
          progress: true,
          completedAt: true,
          column: { select: { name: true } },
          assignees: {
            select: { user: { select: { fullName: true, shortName: true } } },
          },
          dependsOn: {
            select: {
              dependsOn: { select: { number: true, completedAt: true } },
            },
          },
        },
      }),
      this.prisma.task.count({ where }),
      this.prisma.project.findUniqueOrThrow({
        where: { id: ctx.projectId },
        select: { key: true },
      }),
    ]);

    const today = startOfDay(at).getTime();
    const toItem = (r: (typeof rows)[number]): BlockItem => {
      const overdue =
        !r.completedAt && r.dueDate ? r.dueDate.getTime() < today : false;
      const people = r.assignees.map(
        (a) => a.user.shortName ?? a.user.fullName,
      );
      const blockers = r.dependsOn
        .filter((d) => !d.dependsOn.completedAt)
        .map((d) => `${project.key}-${d.dependsOn.number}`);
      return {
        ref: { type: 'task', id: r.id, key: `${project.key}-${r.number}` },
        title: r.title,
        badges: [
          {
            text: PRIORITY_LABEL[r.priority] ?? r.priority,
            tone: PRIORITY_TONE[r.priority],
          },
          { text: TYPE_LABEL[r.type] ?? r.type, tone: 'muted' },
          ...(r.completedAt
            ? [{ text: 'Xong', tone: 'success' as const }]
            : []),
          ...(overdue ? [{ text: 'Quá hạn', tone: 'danger' as const }] : []),
        ],
        meta: [
          {
            icon: 'user' as const,
            text: people.length ? people.join(', ') : 'chưa giao',
          },
          ...(r.remainingHours != null
            ? [
                {
                  icon: 'clock' as const,
                  text: `${num(r.remainingHours)}h còn lại`,
                },
              ]
            : []),
          ...(r.dueDate
            ? [{ icon: 'calendar' as const, text: `hạn ${iso(r.dueDate)}` }]
            : []),
          ...(blockers.length
            ? [{ icon: 'link' as const, text: `chờ ${blockers.join(', ')}` }]
            : []),
        ],
      };
    };

    const params = {
      sprintId: sprintFilter,
      status: spec.filters.status ?? 'OPEN',
      dueRange: spec.filters.dueRange ?? null,
      limit: spec.limit,
    };
    const source = {
      endpoint: 'GET /projects/:id/tasks',
      params,
      rowCount: rows.length,
    };

    if (spec.intent === 'TASK_STATS') {
      // Thống kê phải tính trên TOÀN BỘ tập khớp lọc — `limit` chỉ dành cho danh sách hiển thị
      const all = await this.prisma.task.findMany({
        where,
        select: {
          id: true,
          priority: true,
          dueDate: true,
          startDate: true,
          createdAt: true,
          completedAt: true,
          progress: true,
          remainingHours: true,
          estimateHours: true,
          column: { select: { name: true } },
          _count: { select: { assignees: true } },
        },
      });
      const byColumn = new Map<string, number>();
      const byPriority = new Map<string, number>();
      let overdue = 0;
      let unassigned = 0;
      let hours = 0;
      for (const r of all) {
        byColumn.set(r.column.name, (byColumn.get(r.column.name) ?? 0) + 1);
        byPriority.set(r.priority, (byPriority.get(r.priority) ?? 0) + 1);
        if (!r.completedAt && r.dueDate && r.dueDate.getTime() < today)
          overdue += 1;
        if (r._count.assignees === 0) unassigned += 1;
        // Cùng cách tính "còn lại" với burn-down/forecast (docs 04 §1)
        hours += remainingOf({
          ...r,
          estimateHours: r.estimateHours === null ? null : num(r.estimateHours),
          remainingHours:
            r.remainingHours === null ? null : num(r.remainingHours),
        });
      }
      const stats: StatItem[] = [
        { label: 'Công việc', value: all.length },
        {
          label: 'Quá hạn',
          value: overdue,
          tone: overdue ? 'danger' : 'muted',
        },
        {
          label: 'Chưa giao',
          value: unassigned,
          tone: unassigned ? 'warning' : 'muted',
        },
        { label: 'Giờ còn lại', value: Math.round(hours * 10) / 10, unit: 'h' },
      ];
      const blocks: QueryBlock[] = [
        { kind: 'stat_row', items: stats },
        {
          kind: 'bar_chart',
          series: [...byColumn].map(([label, value]) => ({ label, value })),
          unit: 'việc',
        },
        {
          kind: 'table',
          columns: [
            { key: 'priority', label: 'Ưu tiên' },
            { key: 'count', label: 'Số việc', align: 'right' },
          ],
          rows: [...byPriority].map(([p, c]) => ({
            cells: { priority: PRIORITY_LABEL[p] ?? p, count: c },
          })),
        },
      ];
      return { source, blocks };
    }

    if (rows.length === 0)
      return {
        source,
        blocks: [
          {
            kind: 'empty',
            title: 'Không có công việc khớp bộ lọc',
            description: 'Thử nới bộ lọc hoặc hỏi lại theo sprint khác.',
          } as QueryBlock,
        ],
      };

    if (spec.intent === 'TASK_AGENDA' || spec.groupBy === 'DUE_DATE') {
      const groups = new Map<string, BlockItem[]>();
      for (const r of rows) {
        const key = r.dueDate ? iso(r.dueDate) : 'no-due';
        groups.set(key, [...(groups.get(key) ?? []), toItem(r)]);
      }
      const labelOf = (k: string) => {
        if (k === 'no-due') return 'Chưa đặt hạn';
        const d = new Date(`${k}T00:00:00.000Z`).getTime();
        if (d === today) return `Hôm nay · ${k.slice(8, 10)}/${k.slice(5, 7)}`;
        if (d === today + DAY)
          return `Ngày mai · ${k.slice(8, 10)}/${k.slice(5, 7)}`;
        if (d < today) return `Quá hạn · ${k.slice(8, 10)}/${k.slice(5, 7)}`;
        return `${k.slice(8, 10)}/${k.slice(5, 7)}`;
      };
      const blocks: QueryBlock[] = [
        {
          kind: 'agenda',
          groups: [...groups.entries()]
            .sort(([a], [b]) =>
              a === 'no-due' ? 1 : b === 'no-due' ? -1 : a.localeCompare(b),
            )
            .map(([k, items]) => ({
              label: labelOf(k),
              tone:
                k !== 'no-due' &&
                new Date(`${k}T00:00:00.000Z`).getTime() < today
                  ? ('danger' as const)
                  : undefined,
              items,
            })),
        },
      ];
      return { source, blocks, truncated: this.trunc(rows.length, total) };
    }

    return {
      source,
      blocks: [{ kind: 'task_list', items: rows.map(toItem) } as QueryBlock],
      truncated: this.trunc(rows.length, total),
    };
  }

  private trunc(shown: number, total: number) {
    return shown < total ? { shown, total } : undefined;
  }

  private async taskDetail(spec: DataQuerySpec, ctx: QueryContext) {
    const id = this.taskId(spec.filters.task, ctx);
    const t = await this.prisma.task.findFirst({
      where: { id, projectId: ctx.projectId, deletedAt: null },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        priority: true,
        type: true,
        progress: true,
        estimateHours: true,
        remainingHours: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        column: { select: { name: true } },
        sprint: { select: { name: true } },
        assignees: {
          select: { user: { select: { fullName: true, shortName: true } } },
        },
        skills: {
          select: { minLevel: true, skill: { select: { name: true } } },
        },
        project: { select: { key: true } },
        _count: {
          select: { comments: true, attachments: true, subtasks: true },
        },
      },
    });
    if (!t) throw AppError.notFound({ task: spec.filters.task });
    const key = `${t.project.key}-${t.number}`;
    const blocks: QueryBlock[] = [
      {
        kind: 'person_card',
        item: {
          ref: { type: 'task', id: t.id, key },
          title: t.title,
          subtitle: t.description?.slice(0, 300) ?? undefined,
          badges: [
            { text: t.column.name, tone: 'info' },
            {
              text: PRIORITY_LABEL[t.priority] ?? t.priority,
              tone: PRIORITY_TONE[t.priority],
            },
            ...(t.sprint
              ? [{ text: t.sprint.name, tone: 'muted' as const }]
              : []),
          ],
          meta: [
            {
              icon: 'user',
              text:
                t.assignees
                  .map((a) => a.user.shortName ?? a.user.fullName)
                  .join(', ') || 'chưa giao',
            },
            ...(t.dueDate
              ? [{ icon: 'calendar' as const, text: `hạn ${iso(t.dueDate)}` }]
              : []),
            ...(t.skills.length
              ? [
                  {
                    icon: 'flag' as const,
                    text: t.skills
                      .map((s) => `${s.skill.name} ≥ ${s.minLevel}`)
                      .join(', '),
                  },
                ]
              : []),
          ],
        },
        stats: [
          { label: 'Tiến độ', value: t.progress, unit: '%' },
          {
            label: 'Giờ ước / còn',
            value: `${num(t.estimateHours)} / ${num(t.remainingHours)}`,
            unit: 'h',
          },
          { label: 'Việc con', value: t._count.subtasks },
          { label: 'Bình luận', value: t._count.comments },
        ],
      },
    ];
    return {
      source: {
        endpoint: 'GET /tasks/:id',
        params: { task: key },
        rowCount: 1,
      },
      blocks,
    };
  }

  // ── Con người ──────────────────────────────────────────────

  private async members(ctx: QueryContext) {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId: ctx.projectId },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
            email: true,
            workspaceMembers: {
              select: { title: true, department: true },
              take: 1,
            },
            userSkills: {
              select: { level: true, skill: { select: { name: true } } },
              orderBy: { level: 'desc' },
              take: 4,
            },
            taskAssignees: {
              where: {
                task: {
                  projectId: ctx.projectId,
                  deletedAt: null,
                  completedAt: null,
                },
              },
              select: { task: { select: { remainingHours: true } } },
            },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    const items: BlockItem[] = rows.map((m) => {
      const hours = m.user.taskAssignees.reduce(
        (sum, a) => sum + num(a.task.remainingHours),
        0,
      );
      const w = m.user.workspaceMembers[0];
      return {
        ref: {
          type: 'user',
          id: m.user.id,
          key: m.user.shortName ?? m.user.fullName,
        },
        title: m.user.fullName,
        subtitle:
          [w?.title, w?.department].filter(Boolean).join(' · ') || m.user.email,
        badges: [
          { text: m.role, tone: m.role === 'PM' ? 'info' : 'muted' },
          ...m.user.userSkills.map((sk) => ({
            text: `${sk.skill.name} ${sk.level}`,
            tone: 'muted' as const,
          })),
        ],
        meta: [
          {
            icon: 'clock',
            text: `${m.user.taskAssignees.length} việc đang mở · ${Math.round(hours * 10) / 10}h còn lại`,
          },
        ],
      };
    });
    return {
      source: {
        endpoint: 'GET /projects/:id (members)',
        params: {},
        rowCount: items.length,
      },
      blocks: (items.length
        ? [{ kind: 'people_list', items }]
        : [
            { kind: 'empty', title: 'Dự án chưa có thành viên' },
          ]) as QueryBlock[],
    };
  }

  private async memberProfile(
    spec: DataQuerySpec,
    ctx: QueryContext,
    at: Date,
  ) {
    const userId = this.userId(spec.filters.user ?? 'me', ctx)!;
    const [user, tasks] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          shortName: true,
          email: true,
          userSkills: {
            select: {
              level: true,
              verifiedAt: true,
              skill: { select: { name: true } },
            },
            orderBy: { level: 'desc' },
            take: 8,
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          projectId: ctx.projectId,
          deletedAt: null,
          completedAt: null,
          assignees: { some: { userId } },
        },
        orderBy: { dueDate: 'asc' },
        take: spec.limit,
        select: {
          id: true,
          number: true,
          title: true,
          priority: true,
          type: true,
          dueDate: true,
          remainingHours: true,
          project: { select: { key: true } },
        },
      }),
    ]);
    const today = startOfDay(at).getTime();
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate.getTime() < today,
    ).length;
    const hours = tasks.reduce((sum, t) => sum + num(t.remainingHours), 0);
    const blocks: QueryBlock[] = [
      {
        kind: 'person_card',
        item: {
          ref: {
            type: 'user',
            id: user.id,
            key: user.shortName ?? user.fullName,
          },
          title: user.fullName,
          subtitle: user.email,
          badges: user.userSkills.map((sk) => ({
            text: `${sk.skill.name} ${sk.level}${sk.verifiedAt ? ' ✓' : ''}`,
            tone: 'muted' as const,
          })),
        },
        stats: [
          { label: 'Việc đang mở', value: tasks.length },
          {
            label: 'Quá hạn',
            value: overdue,
            tone: overdue ? 'danger' : 'muted',
          },
          {
            label: 'Giờ còn lại',
            value: Math.round(hours * 10) / 10,
            unit: 'h',
          },
        ],
      },
      tasks.length
        ? {
            kind: 'task_list',
            items: tasks.map((t) => ({
              ref: {
                type: 'task' as const,
                id: t.id,
                key: `${t.project.key}-${t.number}`,
              },
              title: t.title,
              badges: [
                {
                  text: PRIORITY_LABEL[t.priority] ?? t.priority,
                  tone: PRIORITY_TONE[t.priority],
                },
              ],
              meta: [
                ...(t.dueDate
                  ? [
                      {
                        icon: 'calendar' as const,
                        text: `hạn ${iso(t.dueDate)}`,
                      },
                    ]
                  : []),
                ...(t.remainingHours != null
                  ? [
                      {
                        icon: 'clock' as const,
                        text: `${num(t.remainingHours)}h`,
                      },
                    ]
                  : []),
              ],
            })),
          }
        : { kind: 'empty', title: 'Không có việc đang mở' },
    ];
    return {
      source: {
        endpoint: 'GET /projects/:id/tasks?assigneeId=',
        params: { userId },
        rowCount: tasks.length,
      },
      blocks,
    };
  }

  private async workloadWeeks(
    ctx: QueryContext,
    workspaceId: string,
    at: Date,
  ) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: ctx.projectId },
      select: {
        user: { select: { id: true, fullName: true, shortName: true } },
      },
    });
    const { users, settings, spread } = await this.workload.computeUsers(
      workspaceId,
      members.map((m) => m.user.id),
      startOfWeek(at),
      4,
      { projectId: ctx.projectId, today: at },
    );
    const nameOf = new Map(
      members.map((m) => [m.user.id, m.user.shortName ?? m.user.fullName]),
    );
    const toneOf = (u: number) =>
      u >= settings.workload.thresholds.overload
        ? 'danger'
        : u >= settings.workload.thresholds.full
          ? 'warning'
          : u >= settings.workload.thresholds.high
            ? 'info'
            : 'success';
    const columns =
      users[0]?.weeks.map((w) => `Tuần ${w.weekStart.slice(5)}`) ?? [];
    const blocks: QueryBlock[] = [
      {
        kind: 'stat_row',
        items: [
          {
            label: 'Spread nhóm',
            value: Math.round(spread * 100),
            unit: '%',
            hint: `mục tiêu ≤ ${Math.round(settings.workload.fairnessTarget * 100)}%`,
          },
        ],
      },
      {
        kind: 'heatmap',
        columns,
        rows: users.map((u) => ({
          label: nameOf.get(u.userId) ?? u.userId.slice(0, 8),
          ref: { type: 'user', id: u.userId },
          cells: u.weeks.map((w) => ({
            text: `${Math.round(w.utilization * 100)}%`,
            tone: toneOf(w.utilization),
          })),
        })),
      },
    ];
    return {
      source: {
        endpoint: 'GET /projects/:id/workload',
        params: { weeks: 4 },
        rowCount: users.length,
      },
      blocks,
    };
  }

  private async capacity(spec: DataQuerySpec, ctx: QueryContext) {
    const table = await this.workload.capacityTable(ctx.projectId, {});
    const rows = table.members.slice(0, spec.limit).map((m) => ({
      ref: {
        type: 'user' as const,
        id: m.userId,
        key: m.shortName ?? m.fullName,
      },
      cells: {
        member: m.fullName,
        utilization: `${Math.round(m.utilizationBefore * 100)}%`,
        free: `${Math.round(m.freeByDay.reduce((s, d) => s + d.freeHours, 0) * 10) / 10}h`,
        skills: m.skills.map((s) => `${s.name} ${s.level}`).join(', ') || '—',
      },
    }));
    return {
      source: {
        endpoint: 'GET /projects/:id/capacity-table',
        params: { window: table.window },
        rowCount: rows.length,
      },
      blocks: [
        {
          kind: 'note',
          text: `Cửa sổ ${table.window.from} + ${table.window.days} ngày · ${table.tasks.length} việc chưa giao`,
          tone: 'muted',
        },
        {
          kind: 'table',
          columns: [
            { key: 'member', label: 'Thành viên' },
            { key: 'utilization', label: 'Mức dùng', align: 'right' },
            { key: 'free', label: 'Giờ trống', align: 'right' },
            { key: 'skills', label: 'Kỹ năng' },
          ],
          rows,
        },
      ] as QueryBlock[],
    };
  }

  private async whoKnows(
    spec: DataQuerySpec,
    ctx: QueryContext,
    workspaceId: string,
  ) {
    const skillId = spec.filters.skill
      ? ctx.codes?.idOf('k', spec.filters.skill)
      : undefined;
    if (!skillId)
      throw AppError.unprocessable('UNKNOWN_CODE', {
        field: 'skill',
        code: spec.filters.skill ?? null,
      });
    const minLevel = spec.filters.minLevel ?? 3;
    const rows = await this.prisma.userSkill.findMany({
      where: {
        skillId,
        level: { gte: minLevel },
        user: { workspaceMembers: { some: { workspaceId } } },
      },
      orderBy: { level: 'desc' },
      take: spec.limit,
      select: {
        level: true,
        verifiedAt: true,
        skill: { select: { name: true } },
        user: { select: { id: true, fullName: true, shortName: true } },
      },
    });
    const skillName =
      rows[0]?.skill.name ??
      (
        await this.prisma.skill.findUnique({
          where: { id: skillId },
          select: { name: true },
        })
      )?.name ??
      '';
    return {
      source: {
        endpoint: 'GET /workspaces/:id/skill-matrix',
        params: { skill: skillName, minLevel },
        rowCount: rows.length,
      },
      blocks: (rows.length
        ? [
            {
              kind: 'people_list',
              items: rows.map((r) => ({
                ref: {
                  type: 'user' as const,
                  id: r.user.id,
                  key: r.user.shortName ?? r.user.fullName,
                },
                title: r.user.fullName,
                badges: [
                  {
                    text: `${r.skill.name} mức ${r.level}`,
                    tone:
                      r.level >= 4 ? ('success' as const) : ('muted' as const),
                  },
                  ...(r.verifiedAt
                    ? [{ text: 'đã xác nhận', tone: 'info' as const }]
                    : []),
                ],
              })),
            },
          ]
        : [
            {
              kind: 'empty',
              title: `Chưa ai khai ${skillName} từ mức ${minLevel}`,
              description:
                'Nhờ thành viên cập nhật ở màn Nhân sự › Kỹ năng của tôi.',
            },
          ]) as QueryBlock[],
    };
  }

  /**
   * "Ai làm được việc này?" — cho một task THẬT (`filters.task`) hoặc một BẢN NHÁP đang mở trong phiên
   * (`filters.draft`). Trả bảng SỰ THẬT từng người (khớp kỹ năng, giờ hiệu dụng, giờ trống trước hạn,
   * mức dùng) để LLM và người đọc tự cân nhắc — backend không chọn hộ, không loại ai khỏi bảng.
   */
  private async taskCandidates(
    spec: DataQuerySpec,
    ctx: QueryContext,
    at: Date,
  ) {
    const code = spec.filters.task ?? spec.filters.draft;
    if (!code)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        field: 'task',
        message: 'Thiếu mã task (tN) hoặc mã bản nháp (dN)',
      });
    const subject = spec.filters.task
      ? { taskId: ctx.codes?.idOf('t', spec.filters.task) }
      : await this.draftOfSession(ctx, spec.filters.draft!);
    if (!subject || ('taskId' in subject && !subject.taskId))
      throw AppError.unprocessable('UNKNOWN_CODE', { field: 'task', code });

    const result = await this.workload.candidatesFor(ctx.projectId, subject, {
      today: at,
    });
    if (!result)
      throw AppError.unprocessable('UNKNOWN_CODE', { field: 'task', code });
    const { subject: s, rows } = result;
    const required = s.requiredSkills.length
      ? s.requiredSkills.map((r) => `${r.name} ≥ ${r.minLevel}`).join(', ')
      : 'không khai kỹ năng yêu cầu';
    return {
      source: {
        endpoint: 'GET /projects/:id/capacity-table',
        params: { task: s.key ?? code, window: result.window },
        rowCount: rows.length,
      },
      blocks: [
        {
          kind: 'note',
          text: `${s.key ? `${s.key} · ` : ''}${s.title} · ${s.hours === null ? 'chưa ước lượng' : `${s.hours}h còn lại`}${s.difficulty ? ` · độ khó ${s.difficulty}` : ''}${s.dueDate ? ` · hạn ${s.dueDate}` : ' · chưa có hạn'} · cần: ${required}`,
          tone: 'muted',
        },
        {
          kind: 'table',
          columns: [
            { key: 'member', label: 'Thành viên' },
            { key: 'match', label: 'Khớp kỹ năng', align: 'right' },
            { key: 'effort', label: 'Giờ hiệu dụng', align: 'right' },
            {
              key: 'free',
              label: s.dueDate ? 'Trống trước hạn' : 'Giờ trống',
              align: 'right',
            },
            { key: 'util', label: 'Mức dùng', align: 'right' },
          ],
          rows: rows.slice(0, spec.limit).map((r) => ({
            ref: {
              type: 'user' as const,
              id: r.userId,
              key: r.shortName ?? r.fullName,
            },
            cells: {
              member: r.fullName,
              match: `${Math.round(r.skillMatch.avg * 100)}%${r.skillMatch.missing.length ? ` (thiếu ${r.skillMatch.missing.join(', ')})` : ''}`,
              effort: r.hoursEff === null ? '—' : `${r.hoursEff}h`,
              free: `${r.freeBeforeDue ?? r.freeTotal}h`,
              util: `${Math.round(r.utilizationBefore * 100)}%`,
            },
          })),
        },
      ] as QueryBlock[],
    };
  }

  /** Đọc một bản nháp đang mở của PHIÊN để lấy kỹ năng/ước lượng/hạn — việc chưa ghi nên không có trong CSDL task. */
  private async draftOfSession(ctx: QueryContext, draftKey: string) {
    if (!ctx.sessionId) return null;
    const rows = await this.prisma.aiProposal.findMany({
      where: {
        sessionId: ctx.sessionId,
        projectId: ctx.projectId,
        userId: ctx.userId,
        status: 'DRAFT',
      },
      select: { payload: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    for (const row of rows) {
      const action = (row.payload as { action?: StructuredAction } | null)
        ?.action;
      if (!action) continue;
      const list =
        action.type === 'DECOMPOSE_PROPOSAL'
          ? action.tasks
          : action.type === 'CREATE_TASK_DRAFT'
            ? action.drafts
            : [];
      const item = list.find((t) => t.draftKey === draftKey);
      if (!item) continue;
      return {
        title: item.title,
        estimateHours: item.estimateHours ?? null,
        difficulty: item.difficulty ?? null,
        dueDate:
          ('due' in item && typeof item.due === 'string' ? item.due : null) ??
          null,
        requiredSkills: item.requiredSkills
          .map((r) => ({
            skillId: ctx.codes?.idOf('k', r.skill) ?? '',
            minLevel: r.minLevel,
          }))
          .filter((r) => r.skillId),
      };
    }
    return null;
  }

  private async busFactor(
    spec: DataQuerySpec,
    ctx: QueryContext,
    workspaceId: string,
  ) {
    const minLevel = spec.filters.minLevel ?? 3;
    const skills = await this.prisma.skill.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        userSkills: {
          where: {
            level: { gte: minLevel },
            user: { workspaceMembers: { some: { workspaceId } } },
          },
          select: { userId: true },
        },
      },
    });
    const risky = skills
      .filter((sk) => sk.userSkills.length <= 1)
      .slice(0, spec.limit);
    return {
      source: {
        endpoint: 'GET /workspaces/:id/skill-matrix (busFactor)',
        params: { minLevel },
        rowCount: risky.length,
      },
      blocks: (risky.length
        ? [
            {
              kind: 'note',
              text: `${risky.length} kỹ năng chỉ có ≤ 1 người đạt mức ${minLevel} — rủi ro khi người đó nghỉ.`,
              tone: 'warning',
            },
            {
              kind: 'table',
              columns: [
                { key: 'skill', label: 'Kỹ năng' },
                { key: 'holders', label: 'Số người đạt', align: 'right' },
              ],
              rows: risky.map((sk) => ({
                cells: { skill: sk.name, holders: sk.userSkills.length },
              })),
            },
          ]
        : [
            {
              kind: 'empty',
              title: 'Không có kỹ năng nào rủi ro',
              description: `Mọi kỹ năng đều có ≥ 2 người đạt mức ${minLevel}.`,
            },
          ]) as QueryBlock[],
    };
  }

  // ── Sprint & hoạt động ─────────────────────────────────────

  /** Cùng nguồn với tab Sprint (`GET /projects/:id/sprints`) — không tự đếm lại. */
  private async sprints(ctx: QueryContext) {
    const rows = (await this.sprintsSvc.list(ctx.userId, ctx.projectId))
      .slice()
      .sort((x, y) => y.startDate.getTime() - x.startDate.getTime());
    return {
      source: {
        endpoint: 'GET /projects/:id/sprints',
        params: {},
        rowCount: rows.length,
      },
      blocks: [
        {
          kind: 'table',
          columns: [
            { key: 'name', label: 'Sprint' },
            { key: 'status', label: 'Trạng thái' },
            { key: 'time', label: 'Thời gian' },
            { key: 'tasks', label: 'Xong / việc', align: 'right' },
            { key: 'hours', label: 'Giờ còn lại', align: 'right' },
          ],
          rows: rows.map((s) => ({
            ref: { type: 'sprint' as const, id: s.id, key: s.name },
            cells: {
              name: s.name,
              status: SPRINT_STATUS_LABEL[s.status] ?? s.status,
              time: `${iso(s.startDate)} → ${iso(s.endDate)}`,
              tasks: `${s.doneCount}/${s.taskCount}`,
              hours: `${round1(s.remainingHours)} h`,
            },
          })),
        },
      ] as QueryBlock[],
    };
  }

  /**
   * Tiến độ một sprint — số lấy NGUYÊN VĂN từ `ForecastService` (cùng nguồn với Dashboard) và
   * `SprintsService.list` (cùng nguồn với tab Sprint). Không tự cộng giờ ở đây.
   */
  private async sprintProgress(spec: DataQuerySpec, ctx: QueryContext) {
    const empty = (text: string) => ({
      source: {
        endpoint: 'GET /projects/:id/sprints',
        params: {},
        rowCount: 0,
      },
      blocks: [{ kind: 'note', text, tone: 'muted' }] as QueryBlock[],
    });
    if (spec.sprint === '__all')
      return empty(
        'Tiến độ chỉ có nghĩa cho từng sprint — hãy hỏi về một sprint cụ thể (hoặc bỏ trống để xem sprint đang chạy).',
      );
    if (spec.sprint === '__backlog')
      return empty('Backlog không phải sprint nên không có tiến độ.');
    const id = this.sprintId(spec, ctx);
    const sprint = await this.prisma.sprint.findFirst({
      where: id
        ? { id, projectId: ctx.projectId }
        : { projectId: ctx.projectId, status: 'ACTIVE' },
      select: { id: true, name: true, status: true },
    });
    if (!sprint)
      return {
        source: {
          endpoint: 'GET /projects/:id/sprints',
          params: {},
          rowCount: 0,
        },
        blocks: [
          { kind: 'empty', title: 'Chưa có sprint đang chạy' },
        ] as QueryBlock[],
      };
    const [bd, fc, list] = await Promise.all([
      this.forecast.burndown(ctx.userId, sprint.id),
      this.forecast.forecast(ctx.userId, sprint.id),
      this.sprintsSvc.list(ctx.userId, ctx.projectId),
    ]);
    const row = list.find((x) => x.id === sprint.id);
    const active = sprint.status === 'ACTIVE';
    const closed = sprint.status === 'CLOSED';
    const overdue = fc.causes.find((c) => c.code === 'OVERDUE')?.count ?? 0;
    const stats: StatItem[] = [
      {
        label: sprint.name,
        value: SPRINT_STATUS_LABEL[sprint.status] ?? sprint.status,
      },
      {
        label: 'Xong',
        value: `${row?.doneCount ?? 0}/${row?.taskCount ?? 0}`,
        unit: 'việc',
      },
      closed
        ? {
            label: 'Còn lại lúc đóng',
            value: fc.final ? round1(fc.final.remainingHours) : '—',
            unit: fc.final ? 'h' : undefined,
            hint: fc.final ? undefined : 'đóng trước khi có bản chụp cuối',
          }
        : { label: 'Giờ còn lại', value: round1(fc.remainingHours), unit: 'h' },
      { label: 'Vận tốc', value: fc.velocity, unit: 'h/ngày' },
    ];
    if (active)
      stats.push(
        { label: 'Còn', value: fc.workdaysLeft, unit: 'ngày làm việc' },
        { label: 'ETA', value: fc.eta ?? '—' },
        {
          label: 'Rủi ro',
          value: RISK_LABEL[fc.riskLevel] ?? fc.riskLevel,
          tone: RISK_TONE[fc.riskLevel],
        },
        {
          label: 'Quá hạn',
          value: overdue,
          tone: overdue ? 'danger' : 'muted',
        },
      );
    const byDate = new Map<
      string,
      { label: string; value: number | null; compare: number | null }
    >();
    for (const p of bd.ideal)
      byDate.set(p.date, { label: p.date, value: null, compare: p.ideal });
    for (const p of bd.actual)
      byDate.set(p.date, {
        label: p.date,
        compare: byDate.get(p.date)?.compare ?? null,
        value: p.remaining,
      });
    const blocks: QueryBlock[] = [
      { kind: 'stat_row', items: stats },
      {
        kind: 'line_chart',
        unit: 'h còn lại',
        compareLabel: 'Lý tưởng',
        points: [...byDate.values()].sort((x, y) =>
          x.label.localeCompare(y.label),
        ),
      },
    ];
    if (fc.causes.length)
      blocks.push({
        kind: 'note',
        tone: 'warning',
        text: `Nguyên nhân đo được: ${fc.causes
          .map((c) => CAUSE_LABEL[c.code](c.count))
          .join(' · ')}.`,
      });
    if (bd.gaps.length)
      blocks.push({
        kind: 'note',
        tone: 'muted',
        text: `Thiếu bản chụp ${bd.gaps.length} ngày làm việc — đường thực tế chỉ nối các ngày có số liệu.`,
      });
    // Theo người (docs 02/07 D1) — cùng nguồn với trang Sprint (SprintsService.summary). Xếp theo giờ còn lại
    // chỉ để đọc cho dễ; không có cột điểm, không có chữ "nên".
    if (!closed) {
      const sum = await this.sprintsSvc.summary(ctx.userId, sprint.id);
      const only = (spec.filters.assignee ?? [])
        .map((c) => this.userId(c, ctx))
        .filter((x): x is string => !!x);
      const people = sum.byAssignee.filter((p) =>
        only.length ? only.includes(p.userId) : p.tasks > 0,
      );
      blocks.push({
        kind: 'table',
        title: `Theo người · năng lực ${sum.window.from.slice(8, 10)}/${sum.window.from.slice(5, 7)} → ${sum.window.to.slice(8, 10)}/${sum.window.to.slice(5, 7)} · xếp theo giờ còn lại`,
        columns: [
          { key: 'member', label: 'Người' },
          { key: 'tasks', label: 'Việc', align: 'right' },
          { key: 'remaining', label: 'Giờ còn lại', align: 'right' },
          { key: 'capacity', label: 'Năng lực', align: 'right' },
          { key: 'load', label: 'Mức', align: 'right' },
        ],
        rows: [
          ...people.map((p) => ({
            ref: {
              type: 'user' as const,
              id: p.userId,
              key: p.shortName ?? p.fullName,
            },
            cells: {
              member: p.shortName ?? p.fullName,
              tasks: p.tasks,
              remaining: `${round1(p.remainingHours)} h`,
              capacity: `${round1(p.capacityHours)} h`,
              load:
                p.capacityHours > 0
                  ? `${Math.round((p.remainingHours / p.capacityHours) * 100)}%`
                  : '—',
            },
          })),
          ...(only.length || !sum.unassigned.tasks
            ? []
            : [
                {
                  cells: {
                    member: 'Chưa giao',
                    tasks: sum.unassigned.tasks,
                    remaining: `${round1(sum.unassigned.hours)} h`,
                    capacity: '—',
                    load: '—',
                  },
                },
              ]),
        ],
      });
    }
    return {
      source: {
        endpoint: 'GET /sprints/:id/forecast + /burndown',
        params: { sprintId: sprint.id },
        rowCount: row?.taskCount ?? 0,
      },
      blocks,
    };
  }

  private async activity(spec: DataQuerySpec, ctx: QueryContext) {
    const [rows, sprints, me] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { projectId: ctx.projectId },
        orderBy: { createdAt: 'desc' },
        take: spec.limit,
        select: {
          id: true,
          action: true,
          diff: true,
          createdAt: true,
          source: true,
          actor: { select: { fullName: true, shortName: true } },
          task: {
            select: {
              number: true,
              title: true,
              project: { select: { key: true } },
            },
          },
        },
      }),
      this.prisma.sprint.findMany({
        where: { projectId: ctx.projectId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { timezone: true },
      }),
    ]);
    const sprintName = new Map(sprints.map((s) => [s.id, s.name]));
    // Giờ theo múi giờ người hỏi, cùng kiểu "dd/MM HH:mm" với màn Dashboard (trước đây in UTC)
    const when = new Intl.DateTimeFormat('en-GB', {
      timeZone: me?.timezone || 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const fmt = (d: Date) => when.format(d).replace(',', '');
    return {
      source: {
        endpoint: 'GET /projects/:id/activity',
        params: { limit: spec.limit },
        rowCount: rows.length,
      },
      blocks: (rows.length
        ? [
            {
              kind: 'activity_list',
              items: rows.map((r) => {
                const d = (r.diff ?? {}) as { sprintId?: string };
                const sprint = sprintActivityDetail(
                  r.action,
                  r.diff,
                  d.sprintId ? sprintName.get(d.sprintId) : undefined,
                );
                return {
                  title: `${r.actor?.shortName ?? r.actor?.fullName ?? 'Hệ thống'} ${ACTIVITY_ACTION_LABEL[r.action] ?? r.action}`,
                  subtitle: r.task
                    ? `${r.task.project.key}-${r.task.number} ${r.task.title}`
                    : (sprint ?? undefined),
                  meta: [{ icon: 'clock' as const, text: fmt(r.createdAt) }],
                  badges:
                    r.source !== 'MANUAL'
                      ? [{ text: r.source, tone: 'info' as const }]
                      : undefined,
                };
              }),
            },
          ]
        : [{ kind: 'empty', title: 'Chưa có hoạt động' }]) as QueryBlock[],
    };
  }

  private async notifications(spec: DataQuerySpec, ctx: QueryContext) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      take: spec.limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        isRead: true,
        createdAt: true,
      },
    });
    const unread = rows.filter((r) => !r.isRead).length;
    return {
      source: {
        endpoint: 'GET /notifications',
        params: { limit: spec.limit },
        rowCount: rows.length,
      },
      blocks: [
        {
          kind: 'stat_row',
          items: [
            {
              label: 'Chưa đọc',
              value: unread,
              tone: unread ? 'warning' : 'muted',
            },
            { label: 'Gần đây', value: rows.length },
          ],
        },
        rows.length
          ? {
              kind: 'activity_list',
              items: rows.map((r) => ({
                ref: { type: 'notification' as const, id: r.id },
                title: r.title,
                subtitle: r.body ?? undefined,
                badges: [
                  { text: r.type, tone: 'muted' as const },
                  ...(r.isRead
                    ? []
                    : [{ text: 'mới', tone: 'warning' as const }]),
                ],
                meta: [
                  {
                    icon: 'clock' as const,
                    text: r.createdAt
                      .toISOString()
                      .slice(0, 16)
                      .replace('T', ' '),
                  },
                ],
              })),
            }
          : { kind: 'empty', title: 'Không có thông báo' },
      ] as QueryBlock[],
    };
  }

  private async aiUsage(
    spec: DataQuerySpec,
    ctx: QueryContext,
    workspaceId: string,
    canManage: boolean,
  ) {
    // Sổ token là dữ liệu quản trị: chỉ PM/quản trị workspace được xem (khớp GET /ai-usage)
    if (!canManage)
      return {
        source: {
          endpoint: 'GET /workspaces/:id/ai-usage',
          params: {},
          rowCount: 0,
        },
        blocks: [
          {
            kind: 'note',
            text: 'Sổ token AI chỉ dành cho PM hoặc quản trị workspace.',
            tone: 'warning',
          },
        ] as QueryBlock[],
      };
    const from = new Date(Date.now() - 30 * DAY);
    const rows = await this.prisma.aiTokenLog.groupBy({
      by: ['purpose'],
      where: { workspaceId, createdAt: { gte: from } },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCost: true },
    });
    const totalCalls = rows.reduce((s, r) => s + r._count._all, 0);
    const totalCost = rows.reduce((s, r) => s + (r._sum.estimatedCost ?? 0), 0);
    return {
      source: {
        endpoint: 'GET /workspaces/:id/ai-usage',
        params: {
          from: iso(from),
          groupBy: spec.filters.groupUsageBy ?? 'purpose',
        },
        rowCount: rows.length,
      },
      blocks: [
        {
          kind: 'stat_row',
          items: [
            { label: 'Lượt gọi 30 ngày', value: totalCalls },
            {
              label: 'Token',
              value: rows.reduce((s, r) => s + (r._sum.totalTokens ?? 0), 0),
            },
            {
              label: 'Chi phí',
              value: Math.round(totalCost * 26263).toLocaleString('vi-VN'),
              unit: '₫',
              hint: `$${totalCost.toFixed(4)}`,
            },
          ],
        },
        {
          kind: 'table',
          columns: [
            { key: 'purpose', label: 'Mục đích' },
            { key: 'calls', label: 'Lượt', align: 'right' },
            { key: 'tokens', label: 'Token', align: 'right' },
            { key: 'cost', label: 'VND', align: 'right' },
          ],
          rows: rows.map((r) => ({
            cells: {
              purpose: r.purpose,
              calls: r._count._all,
              tokens: r._sum.totalTokens ?? 0,
              cost: Math.round((r._sum.estimatedCost ?? 0) * 26263),
            },
          })),
        },
      ] as QueryBlock[],
    };
  }
}
