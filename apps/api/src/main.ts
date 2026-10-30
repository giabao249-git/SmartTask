import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { API_PREFIX } from './config/constants';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet({ contentSecurityPolicy: false })); // Swagger UI cần inline script
  app.use(cookieParser());
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('SmartTask API')
    .setDescription(
      'Nền tảng quản trị dự án thông minh & cân bằng tải nhân sự tích hợp AI Agent — Đồ án chuyên ngành 841476. ' +
        'Đường dẫn theo docs/04-kien-truc/11-chot-chuc-nang-va-api.md.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('rt')
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(
    `API chạy tại http://localhost:${port}/${API_PREFIX} · Swagger: http://localhost:${port}/docs (hoặc /api/docs)`,
    'Bootstrap',
  );
}

// Chỉ tự khởi động khi chạy trực tiếp (node dist/main) — import từ test không mở cổng.
if (require.main === module) {
  void bootstrap();
}

export { bootstrap };
