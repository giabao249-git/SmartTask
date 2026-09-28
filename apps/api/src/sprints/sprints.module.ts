import { Module } from '@nestjs/common';
import { ForecastModule } from '../forecast/forecast.module';
import { WorkloadModule } from '../workload/workload.module';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  imports: [ForecastModule, WorkloadModule],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
