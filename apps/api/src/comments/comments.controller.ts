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
import { ProjectAccessService } from '../common/access/project-access.service';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  PageQueryDto,
  SuggestQueryDto,
  UpdateCommentDto,
} from './dto/comment.dto';
import { MemberSearchService } from './search/member-search.service';

@ApiTags('Bình luận')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly search: MemberSearchService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get('tasks/:id/comments')
  @ApiOperation({ summary: 'Bình luận của task theo trang (UC-18)' })
  list(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PageQueryDto,
  ) {
    return this.comments.list(user.id, id, q);
  }

  @Post('tasks/:id/comments')
  @ApiOperation({
    summary:
      'Viết bình luận (markdown nhẹ), @mention thành viên dự án → thông báo',
  })
  create(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.id, id, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({ summary: 'Sửa bình luận của mình' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(user.id, id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá mềm (tác giả hoặc PM)' })
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.comments.remove(user.id, id);
  }

  @Get('projects/:projectId/members/suggest')
  @ApiOperation({
    summary:
      'Gợi ý @mention: Elasticsearch (khi có) hoặc pg_trgm — không dấu, gõ thiếu, sai ký tự, email; trả { provider, items }',
  })
  async suggest(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: SuggestQueryDto,
  ) {
    await this.access.assertRead(user.id, projectId);
    return this.search.suggestProjectMembers(projectId, q.q, q.limit ?? 8);
  }
}
