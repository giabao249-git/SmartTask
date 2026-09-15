import { HttpStatus, Injectable } from '@nestjs/common';
import { InvitationStatus, WorkspaceRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AppError } from '../common/app-error';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInvitationDto } from './dto/workspace.dto';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Không gửi email trong phạm vi đồ án: trả về link để người mời tự gửi (Zalo, Slack…). */
  async create(
    workspaceId: string,
    inviterId: string,
    dto: CreateInvitationDto,
  ) {
    const role = dto.role ?? WorkspaceRole.MEMBER;
    if (role === WorkspaceRole.OWNER)
      throw AppError.forbidden({ hint: 'Không mời với vai OWNER' });
    if (dto.email) {
      const already = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, user: { email: dto.email } },
        select: { userId: true },
      });
      if (already)
        throw AppError.conflict('CONFLICT', {
          reason: 'Người này đã là thành viên',
        });
    }
    const days = dto.expiresInDays ?? 7;
    return this.prisma.invitation.create({
      data: {
        workspaceId,
        email: dto.email,
        role,
        token: randomBytes(24).toString('base64url'),
        invitedById: inviterId,
        expiresAt: new Date(Date.now() + days * 86_400_000),
      },
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async revoke(workspaceId: string, id: string): Promise<void> {
    const inv = await this.prisma.invitation.findFirst({
      where: { id, workspaceId },
    });
    if (!inv) throw AppError.notFound();
    await this.prisma.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });
  }

  /** Xem trước công khai: không lộ gì ngoài tên workspace, vai và người mời. */
  async preview(token: string) {
    const inv = await this.validToken(token);
    return {
      workspaceName: inv.workspace.name,
      workspaceSlug: inv.workspace.slug,
      role: inv.role,
      inviter: inv.invitedBy.fullName,
      email: inv.email,
      expiresAt: inv.expiresAt,
    };
  }

  /** Lời mời có email thì chỉ đúng tài khoản đó nhận được; đã là thành viên thì giữ vai cao hơn. */
  async accept(token: string, user: { id: string; email: string }) {
    const inv = await this.validToken(token);
    if (inv.email && inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw AppError.forbidden({ reason: 'Lời mời dành cho email khác' });
    }
    const member = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: inv.workspaceId, userId: user.id },
        },
      });
      const m = existing
        ? existing
        : await tx.workspaceMember.create({
            data: {
              workspaceId: inv.workspaceId,
              userId: user.id,
              role: inv.role,
            },
          });
      // Link mời chung dùng được nhiều lần cho tới khi hết hạn; lời mời đích danh dùng một lần.
      if (inv.email) {
        await tx.invitation.update({
          where: { id: inv.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        });
      }
      return m;
    });
    return {
      workspaceId: inv.workspaceId,
      slug: inv.workspace.slug,
      role: member.role,
    };
  }

  private async validToken(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { name: true, slug: true, archivedAt: true } },
        invitedBy: { select: { fullName: true } },
      },
    });
    if (
      !inv ||
      inv.status !== InvitationStatus.PENDING ||
      inv.expiresAt < new Date() ||
      inv.workspace.archivedAt
    ) {
      throw new AppError('INVITATION_EXPIRED', HttpStatus.GONE);
    }
    return inv;
  }
}
