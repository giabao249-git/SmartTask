import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AiFeedbackKind,
  AiProposalKind,
  AiProposalStatus,
  Prisma,
} from '@prisma/client';
import type { StructuredAction, ValidationResult } from '@smarttask/shared';
import { ProjectAccessService } from '../../common/access/project-access.service';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { mergeSettings } from '../../workspaces/workspace-settings';
import type { CodeMap } from '../context/short-codes';
import type { DecomposeResolution } from '../validator/action-validator.service';

/** `ai_proposals.payload` — action đã validate + yêu cầu gốc + ánh xạ Validator đã đối chiếu. */
export interface ProposalPayload {
  request: {
    requirement: string;
    detail: string;
    sprintId: string | null;
    requirementHash: string;
  };
  action: StructuredAction;
  resolution?: DecomposeResolution;
  applied?: {
    taskIds: string[];
    tasks: { draftKey: string; taskId: string; key: string }[];
  };
}

const PROPOSAL_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  kind: true,
  payload: true,
  codeMap: true,
  validationResult: true,
  status: true,
  appliedById: true,
  appliedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;
export type ProposalRow = Prisma.AiProposalGetPayload<{
  select: typeof PROPOSAL_SELECT;
}>;

/**
 * Vòng đời `ai_proposals` (docs 05 §7c): một DRAFT mỗi (dự án, người, loại) — tạo mới thì DRAFT cũ EXPIRED
 * (DB khoá bằng partial unique index `ai_proposals_one_draft`); khoá trong bộ nhớ chặn bấm trùng; cron 03:00 dọn theo tuổi.
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);
  private readonly locks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  /** Lượt thứ hai cùng (dự án, người, loại) khi lượt đầu chưa xong → 409 AI_IN_PROGRESS. */
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.locks.has(key)) throw AppError.conflict('AI_IN_PROGRESS', { key });
    this.locks.add(key);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
    }
  }

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
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
      select: { settings: true },
    });
    const days = mergeSettings(ws.settings, {}).retention.proposalDraftDays;
    return this.prisma.$transaction(async (tx) => {
      await tx.aiProposal.updateMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
          kind: input.kind,
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
          expiresAt: new Date(Date.now() + days * 86_400_000),
        },
        select: PROPOSAL_SELECT,
      });
    });
  }

  /** PM/quản trị của dự án (hoặc chính người tạo) mới xem được. */
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
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      kind: row.kind,
      status: row.status,
      request: payload.request,
      action: payload.action,
      applied: payload.applied ?? null,
      validation: row.validationResult as unknown as ValidationResult | null,
      codeMap: row.codeMap as unknown as CodeMap | null,
      appliedById: row.appliedById,
      appliedAt: row.appliedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  /** Bảo đảm còn DRAFT và chưa hết hạn; trả về hàng để Executor dùng. */
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

  async reject(userId: string, id: string, reason?: string): Promise<void> {
    const row = await this.get(userId, id);
    const access = await this.access.resolve(userId, row.projectId);
    if (!access.canManage)
      throw AppError.forbidden({ required: 'PM hoặc quản trị workspace' });
    this.assertDraft(row);
    const payload = row.payload as unknown as ProposalPayload;
    await this.prisma.$transaction([
      this.prisma.aiProposal.update({
        where: { id },
        data: { status: AiProposalStatus.REJECTED },
      }),
      this.prisma.aiFeedback.create({
        data: {
          proposalId: id,
          proposed: payload.action as unknown as Prisma.InputJsonValue,
          final: reason ? { reason } : Prisma.JsonNull,
          editKind: AiFeedbackKind.REJECTED,
        },
      }),
    ]);
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
