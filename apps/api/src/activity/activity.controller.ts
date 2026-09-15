import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectAccessService } from '../common/access/project-access.service';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVITY_SELECT = {
  id: true,
  taskId: true,
  action: true,
  diff: true,
  source: true,
  createdAt: true,
  actor: {
    select: { id: true, fullName: true, shortName: true, avatarUrl: true },
  },
  task: {
    select: { number: true, title: true, project: { select: { key: true } } },
  },
} as const;

@ApiTags('Nhật ký hoạt động')
@ApiBearerAuth()
@Controller()
export class ActivityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get('projects/:projectId/activity')
  @ApiQuery({ name: 'taskId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: 'Dòng hoạt động của dự án (UC-16)' })
  async project(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('taskId') taskId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    await this.access.assertRead(user.id, projectId);
    const where = { projectId, ...(taskId ? { taskId } : {}) };
    const take = Math.min(limit, 200);
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        select: ACTIVITY_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return {
      items: items.map((i) => ({
        ...i,
        taskKey: i.task ? `${i.task.project.key}-${i.task.number}` : null,
        task: i.task ? { title: i.task.title } : null,
      })),
      total,
      page,
      limit: take,
    };
  }

  @Get('tasks/:id/activity')
  @ApiOperation({ summary: 'Lịch sử thay đổi của một task' })
  async task(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const projectId = await this.access.projectOfTask(id);
    await this.access.assertRead(user.id, projectId);
    const items = await this.prisma.activityLog.findMany({
      where: { taskId: id },
      select: ACTIVITY_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return items.map((i) => ({ ...i, task: undefined }));
  }
}
