import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, type Prisma } from '@prisma/client';
import { NOTIFICATION_EVENTS } from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';

/** Ánh xạ loại thông báo → khoá tuỳ chọn trong users.notification_prefs.inApp (mặc định bật). */
const PREF_KEY: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'taskAssigned',
  MENTIONED: 'mentioned',
  TASK_DUE_SOON: 'taskDue',
  TASK_OVERDUE: 'taskDue',
  WORKLOAD_ALERT: 'workloadAlert',
  SPRINT_STARTED: 'sprint',
  SPRINT_CLOSED: 'sprint',
  AI_PROPOSAL_APPLIED: 'ai',
  INVITATION: 'taskAssigned',
};

export interface NotifyInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  data?: Prisma.InputJsonValue;
  /** Không gửi cho chính người gây ra sự kiện */
  excludeUserId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Tạo thông báo cho nhiều người, tôn trọng tuỳ chọn in-app; phát notification.created cho từng người (socket Phase 6). */
  async notify(input: NotifyInput): Promise<number> {
    const targets = [...new Set(input.userIds)].filter(
      (id) => id !== input.excludeUserId,
    );
    if (!targets.length) return 0;
    const users = await this.prisma.user.findMany({
      where: { id: { in: targets }, isActive: true },
      select: { id: true, notificationPrefs: true },
    });
    const allowed = users
      .filter((u) => this.inAppEnabled(u.notificationPrefs, input.type))
      .map((u) => u.id);
    if (!allowed.length) return 0;
    const rows = allowed.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      data: input.data,
    }));
    await this.prisma.notification.createMany({ data: rows });
    const created = await this.prisma.notification.findMany({
      where: { userId: { in: allowed }, type: input.type, title: input.title },
      orderBy: { createdAt: 'desc' },
      take: allowed.length,
    });
    for (const n of created)
      this.events.emit(NOTIFICATION_EVENTS.created, {
        notification: n,
        userId: n.userId,
      });
    return allowed.length;
  }

  async list(userId: string, unreadOnly: boolean, page = 1, limit = 30) {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return {
      count: await this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  private inAppEnabled(prefs: unknown, type: NotificationType): boolean {
    const p = prefs as { inApp?: Record<string, boolean> } | null;
    const v = p?.inApp?.[PREF_KEY[type]];
    return v === undefined ? true : v;
  }
}
