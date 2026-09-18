import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AiLogStatus, AiProposalKind, AiPurpose } from '@prisma/client';
import {
  draftPatchSchema,
  type StructuredAction,
  type ValidationIssue,
  type ValidationResult,
} from '@smarttask/shared';
import { ProjectAccessService } from '../common/access/project-access.service';
import { AppError } from '../common/app-error';
import { ForecastService } from '../forecast/forecast.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiConfigService,
  type ResolvedAiConfig,
} from './ai-config/ai-config.service';
import { hashPrompt } from './ai-config/crypto.util';
import {
  ContextBuilderService,
  type BuildInput,
  type BuiltContext,
} from './context/context-builder.service';
import { CodeBook } from './context/short-codes';
import type {
  ApplyProposalDto,
  DecomposeDto,
  PatchItemDto,
} from './dto/ai.dto';
import {
  filterItems,
  type ItemStatusMap,
  type ProposalAction,
} from './proposals/draft-items';
import { applyEdits } from './executor/apply-edits';
import { ExecutorService } from './executor/executor.service';
import { parseStructuredAction } from './parser/response-parser';
import {
  ProposalsService,
  type ProposalPayload,
  type ProposalRow,
} from './proposals/proposals.service';
import {
  AiProviderService,
  type AiCallResult,
} from './provider/ai-provider.service';
import { QuotaService } from './quota/quota.service';
import {
  ActionValidatorService,
  type DecomposeValidation,
} from './validator/action-validator.service';

export interface TurnUsage {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  durationMs: number;
  estimatedCost: number;
  attempts: number;
  promptChars: number;
}

const EXPLAIN_CACHE_MS = 6 * 3600_000;

interface ExplainCacheEntry {
  riskLevel: string;
  remainingHours: number;
  result: {
    action: StructuredAction;
    validation: ValidationResult;
    usage: TurnUsage;
  };
  cachedUntil: Date;
}

