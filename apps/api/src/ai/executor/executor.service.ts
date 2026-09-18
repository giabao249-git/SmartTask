import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskSource } from '@prisma/client';
import type { DraftTask, UpdateTaskDraft } from '@smarttask/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { AI_EVENTS, type AiProposalAppliedPayload } from '../ai.events';
import type { ProposalAction } from '../proposals/draft-items';
import type { ProposalRow } from '../proposals/proposals.service';
import { topoOrder } from '../validator/graph';
import type {
  DecomposeResolution,
  ItemResolution,
} from '../validator/action-validator.service';

export interface AppliedItem {
  draftKey: string;
  taskId: string;
  key: string;
}

export interface ExecuteResult {
  applied: AppliedItem[];
  assigneeIds: string[];
}

/**
 * Thực thi phần đề xuất ĐÃ được người duyệt (docs 05 §2, 12 §5): đi CÙNG đường code với giao diện
 * (`TasksService.create/createSubtask/update/setAssignees` → `task.*` → realtime, thông báo, tính lại tải).
 * Không ghi thẳng từ đầu ra LLM; không đụng item chưa được chọn. Kế thừa `ai-v2/executor.service.ts` (Table_Calendar).
 *
 * Giao dịch: `TasksService.create` tự mở transaction riêng (cấp số ST-n, vị trí) nên tạo hàng loạt là tuần tự;
 * Validator đã kiểm trên dữ liệu sống ngay trước đó nên lỗi giữa chừng hiếm — nếu xảy ra, task vừa tạo trong lượt
 * này được xoá mềm (bù trừ) rồi lỗi được ném lại; item đã APPLIED ở lượt trước không bị đụng.
 */
