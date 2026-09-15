import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Hệ thống')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Tiến trình còn sống (dùng cho UptimeRobot)' })
  live(): { status: string; uptime: number; version: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Sẵn sàng phục vụ: kiểm tra kết nối CSDL' })
  async ready(): Promise<{ db: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { db: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'INTERNAL',
        message: 'CSDL chưa sẵn sàng',
      });
    }
  }
}
