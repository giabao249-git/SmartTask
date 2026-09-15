import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProjectRole, ProjectStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateProjectDto {
  @ApiProperty({
    example: 'ST',
    description: 'Mã dự án 2–6 chữ in hoa; mã task = ST-12',
  })
  @Transform(upper)
  @Matches(/^[A-Z][A-Z0-9]{1,5}$/, {
    message: 'key gồm 2–6 ký tự A-Z0-9, bắt đầu bằng chữ',
  })
  key!: string;

  @ApiProperty({ example: 'SmartTask' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional({ example: '2026-10-23' })
  @IsOptional()
  @IsDateString()
  startDate?: string;
  @ApiPropertyOptional({ example: '2026-11-27' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
  @ApiProperty({ description: 'Người làm PM (phải là thành viên workspace)' })
  @IsUUID()
  pmUserId!: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string | null;
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}

export class ProjectMemberItemDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty({ enum: ProjectRole }) @IsEnum(ProjectRole) role!: ProjectRole;
}

export class PutProjectMembersDto {
  @ApiProperty({
    type: [ProjectMemberItemDto],
    description: 'Thay toàn bộ; đúng một PM',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberItemDto)
  members!: ProjectMemberItemDto[];
}

export class ColumnItemDto {
  @ApiPropertyOptional({ description: 'Bỏ trống = cột mới' })
  @IsOptional()
  @IsUUID()
  id?: string;
  @ApiProperty({ example: 'Đang làm' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;
  @ApiProperty({ example: 'IN_PROGRESS' })
  @Transform(upper)
  @Matches(/^[A-Z][A-Z0-9_]{1,29}$/)
  statusKey!: string;
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  wipLimit?: number | null;
  @ApiPropertyOptional({
    description: 'Cột hoàn thành: kéo vào → completed_at',
  })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}

export class PutColumnsDto {
  @ApiProperty({
    type: [ColumnItemDto],
    description:
      'Thứ tự mảng = thứ tự cột; cột bị bỏ phải trống task; phải có đúng một cột isDone',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ColumnItemDto)
  columns!: ColumnItemDto[];
}

export class LabelDto {
  @ApiProperty({ example: 'Bug' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;
  @ApiPropertyOptional({ example: '#ef4444' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class UpdateLabelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
