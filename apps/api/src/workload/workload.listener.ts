import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PROJECT_EVENTS,
  SPRINT_EVENTS,
  type ProjectMemberEventPayload,
  type SprintEventPayload,
  type TaskEventPayload,
} from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from './workload.service';

/** Tính lại tải khi task/thành viên/sprint đổi (gộp 500 ms) và mỗi sáng 07:00. */
@Injectable()
export class WorkloadListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workload: WorkloadService,
  ) {}

  @OnEvent('task.*', { async: true })
  async onTask(p: TaskEventPayload): Promise<void> {
    if (!p.affectedUserIds.length) return;
    const project = await this.prisma.project.findUnique({
      where: { id: p.projectId },
      select: { workspaceId: true },
    });
    if (project)
      this.workload.scheduleRecompute(project.workspaceId, p.affectedUserIds);
  }

  @OnEvent(PROJECT_EVENTS.memberRemoved, { async: true })
  async onMemberRemoved(p: ProjectMemberEventPayload): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: p.projectId },
      select: { workspaceId: true },
    });
    if (project)
      this.workload.scheduleRecompute(project.workspaceId, [p.userId]);
  }

  @OnEvent(SPRINT_EVENTS.closed, { async: true })
  async onSprintClosed(p: SprintEventPayload): Promise<void> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: p.projectId },
      select: { userId: true, project: { select: { workspaceId: true } } },
    });
    if (members.length)
      this.workload.scheduleRecompute(
        members[0].project.workspaceId,
        members.map((m) => m.userId),
      );
  }

  @Cron('0 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async morningScan(): Promise<void> {
    const workspaces = await this.prisma.workspace.findMany({
      where: { archivedAt: null },
      select: { id: true },
    });
    for (const ws of workspaces) await this.workload.snapshotWorkspace(ws.id);
  }
}
