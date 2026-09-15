import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@smarttask/shared';

/**
 * Mọi lỗi ra ngoài đều có dạng { code, message, details? } (docs/04-kien-truc/11 §2).
 * - AppError: giữ nguyên code.
 * - ValidationPipe (400): code VALIDATION_FAILED, details.fields = danh sách thông điệp.
 * - 401/403/404/429 của Nest: ánh xạ sang mã chung.
 * - Lỗi không lường: 500 INTERNAL, ghi log stack, không lộ chi tiết.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: { code: string; message: string; details?: unknown } = {
      code: 'INTERNAL',
      message: ERROR_CODES.INTERNAL,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'code' in payload
      ) {
        body = payload as typeof body;
      } else {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'message' in payload
            ? (payload as { message: string | string[] }).message
            : typeof payload === 'string'
              ? payload
              : JSON.stringify(payload);
        body = this.mapStatus(status, message);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Ràng buộc DB là tuyến phòng thủ cuối: unique → 409, FK/không tìm thấy → 404, còn lại 500.
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = {
          code: 'CONFLICT',
          message: ERROR_CODES.CONFLICT,
          details: { fields: exception.meta?.target },
        };
      } else if (exception.code === 'P2025' || exception.code === 'P2003') {
        status = HttpStatus.NOT_FOUND;
        body = { code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND };
      } else {
        this.logger.error(
          `${req.method} ${req.url} → Prisma ${exception.code}`,
          exception.message,
        );
      }
    } else {
      this.logger.error(
        `${req.method} ${req.url} → lỗi không lường`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(body);
  }

  private mapStatus(
    status: number,
    message: string | string[],
  ): { code: string; message: string; details?: unknown } {
    // So sánh số với số: HttpStatus là enum số, status đến từ exception.getStatus().
    const S = HttpStatus as unknown as Record<string, number>;
    switch (status) {
      case S.BAD_REQUEST:
        return {
          code: 'VALIDATION_FAILED',
          message: ERROR_CODES.VALIDATION_FAILED,
          details: { fields: Array.isArray(message) ? message : [message] },
        };
      case S.UNAUTHORIZED:
        return {
          code: 'UNAUTHENTICATED',
          message: ERROR_CODES.UNAUTHENTICATED,
        };
      case S.FORBIDDEN:
        return { code: 'FORBIDDEN', message: ERROR_CODES.FORBIDDEN };
      case S.NOT_FOUND:
        return { code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND };
      case S.TOO_MANY_REQUESTS:
        return { code: 'RATE_LIMITED', message: ERROR_CODES.RATE_LIMITED };
      default:
        return {
          code: 'INTERNAL',
          message: Array.isArray(message) ? message.join('; ') : message,
        };
    }
  }
}
