import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsCron } from './notifications.cron';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener, NotificationsCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
