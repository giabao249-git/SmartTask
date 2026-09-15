import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import {
  COMMENT_EVENTS,
  SPRINT_EVENTS,
  TASK_EVENTS,
  type CommentEventPayload,
  type SprintEventPayload,
  type TaskEventPayload,
} from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/** Thông báo sinh từ sự kiện — không gọi từ service nghiệp vụ. Mọi lỗi chỉ ghi log. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(TASK_EVENTS.assigned, { async: true })
  async onAssigned(p: TaskEventPayload): Promise<void> {
    try {
      const diff = p.diff?.assignees as
        { from: string[]; to: string[] } | undefined;
      const added = diff
        ? diff.to.filter((id) => !diff.from.includes(id))
        : p.affectedUserIds;
      if (!added.length) return;
      const t = await this.task(p.taskId);
      await this.notifications.notify({
        userIds: added,
        excludeUserId: p.actorId,
        type: NotificationType.TASK_ASSIGNED,
        title: `Bạn được giao ${t.key}: ${t.title}`,
        body: t.dueDate ? `Hạn ${t.dueDate}` : undefined,
        link: t.link,
        data: { taskId: p.taskId, projectId: p.projectId },
      });
    } catch (e) {
      this.warn('task.assigned', e);
    }
  }

  @OnEvent(TASK_EVENTS.created, { async: true })
  async onCreated(p: TaskEventPayload): Promise<void> {
    try {
      if (!p.affectedUserIds.length) return;
      const t = await this.task(p.taskId);
      await this.notifications.notify({
        userIds: p.affectedUserIds,
        excludeUserId: p.actorId,
        type: NotificationType.TASK_ASSIGNED,
        title: `Bạn được giao ${t.key}: ${t.title}`,
        link: t.link,
        data: { taskId: p.taskId, projectId: p.projectId, source: p.source },
      });
    } catch (e) {
      this.warn('task.created', e);
    }
  }

  @OnEvent(COMMENT_EVENTS.created, { async: true })
  @OnEvent(COMMENT_EVENTS.updated, { async: true })
  async onComment(p: CommentEventPayload): Promise<void> {
    try {
      if (!p.mentionedUserIds.length) return;
      const [t, actor] = await Promise.all([
        this.task(p.taskId),
        this.prisma.user.findUnique({
          where: { id: p.actorId },
          select: { fullName: true },
        }),
      ]);
      await this.notifications.notify({
        userIds: p.mentionedUserIds,
        excludeUserId: p.actorId,
        type: NotificationType.MENTIONED,
        title: `${actor?.fullName ?? 'Ai đó'} nhắc bạn trong ${t.key}`,
        body: t.title,
        link: `${t.link}#comment-${p.commentId}`,
        data: {
          taskId: p.taskId,
          commentId: p.commentId,
          projectId: p.projectId,
        },
      });
    } catch (e) {
      this.warn('comment', e);
    }
  }

  @OnEvent(SPRINT_EVENTS.started, { async: true })
  async onSprintStarted(p: SprintEventPayload): Promise<void> {
    await this.sprintNotice(p, NotificationType.SPRINT_STARTED, 'bắt đầu');
  }

  @OnEvent(SPRINT_EVENTS.closed, { async: true })
  async onSprintClosed(p: SprintEventPayload): Promise<void> {
    await this.sprintNotice(p, NotificationType.SPRINT_CLOSED, 'kết thúc');
  }

  private async sprintNotice(
    p: SprintEventPayload,
    type: NotificationType,
    verb: string,
  ): Promise<void> {
    try {
      const [sprint, members] = await Promise.all([
        this.prisma.sprint.findUnique({
          where: { id: p.sprintId },
          select: {
            name: true,
            project: { select: { key: true, name: true } },
          },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId: p.projectId },
          select: { userId: true },
        }),
      ]);
      if (!sprint) return;
      await this.notifications.notify({
        userIds: members.map((m) => m.userId),
        excludeUserId: p.actorId,
        type,
        title: `${sprint.name} (${sprint.project.key}) đã ${verb}`,
        body: p.movedTaskIds?.length
          ? `${p.movedTaskIds.length} việc chưa xong được chuyển đi`
          : undefined,
        link: `/p/${sprint.project.key}/sprints`,
        data: { sprintId: p.sprintId, projectId: p.projectId },
      });
    } catch (e) {
      this.warn(type, e);
    }
  }

  private async task(taskId: string) {
    const t = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: {
        number: true,
        title: true,
        dueDate: true,
        project: { select: { key: true } },
      },
    });
    const key = `${t.project.key}-${t.number}`;
    return {
      key,
      title: t.title,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      link: `/p/${t.project.key}/t/${key}`,
    };
  }

  private warn(ctx: string, e: unknown): void {
    this.logger.warn(
      `Không tạo được thông báo (${ctx}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
