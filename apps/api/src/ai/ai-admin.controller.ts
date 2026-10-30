import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiPromptType, AiPurpose, WorkspaceRole } from '@prisma/client';
import { AppError } from '../common/app-error';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { AiConfigService } from './ai-config/ai-config.service';
import {
  CreateAiConfigDto,
  PutPromptDto,
  UpdateAiConfigDto,
  UpdateModelCatalogDto,
  UpsertModelCatalogDto,
  UsageCallsQueryDto,
  UsageQueryDto,
} from './ai-config/dto/ai-config.dto';
import { AiProviderService } from './provider/ai-provider.service';

/** 3.12 Quản trị AI (UC-40, 32): catalog model, cấu hình theo workspace/mục đích, prompt có phiên bản, sổ token. */
@ApiTags('Quản trị AI')
@ApiBearerAuth()
@Controller()
export class AiAdminController {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly provider: AiProviderService,
  ) {}

  // ── Danh mục model (toàn hệ thống) ─────────────────────────

  @Get('ai-config/models')
  @ApiOperation({
    summary: 'Danh mục model + năng lực + giá (chỉ model đã thử thật)',
  })
  models(@Query('includeInactive') includeInactive?: string) {
    return this.aiConfig.listModels(includeInactive === 'true');
  }

  @Post('ai-config/models')
  @ApiOperation({
    summary:
      'Thêm/cập nhật model — SYSTEM_ADMIN_EMAILS hoặc tài khoản Platform Admin (ROOT_ADMIN)',
  })
  async upsertModel(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertModelCatalogDto,
  ) {
    await this.aiConfig.assertSystemAdmin(user);
    return this.aiConfig.upsertModel(dto);
  }

  @Patch('ai-config/models/:id')
  @ApiOperation({
    summary:
      'Sửa giá/năng lực model — SYSTEM_ADMIN_EMAILS hoặc tài khoản Platform Admin (ROOT_ADMIN)',
  })
  async updateModel(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModelCatalogDto,
  ) {
    await this.aiConfig.assertSystemAdmin(user);
    return this.aiConfig.updateModel(id, dto);
  }

  // ── Cấu hình theo workspace ────────────────────────────────

  @Get('workspaces/:wsId/ai-configs')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  @ApiOperation({ summary: 'Cấu hình AI của workspace (khoá đã che)' })
  listConfigs(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
  ) {
    return this.aiConfig.listConfigs(wsId, user.id);
  }

  @Post('workspaces/:wsId/ai-configs')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary:
      'Thêm cấu hình AI (khoá mã hoá AES-GCM, hỗ trợ BYOK cá nhân/đội nhóm)',
  })
  createConfig(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Body() dto: CreateAiConfigDto,
  ) {
    return this.aiConfig.createConfig(wsId, user.id, dto);
  }

  @Patch('ai-configs/:id')
  @ApiOperation({ summary: 'Sửa cấu hình' })
  updateConfig(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiConfigDto,
  ) {
    return this.aiConfig.updateConfig(user.id, id, dto);
  }

  @Delete('ai-configs/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá cấu hình' })
  async deleteConfig(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.aiConfig.deleteConfig(user.id, id);
  }

  @Post('ai-configs/:id/test')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Gọi thử một lượt ngắn → { ok, latencyMs, model, reply | error }',
  })
  async testConfig(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const config = await this.aiConfig.resolveById(user.id, id);
    const started = Date.now();
    try {
      const r = await this.provider.call({
        config: { ...config, purpose: AiPurpose.GENERAL },
        purpose: AiPurpose.GENERAL,
        system:
          'Bạn là trợ lý kiểm tra kết nối. Trả về đúng JSON {"type":"CHAT_RESPONSE","reply":"pong"}.',
        userText: 'ping',
        staticHash: 'test',
        endpoint: 'POST /ai-configs/:id/test',
        workspaceId: config.workspaceId,
        userId: user.id,
        userMessage: 'ping',
        maxOutputTokens: 256,
      });
      return {
        ok: true,
        latencyMs: Date.now() - started,
        provider: r.provider,
        model: r.model,
        reply: r.text.slice(0, 300),
        usage: r.usage,
      };
    } catch (e) {
      const err =
        e instanceof AppError
          ? (e.getResponse() as { message?: string })
          : { message: String(e) };
      return {
        ok: false,
        latencyMs: Date.now() - started,
        provider: config.provider,
        model: config.model,
        error: err.message,
      };
    }
  }

  // ── Prompt có phiên bản ────────────────────────────────────

  @Get('workspaces/:wsId/ai-prompts/:type')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  @ApiOperation({
    summary: 'Prompt đang hiệu lực (MASTER chỉ đọc, WORKSPACE sửa được)',
  })
  getPrompt(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('type', new ParseEnumPipe(AiPromptType)) type: AiPromptType,
  ) {
    return this.aiConfig.getPrompt(wsId, type);
  }

  @Put('workspaces/:wsId/ai-prompts/:type')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Ghi phiên bản mới của WORKSPACE prompt (bản cũ giữ lại)',
  })
  putPrompt(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Param('type', new ParseEnumPipe(AiPromptType)) type: AiPromptType,
    @Body() dto: PutPromptDto,
  ) {
    return this.aiConfig.putPrompt(
      wsId,
      user.id,
      type,
      dto.content,
      dto.changeNote,
    );
  }

  // ── Sổ token ───────────────────────────────────────────────

  @Get('workspaces/:wsId/ai-usage/calls')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary:
      'Nhật ký từng lượt gọi AI (không gộp): thời điểm, người gọi, mục đích, model, token, chi phí, trạng thái',
  })
  usageCalls(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query() q: UsageCallsQueryDto,
  ) {
    return this.aiConfig.usageCalls(wsId, q);
  }

  @Get('workspaces/:wsId/ai-usage')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Chi phí/token theo ngày | mục đích | người (UC-32, 40)',
  })
  usage(@Param('wsId', ParseUUIDPipe) wsId: string, @Query() q: UsageQueryDto) {
    return this.aiConfig.usage(wsId, q);
  }
}
