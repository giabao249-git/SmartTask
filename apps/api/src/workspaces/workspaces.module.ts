import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { InvitationsService } from './invitations.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [SkillsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, InvitationsService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
