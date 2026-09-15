import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class WorkloadQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-12',
    description: 'Tuần chứa ngày này là tuần đầu; mặc định hôm nay',
  })
  @IsOptional()
  @IsDateString()
  from?: string;
  @ApiPropertyOptional({ default: 4, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  weeks?: number;
  @ApiPropertyOptional({
    description:
      'Chỉ tính task của dự án này (tải vẫn là của người, xuyên dự án nếu bỏ trống)',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class WorkloadDetailsQueryDto {
  @ApiPropertyOptional({ example: '2026-10-12' })
  @IsOptional()
  @IsDateString()
  week?: string;
  @ApiPropertyOptional({
    description: 'Mặc định: workspace đầu tiên của người đó',
  })
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}

export class AckAlertDto {
  @ApiPropertyOptional({ example: 'Đã chuyển ST-12 sang Minh' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CapacityTableQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() sprintId?: string;
  @ApiPropertyOptional({
    type: [String],
    description: 'Chỉ các task này; mặc định = task chưa giao',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  taskIds?: string[];
}
