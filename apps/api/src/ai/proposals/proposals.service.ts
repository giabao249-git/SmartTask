import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import {
  AiFeedbackKind,
  AiProposalKind,
  AiProposalStatus,
  Prisma,
} from '@prisma/client';
import type {
  DraftPatch,
  StructuredAction,
  ValidationIssue,
  ValidationResult,
} from '@smarttask/shared';
import { ProjectAccessService } from '../../common/access/project-access.service';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { mergeSettings } from '../../workspaces/workspace-settings';
import { AI_EVENTS } from '../ai.events';
import type { CodeMap } from '../context/short-codes';
import type { DecomposeResolution } from '../validator/action-validator.service';
import {
  deriveStatus,
  initialItemStatus,
  isProposalAction,
  itemsOf,
  kindOf,
  patchItem,
  type ItemStatusMap,
  type ProposalAction,
} from './draft-items';

/** `ai_proposals.payload` — action đã validate + yêu cầu gốc + ánh xạ Validator đã đối chiếu. */
export interface ProposalPayload {
  request: {
    requirement?: string;
    text?: string;
    detail?: string;
    sprintId: string | null;
    requirementHash?: string;
  };
  action: StructuredAction;
  /** Bản LLM đề xuất lúc đầu (bất biến) — đối chiếu với `action` cuối để ghi ai_feedback */
  proposed?: StructuredAction;
  resolution?: DecomposeResolution;
  /** Item người sửa tay trên panel → ai_feedback EDITED (CHANGED_HOURS) khi duyệt (docs 12 §5) */
  edited?: Record<string, true>;
  /** Kết quả duyệt (giữ tương thích Phase 7: createdTaskIds/tasks) */
  applied?: {
    taskIds: string[];
    tasks: { draftKey: string; taskId: string; key: string }[];
  };
}

const PROPOSAL_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  sessionId: true,
  messageId: true,
  kind: true,
  payload: true,
  codeMap: true,
  validationResult: true,
  status: true,
  version: true,
  itemStatus: true,
  appliedMap: true,
  appliedById: true,
  appliedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;
export type ProposalRow = Prisma.AiProposalGetPayload<{
  select: typeof PROPOSAL_SELECT;
}>;

