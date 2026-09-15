import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { raw } from 'express';
import type { Env } from '../config/env.schema';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import {
  MAX_ATTACHMENT_BYTES,
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage/storage.provider';
import { SupabaseStorageProvider } from './storage/supabase-storage.provider';

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): StorageProvider => {
        const url = config.get('SUPABASE_URL', { infer: true });
        const key = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
        if (url && key)
          return new SupabaseStorageProvider(
            url,
            key,
            config.get('SUPABASE_STORAGE_BUCKET', { infer: true }),
          );
        const secret = config.get('JWT_ACCESS_SECRET', { infer: true });
        const base =
          config.get('API_PUBLIC_URL', { infer: true }) ??
          `http://localhost:${config.get('PORT', { infer: true })}/api/v1`;
        return new LocalStorageProvider(
          secret,
          base,
          config.get('UPLOAD_DIR', { infer: true }),
        );
      },
    },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule implements NestModule {
  /** Route upload cục bộ nhận thân yêu cầu thô (mọi Content-Type) tới 10 MB. */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES }))
      .forRoutes({
        path: 'attachments/local/*path',
        method: RequestMethod.PUT,
      });
  }
}
