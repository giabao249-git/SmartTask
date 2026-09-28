import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/app-error';
import { ProjectAccessService } from '../common/access/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateTimeEntryDto,
  TaskReviewDto,
  UpdateTimeEntryDto,
} from './dto/worklog.dto';

const MAX_HOURS_PER_DAY = 24;
const day = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Nguồn bằng chứng cho hồ sơ kỹ năng & hiệu suất (docs 02/08): giờ làm thực tế (`time_entries`) và đánh giá
 * việc đã xong (`task_reviews`). Trước đây hai bảng có trong CSDL + hợp đồng docs 11 §3.6 nhưng 0 dòng mã,
 * nên EAR luôn suy từ cycle time và "rating" luôn trống.
 */
@Injectable()
export class WorklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  // ── Giờ làm ────────────────────────────────────────────────

  async listEntries(userId: string, taskId: string) {
    const projectId = await this.access.projectOfTask(taskId);
    const a = await this.access.assertRead(userId, projectId);
    const [task, rows] = await Promise.all([
      this.prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { estimateHours: true },
      }),
      this.prisma.timeEntry.findMany({
        where: { taskId },
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          userId: true,
          workDate: true,
          hours: true,
          note: true,
          source: true,
          createdAt: true,
          user: {
            select: { fullName: true, shortName: true, avatarUrl: true },
          },
        },
      }),
    ]);
    const entries = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      user: r.user,
      workDate: day(r.workDate),
      hours: Number(r.hours),
      note: r.note,
      source: r.source,
      createdAt: r.createdAt,
      canEdit: r.userId === userId || a.canManage,
    }));
    return {
      entries,
      totalHours: round2(entries.reduce((s, e) => s + e.hours, 0)),
      estimateHours:
        task.estimateHours == null ? null : Number(task.estimateHours),
    };
  }

  async createEntry(userId: string, taskId: string, dto: CreateTimeEntryDto) {
    const projectId = await this.access.projectOfTask(taskId);
    const a = await this.access.assertEdit(userId, projectId);
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { assignees: { select: { userId: true } } },
    });
    // Giờ là của người làm: chỉ người được giao ghi cho mình; PM ghi hộ thì vẫn đứng tên PM (không mạo danh)
    if (!a.canManage && !task.assignees.some((x) => x.userId === userId))
      throw AppError.forbidden({ required: 'người thực hiện hoặc PM' });
    const workDate = this.checkDate(dto.workDate);
    await this.checkDayTotal(userId, workDate, dto.hours);
    const row = await this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        workDate,
        hours: dto.hours,
        note: dto.note || null,
      },
      select: { id: true },
    });
    return { id: row.id, ...(await this.listEntries(userId, taskId)) };
  }

  async updateEntry(userId: string, entryId: string, dto: UpdateTimeEntryDto) {
    const e = await this.ownEntry(userId, entryId);
    const workDate = dto.workDate ? this.checkDate(dto.workDate) : e.workDate;
    if (dto.hours !== undefined || dto.workDate)
      await this.checkDayTotal(
        e.userId,
        workDate,
        dto.hours ?? Number(e.hours),
        entryId,
      );
    await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        workDate,
        ...(dto.hours !== undefined ? { hours: dto.hours } : {}),
        ...(dto.note !== undefined ? { note: dto.note || null } : {}),
      },
    });
    return this.listEntries(userId, e.taskId);
  }

  async deleteEntry(userId: string, entryId: string) {
    const e = await this.ownEntry(userId, entryId);
    await this.prisma.timeEntry.delete({ where: { id: entryId } });
    return this.listEntries(userId, e.taskId);
  }

  private async ownEntry(userId: string, entryId: string) {
    const e = await this.prisma.timeEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        taskId: true,
        userId: true,
        workDate: true,
        hours: true,
      },
    });
    if (!e) throw AppError.notFound({ entryId });
    const projectId = await this.access.projectOfTask(e.taskId);
    const a = await this.access.assertEdit(userId, projectId);
    if (e.userId !== userId && !a.canManage)
      throw AppError.forbidden({ required: 'người ghi hoặc PM' });
    return e;
  }

  private checkDate(iso: string): Date {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
    if (day(d) > day(new Date()))
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['workDate: không ghi giờ cho ngày tương lai'],
      });
    return d;
  }

  private async checkDayTotal(
    userId: string,
    workDate: Date,
    hours: number,
    exceptId?: string,
  ) {
    const agg = await this.prisma.timeEntry.aggregate({
      where: {
        userId,
        workDate,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      _sum: { hours: true },
    });
    const total = Number(agg._sum.hours ?? 0) + hours;
    if (total > MAX_HOURS_PER_DAY)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: [
          `hours: tổng ngày ${day(workDate)} thành ${round2(total)} h > ${MAX_HOURS_PER_DAY} h`,
        ],
      });
  }

  // ── Đánh giá việc đã xong ──────────────────────────────────

  /** Rating chỉ người được giao và PM xem được (docs 04 §2) — người khác nhận `visible: false`. */
  async getReview(userId: string, taskId: string) {
    const projectId = await this.access.projectOfTask(taskId);
    const a = await this.access.assertRead(userId, projectId);
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: {
        completedAt: true,
        assignees: { select: { userId: true } },
        review: {
          select: {
            rating: true,
            difficultyActual: true,
            actualHoursConfirmed: true,
            comment: true,
            createdAt: true,
            reviewer: { select: { id: true, fullName: true, shortName: true } },
          },
        },
      },
    });
    const isAssignee = task.assignees.some((x) => x.userId === userId);
    const visible = a.canManage || isAssignee;
    const r = task.review;
    return {
      visible,
      canReview: a.canManage && !a.projectArchived && !!task.completedAt,
      done: !!task.completedAt,
      review:
        visible && r
          ? {
              ...r,
              actualHoursConfirmed:
                r.actualHoursConfirmed == null
                  ? null
                  : Number(r.actualHoursConfirmed),
              // Tự chấm việc của mình: vẫn lưu nhưng hồ sơ kỹ năng không tính (docs 02/08)
              selfReview: task.assignees.some(
                (x) => x.userId === r.reviewer.id,
              ),
            }
          : null,
    };
  }

  async putReview(userId: string, taskId: string, dto: TaskReviewDto) {
    const projectId = await this.access.projectOfTask(taskId);
    await this.access.assertManage(userId, projectId);
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      select: { completedAt: true },
    });
    if (!task.completedAt)
      throw AppError.unprocessable('VALIDATION_FAILED', {
        fields: ['task: chỉ đánh giá việc đã xong'],
      });
    const data = {
      reviewerId: userId,
      rating: dto.rating,
      difficultyActual: dto.difficultyActual,
      actualHoursConfirmed:
        dto.actualHoursConfirmed === undefined
          ? null
          : new Prisma.Decimal(dto.actualHoursConfirmed),
      comment: dto.comment || null,
    };
    await this.prisma.taskReview.upsert({
      where: { taskId },
      create: { taskId, ...data },
      update: data,
    });
    return this.getReview(userId, taskId);
  }
}
