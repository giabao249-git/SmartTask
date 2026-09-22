import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import {
  RequirePlatformRole,
  SystemAdmin,
} from '../common/decorators/system-admin.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SystemAdminGuard } from '../common/guards/system-admin.guard';
import { AdminService } from './admin.service';
import {
  CreateSupportSessionDto,
  QueryUsersDto,
  QueryWorkspacesDto,
  SetMaintenanceModeDto,
  UpdateUserPlatformRoleDto,
  UpdateWorkspaceStatusDto,
} from './dto/admin.dto';

@ApiTags('Quản trị Toàn Nền tảng (Platform Super Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SystemAdminGuard)
@SystemAdmin()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Thống kê tổng quan nền tảng (KPIs, Workspaces, Users, AI FinOps)',
  })
  getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('workspaces')
  @ApiOperation({
    summary: 'Danh sách Workspace toàn hệ thống có phân trang & lọc trạng thái',
  })
  listWorkspaces(@Query() query: QueryWorkspacesDto) {
    return this.adminService.listWorkspaces(query);
  }

  @Patch('workspaces/:id/status')
  @ApiOperation({
    summary:
      'Cập nhật trạng thái vòng đời Workspace (Active, Suspended, Grace)',
  })
  @RequirePlatformRole('ROOT_ADMIN', 'FINOPS_OPERATOR')
  updateWorkspaceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceStatusDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    return this.adminService.updateWorkspaceStatus(id, dto, user, ip, ua);
  }

  @Get('users')
  @ApiOperation({ summary: 'Danh sách Người dùng toàn sàn' })
  listUsers(@Query() query: QueryUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/platform-role')
  @ApiOperation({
    summary: 'Cấp/hạ quyền Super Admin hoặc vai trò Quản trị Nền tảng',
  })
  @RequirePlatformRole('ROOT_ADMIN')
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPlatformRoleDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    return this.adminService.updateUserPlatformRole(id, dto, user, ip, ua);
  }

  @Post('users/:id/revoke-sessions')
  @ApiOperation({
    summary: 'Thu hồi toàn bộ phiên đăng nhập của người dùng (Kill switch)',
  })
  @RequirePlatformRole('ROOT_ADMIN', 'SECURITY_AUDITOR')
  revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    return this.adminService.revokeUserSessions(id, user, ip, ua);
  }

  @Get('ai/costs')
  @ApiOperation({ summary: 'Báo cáo chi phí AI FinOps theo Model & Provider' })
  @RequirePlatformRole('ROOT_ADMIN', 'FINOPS_OPERATOR')
  getAiCosts(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.adminService.getAiFinOpsCosts(daysNum);
  }

  @Get('health/telemetry')
  @ApiOperation({
    summary: 'Giám sát Telemetry, tài nguyên Node.js process & database',
  })
  @RequirePlatformRole('ROOT_ADMIN', 'SECURITY_AUDITOR')
  getTelemetry() {
    return this.adminService.getSystemTelemetry();
  }

  @Post('system/maintenance')
  @ApiOperation({
    summary: 'Bật/tắt Chế độ bảo trì hệ thống (Disabled, Read-Only, Full)',
  })
  @RequirePlatformRole('ROOT_ADMIN')
  setMaintenance(
    @Body() dto: SetMaintenanceModeDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    return this.adminService.setMaintenanceMode(dto, user, ip, ua);
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Xem Nhật ký Kiểm toán Bất biến (SOC 2, kèm kiểm tra HMAC chain)',
  })
  @RequirePlatformRole('ROOT_ADMIN', 'SECURITY_AUDITOR')
  getAuditLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAuditLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 25,
    );
  }

  @Post('support-sessions')
  @ApiOperation({
    summary:
      'Mở phiên hỗ trợ khách hàng có ủy quyền (Customer Consent Impersonation)',
  })
  @RequirePlatformRole('ROOT_ADMIN', 'CUSTOMER_SUPPORT')
  createSupportSession(
    @Body() dto: CreateSupportSessionDto,
    @CurrentUser() user: JwtUser,
    @Ip() ip?: string,
    @Headers('user-agent') ua?: string,
  ) {
    return this.adminService.createSupportSession(dto, user, ip, ua);
  }
}
