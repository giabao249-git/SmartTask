import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiPurpose, ChatRole, Prisma } from '@prisma/client';
import type {
  StructuredAction,
  ValidationIssue,
  ValidationResult,
} from '@smarttask/shared';
import { ProjectAccessService } from '../../common/access/project-access.service';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_EVENTS, type AiSessionUpdatedPayload } from '../ai.events';
import { AiConfigService } from '../ai-config/ai-config.service';
import { AiService } from '../ai.service';
import type { BuiltContext } from '../context/context-builder.service';
import type { ChatDto, CreateSessionDto, PatchSessionDto } from '../dto/ai.dto';
import {
  assignServerKeys,
  isProposalAction,
  patchItem,
  type ProposalAction,
} from '../proposals/draft-items';
import {
  ProposalsService,
  type ProposalPayload,
  type ProposalRow,
} from '../proposals/proposals.service';
import { AiProviderService } from '../provider/ai-provider.service';
import { QuotaService } from '../quota/quota.service';
import {
  ActionValidatorService,
  type DecomposeValidation,
} from '../validator/action-validator.service';

const HISTORY_LIMIT = 20;

const SESSION_SELECT = {
  id: true,
  userId: true,
  workspaceId: true,
  projectId: true,
  title: true,
  nextDraftSeq: true,
  lastTurnAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
type SessionRow = Prisma.ChatSessionGetPayload<{
  select: typeof SESSION_SELECT;
}>;

/** Việc chờ ghi sau khi LLM trả và Validator kiểm — chỉ ghi khi lượt kết thúc bình thường. */
type Staged =
  | {
      kind: 'create';
      action: ProposalAction;
      keyMap: Record<string, string>;
      keyCount: number;
      firstSeq: number;
      validation: DecomposeValidation | null;
    }
  | {
      kind: 'patch';
      rows: {
        row: ProposalRow;
        action: ProposalAction;
        validation: DecomposeValidation;
      }[];
    }
  | { kind: 'discard'; rows: { row: ProposalRow; keys: string[] | 'all' }[] }
  | { kind: 'none' };

/**
 * Chat theo phiên (docs 12): mỗi lượt = 1 lượt LLM; bản nháp sống ở DB (`ai_proposals.session_id`), UI vẽ từ server.
 * Không có lượt chat nào ghi task thật — chỉ `POST /ai/proposals/:id/apply` (AiService.apply) ghi.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly ai: AiService,
    private readonly aiConfig: AiConfigService,
    private readonly provider: AiProviderService,
    private readonly validator: ActionValidatorService,
    private readonly proposals: ProposalsService,
    private readonly quota: QuotaService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Phiên ──────────────────────────────────────────────────

  async listSessions(
    userId: string,
    projectId?: string,
    includeArchived = false,
  ) {
    const rows = await this.prisma.chatSession.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [
        { lastTurnAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 100,
      select: {
        ...SESSION_SELECT,
        _count: { select: { messages: true } },
        proposals: { where: { status: 'DRAFT' }, select: { kind: true } },
      },
    });
    return rows.map((r) => ({
      ...this.sessionView(r),
      messageCount: r._count.messages,
      openDrafts: r.proposals.length,
      openKinds: [...new Set(r.proposals.map((p) => p.kind))],
    }));
  }

  async createSession(userId: string, dto: CreateSessionDto) {
    const access = await this.access.assertEdit(userId, dto.projectId);
    const row = await this.prisma.chatSession.create({
      data: {
        userId,
        workspaceId: access.workspaceId,
        projectId: dto.projectId,
        title: dto.title ?? null,
      },
      select: SESSION_SELECT,
    });
    this.emitSession(row, 'created');
    return this.sessionView(row);
  }

  /** `{session, messages[], proposals[]}` — dùng khi mở lại; chỉ chủ phiên. */
  async getSession(userId: string, id: string) {
    const row = await this.own(userId, id);
    const [messages, proposals] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { sessionId: id },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: {
          id: true,
          role: true,
          text: true,
          structuredData: true,
          schemaVersion: true,
          parseFailed: true,
          createdAt: true,
        },
      }),
      this.proposals.ofSession(id),
    ]);
    return {
      session: this.sessionView(row),
      messages,
      proposals: proposals.map((p) => this.proposals.view(p)),
    };
  }

  async sessionProposals(userId: string, id: string) {
    await this.own(userId, id);
    return (await this.proposals.ofSession(id)).map((p) =>
      this.proposals.view(p),
    );
  }

  async patchSession(userId: string, id: string, dto: PatchSessionDto) {
    await this.own(userId, id);
    const row = await this.prisma.chatSession.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.archived !== undefined
          ? { archivedAt: dto.archived ? new Date() : null }
          : {}),
      },
      select: SESSION_SELECT,
    });
    this.emitSession(
      row,
      dto.archived !== undefined
        ? dto.archived
          ? 'archived'
          : 'reopened'
        : 'renamed',
    );
    return this.sessionView(row);
  }

  /** Xoá phiên: DRAFT của phiên → REJECTED (giữ lịch sử feedback), APPLIED giữ lại (session_id SetNull). */
  async deleteSession(userId: string, id: string): Promise<void> {
    const row = await this.own(userId, id);
    for (const p of await this.proposals.openInSession(id))
      await this.proposals.discardItems(p, 'all', 'xoá phiên');
    await this.prisma.chatSession.delete({ where: { id } });
    this.emitSession(row, 'deleted');
  }

  // ── Một lượt chat ──────────────────────────────────────────

  async chat(userId: string, dto: ChatDto) {
    const access = await this.access.assertEdit(userId, dto.projectId);
    const endpoint = 'POST /ai/chat';
    const session = dto.sessionId
      ? await this.own(userId, dto.sessionId)
      : await this.prisma.chatSession.create({
          data: {
            userId,
            workspaceId: access.workspaceId,
            projectId: dto.projectId,
            title: dto.text.slice(0, 80),
          },
          select: SESSION_SELECT,
        });
    if (session.projectId !== dto.projectId)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['sessionId thuộc dự án khác'],
      });
    if (session.archivedAt)
      throw AppError.conflict('CONFLICT', {
        reason: 'Phiên đã lưu trữ — mở lại trước',
      });

    return this.proposals.withLock(
      `session:${session.id}`,
      async () => {
        await this.quota.assert(
          userId,
          access.workspaceId,
          AiPurpose.CHAT,
          endpoint,
        );
        const userMsg = await this.prisma.chatMessage.create({
          data: { sessionId: session.id, role: ChatRole.USER, text: dto.text },
          select: { id: true, createdAt: true },
        });
        // Mọi proposal của phiên (kể cả APPLIED/REJECTED) để LLM thấy item ✓/✗ và Validator báo DRAFT_ALREADY_APPLIED
        const [open, history, nextSeq] = await Promise.all([
          this.proposals.ofSession(session.id),
          this.prisma.chatMessage.findMany({
            where: { sessionId: session.id, id: { not: userMsg.id } },
            orderBy: { createdAt: 'desc' },
            take: HISTORY_LIMIT,
            select: { role: true, text: true, structuredData: true },
          }),
          this.proposals.nextSeq(session.id),
        ]);
        const config = await this.aiConfig.resolve(
          access.workspaceId,
          AiPurpose.CHAT,
        );

        const hold: { staged: Staged; action: StructuredAction | null } = {
          staged: { kind: 'none' },
          action: null,
        };
        const turn = await this.ai.runTurn(
          config,
          {
            userId,
            projectId: dto.projectId,
            purpose: 'CHAT',
            sprintId: dto.sprintId,
            requirement: dto.text,
            session: {
              id: session.id,
              nextDraftSeq: nextSeq,
              proposals: open,
              messages: history.reverse(),
              selectedCode: dto.selectedCode,
            },
          },
          endpoint,
          dto.text,
          async (action, ctx) => {
            const r = await this.stage(
              action,
              ctx,
              open,
              nextSeq,
              access.workspaceId,
              dto.projectId,
            );
            hold.staged = r.staged;
            hold.action = r.action;
            return r.validation;
          },
        );
        const action = hold.action ?? turn.action;

        // Ghi tin trợ lý (structured_data = action đã đổi key) rồi áp phần đã dàn (docs 05 §5)
        const assistant = await this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: ChatRole.ASSISTANT,
            text: action.reply ?? '',
            structuredData: action as unknown as Prisma.InputJsonValue,
            schemaVersion: action.schemaVersion ?? 1,
            parseFailed: !!(action as { parseFailed?: boolean }).parseFailed,
          },
          select: { id: true, createdAt: true },
        });
        await this.provider.attachLog(turn.logId, { messageId: assistant.id });
        await this.commit(
          hold.staged,
          session,
          assistant.id,
          action,
          turn.ctx,
          dto.text,
        );
        const updatedSession = await this.prisma.chatSession.update({
          where: { id: session.id },
          data: { lastTurnAt: new Date() },
          select: SESSION_SELECT,
        });
        this.emitSession(updatedSession, 'turn');
        const proposals = (await this.proposals.ofSession(session.id)).map(
          (p) => this.proposals.view(p),
        );
        return {
          sessionId: session.id,
          session: this.sessionView(updatedSession),
          message: {
            id: assistant.id,
            role: 'ASSISTANT',
            text: action.reply ?? '',
            createdAt: assistant.createdAt,
          },
          userMessageId: userMsg.id,
          action,
          validation: turn.validation,
          proposals,
          usage: turn.usage,
        };
      },
      'AI_TURN_IN_PROGRESS',
    );
  }

  /**
   * Dàn việc ghi theo loại action (không ghi ngay — Validator có thể yêu cầu LLM sửa một lần):
   * action mới có item → đổi key theo `next_draft_seq` rồi validate; UPDATE_TASK_DRAFT theo key → vá vào đúng
   * proposal của PHIÊN và validate bản đã vá; DISCARD_DRAFT → tra key; còn lại không ghi gì.
   */
  private async stage(
    action: StructuredAction,
    ctx: BuiltContext,
    open: ProposalRow[],
    nextSeq: number,
    workspaceId: string,
    projectId: string,
  ): Promise<{
    staged: Staged;
    action: StructuredAction;
    validation: ValidationResult | null;
  }> {
    const vctx = {
      codes: ctx.codes,
      projectId,
      workspaceId,
      sprintId: ctx.meta.sprintId,
    };
    if (action.type === 'UPDATE_TASK_DRAFT' && !action.targetTask) {
      const keys = [
        ...new Set([
          ...(action.targetDraftKey ? [action.targetDraftKey] : []),
          ...(action.targetDraftKeys ?? []),
        ]),
      ];
      if (!keys.length)
        return {
          staged: { kind: 'none' },
          action,
          validation: failed([
            {
              path: 'targetDraftKeys',
              code: 'UNKNOWN_DRAFT_KEY',
              message:
                'Thiếu targetDraftKeys (hoặc targetTask nếu sửa task thật)',
            },
          ]),
        };
      const { found, issues } = this.proposals.locate(open, keys);
      if (issues.length)
        return { staged: { kind: 'none' }, action, validation: failed(issues) };
      const byRow = new Map<
        string,
        { row: ProposalRow; action: ProposalAction }
      >();
      const errors: ValidationIssue[] = [];
      for (const k of keys) {
        const row = found.get(k)!;
        const cur = byRow.get(row.id) ?? {
          row,
          action: (row.payload as unknown as ProposalPayload)
            .action as ProposalAction,
        };
        try {
          const next = patchItem(cur.action, k, action.patch);
          if (!next)
            errors.push({
              path: k,
              code: 'UNKNOWN_DRAFT_KEY',
              message: `Không vá được ${k}`,
            });
          else byRow.set(row.id, { row, action: next });
        } catch (e) {
          errors.push({
            path: k,
            code: 'VALIDATION_FAILED',
            message: String((e as Error).message).slice(0, 300),
          });
        }
      }
      if (errors.length)
        return { staged: { kind: 'none' }, action, validation: failed(errors) };
      const rows: {
        row: ProposalRow;
        action: ProposalAction;
        validation: DecomposeValidation;
      }[] = [];
      const merged: ValidationResult = {
        ok: true,
        errors: [],
        warnings: [],
        checkedAt: new Date().toISOString(),
        facts: {},
      };
      for (const { row, action: patched } of byRow.values()) {
        const v = await this.validator.validateAction(patched, {
          ...vctx,
          sprintId: (row.payload as unknown as ProposalPayload).request
            .sprintId,
        });
        rows.push({ row, action: patched, validation: v });
        merged.errors.push(...v.errors);
        merged.warnings.push(...v.warnings);
        merged.ok = merged.ok && v.ok;
      }
      return { staged: { kind: 'patch', rows }, action, validation: merged };
    }
    if (action.type === 'DISCARD_DRAFT') {
      if (action.all)
        return {
          staged: {
            kind: 'discard',
            rows: open.map((row) => ({ row, keys: 'all' as const })),
          },
          action,
          validation: null,
        };
      const { found, issues } = this.proposals.locate(
        open,
        action.targetDraftKeys,
      );
      if (issues.length)
        return { staged: { kind: 'none' }, action, validation: failed(issues) };
      const byRow = new Map<string, { row: ProposalRow; keys: string[] }>();
      for (const [k, row] of found)
        byRow.set(row.id, {
          row,
          keys: [...(byRow.get(row.id)?.keys ?? []), k],
        });
      return {
        staged: { kind: 'discard', rows: [...byRow.values()] },
        action,
        validation: null,
      };
    }
    if (isProposalAction(action)) {
      const {
        action: keyed,
        keyMap,
        count,
      } = assignServerKeys(action, nextSeq);
      const v = await this.validator.validateAction(keyed, vctx);
      return {
        staged: {
          kind: 'create',
          action: keyed,
          keyMap,
          keyCount: count,
          firstSeq: nextSeq,
          validation: v,
        },
        action: keyed,
        validation: v,
      };
    }
    return { staged: { kind: 'none' }, action, validation: null };
  }

  private async commit(
    staged: Staged,
    session: SessionRow,
    messageId: string,
    action: StructuredAction,
    ctx: BuiltContext,
    text: string,
  ): Promise<void> {
    switch (staged.kind) {
      case 'create': {
        const { resolution, ...validation } =
          staged.validation ?? ({} as DecomposeValidation);
        await this.proposals.createInSession({
          session: {
            id: session.id,
            projectId: session.projectId!,
            workspaceId: session.workspaceId,
            userId: session.userId,
          },
          messageId,
          action: staged.action,
          keyMap: staged.keyMap,
          keyCount: staged.keyCount,
          firstSeq: staged.firstSeq,
          codeMap: ctx.codes.toJSON(),
          validation: staged.validation ? validation : null,
          resolution,
          text,
        });
        return;
      }
      case 'patch':
        for (const r of staged.rows) {
          const { resolution, ...validation } = r.validation;
          await this.proposals.savePatched(
            r.row,
            r.action,
            validation,
            resolution,
          );
        }
        return;
      case 'discard':
        for (const r of staged.rows)
          await this.proposals.discardItems(
            r.row,
            r.keys,
            (action as { resolutionReason?: string }).resolutionReason,
          );
        return;
      default:
        return;
    }
  }

  private async own(userId: string, id: string): Promise<SessionRow> {
    const row = await this.prisma.chatSession.findUnique({
      where: { id },
      select: SESSION_SELECT,
    });
    if (!row || row.userId !== userId)
      throw AppError.notFound({ sessionId: id });
    return row;
  }

  private sessionView(r: SessionRow) {
    return {
      id: r.id,
      projectId: r.projectId,
      workspaceId: r.workspaceId,
      title: r.title,
      nextDraftSeq: r.nextDraftSeq,
      lastTurnAt: r.lastTurnAt,
      archivedAt: r.archivedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private emitSession(row: SessionRow, change: string): void {
    const payload: AiSessionUpdatedPayload = {
      userId: row.userId,
      sessionId: row.id,
      projectId: row.projectId,
      change,
      at: new Date(),
    };
    this.events.emit(AI_EVENTS.sessionUpdated, payload);
  }
}

function failed(errors: ValidationIssue[]): ValidationResult {
  return {
    ok: false,
    errors,
    warnings: [],
    checkedAt: new Date().toISOString(),
  };
}
