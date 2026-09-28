import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import {
  AddSprintTasksDto,
  CloseSprintDto,
  CreateSprintDto,
  UpdateSprintDto,
} from './dto/sprint.dto';
import { SprintsService } from './sprints.service';

@ApiTags('Sprint')
@ApiBearerAuth()
@Controller()
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('projects/:projectId/sprints')
  @ApiOperation({
    summary: 'Sprint của dự án kèm số việc, giờ ước lượng/còn lại (UC-09)',
  })
  list(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.sprints.list(user.id, projectId);
  }

  @Post('projects/:projectId/sprints')
  @ApiOperation({ summary: 'Tạo sprint (PM)' })
  create(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprints.create(user.id, projectId, dto);
  }

  @Get('sprints/:id')
  get(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.get(user.id, id);
  }

  @Get('sprints/:id/summary')
  @ApiOperation({
    summary:
      'Tóm tắt sprint: cam kết/hoàn thành/còn lại, năng lực nhóm trong cửa sổ, theo người, việc bị đẩy đi / chuyển vào / thêm sau khi bắt đầu (UC-09, UC-30)',
  })
  summary(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sprints.summary(user.id, id);
  }

  @Patch('sprints/:id')
  @ApiOperation({ summary: 'Sửa sprint chưa đóng' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprints.update(user.id, id, dto);
  }

  @Post('sprints/:id/start')
  @ApiOperation({
    summary:
      'Bắt đầu sprint — một ACTIVE mỗi dự án (409 SPRINT_ALREADY_ACTIVE); chốt scope giờ ban đầu',
  })
  start(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.start(user.id, id);
  }

  @Post('sprints/:id/close')
  @ApiOperation({
    summary: 'Kết thúc sprint; việc chưa xong về backlog hoặc sang sprint khác',
  })
  close(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseSprintDto,
  ) {
    return this.sprints.close(user.id, id, dto);
  }

  @Post('sprints/:id/tasks')
  @ApiOperation({ summary: 'Kéo task vào sprint' })
  addTasks(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSprintTasksDto,
  ) {
    return this.sprints.addTasks(user.id, id, dto);
  }
}
