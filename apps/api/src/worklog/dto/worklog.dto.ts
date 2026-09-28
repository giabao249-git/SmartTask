import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTimeEntryDto {
  @ApiProperty({
    example: '2026-09-28',
    description: 'Ngày làm (không ở tương lai)',
  })
  @IsDateString({ strict: true })
  workDate!: string;

  @ApiProperty({ example: 2.5, minimum: 0.25, maximum: 24 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  hours!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateTimeEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  workDate?: string;

  @ApiPropertyOptional({ minimum: 0.25, maximum: 24 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class TaskReviewDto {
  @ApiProperty({
    minimum: 1,
    maximum: 5,
    description: 'Chất lượng đầu ra, 3 = đạt yêu cầu',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({
    minimum: 1,
    maximum: 5,
    description: 'Độ khó thực tế (khác độ khó lúc lập kế hoạch)',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  difficultyActual!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 400 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(400)
  actualHoursConfirmed?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
