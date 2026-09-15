import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ForecastModule } from '../forecast/forecast.module';
import { WorkloadModule } from '../workload/workload.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeListener } from './realtime.listener';

@Module({
  imports: [JwtModule.register({}), WorkloadModule, ForecastModule],
  providers: [RealtimeGateway, RealtimeListener],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
