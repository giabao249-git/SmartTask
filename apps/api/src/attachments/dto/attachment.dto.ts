import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_ATTACHMENT_BYTES } from '../storage/storage.provider';

export class SignAttachmentDto {
  @ApiProperty({ example: 'thiet-ke.png' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;
  @ApiProperty({ example: 'image/png' })
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/)
  mime!: string;
  @ApiProperty({ example: 123456, maximum: MAX_ATTACHMENT_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES, { message: 'ATTACHMENT_TOO_LARGE' })
  sizeBytes!: number;
}

export class ConfirmAttachmentDto extends SignAttachmentDto {
  @ApiProperty({ description: 'storagePath do bước sign trả về' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  storagePath!: string;
}
