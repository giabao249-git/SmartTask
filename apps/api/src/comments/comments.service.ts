import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectAccessService } from '../common/access/project-access.service';
import { AppError } from '../common/app-error';
import {
  COMMENT_EVENTS,
  type CommentEventPayload,
} from '../common/events/task.events';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateCommentDto,
  PageQueryDto,
  UpdateCommentDto,
} from './dto/comment.dto';

const COMMENT_SELECT = {
  id: true,
  taskId: true,
  parentId: true,
  body: true,
  editedAt: true,
  createdAt: true,
  author: {
    select: { id: true, fullName: true, shortName: true, avatarUrl: true },
  },
  mentions: {
    select: { user: { select: { id: true, fullName: true, shortName: true } } },
  },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
  ) {}

  async list(userId: string, taskId: string, q: PageQueryDto) {
    const projectId = await this.access.projectOfTask(taskId);
    await this.access.assertRead(userId, projectId);
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { taskId, deletedAt: null },
        select: COMMENT_SELECT,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.comment.count({ where: { taskId, deletedAt: null } }),
    ]);
    return { items: items.map(view), total, page, limit };
  }

  async create(userId: string, taskId: string, dto: CreateCommentDto) {
    const projectId = await this.access.projectOfTask(taskId);
    await this.access.assertEdit(userId, projectId);
    const mentions = await this.validMentions(
      projectId,
      dto.mentionUserIds ?? [],
    );
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, taskId, deletedAt: null },
        select: { parentId: true },
      });
      if (!parent) throw AppError.notFound({ parentId: dto.parentId });
      if (parent.parentId)
        throw AppError.unprocessable('VALIDATION_FAILED', {
          fields: ['chỉ trả lời một cấp'],
        });
    }
    const c = await this.prisma.comment.create({
      data: {
        taskId,
        authorId: userId,
        parentId: dto.parentId,
        body: dto.body,
        mentions: { create: mentions.map((id) => ({ userId: id })) },
      },
      select: COMMENT_SELECT,
    });
    this.emit(COMMENT_EVENTS.created, {
      projectId,
      taskId,
      commentId: c.id,
      actorId: userId,
      mentionedUserIds: mentions.filter((m) => m !== userId),
      at: c.createdAt,
    });
    return view(c);
  }

  async update(userId: string, commentId: string, dto: UpdateCommentDto) {
    const { c, projectId } = await this.loadOwn(userId, commentId, false);
    const mentions = dto.mentionUserIds
      ? await this.validMentions(projectId, dto.mentionUserIds)
      : null;
    const before = c.mentions.map((m) => m.user.id);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (mentions) {
        await tx.mention.deleteMany({ where: { commentId } });
        await tx.mention.createMany({
          data: mentions.map((id) => ({ commentId, userId: id })),
          skipDuplicates: true,
        });
      }
      return tx.comment.update({
        where: { id: commentId },
        data: { body: dto.body, editedAt: new Date() },
        select: COMMENT_SELECT,
      });
    });
    const newlyMentioned = mentions
      ? mentions.filter((id) => !before.includes(id) && id !== userId)
      : [];
    this.emit(COMMENT_EVENTS.updated, {
      projectId,
      taskId: c.taskId,
      commentId,
      actorId: userId,
      mentionedUserIds: newlyMentioned,
      at: new Date(),
    });
    return view(updated);
  }

  async remove(userId: string, commentId: string): Promise<void> {
    const { c, projectId } = await this.loadOwn(userId, commentId, true);
    await this.prisma.comment.updateMany({
      where: { OR: [{ id: commentId }, { parentId: commentId }] },
      data: { deletedAt: new Date() },
    });
    this.emit(COMMENT_EVENTS.deleted, {
      projectId,
      taskId: c.taskId,
      commentId,
      actorId: userId,
      mentionedUserIds: [],
      at: new Date(),
    });
  }

  /** Tác giả sửa/xoá bài mình; PM xoá được bài người khác (không sửa nội dung người khác). */
  private async loadOwn(userId: string, commentId: string, allowPm: boolean) {
    const c = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { ...COMMENT_SELECT, authorId: true },
    });
    if (!c) throw AppError.notFound();
    const projectId = await this.access.projectOfTask(c.taskId);
    const access = await this.access.assertEdit(userId, projectId);
    if (c.authorId !== userId && !(allowPm && access.canManage))
      throw AppError.forbidden({
        required: 'tác giả' + (allowPm ? ' hoặc PM' : ''),
      });
    return { c, projectId };
  }

  private async validMentions(
    projectId: string,
    ids: string[],
  ): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const n = await this.prisma.projectMember.count({
      where: { projectId, userId: { in: unique } },
    });
    if (n !== unique.length)
      throw AppError.unprocessable('ASSIGN_NOT_MEMBER', {
        reason: 'Chỉ nhắc thành viên dự án',
      });
    return unique;
  }

  private emit(name: string, p: CommentEventPayload): void {
    this.events.emit(name, p);
  }
}

function view(c: {
  id: string;
  taskId: string;
  parentId: string | null;
  body: string;
  editedAt: Date | null;
  createdAt: Date;
  author: unknown;
  mentions: { user: unknown }[];
}) {
  return {
    id: c.id,
    taskId: c.taskId,
    parentId: c.parentId,
    body: c.body,
    editedAt: c.editedAt,
    createdAt: c.createdAt,
    author: c.author,
    mentions: c.mentions.map((m) => m.user),
  };
}
