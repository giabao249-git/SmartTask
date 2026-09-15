import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppError } from '../common/app-error';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { NotificationPrefsDto } from './dto/notification-prefs.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  shortName: true,
  avatarUrl: true,
  timezone: true,
  weeklyCapacityHours: true,
  notificationPrefs: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /me — hồ sơ + workspace của tôi kèm vai trò. */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...PUBLIC_USER_SELECT,
        workspaceMembers: {
          where: { workspace: { archivedAt: null } },
          select: {
            role: true,
            workspace: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!user) throw AppError.notFound();
    const { workspaceMembers, ...rest } = user;
    return {
      user: rest,
      workspaces: workspaceMembers.map((m) => ({
        ...m.workspace,
        role: m.role,
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName?.trim(),
        shortName: dto.shortName?.trim(),
        avatarUrl: dto.avatarUrl,
        timezone: dto.timezone,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new AppError('PASSWORD_MISMATCH', HttpStatus.BAD_REQUEST);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      // Đổi mật khẩu = đăng xuất mọi thiết bị khác.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async setNotificationPrefs(userId: string, dto: NotificationPrefsDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationPrefs: JSON.parse(
          JSON.stringify(dto),
        ) as Prisma.InputJsonObject,
      },
      select: { notificationPrefs: true },
    });
    return user.notificationPrefs;
  }
}
