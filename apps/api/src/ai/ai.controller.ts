import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import {
  ApplyProposalDto,
  DecomposeDto,
  PatchItemDto,
  QuotaQueryDto,
  RejectProposalDto,
} from './dto/ai.dto';
import { QuotaService } from './quota/quota.service';

/** 3.11 AI (MVP) — docs/04-kien-truc/11. Mọi ghi DB chỉ xảy ra ở `apply` sau khi PM xác nhận. */
@ApiTags('AI')
@ApiBearerAuth()
@Controller()
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly quota: QuotaService,
  ) {}

  @Post('projects/:id/ai/decompose')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Phân rã yêu cầu thành task (UC-28) — LLM đề xuất, Validator kiểm, trả DRAFT để xem trước',
    description:
      'Trả { proposalId, action, validation, cached, usage }. 429 hết hạn mức; 503 AI lỗi; 409 đang có lượt chưa xong. ' +
      'action.type = ASK_CLARIFICATION khi yêu cầu mơ hồ (proposalId = null).',
  })
  decompose(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: DecomposeDto,
  ) {
    return this.ai.decompose(user.id, projectId, dto);
  }

  @Get('ai/proposals/:id')
  @ApiOperation({ summary: 'Xem đề xuất (payload, validation, trạng thái)' })
  proposal(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ai.getProposal(user.id, id);
  }

  @Post('ai/proposals/:id/apply')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Lặp với cùng khoá → trả kết quả cũ',
  })
  @ApiOperation({
    summary:
      'Áp dụng đề xuất sau khi PM sửa/xác nhận → tạo task qua TasksService',
    description:
      '422 PROPOSAL_VALIDATION_FAILED kèm errors[] khi bản đã sửa không qua Validator; 409 đã áp dụng; 410 hết hạn.',
  })
  apply(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyProposalDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ai.apply(user.id, id, dto, idempotencyKey);
  }

  @Post('ai/proposals/:id/reject')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Từ chối đề xuất toàn bộ hoặc một phần (draftKeys) — ghi ai_feedback',
  })
  async reject(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectProposalDto,
  ): Promise<void> {
    await this.ai.reject(user.id, id, dto.reason, dto.draftKeys);
  }

  @Patch('ai/proposals/:id/items/:draftKey')
  @ApiOperation({
    summary:
      'Người sửa tay một item trên panel (không qua LLM) — kèm version; 409 khi lệch',
  })
  patchItem(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('draftKey') draftKey: string,
    @Body() dto: PatchItemDto,
  ) {
    return this.ai.patchItem(user.id, id, draftKey, dto);
  }

  @Get('ai/quota')
  @ApiOperation({ summary: 'Hạn mức AI hôm nay của tôi (UC-32)' })
  quotaOf(@CurrentUser() user: JwtUser, @Query() q: QuotaQueryDto) {
    return this.quota.status(user.id, q.workspaceId ?? null);
  }

  @Post('sprints/:id/forecast/explain')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Giải thích rủi ro trễ hạn bằng AI (UC-31) — số liệu và mức từ backend, AI chỉ diễn giải; cache 6 h',
  })
  explain(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) sprintId: string,
  ) {
    return this.ai.explain(user.id, sprintId);
  }
}
