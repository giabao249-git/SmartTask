import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { WorkloadController } from './workload.controller';
import { WorkloadListener } from './workload.listener';
import { WorkloadService } from './workload.service';

@Module({
  imports: [MetricsModule],
  controllers: [WorkloadController],
  providers: [WorkloadService, WorkloadListener],
  exports: [WorkloadService, MetricsModule],
})
export class WorkloadModule {}
