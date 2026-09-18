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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  ChatDto,
  CreateSessionDto,
  PatchSessionDto,
  SessionsQueryDto,
} from '../dto/ai.dto';
import { ChatService } from './chat.service';

/** Chat theo phiên với bản nháp sửa nhiều lượt (docs 12 §5). Mọi route tự chủ sở hữu phiên (`session.userId === req.user`). */
@ApiTags('AI · Chat')
@ApiBearerAuth()
@Controller('ai')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('chat')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Một lượt chat (UC-38/39) — tạo phiên lười nếu thiếu; trả action + validation + TOÀN BỘ proposal của phiên',
    description:
      '409 AI_TURN_IN_PROGRESS khi lượt trước chưa xong; 429 hạn mức; 503 AI lỗi. Không lượt nào ghi task thật — chỉ POST /ai/proposals/:id/apply.',
  })
  chatTurn(@CurrentUser() user: JwtUser, @Body() dto: ChatDto) {
    return this.chat.chat(user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Phiên của tôi (mặc định chưa lưu trữ), kèm số nháp mở',
  })
  sessions(@CurrentUser() user: JwtUser, @Query() q: SessionsQueryDto) {
    return this.chat.listSessions(
      user.id,
      q.projectId,
      q.includeArchived ?? false,
    );
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Tạo phiên trống' })
  createSession(@CurrentUser() user: JwtUser, @Body() dto: CreateSessionDto) {
    return this.chat.createSession(user.id, dto);
  }

  @Get('sessions/:id')
  @ApiOperation({
    summary: '{ session, messages[], proposals[] } — dùng khi mở lại phiên',
  })
  session(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.getSession(user.id, id);
  }

  @Get('sessions/:id/proposals')
  @ApiOperation({ summary: 'Bản nháp của phiên (cho panel refetch)' })
  sessionProposals(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.sessionProposals(user.id, id);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Đổi tiêu đề / lưu trữ / mở lại' })
  patchSession(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchSessionDto,
  ) {
    return this.chat.patchSession(user.id, id, dto);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Xoá phiên — nháp DRAFT → REJECTED, task đã tạo giữ nguyên',
  })
  async deleteSession(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.chat.deleteSession(user.id, id);
  }
}
