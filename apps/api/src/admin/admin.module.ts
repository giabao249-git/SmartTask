import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemAdminGuard } from '../common/guards/system-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuditService, SystemAdminGuard],
  exports: [AdminService, AdminAuditService, SystemAdminGuard],
})
export class AdminModule {}
