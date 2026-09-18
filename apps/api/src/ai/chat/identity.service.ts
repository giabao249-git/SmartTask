import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAliasDto, MemberIdentityDto } from '../dto/ai.dto';

/** Dữ liệu DANH TÍNH (docs 12 §2, §4): alias và chức danh/phòng ban/quản lý trên workspace_members — admin quản. */
@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  listAliases(workspaceId: string) {
    return this.prisma.memberAlias.findMany({
      where: { workspaceId },
      orderBy: [{ userId: 'asc' }, { alias: 'asc' }],
      select: {
        id: true,
        userId: true,
        alias: true,
        createdAt: true,
        user: { select: { fullName: true, shortName: true } },
      },
    });
  }

  async addAlias(
    workspaceId: string,
    createdById: string,
    dto: CreateAliasDto,
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: dto.userId } },
      select: { userId: true },
    });
    if (!member) throw AppError.notFound({ userId: dto.userId });
    try {
      return await this.prisma.memberAlias.create({
        data: {
          workspaceId,
          userId: dto.userId,
          alias: dto.alias,
          createdById,
        },
        select: { id: true, userId: true, alias: true, createdAt: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw AppError.conflict('CONFLICT', {
          alias: dto.alias,
          reason: 'Bí danh đã có trong workspace',
        });
      throw e;
    }
  }

  async removeAlias(workspaceId: string, id: string): Promise<void> {
    const r = await this.prisma.memberAlias.deleteMany({
      where: { id, workspaceId },
    });
    if (!r.count) throw AppError.notFound({ id });
  }

  async setIdentity(
    workspaceId: string,
    userId: string,
    dto: MemberIdentityDto,
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { userId: true },
    });
    if (!member) throw AppError.notFound({ userId });
    if (dto.managerUserId) {
      if (dto.managerUserId === userId)
        throw AppError.unprocessable('VALIDATION_FAILED', {
          fields: ['managerUserId không thể là chính mình'],
        });
      const mgr = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: dto.managerUserId },
        },
        select: { userId: true },
      });
      if (!mgr) throw AppError.notFound({ managerUserId: dto.managerUserId });
    }
    const updated = await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: {
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.managerUserId !== undefined
          ? { managerUserId: dto.managerUserId }
          : {}),
      },
      select: {
        userId: true,
        role: true,
        department: true,
        title: true,
        managerUserId: true,
        user: { select: { fullName: true, shortName: true } },
      },
    });
    return updated;
  }
}
