import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@smarttask/shared';

/**
 * Lỗi nghiệp vụ có mã. Service ném AppError; HttpExceptionFilter đổi thành { code, message, details }.
 * Không ném HttpException thô trong service để mã lỗi luôn nằm trong bảng dùng chung.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    status: HttpStatus,
    public readonly details?: unknown,
    message?: string,
  ) {
    super({ code, message: message ?? ERROR_CODES[code], details }, status);
  }

  static notFound(details?: unknown): AppError {
    return new AppError('NOT_FOUND', HttpStatus.NOT_FOUND, details);
  }

  static forbidden(details?: unknown): AppError {
    return new AppError('FORBIDDEN', HttpStatus.FORBIDDEN, details);
  }

  static conflict(code: ErrorCode, details?: unknown): AppError {
    return new AppError(code, HttpStatus.CONFLICT, details);
  }

  static unprocessable(code: ErrorCode, details?: unknown): AppError {
    return new AppError(code, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
