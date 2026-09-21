import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '@prisma/client';

export const IS_SYSTEM_ADMIN_KEY = 'isSystemAdmin';
export const PLATFORM_ROLES_KEY = 'platformRoles';

/** Yêu cầu người dùng là Super Admin của toàn nền tảng */
export const SystemAdmin = () => SetMetadata(IS_SYSTEM_ADMIN_KEY, true);

/** Yêu cầu người dùng có một trong các PlatformRole được chỉ định (hoặc ROOT_ADMIN) */
export const RequirePlatformRole = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);
