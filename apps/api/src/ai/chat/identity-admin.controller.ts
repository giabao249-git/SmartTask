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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiPromptType, WorkspaceRole } from '@prisma/client';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { WorkspaceRoles } from '../../common/decorators/workspace-roles.decorator';
import { AiConfigService } from '../ai-config/ai-config.service';
import { PutPromptDto } from '../ai-config/dto/ai-config.dto';
import { CreateAliasDto, MemberIdentityDto } from '../dto/ai.dto';
import { IdentityService } from './identity.service';

/**
 * Admin quản DANH TÍNH cho LLM nhận diện người (docs 12 §4–5): chính sách chọn người ở WORKSPACE prompt,
 * alias + chức danh/phòng ban/quản lý là DỮ LIỆU — backend chỉ cấp, LLM tự đối chiếu, không chắc thì hỏi lại.
 */
@ApiTags('Quản trị AI')
@ApiBearerAuth()
@Controller('workspaces/:wsId')
export class IdentityAdminController {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly identity: IdentityService,
  ) {}

  @Get('ai/prompt')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary:
      'WORKSPACE prompt đang hiệu lực (chính sách chọn người, giọng điệu…)',
  })
  getPrompt(@Param('wsId', ParseUUIDPipe) wsId: string) {
    return this.aiConfig.getPrompt(wsId, AiPromptType.WORKSPACE);
  }

  @Put('ai/prompt')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Ghi phiên bản mới của WORKSPACE prompt' })
  putPrompt(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Body() dto: PutPromptDto,
  ) {
    return this.aiConfig.putPrompt(
      wsId,
      user.id,
      AiPromptType.WORKSPACE,
      dto.content,
      dto.changeNote,
    );
  }

  @Get('member-aliases')
  @WorkspaceRoles()
  @ApiOperation({ summary: 'Bí danh thành viên ("chị Lan", "Minh BE")' })
  aliases(@Param('wsId', ParseUUIDPipe) wsId: string) {
    return this.identity.listAliases(wsId);
  }

  @Post('member-aliases')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Thêm bí danh (unique theo workspace, không phân biệt hoa thường)',
  })
  addAlias(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Body() dto: CreateAliasDto,
  ) {
    return this.identity.addAlias(wsId, user.id, dto);
  }

  @Delete('member-aliases/:id')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá bí danh' })
  async removeAlias(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.identity.removeAlias(wsId, id);
  }

  @Patch('members/:userId/identity')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Chức danh / phòng ban / quản lý trực tiếp của thành viên',
  })
  identityOf(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: MemberIdentityDto,
  ) {
    return this.identity.setIdentity(wsId, userId, dto);
  }
}
