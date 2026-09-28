import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { webLink } from './web-links';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/** 07:30 mỗi ngày (giờ VN): nhắc việc đến hạn hôm nay/ngày mai và việc quá hạn cho người thực hiện. */
@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('30 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async remindDueTasks(): Promise<void> {
    const today = new Date(new Date().toDateString());
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const open = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        completedAt: null,
        dueDate: { lte: tomorrow },
        assignees: { some: {} },
        project: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        number: true,
        title: true,
        dueDate: true,
        projectId: true,
        project: { select: { key: true } },
        assignees: { select: { userId: true } },
      },
    });
    let sent = 0;
    for (const t of open) {
      const overdue = t.dueDate! < today;
      const key = `${t.project.key}-${t.number}`;
      sent += await this.notifications.notify({
        userIds: t.assignees.map((a) => a.userId),
        type: overdue
          ? NotificationType.TASK_OVERDUE
          : NotificationType.TASK_DUE_SOON,
        title: overdue
          ? `${key} đã quá hạn`
          : `${key} đến hạn ${t.dueDate!.toISOString().slice(0, 10) === today.toISOString().slice(0, 10) ? 'hôm nay' : 'ngày mai'}`,
        body: t.title,
        link: webLink.task(t.projectId, key),
        data: { taskId: t.id, projectId: t.projectId },
      });
    }
    this.logger.log(`Nhắc hạn: ${open.length} việc, ${sent} thông báo`);
  }
}
