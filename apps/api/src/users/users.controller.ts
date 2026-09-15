import { Body, Controller, Get, HttpCode, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { NotificationPrefsDto } from './dto/notification-prefs.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Tài khoản')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Hồ sơ của tôi + danh sách workspace kèm vai trò (UC-03)',
  })
  me(@CurrentUser() user: JwtUser) {
    return this.users.me(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật tên, tên gọi ngắn, ảnh, múi giờ' })
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Đổi mật khẩu (thu hồi mọi phiên khác)' })
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(user.id, dto);
  }

  @Put('notification-prefs')
  @ApiOperation({ summary: 'Tuỳ chọn kênh thông báo in-app / push' })
  setNotificationPrefs(
    @CurrentUser() user: JwtUser,
    @Body() dto: NotificationPrefsDto,
  ) {
    return this.users.setNotificationPrefs(user.id, dto);
  }
}
