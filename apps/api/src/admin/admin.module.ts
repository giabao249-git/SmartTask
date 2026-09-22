import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemAdminGuard } from '../common/guards/system-admin.guard';
import { PlatformStateService } from './platform-state.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminAuditService,
    SystemAdminGuard,
    PlatformStateService,
  ],
  exports: [
    AdminService,
    AdminAuditService,
    SystemAdminGuard,
    PlatformStateService,
  ],
})
export class AdminModule {}
