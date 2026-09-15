import { Global, Module } from '@nestjs/common';
import { WorkspaceAccessService } from './workspace-access.service';

/** Dịch vụ trả lời "ai có vai gì ở đâu" — global để guard và mọi module dùng mà không tạo phụ thuộc vòng. */
@Global()
@Module({
  providers: [WorkspaceAccessService],
  exports: [WorkspaceAccessService],
})
export class AccessModule {}
