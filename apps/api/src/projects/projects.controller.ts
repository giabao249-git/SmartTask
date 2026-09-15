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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import {
  CreateProjectDto,
  LabelDto,
  PutColumnsDto,
  PutProjectMembersDto,
  UpdateLabelDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Dự án')
@ApiBearerAuth()
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('workspaces/:wsId/projects')
  @ApiQuery({ name: 'status', required: false, enum: ProjectStatus })
  @ApiOperation({
    summary:
      'Dự án trong workspace kèm số việc, sprint đang chạy, vai của tôi (UC-08)',
  })
  list(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query('status') status?: ProjectStatus,
  ) {
    return this.projects.list(user.id, wsId, status);
  }

  @Post('workspaces/:wsId/projects')
  @ApiOperation({
    summary: 'Tạo dự án (OWNER/ADMIN workspace): mã, PM, 4 cột Kanban mặc định',
  })
  create(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(user.id, wsId, dto);
  }

  @Get('projects/:projectId')
  @ApiOperation({
    summary: 'Chi tiết dự án: cột, nhãn, thành viên, quyền của tôi',
  })
  get(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.get(user.id, projectId);
  }

  @Patch('projects/:projectId')
  @ApiOperation({ summary: 'Sửa dự án (PM / quản trị workspace)' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.id, projectId, dto);
  }

  @Post('projects/:projectId/archive')
  @HttpCode(204)
  @ApiOperation({ summary: 'Lưu trữ dự án' })
  async archive(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    await this.projects.archive(user.id, projectId);
  }

  @Get('projects/:projectId/members')
  @ApiOperation({
    summary: 'Thành viên dự án kèm kỹ năng (bảng sự thật cho giao việc)',
  })
  members(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.members(user.id, projectId);
  }

  @Put('projects/:projectId/members')
  @ApiOperation({
    summary:
      'Thay toàn bộ thành viên dự án; đúng một PM; người bị gỡ mất assignee',
  })
  putMembers(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: PutProjectMembersDto,
  ) {
    return this.projects.putMembers(user.id, projectId, dto);
  }

  @Delete('projects/:projectId/members/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Gỡ một thành viên (không gỡ PM)' })
  async removeMember(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.projects.removeMember(user.id, projectId, userId);
  }

  @Get('projects/:projectId/columns')
  @ApiOperation({ summary: 'Cột Kanban kèm số task' })
  columns(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.columns(user.id, projectId);
  }

  @Put('projects/:projectId/columns')
  @ApiOperation({
    summary: 'Thay toàn bộ cột (thứ tự mảng, WIP, cột hoàn thành) (UC-12)',
  })
  putColumns(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: PutColumnsDto,
  ) {
    return this.projects.putColumns(user.id, projectId, dto);
  }

  @Get('projects/:projectId/labels')
  @ApiOperation({ summary: 'Nhãn của dự án' })
  labels(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.labels(user.id, projectId);
  }

  @Post('projects/:projectId/labels')
  @ApiOperation({ summary: 'Thêm nhãn' })
  createLabel(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: LabelDto,
  ) {
    return this.projects.createLabel(user.id, projectId, dto);
  }

  @Patch('labels/:id')
  @ApiOperation({ summary: 'Sửa nhãn' })
  updateLabel(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.projects.updateLabel(user.id, id, dto);
  }

  @Delete('labels/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá nhãn (PM)' })
  async deleteLabel(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.projects.deleteLabel(user.id, id);
  }

  @Get('projects/:projectId/dashboard')
  @ApiOperation({
    summary:
      'Thẻ số, việc theo cột/người (UC-33; tải & burn-down bổ sung Phase 5)',
  })
  dashboard(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.dashboard(user.id, projectId);
  }
}
