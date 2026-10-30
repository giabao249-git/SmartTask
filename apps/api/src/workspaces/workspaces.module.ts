import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { SkillsModule } from '../skills/skills.module';
import { WorkloadModule } from '../workload/workload.module';
import { InvitationsService } from './invitations.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [SkillsModule, WorkloadModule, AdminModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, InvitationsService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
