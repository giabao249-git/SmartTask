import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Thông báo')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: 'Thông báo của tôi (UC-20)' })
  list(
    @CurrentUser() user: JwtUser,
    @Query('unread', new ParseBoolPipe({ optional: true })) unread?: boolean,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.notifications.list(
      user.id,
      unread ?? false,
      page ?? 1,
      Math.min(limit ?? 30, 100),
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số chưa đọc (chuông)' })
  unreadCount(@CurrentUser() user: JwtUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch(':id/read')
  @HttpCode(204)
  async read(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: JwtUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }
}
