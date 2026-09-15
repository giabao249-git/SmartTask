import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Dùng cho body có cấu trúc sâu/tuỳ biến (settings JSON, structured action của AI) — nơi class-validator
 * rườm rà. Lỗi trả về cùng dạng { code: VALIDATION_FAILED, details.fields } như ValidationPipe.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu gửi lên không hợp lệ',
        details: {
          fields: parsed.error.issues.map(
            (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
          ),
        },
      });
    }
    return parsed.data;
  }
}
