import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
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
import {
  AssigneesDto,
  CreateSubtaskDto,
  CreateTaskDto,
  DuplicateTaskDto,
  ListTasksQueryDto,
  MoveTaskDto,
  MyTasksQueryDto,
  ProgressDto,
  TaskLabelsDto,
  TaskSkillsDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Công việc')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('projects/:projectId/tasks')
  @ApiOperation({
    summary:
      'Task của dự án (Kanban/Gantt/danh sách dùng chung); since= trả phần chênh + deletedIds (UC-12, 13, 15, 17)',
  })
  list(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: ListTasksQueryDto,
  ) {
    return this.tasks.list(user.id, projectId, q);
  }

  @Post('projects/:projectId/tasks')
  @ApiOperation({
    summary: 'Tạo task (thành viên dự án); mã ST-n tự tăng (UC-10)',
  })
  create(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(user.id, projectId, dto);
  }

  @Get('me/tasks')
  @ApiOperation({ summary: 'Việc của tôi xuyên dự án (UC-15)' })
  myTasks(@CurrentUser() user: JwtUser, @Query() q: MyTasksQueryDto) {
    return this.tasks.myTasks(user.id, q);
  }

  @Get('workspaces/:wsId/tasks/search')
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: 'Tìm mờ tiêu đề (⌘K)' })
  search(
    @CurrentUser() user: JwtUser,
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasks.search(
      user.id,
      wsId,
      q ?? '',
      limit ? Number(limit) : 20,
    );
  }

  @Get('tasks/by-key/:projectKey/:number')
  @ApiOperation({ summary: 'Task theo mã ST-12 (web dùng cho URL)' })
  byKey(
    @CurrentUser() user: JwtUser,
    @Param('projectKey') projectKey: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.tasks.getByKey(user.id, projectKey, number);
  }

  @Get('tasks/:id')
  @ApiOperation({
    summary:
      'Chi tiết task: subtask, người, kỹ năng, phụ thuộc, nhãn, đếm bình luận/tệp',
  })
  get(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.get(user.id, id);
  }

  @Patch('tasks/:id')
  @ApiOperation({
    summary:
      'Sửa trường; body phải có version (409 TASK_VERSION_CONFLICT khi lệch)',
  })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user.id, id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá mềm task và subtask (người tạo hoặc PM)' })
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tasks.remove(user.id, id);
  }

  @Patch('tasks/:id/move')
  @ApiOperation({
    summary:
      'Kéo thả: đổi cột/vị trí/sprint; kiểm WIP (422); cột hoàn thành đặt completed_at (UC-12)',
  })
  move(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasks.move(user.id, id, dto);
  }

  @Patch('tasks/:id/progress')
  @ApiOperation({
    summary: 'Cập nhật tiến độ % hoặc giờ còn lại (người thực hiện / PM)',
  })
  progress(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProgressDto,
  ) {
    return this.tasks.progress(user.id, id, dto);
  }

  @Put('tasks/:id/assignees')
  @ApiOperation({ summary: 'Thay người thực hiện (phải là thành viên dự án)' })
  assignees(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssigneesDto,
  ) {
    return this.tasks.setAssignees(user.id, id, dto);
  }

  @Put('tasks/:id/skills')
  @ApiOperation({ summary: 'Kỹ năng yêu cầu + mức tối thiểu' })
  skills(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskSkillsDto,
  ) {
    return this.tasks.setSkills(user.id, id, dto);
  }

  @Put('tasks/:id/labels')
  @ApiOperation({ summary: 'Nhãn của task' })
  labels(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskLabelsDto,
  ) {
    return this.tasks.setLabels(user.id, id, dto);
  }

  @Post('tasks/:id/subtasks')
  @ApiOperation({
    summary: 'Tạo subtask (một cấp); tiến độ cha tính từ subtask (UC-11)',
  })
  subtask(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.tasks.createSubtask(user.id, id, dto);
  }

  @Post('tasks/:id/duplicate')
  @ApiOperation({ summary: 'Sao chép task (tuỳ chọn kèm subtask) về cột đầu' })
  duplicate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateTaskDto,
  ) {
    return this.tasks.duplicate(user.id, id, dto);
  }
}
