import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { SkillEvidenceService } from './skill-evidence.service';

@Module({
  providers: [MetricsService, SkillEvidenceService],
  exports: [MetricsService, SkillEvidenceService],
})
export class MetricsModule {}
