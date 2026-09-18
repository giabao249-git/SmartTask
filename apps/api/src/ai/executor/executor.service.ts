import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AiFeedbackKind,
  AiProposalStatus,
  Prisma,
  TaskSource,
} from '@prisma/client';
import type { DecomposeProposal, DraftTask } from '@smarttask/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { AI_EVENTS, type AiProposalAppliedPayload } from '../ai.events';
import type { DecomposeResolution } from '../validator/action-validator.service';
import type {
  ProposalPayload,
  ProposalRow,
} from '../proposals/proposals.service';
import { topoOrder } from '../validator/graph';

export interface ApplyResult {
  proposalId: string;
  createdTaskIds: string[];
  tasks: { draftKey: string; taskId: string; key: string }[];
}

/**
 * Thực thi đề xuất ĐÃ được người xác nhận (docs 05 §2, §9): đi CÙNG đường code với giao diện (`TasksService.create`
 * / `createSubtask` → phát `task.created` → realtime, thông báo, tính lại tải như thao tác tay). Không ghi thẳng từ
 * đầu ra LLM. Kế thừa `ai-v2/executor.service.ts` (Table_Calendar).
 *
 * Ghi chú giao dịch: `TasksService.create` tự mở transaction riêng (cấp số ST-n, vị trí) nên tạo hàng loạt là tuần tự;
 * Validator đã kiểm trên dữ liệu sống ngay trước đó nên lỗi giữa chừng hiếm — nếu xảy ra, task đã tạo được xoá mềm
 * (bù trừ) và lỗi được ném lại.
 */
@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly events: EventEmitter2,
  ) {}

  async applyDecompose(
    row: ProposalRow,
    workspaceId: string,
    action: DecomposeProposal,
    resolution: DecomposeResolution,
    userId: string,
  ): Promise<ApplyResult> {
    const edges = new Map(action.tasks.map((t) => [t.draftKey, t.dependsOn]));
    const order = topoOrder(
      action.tasks.map((t) => t.draftKey),
      edges,
    );
    const byKey = new Map(action.tasks.map((t) => [t.draftKey, t]));
    const created: { draftKey: string; taskId: string; key: string }[] = [];
    const assigneeIds = new Set<string>();

    try {
      for (const draftKey of order) {
        const t = byKey.get(draftKey)!;
        const r = resolution.tasks[draftKey] ?? {
          assigneeId: null,
          skills: [],
          droppedSkills: [],
        };
        const task = await this.tasks.create(
          userId,
          row.projectId,
          {
            title: t.title,
            description: describe(t, r.droppedSkills),
            priority: t.priority,
            difficulty: t.difficulty,
            estimateHours: t.estimateHours,
            sprintId: resolution.sprintId ?? undefined,
            assigneeIds: r.assigneeId ? [r.assigneeId] : [],
            requiredSkills: r.skills,
          },
          TaskSource.AI,
        );
        if (r.assigneeId) assigneeIds.add(r.assigneeId);
        for (const s of t.subtasks)
          await this.tasks.createSubtask(userId, task.id, {
            title: s.title,
            estimateHours: s.estimateHours,
          });
        created.push({ draftKey, taskId: task.id, key: task.key });
      }
    } catch (e) {
      if (created.length) {
        this.logger.warn(
          `Áp dụng ${row.id} lỗi giữa chừng, xoá mềm ${created.length} task đã tạo: ${String(e)}`,
        );
        await this.prisma.task.updateMany({
          where: {
            OR: [
              { id: { in: created.map((c) => c.taskId) } },
              { parentId: { in: created.map((c) => c.taskId) } },
            ],
          },
          data: { deletedAt: new Date() },
        });
      }
      throw e;
    }

    const idOf = new Map(created.map((c) => [c.draftKey, c.taskId]));
    const deps = action.tasks.flatMap((t) =>
      t.dependsOn
        .filter((d) => idOf.has(d) && idOf.has(t.draftKey))
        .map((d) => ({
          taskId: idOf.get(t.draftKey)!,
          dependsOnId: idOf.get(d)!,
        })),
    );
    const original = (row.payload as unknown as ProposalPayload)
      .action as DecomposeProposal;
    const originalByKey = new Map(original.tasks.map((t) => [t.draftKey, t]));
    const feedback: Prisma.AiFeedbackCreateManyInput[] = created.map((c) => {
      const before = originalByKey.get(c.draftKey);
      const after = byKey.get(c.draftKey)!;
      return {
        proposalId: row.id,
        taskId: c.taskId,
        proposed: before ?? after,
        final: after,
        editKind: editKind(before, after),
      };
    });
    const removed = original.tasks.filter((t) => !byKey.has(t.draftKey));
    for (const t of removed)
      feedback.push({
        proposalId: row.id,
        proposed: t,
        final: Prisma.JsonNull,
        editKind: AiFeedbackKind.REJECTED,
      });

    const applied = { taskIds: created.map((c) => c.taskId), tasks: created };
    await this.prisma.$transaction([
      ...(deps.length
        ? [
            this.prisma.taskDependency.createMany({
              data: deps,
              skipDuplicates: true,
            }),
          ]
        : []),
      this.prisma.task.updateMany({
        where: { id: { in: applied.taskIds } },
        data: { aiProposalId: row.id },
      }),
      this.prisma.aiFeedback.createMany({ data: feedback }),
      this.prisma.aiProposal.update({
        where: { id: row.id },
        data: {
          status: AiProposalStatus.APPLIED,
          appliedById: userId,
          appliedAt: new Date(),
          payload: {
            ...(row.payload as object),
            action,
            resolution,
            applied,
          } as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    const payload: AiProposalAppliedPayload = {
      proposalId: row.id,
      projectId: row.projectId,
      workspaceId,
      kind: row.kind,
      taskIds: applied.taskIds,
      assigneeIds: [...assigneeIds],
      actorId: userId,
      at: new Date(),
    };
    this.events.emit(AI_EVENTS.proposalApplied, payload);
    return {
      proposalId: row.id,
      createdTaskIds: applied.taskIds,
      tasks: created,
    };
  }
}

function describe(t: DraftTask, dropped: string[]): string | undefined {
  const parts = [
    t.description?.trim(),
    t.reason ? `_Lý do AI:_ ${t.reason}` : '',
    dropped.length
      ? `_Kỹ năng chưa có trong danh mục:_ ${dropped.join(', ')}`
      : '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n') : undefined;
}

function editKind(
  before: DraftTask | undefined,
  after: DraftTask,
): AiFeedbackKind {
  if (!before) return AiFeedbackKind.ACCEPTED;
  if ((before.suggestedAssignee ?? null) !== (after.suggestedAssignee ?? null))
    return AiFeedbackKind.CHANGED_USER;
  if ((before.estimateHours ?? null) !== (after.estimateHours ?? null))
    return AiFeedbackKind.CHANGED_HOURS;
  return AiFeedbackKind.ACCEPTED;
}