/**
 * Vòng đời `ai_proposals` (docs 05 §7c, 12 §2–3): đề xuất từ form giữ "một DRAFT mỗi (dự án, người, loại)";
 * bản nháp trong PHIÊN chat nhận draftKey do server cấp từ `chat_sessions.next_draft_seq` (không tái dùng),
 * sửa/bỏ/duyệt theo từng item với khoá lạc quan `version`; trạng thái proposal suy ra từ `item_status`.
 * Cron 03:00 dọn theo tuổi.
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);
  private readonly locks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
  ) {}

  /** Lượt thứ hai cùng khoá khi lượt đầu chưa xong → 409 (`code`: AI_IN_PROGRESS theo dự án / AI_TURN_IN_PROGRESS theo phiên). */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    code: 'AI_IN_PROGRESS' | 'AI_TURN_IN_PROGRESS' = 'AI_IN_PROGRESS',
  ): Promise<T> {
    if (this.locks.has(key)) throw AppError.conflict(code, { key });
    this.locks.add(key);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
    }
  }

  // ── Đề xuất từ form (Phase 7) ──────────────────────────────

  async findOpenDraft(
    projectId: string,
    userId: string,
    kind: AiProposalKind,
  ): Promise<ProposalRow | null> {
    return this.prisma.aiProposal.findFirst({
      where: {
        projectId,
        userId,
        kind,
        sessionId: null,
        status: AiProposalStatus.DRAFT,
        expiresAt: { gt: new Date() },
      },
      select: PROPOSAL_SELECT,
    });
  }

  async createDraft(input: {
    projectId: string;
    workspaceId: string;
    userId: string;
    kind: AiProposalKind;
    payload: ProposalPayload;
    codeMap: CodeMap;
    validation: ValidationResult;
  }): Promise<ProposalRow> {
    const days = await this.draftDays(input.workspaceId);
    const action = input.payload.action as ProposalAction;
    return this.prisma.$transaction(async (tx) => {
      await tx.aiProposal.updateMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
          kind: input.kind,
          sessionId: null,
          status: AiProposalStatus.DRAFT,
        },
        data: { status: AiProposalStatus.EXPIRED },
      });
      return tx.aiProposal.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
          kind: input.kind,
          payload: input.payload as unknown as Prisma.InputJsonValue,
          codeMap: input.codeMap as unknown as Prisma.InputJsonValue,
          validationResult:
            input.validation as unknown as Prisma.InputJsonValue,
          itemStatus: initialItemStatus(action),
          appliedMap: {},
          expiresAt: new Date(Date.now() + days * 86_400_000),
        },
        select: PROPOSAL_SELECT,
      });
    });
  }

  // ── Bản nháp trong phiên (Phase 8) ─────────────────────────

  /** `next_draft_seq` hiện tại — để ContextBuilder in `next = d{seq}` và để cấp key trước khi lưu. */
  async nextSeq(sessionId: string): Promise<number> {
    const s = await this.prisma.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { nextDraftSeq: true },
    });
    return s.nextDraftSeq;
  }

  /**
   * Lưu action LLM thành proposal của phiên trong MỘT giao dịch: `update … increment` trả về seq mới, so với
   * `firstSeq` đã dùng khi đổi key (`assignServerKeys`) — lệch (hai lượt đua, dù phiên đã khoá) → ném lỗi để làm lại;
   * bảng đổi key LLM → key server ghi vào `code_map.drafts`.
   */
  async createInSession(input: {
    session: {
      id: string;
      projectId: string;
      workspaceId: string;
      userId: string;
    };
    messageId: string | null;
    action: ProposalAction;
    keyMap: Record<string, string>;
    keyCount: number;
    firstSeq: number;
    codeMap: CodeMap;
    validation: ValidationResult | null;
    resolution?: DecomposeResolution;
    text: string;
  }): Promise<ProposalRow> {
    const days = await this.draftDays(input.session.workspaceId);
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.chatSession.update({
        where: { id: input.session.id },
        data: { nextDraftSeq: { increment: input.keyCount } },
        select: { nextDraftSeq: true },
      });
      if (s.nextDraftSeq - input.keyCount !== input.firstSeq)
        throw new Error(
          `next_draft_seq đã đổi (${s.nextDraftSeq - input.keyCount} ≠ ${input.firstSeq})`,
        );
      const payload: ProposalPayload = {
        request: {
          text: input.text,
          sprintId: input.resolution?.sprintId ?? null,
        },
        action: input.action,
        proposed: input.action,
        resolution: input.resolution,
      };
      return tx.aiProposal.create({
        data: {
          projectId: input.session.projectId,
          userId: input.session.userId,
          sessionId: input.session.id,
          messageId: input.messageId,
          kind: kindOf(input.action),
          payload: payload as unknown as Prisma.InputJsonValue,
          codeMap: {
            ...input.codeMap,
            drafts: input.keyMap,
          },
          validationResult: (input.validation ??
            Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
          itemStatus: initialItemStatus(input.action),
          appliedMap: {},
          expiresAt: new Date(Date.now() + days * 86_400_000),
        },
        select: PROPOSAL_SELECT,
      });
    });
  }

  /** Toàn bộ proposal của phiên (mọi trạng thái, cũ → mới) — UI thay panel, không merge. */
  async ofSession(sessionId: string): Promise<ProposalRow[]> {
    return this.prisma.aiProposal.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: PROPOSAL_SELECT,
    });
  }

  /** Bản nháp đang mở của phiên (còn item DRAFT) — cho ContextBuilder và tra key. */
  async openInSession(sessionId: string): Promise<ProposalRow[]> {
    return this.prisma.aiProposal.findMany({
      where: {
        sessionId,
        status: AiProposalStatus.DRAFT,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      select: PROPOSAL_SELECT,
    });
  }

  /**
   * Tra draftKey → proposal trong phiên. Trả `issues` thay vì ném: key lạ/đã bỏ = UNKNOWN_DRAFT_KEY, item đã
   * duyệt = DRAFT_ALREADY_APPLIED — LLM được bảo hỏi lại hoặc chuyển sang UPDATE_TASK_DRAFT{targetTask}.
   */
  locate(
    proposals: ProposalRow[],
    keys: string[],
  ): { found: Map<string, ProposalRow>; issues: ValidationIssue[] } {
    const found = new Map<string, ProposalRow>();
    const issues: ValidationIssue[] = [];
    keys.forEach((k, i) => {
      const row = proposals.find(
        (p) => k in ((p.itemStatus ?? {}) as ItemStatusMap),
      );
      const st = row
        ? ((row.itemStatus as ItemStatusMap)[k] ?? 'DRAFT')
        : undefined;
      if (!row || st === 'DISCARDED')
        issues.push({
          path: `targetDraftKeys[${i}]`,
          code: 'UNKNOWN_DRAFT_KEY',
          message: `Bản nháp ${k} không có trong phiên này (hoặc đã bỏ)`,
        });
      else if (st === 'APPLIED')
        issues.push({
          path: `targetDraftKeys[${i}]`,
          code: 'DRAFT_ALREADY_APPLIED',
          message: `${k} đã được duyệt thành task thật — muốn sửa thì dùng UPDATE_TASK_DRAFT với targetTask`,
          data: {
            taskId: (row.appliedMap as Record<string, string> | null)?.[k],
          },
        });
      else found.set(k, row);
    });
    return { found, issues };
  }

  /** Vá patch vào một item (thuần) — key lạ/đã bỏ → UNKNOWN_DRAFT_KEY, đã duyệt → DRAFT_ALREADY_APPLIED. */
  patched(
    row: ProposalRow,
    draftKey: string,
    patch: DraftPatch,
  ): ProposalAction {
    const st = ((row.itemStatus ?? {}) as ItemStatusMap)[draftKey];
    if (!st) throw AppError.unprocessable('UNKNOWN_DRAFT_KEY', { draftKey });
    if (st === 'APPLIED')
      throw AppError.conflict('DRAFT_ALREADY_APPLIED', { draftKey });
    if (st === 'DISCARDED')
      throw AppError.unprocessable('UNKNOWN_DRAFT_KEY', {
        draftKey,
        reason: 'đã bỏ',
      });
    const action = (row.payload as unknown as ProposalPayload)
      .action as ProposalAction;
    let out: ProposalAction | null;
    try {
      out = patchItem(action, draftKey, patch);
    } catch (e) {
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: [String((e as Error).message).slice(0, 500)],
      });
    }
    if (!out) throw AppError.unprocessable('UNKNOWN_DRAFT_KEY', { draftKey });
    return out;
  }

  /** Lưu action đã vá (LLM hoặc tay) + kết quả Validator; `editedKey` đánh dấu sửa tay để ghi EDITED khi duyệt. */
  async savePatched(
    row: ProposalRow,
    action: ProposalAction,
    validation: ValidationResult | null,
    resolution: DecomposeResolution | undefined,
    opts: { editedKey?: string } = {},
  ): Promise<ProposalRow> {
    const payload = row.payload as unknown as ProposalPayload;
    const next: ProposalPayload = {
      ...payload,
      action,
      resolution: resolution ?? payload.resolution,
      edited: opts.editedKey
        ? { ...(payload.edited ?? {}), [opts.editedKey]: true }
        : payload.edited,
    };
    const updated = await this.prisma.aiProposal.update({
      where: { id: row.id },
      data: {
        payload: next as unknown as Prisma.InputJsonValue,
        validationResult: (validation ??
          Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      select: PROPOSAL_SELECT,
    });
    this.emitUpdated(updated);
    return updated;
  }

  assertVersion(row: ProposalRow, version?: number): void {
    if (version !== undefined && version !== row.version)
      throw AppError.conflict('PROPOSAL_VERSION_CONFLICT', {
        current: row.version,
        given: version,
      });
  }

  /** Bỏ item (LLM DISCARD_DRAFT hoặc người bấm Bỏ): item → DISCARDED, ghi ai_feedback REJECTED, trạng thái suy lại. */
  async discardItems(
    row: ProposalRow,
    keys: string[] | 'all',
    reason?: string,
  ): Promise<ProposalRow> {
    const items = { ...((row.itemStatus ?? {}) as ItemStatusMap) };
    const targets =
      keys === 'all'
        ? Object.keys(items).filter((k) => items[k] === 'DRAFT')
        : keys;
    const changed = targets.filter((k) => items[k] === 'DRAFT');
    if (!changed.length) return row;
    for (const k of changed) items[k] = 'DISCARDED';
    const action = (row.payload as unknown as ProposalPayload)
      .action as ProposalAction;
    const byKey = new Map(itemsOf(action).map((i) => [i.draftKey, i]));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.aiFeedback.createMany({
        data: changed.map((k) => ({
          proposalId: row.id,
          proposed: (byKey.get(k) ?? {
            draftKey: k,
          }) as unknown as Prisma.InputJsonValue,
          final: reason ? { reason } : Prisma.JsonNull,
          editKind: AiFeedbackKind.REJECTED,
        })),
      });
      return tx.aiProposal.update({
        where: { id: row.id },
        data: {
          itemStatus: items,
          status: deriveStatus(items),
          version: { increment: 1 },
        },
        select: PROPOSAL_SELECT,
      });
    });
    this.emitUpdated(updated);
    return updated;
  }

  /** Ghi kết quả duyệt (Executor đã tạo/sửa xong): item → APPLIED, applied_map, feedback ACCEPTED/EDITED, trạng thái suy lại. */
  async markApplied(
    row: ProposalRow,
    userId: string,
    applied: { draftKey: string; taskId: string; key: string }[],
    finalAction: ProposalAction,
  ): Promise<ProposalRow> {
    const payload = row.payload as unknown as ProposalPayload;
    const items = { ...((row.itemStatus ?? {}) as ItemStatusMap) };
    const map = { ...((row.appliedMap ?? {}) as Record<string, string>) };
    for (const a of applied) {
      items[a.draftKey] = 'APPLIED';
      map[a.draftKey] = a.taskId;
    }
    const original = new Map(
      itemsOf((payload.proposed ?? payload.action) as ProposalAction).map(
        (i) => [i.draftKey, i],
      ),
    );
    const finalItems = new Map(
      itemsOf(finalAction).map((i) => [i.draftKey, i]),
    );
    const status = deriveStatus(items);
    const prev = payload.applied ?? { taskIds: [], tasks: [] };
    const nextPayload: ProposalPayload = {
      ...payload,
      applied: {
        taskIds: [...prev.taskIds, ...applied.map((a) => a.taskId)],
        tasks: [...prev.tasks, ...applied],
      },
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.aiFeedback.createMany({
        data: applied.map((a) => ({
          proposalId: row.id,
          taskId: a.taskId,
          proposed: (original.get(a.draftKey) ??
            {}) as unknown as Prisma.InputJsonValue,
          final: (finalItems.get(a.draftKey) ??
            {}) as unknown as Prisma.InputJsonValue,
          editKind: editKindOf(
            original.get(a.draftKey),
            finalItems.get(a.draftKey),
            !!payload.edited?.[a.draftKey],
          ),
        })),
      });
      return tx.aiProposal.update({
        where: { id: row.id },
        data: {
          itemStatus: items,
          appliedMap: map,
          status,
          version: { increment: 1 },
          payload: nextPayload as unknown as Prisma.InputJsonValue,
          appliedById: userId,
          appliedAt: new Date(),
        },
        select: PROPOSAL_SELECT,
      });
    });
    this.emitUpdated(updated);
    return updated;
  }

  // ── Đọc / quyền ────────────────────────────────────────────

  /** PM/quản trị của dự án hoặc chính người tạo. */
  async get(userId: string, id: string): Promise<ProposalRow> {
    const row = await this.prisma.aiProposal.findUnique({
      where: { id },
      select: PROPOSAL_SELECT,
    });
    if (!row) throw AppError.notFound({ proposalId: id });
    const access = await this.access.resolve(userId, row.projectId);
    if (!access.canManage && row.userId !== userId)
      throw AppError.forbidden({ required: 'PM hoặc người tạo đề xuất' });
    return row;
  }

  view(row: ProposalRow) {
    const payload = row.payload as unknown as ProposalPayload;
    const items = (row.itemStatus ?? {}) as ItemStatusMap;
    const map = (row.appliedMap ?? {}) as Record<string, string>;
    const action = payload.action;
    const list = isProposalAction(action) ? itemsOf(action) : [];
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      sessionId: row.sessionId,
      messageId: row.messageId,
      kind: row.kind,
      status: row.status,
      version: row.version,
      request: payload.request,
      action,
      items: list.map((i) => ({
        ...i,
        status: items[i.draftKey] ?? 'DRAFT',
        taskId: map[i.draftKey] ?? null,
        edited: !!payload.edited?.[i.draftKey],
      })),
      itemStatus: items,
      appliedMap: map,
      applied: payload.applied ?? null,
      validation: row.validationResult as unknown as ValidationResult | null,
      codeMap: row.codeMap as unknown as
        (CodeMap & { drafts?: Record<string, string> }) | null,
      appliedById: row.appliedById,
      appliedAt: row.appliedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  /** Bảo đảm còn DRAFT và chưa hết hạn. */
  assertDraft(row: ProposalRow): void {
    if (row.status === AiProposalStatus.APPLIED)
      throw AppError.conflict('PROPOSAL_ALREADY_APPLIED', {
        proposalId: row.id,
      });
    if (row.status === AiProposalStatus.EXPIRED || row.expiresAt < new Date())
      throw new AppError('PROPOSAL_EXPIRED', HttpStatus.GONE, {
        proposalId: row.id,
        expiresAt: row.expiresAt,
      });
    if (row.status !== AiProposalStatus.DRAFT)
      throw AppError.conflict('PROPOSAL_NOT_DRAFT', { status: row.status });
  }

  /** Từ chối toàn bộ (Phase 7) hoặc một phần (`draftKeys`). */
  async reject(
    userId: string,
    id: string,
    reason?: string,
    draftKeys?: string[],
  ): Promise<ProposalRow> {
    const row = await this.get(userId, id);
    this.assertDraft(row);
    return this.discardItems(
      row,
      draftKeys?.length ? draftKeys : 'all',
      reason,
    );
  }

  emitUpdated(row: ProposalRow): void {
    this.events.emit(AI_EVENTS.proposalUpdated, {
      userId: row.userId,
      sessionId: row.sessionId,
      projectId: row.projectId,
      proposal: this.view(row),
      at: new Date(),
    });
  }

  private async draftDays(workspaceId: string): Promise<number> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });
    return mergeSettings(ws.settings, {}).retention.proposalDraftDays;
  }

  /** Dọn theo tuổi (05 §7c): DRAFT quá hạn → EXPIRED; EXPIRED/REJECTED > 30 ngày xoá; APPLIED > 180 ngày xoá. */
  @Cron('0 3 * * *')
  async cleanup(): Promise<void> {
    try {
      const now = new Date();
      const expired = await this.prisma.aiProposal.updateMany({
        where: { status: AiProposalStatus.DRAFT, expiresAt: { lt: now } },
        data: { status: AiProposalStatus.EXPIRED },
      });
      const done = await this.prisma.aiProposal.deleteMany({
        where: {
          status: { in: [AiProposalStatus.EXPIRED, AiProposalStatus.REJECTED] },
          createdAt: { lt: new Date(now.getTime() - 30 * 86_400_000) },
        },
      });
      const applied = await this.prisma.aiProposal.deleteMany({
        where: {
          status: AiProposalStatus.APPLIED,
          appliedAt: { lt: new Date(now.getTime() - 180 * 86_400_000) },
        },
      });
      this.logger.log(
        `Dọn ai_proposals: ${expired.count} hết hạn, xoá ${done.count} + ${applied.count}`,
      );
    } catch (e) {
      this.logger.warn(`Dọn ai_proposals lỗi: ${String(e)}`);
    }
  }
}

/** ACCEPTED / CHANGED_USER / CHANGED_HOURS (sửa tay hoặc qua chat) — nguồn cho thói quen (docs 06 §3). */
function editKindOf(
  before:
    { assignee?: string | null; estimateHours?: number | null } | undefined,
  after:
    { assignee?: string | null; estimateHours?: number | null } | undefined,
  editedByHand: boolean,
): AiFeedbackKind {
  if (!before || !after) return AiFeedbackKind.ACCEPTED;
  if ((before.assignee ?? null) !== (after.assignee ?? null))
    return AiFeedbackKind.CHANGED_USER;
  if ((before.estimateHours ?? null) !== (after.estimateHours ?? null))
    return AiFeedbackKind.CHANGED_HOURS;
  return editedByHand ? AiFeedbackKind.CHANGED_HOURS : AiFeedbackKind.ACCEPTED;
}
