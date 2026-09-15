import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
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
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import {
  CreateSkillDto,
  MergeSkillDto,
  PutMySkillsDto,
  SkillMatrixQueryDto,
  UpdateSkillDto,
  VerifySkillDto,
} from './dto/skill.dto';
import { SkillsService } from './skills.service';

@ApiTags('Kỹ năng')
@ApiBearerAuth()
@Controller()
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get('workspaces/:wsId/skills')
  @WorkspaceRoles()
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOperation({ summary: 'Danh mục kỹ năng theo nhóm (UC-06)' })
  list(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    return this.skills.list(wsId, includeInactive ?? false);
  }

  @Post('workspaces/:wsId/skills')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Thêm kỹ năng (từ chối nếu trùng tên/alias)' })
  create(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Body() dto: CreateSkillDto,
  ) {
    return this.skills.create(wsId, dto);
  }

  @Patch('skills/:id')
  @ApiOperation({
    summary: 'Sửa tên/nhóm/alias/ẩn (OWNER/ADMIN của workspace chứa kỹ năng)',
  })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skills.update(user.id, id, dto);
  }

  @Post('skills/:id/merge')
  @ApiOperation({
    summary:
      'Gộp kỹ năng này vào kỹ năng đích (chuyển user_skills, task_skills, alias)',
  })
  merge(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeSkillDto,
  ) {
    return this.skills.merge(user.id, id, dto);
  }

  @Get('workspaces/:wsId/skill-matrix')
  @WorkspaceRoles()
  @ApiOperation({
    summary: 'Heatmap thành viên × kỹ năng + bus factor (UC-23)',
  })
  matrix(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query() query: SkillMatrixQueryDto,
  ) {
    return this.skills.matrix(wsId, query);
  }

  @Get('workspaces/:wsId/me/skills')
  @WorkspaceRoles()
  @ApiOperation({ summary: 'Kỹ năng của tôi trong workspace (UC-22)' })
  mySkills(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
  ) {
    return this.skills.mySkills(user.id, wsId);
  }

  @Put('workspaces/:wsId/me/skills')
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({
    summary:
      'Khai/đổi toàn bộ kỹ năng của tôi (mức 1–5); đổi mức thì mất xác nhận',
  })
  putMySkills(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Body() dto: PutMySkillsDto,
  ) {
    return this.skills.putMySkills(user.id, wsId, dto);
  }

  @Patch('users/:userId/skills/:skillId/verify')
  @ApiOperation({ summary: 'OWNER/ADMIN xác nhận mức kỹ năng của thành viên' })
  verify(
    @CurrentUser() user: JwtUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Body() dto: VerifySkillDto,
  ) {
    return this.skills.verify(user.id, userId, skillId, dto.level);
  }
}
