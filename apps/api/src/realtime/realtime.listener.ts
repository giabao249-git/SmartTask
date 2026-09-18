import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  COMMENT_EVENTS,
  NOTIFICATION_EVENTS,
  SPRINT_EVENTS,
  type CommentEventPayload,
  type SprintEventPayload,
  type TaskEventPayload,
} from '../common/events/task.events';
import { AI_EVENTS, type AiProposalAppliedPayload } from '../ai/ai.events';
import { FORECAST_EVENTS } from '../forecast/forecast.service';
import { PrismaService } from '../prisma/prisma.service';
import { WORKLOAD_EVENTS } from '../workload/workload.service';
import { RealtimeGateway } from './realtime.gateway';

/** Cầu nối sự kiện nội bộ → socket (docs 11 §4). Payload gọn: id + version + actor; client dùng version để bỏ sự kiện cũ. */
@Injectable()
export class RealtimeListener {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('task.*', { async: true })
  async onTask(p: TaskEventPayload): Promise<void> {
    const kind = (p.event ?? 'task.updated').split('.')[1];
    if (kind === 'deleted') {
      this.gateway.toProject(p.projectId, 'task:deleted', {
        taskId: p.taskId,
        projectId: p.projectId,
        version: p.version,
        actorId: p.actorId,
        at: p.at,
      });
      return;
    }
    const task = await this.prisma.task.findUnique({
      where: { id: p.taskId },
      select: {
        id: true,
        projectId: true,
        sprintId: true,
        parentId: true,
        columnId: true,
        number: true,
        title: true,
        priority: true,
        isUrgent: true,
        difficulty: true,
        startDate: true,
        dueDate: true,
        estimateHours: true,
        remainingHours: true,
        progress: true,
        position: true,
        version: true,
        source: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
        assignees: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    });
    if (!task) return;
    this.gateway.toProject(p.projectId, `task:${kind}`, {
      task: {
        ...task,
        estimateHours:
          task.estimateHours === null ? null : Number(task.estimateHours),
        remainingHours:
          task.remainingHours === null ? null : Number(task.remainingHours),
        assigneeIds: task.assignees.map((a) => a.userId),
        labelIds: task.labels.map((l) => l.labelId),
        assignees: undefined,
        labels: undefined,
      },
      diffKeys: Object.keys(p.diff ?? {}),
      version: task.version,
      actorId: p.actorId,
      source: p.source,
      at: p.at,
    });
  }

  @OnEvent(COMMENT_EVENTS.created)
  @OnEvent(COMMENT_EVENTS.updated)
  @OnEvent(COMMENT_EVENTS.deleted)
  onComment(p: CommentEventPayload): void {
    const kind = (p.event ?? 'comment.created').split('.')[1];
    this.gateway.toProject(p.projectId, `comment:${kind}`, {
      taskId: p.taskId,
      commentId: p.commentId,
      actorId: p.actorId,
      mentionedUserIds: p.mentionedUserIds,
      at: p.at,
    });
  }

  @OnEvent(SPRINT_EVENTS.started)
  @OnEvent(SPRINT_EVENTS.closed)
  @OnEvent(SPRINT_EVENTS.updated)
  onSprint(p: SprintEventPayload): void {
    this.gateway.toProject(p.projectId, 'sprint:updated', {
      sprintId: p.sprintId,
      movedTaskIds: p.movedTaskIds ?? [],
      actorId: p.actorId,
      at: p.at,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.created)
  onNotification(p: { userId: string; notification: unknown }): void {
    this.gateway.toUser(p.userId, 'notification:new', {
      notification: p.notification,
    });
  }

  @OnEvent(WORKLOAD_EVENTS.updated)
  onWorkload(p: {
    workspaceId: string;
    userId: string;
    weekStart: string;
    utilization: number;
    level: string;
    riskScore: number;
    projectIds: string[];
  }): void {
    const payload = {
      userId: p.userId,
      weekStart: p.weekStart,
      utilization: p.utilization,
      level: p.level,
      riskScore: p.riskScore,
    };
    this.gateway.toUser(p.userId, 'workload:updated', payload);
    for (const projectId of p.projectIds)
      this.gateway.toProject(projectId, 'workload:updated', payload);
  }

  @OnEvent(FORECAST_EVENTS.riskChanged)
  onRisk(p: {
    sprintId: string;
    projectId: string;
    from: string;
    to: string;
  }): void {
    this.gateway.toProject(p.projectId, 'forecast:risk', {
      sprintId: p.sprintId,
      from: p.from,
      to: p.to,
    });
  }

  @OnEvent(AI_EVENTS.proposalApplied)
  onProposalApplied(p: AiProposalAppliedPayload): void {
    this.gateway.toProject(p.projectId, 'ai:proposal:applied', {
      proposalId: p.proposalId,
      kind: p.kind,
      taskIds: p.taskIds,
      actorId: p.actorId,
      at: p.at,
    });
  }
}
