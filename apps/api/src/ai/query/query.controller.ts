import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { dataQuerySpecSchema } from '@smarttask/shared';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AiQueryService } from './query.service';
import { aiQueryBodySchema } from './query.dto';
import type { AiQueryDto } from './query.dto';

@ApiTags('Trợ lý AI · tra cứu')
@ApiBearerAuth()
@Controller('ai')
export class AiQueryController {
  constructor(private readonly query: AiQueryService) {}

  @Post('query')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Chạy lại một truy vấn tra cứu (docs 14) — KHÔNG gọi LLM, không tính hạn mức AI. Dùng cho nút "Làm mới" của khối dữ liệu trong chat.',
    description:
      'Chỉ đọc. Quyền theo người gọi trên dự án; `query` phải khớp schema DataQuerySpec (intent nằm trong enum, limit ≤ 100).',
  })
  run(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(aiQueryBodySchema)) body: AiQueryDto,
  ) {
    return this.query.run(dataQuerySpecSchema.parse(body.query), {
      userId: user.id,
      projectId: body.projectId,
      codes: null,
      sessionId: body.sessionId,
      messageId: body.messageId,
    });
  }
}
