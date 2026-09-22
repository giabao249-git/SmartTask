import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import type { MaintenanceLevel } from './dto/admin.dto';

export interface MaintenanceState {
  mode: MaintenanceLevel;
  reason?: string;
  expectedDurationMinutes?: number;
  updatedAt: string;
  updatedBy?: string;
}

const KEY = 'maintenance';
const CACHE_MS = 5_000;
const DISABLED: MaintenanceState = {
  mode: 'DISABLED',
  updatedAt: new Date(0).toISOString(),
};

/**
 * Trạng thái bảo trì lưu ở bảng `platform_settings` (sống sót restart, đồng nhất khi chạy nhiều pod)
 * kèm cache 5 giây để guard không truy vấn mỗi request.
 */
@Injectable()
export class PlatformStateService {
  private cache: { value: MaintenanceState; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getMaintenance(force = false): Promise<MaintenanceState> {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_MS)
      return this.cache.value;
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: KEY },
    });
    const value = (row?.value as MaintenanceState | undefined) ?? DISABLED;
    this.cache = { value, at: Date.now() };
    return value;
  }

  async setMaintenance(state: MaintenanceState): Promise<MaintenanceState> {
    await this.prisma.platformSetting.upsert({
      where: { key: KEY },
      create: {
        key: KEY,
        value: state as unknown as Prisma.InputJsonValue,
        updatedBy: state.updatedBy,
      },
      update: {
        value: state as unknown as Prisma.InputJsonValue,
        updatedBy: state.updatedBy,
      },
    });
    this.cache = { value: state, at: Date.now() };
    return state;
  }
}