@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * @param action  tập con item được duyệt (đã lọc bằng `filterItems`)
   * @param appliedMap  key → task đã tạo ở lượt trước (để nối phụ thuộc chéo lượt)
   */
  async execute(
    row: ProposalRow,
    workspaceId: string,
    action: ProposalAction,
    resolution: DecomposeResolution,
    userId: string,
    appliedMap: Record<string, string> = {},
  ): Promise<ExecuteResult> {
    let result: ExecuteResult;
    switch (action.type) {
      case 'DECOMPOSE_PROPOSAL':
        result = await this.createTasks(
          row,
          action.tasks,
          resolution,
          userId,
          appliedMap,
        );
        break;
      case 'CREATE_TASK_DRAFT':
        result = await this.createTasks(
          row,
          action.drafts.map((d) => ({
            ...d,
            suggestedAssignee: d.assignee ?? d.suggestedAssignee,
          })),
          resolution,
          userId,
          appliedMap,
        );
        break;
      case 'UPDATE_TASK_DRAFT':
        result = await this.updateTask(action, resolution, userId);
        break;
      case 'ASSIGN_PROPOSAL':
        result = await this.assign(
          action.assignments.map((a) => ({
            draftKey: a.draftKey!,
            start: a.start,
            due: a.due,
          })),
          resolution,
          userId,
        );
        break;
      case 'REBALANCE_PROPOSAL':
        result = await this.assign(
          action.moves.map((m) => ({ draftKey: m.draftKey! })),
          resolution,
          userId,
        );
        break;
    }
    if (result.applied.length) {
      await this.prisma.task.updateMany({
        where: {
          id: { in: result.applied.map((a) => a.taskId) },
          aiProposalId: null,
        },
        data: { aiProposalId: row.id },
      });
      const payload: AiProposalAppliedPayload = {
        proposalId: row.id,
        projectId: row.projectId,
        workspaceId,
        kind: row.kind,
        taskIds: result.applied.map((a) => a.taskId),
        assigneeIds: result.assigneeIds,
        actorId: userId,
        at: new Date(),
      };
      this.events.emit(AI_EVENTS.proposalApplied, payload);
    }
    return result;
  }

  private async createTasks(
    row: ProposalRow,
    drafts: (DraftTask & { start?: string; due?: string })[],
    resolution: DecomposeResolution,
    userId: string,
    appliedMap: Record<string, string>,
  ): Promise<ExecuteResult> {
    const edges = new Map(drafts.map((t) => [t.draftKey, t.dependsOn]));
    const order = topoOrder(
      drafts.map((t) => t.draftKey),
      edges,
    ).filter((k) => edges.has(k));
    const byKey = new Map(drafts.map((t) => [t.draftKey, t]));
    const created: AppliedItem[] = [];
    const assigneeIds = new Set<string>();
    try {
      for (const draftKey of order) {
        const t = byKey.get(draftKey)!;
        const r = resolution.tasks[draftKey] ?? empty();
        const task = await this.tasks.create(
          userId,
          row.projectId,
          {
            title: t.title,
            description: describe(t, r.droppedSkills),
            priority: t.priority,
            difficulty: t.difficulty,
            estimateHours: t.estimateHours,
            startDate: t.start,
            dueDate: t.due,
            sprintId:
              (r.sprintId === undefined ? resolution.sprintId : r.sprintId) ??
              undefined,
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
          `Duyệt ${row.id} lỗi giữa chừng, xoá mềm ${created.length} task vừa tạo: ${String(e)}`,
        );
        const ids = created.map((c) => c.taskId);
        await this.prisma.task.updateMany({
          where: { OR: [{ id: { in: ids } }, { parentId: { in: ids } }] },
          data: { deletedAt: new Date() },
        });
      }
      throw e;
    }
    // Phụ thuộc: trong lượt này hoặc tới task đã duyệt ở lượt trước; key còn DRAFT/DISCARDED thì bỏ qua
    const idOf = (k: string) =>
      created.find((c) => c.draftKey === k)?.taskId ?? appliedMap[k];
    const deps = drafts.flatMap((t) =>
      t.dependsOn
        .map((d) => ({ taskId: idOf(t.draftKey), dependsOnId: idOf(d) }))
        .filter(
          (x): x is { taskId: string; dependsOnId: string } =>
            !!x.taskId && !!x.dependsOnId,
        ),
    );
    if (deps.length)
      await this.prisma.taskDependency.createMany({
        data: deps,
        skipDuplicates: true,
      });
    return { applied: created, assigneeIds: [...assigneeIds] };
  }

  /** Đề xuất sửa task thật: `TasksService.update` (kèm version sống) + `setAssignees` khi patch có người. */
  private async updateTask(
    action: UpdateTaskDraft,
    resolution: DecomposeResolution,
    userId: string,
  ): Promise<ExecuteResult> {
    const draftKey = action.draftKey!;
    const r = resolution.tasks[draftKey];
    if (!r?.taskId)
      throw new Error(`Thiếu taskId đã đối chiếu cho ${draftKey}`);
    const p = action.patch;
    const current = await this.prisma.task.findUniqueOrThrow({
      where: { id: r.taskId },
      select: { version: true },
    });
    let version = current.version;
    const fields = {
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.description !== undefined ? { description: p.description } : {}),
      ...(p.priority !== undefined ? { priority: p.priority } : {}),
      ...(p.difficulty !== undefined ? { difficulty: p.difficulty } : {}),
      ...(p.estimateHours !== undefined
        ? { estimateHours: p.estimateHours }
        : {}),
      ...(p.start !== undefined ? { startDate: p.start } : {}),
      ...(p.due !== undefined ? { dueDate: p.due } : {}),
      ...(r.sprintId !== undefined ? { sprintId: r.sprintId } : {}),
    };
    let key = '';
    if (Object.keys(fields).length) {
      const t = await this.tasks.update(userId, r.taskId, {
        version,
        ...fields,
      });
      version = t.version;
      key = t.key;
    }
    const assigneeIds: string[] = [];
    if (p.suggestedAssignee !== undefined) {
      const t = await this.tasks.setAssignees(
        userId,
        r.taskId,
        { version, userIds: r.assigneeId ? [r.assigneeId] : [] },
        TaskSource.AI,
      );
      key = t.key;
      if (r.assigneeId) assigneeIds.push(r.assigneeId);
    }
    if (!key) {
      const t = await this.tasks.get(userId, r.taskId);
      key = t.key;
    }
    return { applied: [{ draftKey, taskId: r.taskId, key }], assigneeIds };
  }

  /** ASSIGN/REBALANCE: mỗi item = một `setAssignees` (thay toàn bộ bằng người LLM chọn, PM đã duyệt). */
  private async assign(
    items: { draftKey: string; start?: string; due?: string }[],
    resolution: DecomposeResolution,
    userId: string,
  ): Promise<ExecuteResult> {
    const applied: AppliedItem[] = [];
    const assigneeIds = new Set<string>();
    for (const it of items) {
      const r = resolution.tasks[it.draftKey];
      if (!r?.taskId || !r.assigneeId)
        throw new Error(`Thiếu task/người đã đối chiếu cho ${it.draftKey}`);
      const current = await this.prisma.task.findUniqueOrThrow({
        where: { id: r.taskId },
        select: { version: true },
      });
      let version = current.version;
      if (it.start || it.due) {
        const t = await this.tasks.update(userId, r.taskId, {
          version,
          ...(it.start ? { startDate: it.start } : {}),
          ...(it.due ? { dueDate: it.due } : {}),
        });
        version = t.version;
      }
      const t = await this.tasks.setAssignees(
        userId,
        r.taskId,
        { version, userIds: [r.assigneeId] },
        TaskSource.AI,
      );
      assigneeIds.add(r.assigneeId);
      applied.push({ draftKey: it.draftKey, taskId: r.taskId, key: t.key });
    }
    return { applied, assigneeIds: [...assigneeIds] };
  }
}

function empty(): ItemResolution {
  return { assigneeId: null, skills: [], droppedSkills: [] };
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
