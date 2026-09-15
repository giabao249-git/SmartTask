import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/constants';
import { PrismaService } from '../src/prisma/prisma.service';

/** Dựng app y hệt main.ts (prefix, pipe, cookie) nhưng không listen cổng. */
export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export const uniqueEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;

/** Lấy cookie rt từ header set-cookie của supertest. */
export function extractCookie(
  res: { headers: Record<string, string | string[]> },
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0];
}
