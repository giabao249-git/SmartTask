import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateInvitationDto,
  CreateWorkspaceDto,
  ListMembersQueryDto,
  TransferOwnershipDto,
  UpdateMemberRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';
import { InvitationsService } from './invitations.service';
import { workspaceSettingsPatchSchema } from './workspace-settings';
import {
  WorkspacesService,
  type AuditActorContext,
} from './workspaces.service';

interface ReqMeta {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@ApiTags('Workspace')
@ApiBearerAuth()
@Controller()
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly invitations: InvitationsService,
  ) {}

  private actor(user: JwtUser, req?: ReqMeta): AuditActorContext {
    const ua = req?.headers?.['user-agent'];
    return {
      userId: user.id,
      email: user.email,
      ip: req?.ip,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    };
  }

  // ── Workspace ──────────────────────────────────────────────

  @Get('workspaces')
  @ApiOperation({ summary: 'Workspace của tôi kèm vai trò (UC-04)' })
  listMine(@CurrentUser() user: JwtUser) {
    return this.workspaces.listMine(user.id);
  }

  @Post('workspaces')
  @ApiOperation({
    summary:
      'Tạo workspace: người tạo là OWNER, nạp 30 kỹ năng mẫu, cài đặt mặc định',
  })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get('workspaces/:wsId')
  @WorkspaceRoles()
  @ApiOperation({ summary: 'Chi tiết workspace (thành viên)' })
  get(@Param('wsId', ParseUUIDPipe) wsId: string) {
    return this.workspaces.get(wsId);
  }

  @Patch('workspaces/:wsId')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Sửa tên, logo' })
  update(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(wsId, dto, this.actor(user, req));
  }

  @Post('workspaces/:wsId/archive')
  @WorkspaceRoles('OWNER')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Lưu trữ workspace (ẩn khỏi danh sách, không xoá dữ liệu)',
  })
  async archive(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
  ): Promise<void> {
    await this.workspaces.archive(wsId, this.actor(user, req));
  }

  @Post('workspaces/:wsId/transfer-ownership')
  @WorkspaceRoles('OWNER')
  @ApiOperation({
    summary: 'Chuyển quyền sở hữu cho một thành viên; chủ cũ thành ADMIN',
  })
  transfer(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.workspaces.transferOwnership(
      wsId,
      user.id,
      dto.userId,
      this.actor(user, req),
    );
  }

  // ── Cài đặt ────────────────────────────────────────────────

  @Get('workspaces/:wsId/settings')
  @WorkspaceRoles()
  @ApiOperation({
    summary:
      'Cài đặt: năng lực mặc định, ngày làm việc, ngưỡng tải, trọng số burnout, hạn mức AI, retention',
  })
  getSettings(@Param('wsId', ParseUUIDPipe) wsId: string) {
    return this.workspaces.getSettings(wsId);
  }

  @Patch('workspaces/:wsId/settings')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Cập nhật một phần cài đặt (gộp sâu)' })
  @ApiBody({
    schema: {
      type: 'object',
      example: {
        workload: { thresholds: { overload: 1.2 } },
        ai: { dailyLimitPerUser: 10 },
      },
    },
  })
  patchSettings(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
    @Body(new ZodValidationPipe(workspaceSettingsPatchSchema)) patch: unknown,
  ) {
    return this.workspaces.patchSettings(wsId, patch, this.actor(user, req));
  }

  // ── Nhật ký kiểm toán (Audit Log — OWNER & ADMIN) ──────────

  @Get('workspaces/:wsId/audit-logs')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({
    summary:
      'Nhật ký kiểm toán (Audit Log) cấp Workspace với chữ ký chuỗi HMAC-SHA256 bất biến',
  })
  auditLogs(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query('category') category?: string,
    @Query('actorId') actorId?: string,
    @Query('days') days?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workspaces.getAuditLogs(wsId, {
      category,
      actorId,
      days,
      q,
      page,
      limit,
    });
  }

  // ── Thành viên ─────────────────────────────────────────────

  @Get('workspaces/:wsId/members')
  @WorkspaceRoles()
  @ApiOperation({
    summary: 'Danh sách thành viên, lọc theo vai/tên/email (UC-05)',
  })
  members(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.workspaces.listMembers(wsId, query);
  }

  @Patch('workspaces/:wsId/members/:userId')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Đổi vai ADMIN/MEMBER/VIEWER' })
  updateRole(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaces.updateMemberRole(
      wsId,
      userId,
      dto.role,
      this.actor(user, req),
    );
  }

  @Delete('workspaces/:wsId/members/:userId')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Gỡ thành viên (không gỡ OWNER)' })
  async removeMember(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
  ): Promise<void> {
    await this.workspaces.removeMember(wsId, userId, this.actor(user, req));
  }

  // ── Lời mời ────────────────────────────────────────────────

  @Get('workspaces/:wsId/invitations')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Lời mời đang hiệu lực' })
  listInvitations(@Param('wsId', ParseUUIDPipe) wsId: string) {
    return this.invitations.list(wsId);
  }

  @Post('workspaces/:wsId/invitations')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({
    summary:
      'Tạo lời mời đích danh (email) hoặc link chung; trả token để ghép link /invite/:token',
  })
  async createInvitation(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
    @Body() dto: CreateInvitationDto,
  ) {
    const inv = await this.invitations.create(wsId, user.id, dto);
    const meta = this.actor(user, req);
    await this.workspaces.recordWorkspaceAudit({
      workspaceId: wsId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'member.invited',
      targetType: 'Invitation',
      targetId: inv.id,
      targetName: inv.email ?? 'Link mời dùng chung',
      category: 'MEMBER',
      beforeState: null,
      afterState: {
        email: inv.email ?? 'Link dùng chung',
        role: inv.role,
        expiresAt: inv.expiresAt.toISOString(),
      },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return inv;
  }

  @Delete('workspaces/:wsId/invitations/:id')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Thu hồi lời mời' })
  async revokeInvitation(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
    @Req() req: ReqMeta,
  ): Promise<void> {
    await this.invitations.revoke(wsId, id);
    const meta = this.actor(user, req);
    await this.workspaces.recordWorkspaceAudit({
      workspaceId: wsId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'member.invitation_revoked',
      targetType: 'Invitation',
      targetId: id,
      targetName: `Lời mời #${id.slice(0, 8)}`,
      category: 'MEMBER',
      beforeState: { status: 'PENDING' },
      afterState: { status: 'REVOKED' },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Xem trước lời mời (không cần đăng nhập)' })
  previewInvitation(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({
    summary:
      'Chấp nhận lời mời (cần đăng nhập; email phải khớp nếu mời đích danh)',
  })
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invitations.accept(token, user);
  }
}