/**
 * Điều phối MỘT LƯỢT AI (docs 05 §9): quyền → hạn mức → ContextBuilder (nạp mới) → AiProvider → ResponseParser →
 * ActionValidator → (gọi lại 1 lần kèm lỗi để LLM tự sửa) → lưu DRAFT. Backend không xếp hạng, không thay đề xuất;
 * ghi DB chỉ ở `apply` sau khi PM xác nhận, qua Executor → TasksService.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly explainCache = new Map<string, ExplainCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly aiConfig: AiConfigService,
    private readonly context: ContextBuilderService,
    private readonly provider: AiProviderService,
    private readonly validator: ActionValidatorService,
    private readonly proposals: ProposalsService,
    private readonly executor: ExecutorService,
    private readonly quota: QuotaService,
    private readonly forecast: ForecastService,
  ) {}

  // ── UC-28: phân rã yêu cầu ─────────────────────────────────

  async decompose(userId: string, projectId: string, dto: DecomposeDto) {
    const access = await this.access.assertManage(userId, projectId);
    const endpoint = 'POST /projects/:id/ai/decompose';
    const detail = dto.detail ?? 'normal';
    const requirementHash = hashPrompt(
      `${dto.requirement.trim()}|${dto.sprintId ?? ''}|${detail}`,
    );

    // Bấm trùng cùng yêu cầu → trả DRAFT đang mở thay vì gọi mới (05 §7c)
    const open = await this.proposals.findOpenDraft(
      projectId,
      userId,
      AiProposalKind.DECOMPOSE,
    );
    if (
      open &&
      (open.payload as unknown as ProposalPayload).request?.requirementHash ===
        requirementHash
    ) {
      const v = this.proposals.view(open);
      return {
        proposalId: v.id,
        action: v.action,
        validation: v.validation,
        cached: true,
        usage: null,
      };
    }
    await this.quota.assert(
      userId,
      access.workspaceId,
      AiPurpose.DECOMPOSE,
      endpoint,
    );

    return this.proposals.withLock(
      `${projectId}:${userId}:DECOMPOSE`,
      async () => {
        const config = await this.aiConfig.resolve(
          access.workspaceId,
          AiPurpose.DECOMPOSE,
        );
        const buildInput: BuildInput = {
          userId,
          projectId,
          purpose: 'DECOMPOSE',
          sprintId: dto.sprintId,
          requirement: dto.requirement,
          detail,
        };
        const turn = await this.runTurn(
          config,
          buildInput,
          endpoint,
          dto.requirement,
          async (action, ctx) => {
            if (action.type !== 'DECOMPOSE_PROPOSAL') return null;
            return this.validator.validateDecompose(action, {
              codes: ctx.codes,
              projectId,
              workspaceId: access.workspaceId,
              sprintId: ctx.meta.sprintId,
            });
          },
        );

        // ASK_CLARIFICATION / CHAT_RESPONSE: không có gì để lưu thành đề xuất — trả về để UI hỏi lại
        if (turn.action.type !== 'DECOMPOSE_PROPOSAL')
          return {
            proposalId: null,
            action: turn.action,
            validation: null,
            cached: false,
            usage: turn.usage,
          };

        const validation = turn.validation as DecomposeValidation;
        const { resolution, ...validationOnly } = validation;
        const row = await this.proposals.createDraft({
          projectId,
          workspaceId: access.workspaceId,
          userId,
          kind: AiProposalKind.DECOMPOSE,
          payload: {
            request: {
              requirement: dto.requirement,
              detail,
              sprintId: turn.ctx.meta.sprintId,
              requirementHash,
            },
            action: turn.action,
            proposed: turn.action,
            resolution,
          },
          codeMap: turn.ctx.codes.toJSON(),
          validation: validationOnly,
        });
        await this.provider.attachLog(turn.logId, { proposalId: row.id });
        return {
          proposalId: row.id,
          action: turn.action,
          validation: validationOnly,
          cached: false,
          usage: turn.usage,
        };
      },
    );
  }

  async getProposal(userId: string, id: string) {
    return this.proposals.view(await this.proposals.get(userId, id));
  }

  /**
   * Duyệt toàn bộ hoặc một phần (`draftKeys`) — docs 12 §5: kiểm `version` (409 PROPOSAL_VERSION_CONFLICT), gộp sửa
   * tay Phase 7 (`edits`), validate lại TẬP CON được duyệt trên dữ liệu sống → Executor → item APPLIED + applied_map.
   * Idempotent theo header Idempotency-Key khi đã APPLIED toàn bộ.
   */
  async apply(
    userId: string,
    id: string,
    dto: ApplyProposalDto,
    idempotencyKey?: string,
  ) {
    let row = await this.proposals.get(userId, id);
    const access = await this.assertCanApply(userId, row);
    const payload = row.payload as unknown as ProposalPayload;
    if (row.status === 'APPLIED' && idempotencyKey && payload.applied)
      return {
        proposalId: row.id,
        proposal: this.proposals.view(row),
        createdTaskIds: payload.applied.taskIds,
        tasks: payload.applied.tasks,
        createdTasks: payload.applied.tasks,
        idempotent: true,
      };
    this.proposals.assertDraft(row);
    this.proposals.assertVersion(row, dto.version);

    // Sửa tay kiểu Phase 7 (thẻ xem trước form): remove → bỏ item; còn lại vá vào action
    let action = payload.action as ProposalAction;
    if (dto.edits?.tasks?.length) {
      const removed = dto.edits.tasks
        .filter((e) => e.remove)
        .map((e) => e.draftKey);
      if (removed.length) row = await this.proposals.discardItems(row, removed);
      const kept = dto.edits.tasks.filter((e) => !e.remove);
      if (kept.length) {
        if (action.type !== 'DECOMPOSE_PROPOSAL')
          throw AppError.unprocessable('VALIDATION_FAILED', {
            fields: [
              'edits.tasks chỉ dùng cho DECOMPOSE — panel chat dùng PATCH /ai/proposals/:id/items/:draftKey',
            ],
          });
        try {
          action = applyEdits(action, kept);
        } catch (e) {
          throw AppError.unprocessable('VALIDATION_FAILED', {
            fields: [String((e as Error).message).slice(0, 500)],
          });
        }
      }
    }

    const items = (row.itemStatus ?? {}) as ItemStatusMap;
    const requested = dto.draftKeys?.length
      ? dto.draftKeys
      : Object.keys(items).filter((k) => items[k] === 'DRAFT');
    for (const k of requested) {
      if (!(k in items))
        throw AppError.unprocessable('UNKNOWN_DRAFT_KEY', { draftKey: k });
      if (items[k] === 'APPLIED')
        throw AppError.conflict('DRAFT_ALREADY_APPLIED', { draftKey: k });
      if (items[k] === 'DISCARDED')
        throw AppError.unprocessable('UNKNOWN_DRAFT_KEY', {
          draftKey: k,
          reason: 'đã bỏ',
        });
    }
    if (!requested.length)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['Không còn mục nào để duyệt'],
      });

    const subset = filterItems(action, requested);
    const codes = CodeBook.from(row.codeMap as never);
    const validation = await this.validator.validateAction(subset, {
      codes,
      projectId: row.projectId,
      workspaceId: access.workspaceId,
      sprintId: payload.request.sprintId,
    });
    const { resolution, ...validationOnly } = validation;
    await this.prisma.aiProposal.update({
      where: { id },
      data: {
        payload: { ...payload, action } as never,
        validationResult: validationOnly as never,
      },
    });
    if (!validation.ok)
      throw AppError.unprocessable('PROPOSAL_VALIDATION_FAILED', {
        errors: validation.errors,
        warnings: validation.warnings,
      });
    const result = await this.executor.execute(
      row,
      access.workspaceId,
      subset,
      resolution,
      userId,
      (row.appliedMap ?? {}) as Record<string, string>,
    );
    const updated = await this.proposals.markApplied(
      { ...row, payload: { ...payload, action } as never },
      userId,
      result.applied,
      action,
    );
    return {
      proposalId: row.id,
      proposal: this.proposals.view(updated),
      createdTaskIds: result.applied.map((a) => a.taskId),
      tasks: result.applied,
      createdTasks: result.applied,
      idempotent: false,
    };
  }

  async reject(
    userId: string,
    id: string,
    reason?: string,
    draftKeys?: string[],
  ) {
    const row = await this.proposals.get(userId, id);
    await this.assertCanApply(userId, row);
    return this.proposals.view(
      await this.proposals.reject(userId, id, reason, draftKeys),
    );
  }

  /** Người sửa tay một item trên panel (docs 12 §5) — không qua LLM; validate lại cả proposal; version +1. */
  async patchItem(
    userId: string,
    id: string,
    draftKey: string,
    dto: PatchItemDto,
  ) {
    const row = await this.proposals.get(userId, id);
    const access = await this.assertCanApply(userId, row);
    this.proposals.assertDraft(row);
    this.proposals.assertVersion(row, dto.version);
    const parsed = draftPatchSchema.safeParse(dto.patch);
    if (!parsed.success)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: parsed.error.issues.map(
          (i) => `patch.${i.path.join('.')}: ${i.message}`,
        ),
      });
    const action = this.proposals.patched(row, draftKey, parsed.data);
    const payload = row.payload as unknown as ProposalPayload;
    const validation = await this.validator.validateAction(action, {
      codes: CodeBook.from(row.codeMap as never),
      projectId: row.projectId,
      workspaceId: access.workspaceId,
      sprintId: payload.request.sprintId,
    });
    const { resolution, ...validationOnly } = validation;
    const updated = await this.proposals.savePatched(
      row,
      action,
      validationOnly,
      resolution,
      { editedKey: draftKey },
    );
    return this.proposals.view(updated);
  }

  /** PM/quản trị, hoặc chính người tạo đề xuất nếu người đó được sửa task trong dự án (thành viên). */
  private async assertCanApply(userId: string, row: ProposalRow) {
    const access = await this.access.resolve(userId, row.projectId);
    if (!access.canManage && !(row.userId === userId && access.canEdit))
      throw AppError.forbidden({
        required: 'PM/quản trị hoặc người tạo đề xuất là thành viên dự án',
      });
    return access;
  }

  // ── UC-31: giải thích rủi ro ───────────────────────────────

  async explain(userId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { projectId: true },
    });
    if (!sprint) throw AppError.notFound({ sprintId });
    const access = await this.access.assertManage(userId, sprint.projectId);
    const endpoint = 'POST /sprints/:id/forecast/explain';
    const fc = await this.forecast.forecast(userId, sprintId);

    // Cache 6 h theo sprint, chỉ dùng lại khi mức và giờ còn lại chưa đổi (11 §1.1 #19)
    const hit = this.explainCache.get(sprintId);
    if (
      hit &&
      hit.cachedUntil > new Date() &&
      hit.riskLevel === fc.riskLevel &&
      hit.remainingHours === fc.remainingHours
    )
      return {
        ...hit.result,
        forecast: fc,
        cached: true,
        cachedUntil: hit.cachedUntil.toISOString(),
      };

    await this.quota.assert(
      userId,
      access.workspaceId,
      AiPurpose.EXPLAIN,
      endpoint,
    );
    return this.proposals.withLock(
      `EXPLAIN:${sprintId}:${userId}`,
      async () => {
        const config = await this.aiConfig.resolve(
          access.workspaceId,
          AiPurpose.EXPLAIN,
        );
        const turn = await this.runTurn(
          config,
          { userId, projectId: sprint.projectId, purpose: 'EXPLAIN', sprintId },
          endpoint,
          `Giải thích rủi ro sprint ${sprintId}`,
          (action, ctx) =>
            Promise.resolve(
              action.type === 'RISK_EXPLANATION'
                ? this.validator.validateExplain(
                    action,
                    ctx.facts.forecastRiskLevel ?? fc.riskLevel,
                  )
                : null,
            ),
        );
        const validation: ValidationResult = turn.validation ?? {
          ok: false,
          errors: [
            {
              path: 'type',
              code: 'AI_RESPONSE_INVALID',
              message: `Mong đợi RISK_EXPLANATION, nhận ${turn.action.type}`,
            },
          ],
          warnings: [],
          checkedAt: new Date().toISOString(),
        };
        const result = { action: turn.action, validation, usage: turn.usage };
        const cachedUntil = new Date(Date.now() + EXPLAIN_CACHE_MS);
        if (validation.ok)
          this.explainCache.set(sprintId, {
            riskLevel: fc.riskLevel,
            remainingHours: fc.remainingHours,
            result,
            cachedUntil,
          });
        return {
          ...result,
          forecast: fc,
          cached: false,
          cachedUntil: validation.ok ? cachedUntil.toISOString() : null,
        };
      },
    );
  }

  // ── Một lượt gọi: build → call → parse → validate → gọi lại 1 lần ──

  async runTurn(
    config: ResolvedAiConfig,
    buildInput: BuildInput,
    endpoint: string,
    userMessage: string,
    validate: (
      action: StructuredAction,
      ctx: BuiltContext,
    ) => Promise<ValidationResult | null>,
  ): Promise<{
    action: StructuredAction;
    validation: ValidationResult | null;
    ctx: BuiltContext;
    usage: TurnUsage;
    logId: string | null;
  }> {
    let previousErrors: ValidationIssue[] | undefined;
    let usage: TurnUsage | null = null;
    let last: {
      action: StructuredAction;
      validation: ValidationResult | null;
      ctx: BuiltContext;
      logId: string | null;
    } | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const ctx = await this.context.build({ ...buildInput, previousErrors });
      const call = await this.provider.call({
        config,
        purpose: config.purpose,
        system: ctx.prompt.system,
        userText: ctx.prompt.userText,
        staticHash: ctx.prompt.staticHash,
        endpoint,
        workspaceId: ctx.meta.workspaceId,
        userId: buildInput.userId,
        userMessage,
        promptVersions: {
          master: ctx.meta.masterVersion,
          workspace: ctx.meta.workspacePromptVersion,
        },
      });
      usage = accumulate(usage, call, attempt, ctx.prompt.chars);
      const parsed = parseStructuredAction(call.text);
      if (parsed.parseFailed) {
        await this.markInvalid(call.logId, call.text, parsed.issues);
        this.logger.warn(
          `[AI] JSON không hợp lệ (lần ${attempt}): ${parsed.issues?.join('; ')}`,
        );
        last = {
          action: parsed.action,
          validation: null,
          ctx,
          logId: call.logId,
        };
        previousErrors = [
          {
            path: '$',
            code: 'AI_RESPONSE_INVALID',
            message: `Đầu ra không đúng schema: ${(parsed.issues ?? []).slice(0, 5).join('; ')}`,
          },
        ];
        continue;
      }
      const validation = await validate(parsed.action, ctx);
      last = { action: parsed.action, validation, ctx, logId: call.logId };
      if (!validation || validation.ok) break;
      previousErrors = validation.errors;
    }
    if (!last)
      throw new AppError(
        'AI_PROVIDER_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    if ((last.action as { parseFailed?: boolean }).parseFailed)
      throw new AppError(
        'AI_RESPONSE_INVALID',
        HttpStatus.SERVICE_UNAVAILABLE,
        { reply: last.action.reply?.slice(0, 300) },
      );
    return { ...last, usage: usage! };
  }

  private async markInvalid(
    logId: string | null,
    raw: string,
    issues?: string[],
  ): Promise<void> {
    if (!logId) return;
    await this.prisma.aiTokenLog
      .update({
        where: { id: logId },
        data: {
          status: AiLogStatus.INVALID_OUTPUT,
          errorMessage: (issues ?? []).join('; ').slice(0, 1000),
          rawResponse: raw.slice(0, 20_000),
        },
      })
      .catch(() => undefined);
  }
}

function accumulate(
  prev: TurnUsage | null,
  call: AiCallResult,
  attempts: number,
  promptChars: number,
): TurnUsage {
  return {
    provider: call.provider,
    model: call.model,
    inputTokens: (prev?.inputTokens ?? 0) + call.usage.inputTokens,
    cachedInputTokens:
      (prev?.cachedInputTokens ?? 0) + call.usage.cachedInputTokens,
    outputTokens: (prev?.outputTokens ?? 0) + call.usage.outputTokens,
    durationMs: (prev?.durationMs ?? 0) + call.durationMs,
    estimatedCost:
      Math.round(((prev?.estimatedCost ?? 0) + call.estimatedCost) * 1e8) / 1e8,
    attempts,
    promptChars,
  };
}
