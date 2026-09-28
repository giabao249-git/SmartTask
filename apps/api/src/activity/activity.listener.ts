import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import {
  COMMENT_EVENTS,
  PROJECT_EVENTS,
  SPRINT_EVENTS,
  TASK_EVENTS,
  type CommentEventPayload,
  type ProjectMemberEventPayload,
  type SprintEventPayload,
  type TaskEventPayload,
} from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Nhật ký hoạt động ghi từ sự kiện — service nghiệp vụ không biết đến bảng activity_logs.
 * Listener không được làm hỏng luồng chính: mọi lỗi chỉ ghi log.
 */
@Injectable()
export class ActivityListener {
  private readonly logger = new Logger(ActivityListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('task.*', { async: true })
  async onTask(payload: TaskEventPayload): Promise<void> {
    await this.write({
      projectId: payload.projectId,
      taskId: payload.taskId,
      actorId: payload.actorId,
      action: payload.event ?? inferTaskAction(payload),
      diff: (payload.diff ?? null) as Prisma.InputJsonValue,
      source: payload.source,
      createdAt: payload.at,
    });
  }

  @OnEvent(SPRINT_EVENTS.started, { async: true })
  onSprintStarted(p: SprintEventPayload) {
    return this.write({
      projectId: p.projectId,
      actorId: p.actorId,
      action: 'sprint.started',
      diff: { sprintId: p.sprintId },
      createdAt: p.at,
    });
  }

  /** Đưa việc vào sprint hàng loạt — trước đây không để lại dấu vết nên không biết việc nào thêm giữa sprint. */
  @OnEvent(SPRINT_EVENTS.updated, { async: true })
  onSprintTasksAdded(p: SprintEventPayload) {
    if (!p.movedTaskIds?.length) return; // sửa tên/ngày sprint thì không ghi dòng này
    return this.write({
      projectId: p.projectId,
      actorId: p.actorId,
      action: 'sprint.tasks_added',
      diff: {
        sprintId: p.sprintId,
        taskIds: p.movedTaskIds,
        afterStart: !!p.afterStart,
      },
      createdAt: p.at,
    });
  }

  @OnEvent(SPRINT_EVENTS.closed, { async: true })
  onSprintClosed(p: SprintEventPayload) {
    return this.write({
      projectId: p.projectId,
      actorId: p.actorId,
      action: 'sprint.closed',
      diff: { sprintId: p.sprintId, movedTaskIds: p.movedTaskIds ?? [] },
      createdAt: p.at,
    });
  }

  @OnEvent(COMMENT_EVENTS.created, { async: true })
  onComment(p: CommentEventPayload) {
    return this.write({
      projectId: p.projectId,
      taskId: p.taskId,
      actorId: p.actorId,
      action: 'comment.created',
      diff: { commentId: p.commentId, mentions: p.mentionedUserIds },
      createdAt: p.at,
    });
  }

  @OnEvent(PROJECT_EVENTS.memberRemoved, { async: true })
  onMemberRemoved(p: ProjectMemberEventPayload) {
    return this.write({
      projectId: p.projectId,
      actorId: p.actorId,
      action: 'project.member.removed',
      diff: { userId: p.userId },
      createdAt: p.at,
    });
  }

  private async write(data: {
    projectId: string;
    taskId?: string;
    actorId: string | null;
    action: string;
    diff: Prisma.InputJsonValue | null;
    source?: 'MANUAL' | 'AI';
    createdAt: Date;
  }): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          projectId: data.projectId,
          taskId: data.taskId,
          actorId: data.actorId,
          action: data.action,
          diff: data.diff ?? undefined,
          source: data.source ?? 'MANUAL',
          createdAt: data.createdAt,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Không ghi được activity_logs (${data.action}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

/** Không có tên sự kiện trong payload wildcard → suy từ nội dung diff. */
export function inferTaskAction(p: TaskEventPayload): string {
  const keys = Object.keys(p.diff ?? {});
  if (keys.includes('assignees')) return TASK_EVENTS.assigned;
  if (keys.includes('columnId')) return TASK_EVENTS.moved;
  return TASK_EVENTS.updated;
}
