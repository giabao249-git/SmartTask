import { SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';

/**
 * Route có tham số :wsId — yêu cầu người gọi là thành viên workspace với một trong các vai này.
 * Không ghi vai = chỉ cần là thành viên (kể cả VIEWER).
 */
export const WorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);
