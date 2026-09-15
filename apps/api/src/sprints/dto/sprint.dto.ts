import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSprintDto {
  @ApiProperty({ example: 'Sprint 3' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
  @ApiPropertyOptional({ example: 'Hoàn thành luồng đăng nhập và Kanban' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  goal?: string;
  @ApiProperty({ example: '2026-10-13' }) @IsDateString() startDate!: string;
  @ApiProperty({ example: '2026-10-24' }) @IsDateString() endDate!: string;
}

export class UpdateSprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  goal?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
}

export class CloseSprintDto {
  @ApiProperty({
    example: 'backlog',
    description:
      '"backlog" hoặc id sprint PLANNED/ACTIVE cùng dự án để chuyển việc dở',
  })
  @IsString()
  moveOpenTo!: string;
}

export class AddSprintTasksDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  taskIds!: string[];
}
