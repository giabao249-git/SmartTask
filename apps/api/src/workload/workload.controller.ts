import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectAccessService } from '../common/access/project-access.service';
import { WorkspaceAccessService } from '../common/access/workspace-access.service';
import { AppError } from '../common/app-error';
import {
  CurrentUser,
  type JwtUser,
} from '../common/decorators/current-user.decorator';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  AckAlertDto,
  CapacityTableQueryDto,
  WorkloadDetailsQueryDto,
  WorkloadQueryDto,
} from './dto/workload.dto';
import { toDate, weekStartOf } from './domain/calendar';
import { WorkloadService } from './workload.service';
import type { UserWorkload } from './workload.types';

@ApiTags('Tải nhân sự')
@ApiBearerAuth()
@Controller()
export class WorkloadController {
  constructor(
    private readonly workload: WorkloadService,
    private readonly wsAccess: WorkspaceAccessService,
    private readonly access: ProjectAccessService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('workspaces/:wsId/workload')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiOperation({
    summary: 'Tải theo người × tuần toàn workspace (UC-24) — chỉ OWNER/ADMIN',
  })
  async workspace(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query() q: WorkloadQueryDto,
  ) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: wsId, role: { not: 'VIEWER' } },
      select: { userId: true },
    });
    const res = await this.workload.computeUsers(
      wsId,
      members.map((m) => m.userId),
      q.from ? toDate(q.from) : new Date(),
      q.weeks ?? 4,
      { projectId: q.projectId },
    );
    return {
      users: res.users.map(stripTasks),
      spread: res.spread,
      thresholds: res.settings.workload.thresholds,
    };
  }

  @Get('projects/:projectId/workload')
  @ApiOperation({
    summary:
      'Tải của thành viên dự án (mọi thành viên dự án xem được; chi tiết task chỉ của dự án này)',
  })
  async project(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: WorkloadQueryDto,
  ) {
    const a = await this.access.assertRead(user.id, projectId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const res = await this.workload.computeUsers(
      a.workspaceId,
      members.map((m) => m.userId),
      q.from ? toDate(q.from) : new Date(),
      q.weeks ?? 4,
    );
    // Tải là xuyên dự án; nhưng danh sách task cấu thành chỉ lộ task của dự án này (hoặc của chính mình)
    return {
      users: res.users.map((u) => ({
        ...u,
        weeks: u.weeks.map((w) => ({
          ...w,
          tasks:
            u.userId === user.id || a.canManage
              ? w.tasks.filter(
                  (t) => t.projectId === projectId || u.userId === user.id,
                )
              : [],
        })),
      })),
      spread: res.spread,
      thresholds: res.settings.workload.thresholds,
    };
  }

  @Get('users/:userId/workload/details')
  @ApiQuery({ name: 'week', required: false })
  @ApiOperation({
    summary:
      'Chi tiết một tuần: task cấu thành, giờ họp/nghỉ, breakdown burnout (chính mình hoặc PM/quản trị)',
  })
  async details(
    @CurrentUser() user: JwtUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() q: WorkloadDetailsQueryDto,
  ) {
    const wsId = q.workspaceId ?? (await this.defaultWorkspace(userId));
    if (user.id !== userId)
      await this.wsAccess.assertRole(user.id, wsId, ['OWNER', 'ADMIN']);
    else await this.wsAccess.assertRole(user.id, wsId, []);
    const from = q.week ? toDate(q.week) : new Date();
    const res = await this.workload.computeUsers(wsId, [userId], from, 1);
    const week = res.users[0]?.weeks[0];
    if (!week) throw AppError.notFound();
    const free = await this.workload.freeByDay(
      wsId,
      userId,
      weekStartOf(from),
      7,
    );
    return {
      ...week,
      freeByDay: free,
      thresholds: res.settings.workload.thresholds,
    };
  }

  @Get('workspaces/:wsId/workload/alerts')
  @WorkspaceRoles('OWNER', 'ADMIN')
  @ApiQuery({ name: 'open', required: false, type: Boolean })
  @ApiOperation({ summary: 'Cảnh báo quá tải/burnout (UC-25)' })
  alerts(
    @Param('wsId', ParseUUIDPipe) wsId: string,
    @Query('open') open?: string,
  ) {
    return this.prisma.workloadAlert.findMany({
      where: {
        workspaceId: wsId,
        ...(open === 'false' ? {} : { ackedAt: null }),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
            avatarUrl: true,
          },
        },
        ackedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ weekStart: 'desc' }, { riskScore: 'desc' }],
    });
  }

  @Post('workload/alerts/:id/ack')
  @ApiOperation({
    summary: 'PM/quản trị ghi nhận đã xử lý (đổi người, dời hạn…)',
  })
  async ack(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AckAlertDto,
  ) {
    const alert = await this.prisma.workloadAlert.findUnique({ where: { id } });
    if (!alert) throw AppError.notFound();
    await this.wsAccess.assertRole(user.id, alert.workspaceId, [
      'OWNER',
      'ADMIN',
    ]);
    return this.prisma.workloadAlert.update({
      where: { id },
      data: { ackedById: user.id, ackedAt: new Date(), ackNote: dto.note },
    });
  }

  @Post('projects/:projectId/workload/recompute')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Tính lại ngay tải của thành viên dự án (nút "Tính lại")',
  })
  async recompute(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const a = await this.access.assertManage(user.id, projectId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    return this.workload.snapshotWorkspace(
      a.workspaceId,
      members.map((m) => m.userId),
    );
  }

  @Get('projects/:projectId/capacity-table')
  @ApiOperation({
    summary:
      'Bảng sự thật cho giao việc (UC-26/39): kỹ năng, giờ trống theo ngày, EAR, khớp kỹ năng từng cặp — KHÔNG xếp hạng',
  })
  async capacity(
    @CurrentUser() user: JwtUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: CapacityTableQueryDto,
  ) {
    await this.access.assertManage(user.id, projectId);
    return this.workload.capacityTable(projectId, {
      sprintId: q.sprintId,
      taskIds: q.taskIds,
    });
  }

  private async defaultWorkspace(userId: string): Promise<string> {
    const m = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspace: { archivedAt: null } },
      orderBy: { joinedAt: 'asc' },
      select: { workspaceId: true },
    });
    if (!m) throw AppError.notFound();
    return m.workspaceId;
  }
}

function stripTasks(u: UserWorkload) {
  return {
    ...u,
    weeks: u.weeks.map(({ tasks, ...w }) => ({
      ...w,
      taskCount: tasks.length,
    })),
  };
}
